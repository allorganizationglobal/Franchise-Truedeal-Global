import { useState, useEffect } from 'react';
import {
  Building2,
  ShieldCheck,
  Clock,
  Printer,
  X,
  Lock,
  QrCode,
  Copy,
  Check,
  Info,
  AlertTriangle,
  CreditCard,
  ExternalLink,
  Loader2,
  LogIn
} from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import { FranchiseApplication, PaymentRecord, Currency } from '../../types/franchise';
import { FranchiseStorageService, getPlanById } from '../../services/storage';
import { calculateFeeBreakdownINR } from '../../config/complianceConfig';
import { NotificationService } from '../../services/notificationService';
import { playApprovalSuccessSound } from '../../utils/audio';
import { getFirebaseIdToken } from '../../services/firebase';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  application: FranchiseApplication;
  paymentType: 'application_fee' | 'franchise_deposit';
  amount: number;
  currency?: Currency;
  currentUser?: FirebaseUser | null;
  onSignInGoogle?: () => void;
  onPaymentSuccess?: (payment: PaymentRecord) => void;
  onNavigate?: (tab: string) => void;
}

interface PayUStatusConfig {
  configured: boolean;
  env: 'test' | 'production';
  checkoutUrl: string;
  missingEnvVars?: string[];
}

export function PaymentModal({
  isOpen,
  onClose,
  application,
  paymentType,
  amount,
  currency = 'INR',
  currentUser,
  onSignInGoogle,
  onPaymentSuccess,
  onNavigate
}: PaymentModalProps) {
  const config = FranchiseStorageService.getComplianceConfig();
  const plan = getPlanById(application.planId);
  const feeBreakdown = calculateFeeBreakdownINR(amount, config);

  const [activeMode, setActiveMode] = useState<'payu_hosted' | 'bank_upi'>('payu_hosted');
  const [payuConfig, setPayuConfig] = useState<PayUStatusConfig | null>(null);
  const [loadingPayuConfig, setLoadingPayuConfig] = useState(false);
  const [initiatingPayu, setInitiatingPayu] = useState(false);
  const [payuError, setPayuError] = useState<string | null>(null);
  const [payuPolicyAccepted, setPayuPolicyAccepted] = useState(false);

  const [selectedQrTab, setSelectedQrTab] = useState<'bob' | 'idbi'>('bob');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [utrNumber, setUtrNumber] = useState<string>('');
  const [billingName, setBillingName] = useState(application.applicant.fullName);
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [submittedPayment, setSubmittedPayment] = useState<PaymentRecord | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setLoadingPayuConfig(true);
    fetch('/api/payments/payu/status?mode=config')
      .then((res) => res.json())
      .then((data) => {
        if (active && data?.config) {
          setPayuConfig({
            configured: Boolean(data.config.configured),
            env: data.config.env === 'production' ? 'production' : 'test',
            checkoutUrl: String(data.config.checkoutUrl || 'https://test.payu.in/_payment'),
            missingEnvVars: Array.isArray(data.config.missingEnvVars) ? data.config.missingEnvVars : []
          });
        }
      })
      .catch(() => {
        if (active) setPayuConfig(null);
      })
      .finally(() => {
        if (active) setLoadingPayuConfig(false);
      });
    return () => {
      active = false;
    };
  }, [isOpen]);

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2500);
  };

  if (!isOpen) return null;

  const currencySymbol = currency === 'INR' ? '₹' : '$';
  const totalPayable = currency === 'INR' ? feeBreakdown.totalPayableINR : amount;

  const handleLaunchPayUCheckout = async () => {
    setPayuError(null);

    if (!currentUser) {
      setPayuError('Please sign in with your Google account first so your payment is securely bound to your verified applicant identity.');
      return;
    }

    if (!payuPolicyAccepted) {
      setPayuError('Please confirm that you have reviewed the Refund Policy, Cancellation Policy, and Terms & Conditions before proceeding to PayU Hosted Checkout.');
      return;
    }

    if (!application.id || application.id === 'PENDING') {
      setPayuError('Please submit your application first to obtain an official Application Reference ID before initiating PayU Hosted Checkout.');
      return;
    }

    setInitiatingPayu(true);
    try {
      const idToken = await getFirebaseIdToken();
      if (!idToken) {
        setPayuError('Unable to obtain a valid Firebase authentication token. Please sign out and sign in again.');
        setInitiatingPayu(false);
        return;
      }

      const response = await fetch('/api/payments/payu/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({
          applicationId: application.id,
          planId: application.planId,
          applicantName: application.applicant.fullName,
          phone: application.applicant.phone
        })
      });

      const data = await response.json();

      if (!response.ok || !data?.ok || !data?.checkoutUrl || !data?.formFields) {
        setPayuError(
          data?.message ||
            (response.status === 503
              ? 'PayU India Hosted Checkout credentials are not yet activated on this server (account currently under verification).'
              : 'Could not initiate PayU Hosted Checkout. Please try again or contact support.')
        );
        setInitiatingPayu(false);
        return;
      }

      // Persist initiated PAYMENT_PENDING record locally so tracker reflects it immediately
      if (data.payment?.txnId) {
        const pendingRecord: PaymentRecord = {
          id: data.payment.paymentId || `pay_${data.payment.txnId}`,
          applicationId: application.id,
          type: paymentType,
          amount: data.payment.amount,
          currency: 'INR',
          method: 'payu_hosted',
          status: 'processing',
          payuStatus: 'PAYMENT_PENDING',
          txnId: data.payment.txnId,
          transactionHash: data.payment.txnId,
          referenceCode: data.payment.txnId,
          timestamp: data.payment.createdAt || new Date().toISOString(),
          receiptNumber: 'PENDING-PAYU-VERIFICATION',
          billingName: application.applicant.fullName,
          gstAmount: data.payment.gstAmountINR || 0,
          totalWithGst: data.payment.amount
        };
        FranchiseStorageService.addPayment(application.id, pendingRecord);
      }

      // Dynamically construct and submit official PayU Hosted Checkout POST form
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = data.checkoutUrl;
      form.style.display = 'none';

      Object.entries(data.formFields as Record<string, string>).forEach(([fieldName, fieldVal]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = fieldName;
        input.value = String(fieldVal ?? '');
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();
    } catch (err: any) {
      setPayuError(err?.message || 'Network error while connecting to the payment initiation endpoint.');
      setInitiatingPayu(false);
    }
  };

  const handleSubmitReference = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!billingName.trim() || billingName.trim().length < 2) {
      setFormError('Please enter the payer / billing name matching your bank transfer.');
      return;
    }

    if (!utrNumber.trim() || utrNumber.trim().length < 6) {
      setFormError('Please enter a valid UTR / IMPS / NEFT / UPI transaction reference number (at least 6 characters).');
      return;
    }

    if (!policyAccepted) {
      setFormError('Please confirm that you have reviewed the Refund Policy, Cancellation Policy, and Terms & Conditions.');
      return;
    }

    setProcessing(true);
    const effectiveRef = utrNumber.trim().toUpperCase();

    setTimeout(() => {
      setProcessing(false);
      // Offline bank/UPI references are ALWAYS recorded as 'processing' pending manual bank statement verification.
      const newPayment: PaymentRecord = {
        id: 'pay_' + Math.random().toString(36).substring(2, 9),
        applicationId: application.id,
        type: paymentType,
        amount: totalPayable,
        currency,
        method: 'upi_bank_transfer',
        status: 'processing',
        payuStatus: 'PAYMENT_PENDING',
        transactionHash:
          'ref_' +
          Array.from(crypto.getRandomValues(new Uint8Array(10)))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join(''),
        referenceCode: effectiveRef,
        timestamp: new Date().toISOString(),
        receiptNumber: 'REF-2026-' + Math.floor(1000 + Math.random() * 9000),
        billingName: billingName.trim(),
        gstAmount: currency === 'INR' ? feeBreakdown.gstAmountINR : 0,
        totalWithGst: totalPayable
      };

      FranchiseStorageService.addPayment(application.id, newPayment);

      FranchiseStorageService.updateApplicationStatus(
        application.id,
        application.status,
        application.applicant.email,
        'applicant',
        `Bank Transfer / UPI reference "${effectiveRef}" submitted for ${currencySymbol}${totalPayable.toLocaleString('en-IN')}. Status: Pending manual bank statement reconciliation.`
      );

      NotificationService.addNotification(
        `Payment Reference Submitted (${currencySymbol}${totalPayable.toLocaleString('en-IN')} ${currency})`,
        `Reference ${newPayment.referenceCode} recorded as Pending Bank Verification. Our accounts team reconciles bank credits within 1–2 business days.`,
        'info',
        application.id
      );

      playApprovalSuccessSound();
      setSubmittedPayment(newPayment);
      onPaymentSuccess?.(newPayment);
    }, 500);
  };

  const handlePolicyJump = (tab: string) => {
    onClose();
    onNavigate?.(tab);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm">
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-7 max-h-[92vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
          aria-label="Close payment modal"
        >
          <X className="w-5 h-5" />
        </button>

        {!submittedPayment ? (
          <div className="space-y-5">
            {/* Pre-Payment Summary Header */}
            <div className="pb-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-start justify-between gap-4 pr-6">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    {config.legalName}
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {paymentType === 'application_fee' ? 'Application Verification Fee' : 'Franchise Package Fee'}
                  </h3>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    App #{application.id} · {plan?.title || application.planId}
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Authoritative Amount (INR)</span>
                  <span className="text-2xl font-black font-mono tabular-nums text-slate-900 dark:text-slate-100">
                    ₹{feeBreakdown.totalPayableINR.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Transparent Tax Breakdown */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Base Franchise Package Fee</span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                    ₹{feeBreakdown.baseFeeINR.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tax / GST Treatment</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {feeBreakdown.gstAmountINR > 0
                      ? `₹${feeBreakdown.gstAmountINR.toLocaleString('en-IN')} (${feeBreakdown.gstRatePercent}% GST)`
                      : feeBreakdown.gstLabel}
                  </span>
                </div>
                {plan?.validity && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">License Validity</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">{plan.validity}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Channel Tabs: PayU India Hosted Checkout vs Corporate Bank / UPI */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveMode('payu_hosted')}
                className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeMode === 'payu_hosted'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>PayU Hosted Checkout</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveMode('bank_upi')}
                className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeMode === 'bank_upi'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Corporate Bank / UPI</span>
              </button>
            </div>

            {activeMode === 'payu_hosted' ? (
              <div className="space-y-4">
                {/* PayU Security & Environment Banner */}
                <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <span>PayU India Official Hosted Checkout</span>
                    </span>
                    {loadingPayuConfig ? (
                      <span className="text-[10px] font-mono text-slate-500">Checking gateway...</span>
                    ) : payuConfig?.configured ? (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 uppercase">
                        {payuConfig.env === 'production' ? 'LIVE READY' : 'TEST SANDBOX READY'}
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 uppercase">
                        PENDING ACTIVATION
                      </span>
                    )}
                  </div>
                  <p className="text-indigo-900/90 dark:text-indigo-200/90 leading-relaxed">
                    You will be redirected to PayU India&apos;s PCI-DSS hosted checkout page for UPI, NetBanking, Debit/Credit
                    Cards, and Wallets. Amount and SHA-512 cryptographic signature are calculated strictly on our server.
                    This portal never collects or stores card numbers, CVV, or OTP.
                  </p>
                </div>

                {/* Gateway Pending Activation Honest Notice */}
                {!loadingPayuConfig && payuConfig && !payuConfig.configured && (
                  <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-2 text-xs text-amber-950 dark:text-amber-200">
                    <div className="flex items-center gap-2 font-bold">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>PayU Merchant Account Verification In Progress</span>
                    </div>
                    <p className="leading-relaxed">
                      Server-side PayU Classic Hosted Checkout integration is complete, and merchant credentials
                      (<code className="font-mono">PAYU_MERCHANT_KEY</code> / <code className="font-mono">PAYU_MERCHANT_SALT</code>)
                      are awaiting PayU activation. Once configured in Vercel environment variables, online checkout
                      activates automatically without code changes.
                    </p>
                  </div>
                )}

                {/* Authentication Check */}
                {!currentUser && (
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="space-y-0.5">
                      <span className="font-bold text-slate-900 dark:text-white block">
                        Google Sign-In Required for Online Payment
                      </span>
                      <span className="text-slate-500 dark:text-slate-400">
                        Sign in to cryptographically bind your PayU order &amp; receipt to your applicant account.
                      </span>
                    </div>
                    {onSignInGoogle && (
                      <button
                        type="button"
                        onClick={onSignInGoogle}
                        className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
                      >
                        <LogIn className="w-3.5 h-3.5" />
                        <span>Sign In</span>
                      </button>
                    )}
                  </div>
                )}

                {payuError && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 font-medium">
                    {payuError}
                  </div>
                )}

                {/* Policy Acknowledgement */}
                <label className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={payuPolicyAccepted}
                    onChange={(e) => setPayuPolicyAccepted(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>
                    I understand payment confirmation is verified server-side via PayU before receipt issuance, and I agree to the{' '}
                    <button type="button" onClick={() => handlePolicyJump('refund')} className="text-indigo-600 dark:text-indigo-400 underline font-semibold cursor-pointer">
                      Refund Policy
                    </button>
                    ,{' '}
                    <button type="button" onClick={() => handlePolicyJump('cancellation')} className="text-indigo-600 dark:text-indigo-400 underline font-semibold cursor-pointer">
                      Cancellation Policy
                    </button>
                    , and{' '}
                    <button type="button" onClick={() => handlePolicyJump('terms')} className="text-indigo-600 dark:text-indigo-400 underline font-semibold cursor-pointer">
                      Terms &amp; Conditions
                    </button>
                    .
                  </span>
                </label>

                <button
                  type="button"
                  disabled={initiatingPayu || !currentUser || (payuConfig !== null && !payuConfig.configured)}
                  onClick={handleLaunchPayUCheckout}
                  className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                >
                  {initiatingPayu ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Signing Order &amp; Redirecting to PayU...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>
                        Proceed to PayU Hosted Checkout (₹{feeBreakdown.totalPayableINR.toLocaleString('en-IN')} INR)
                      </span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitReference} className="space-y-4">
                {formError && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 font-medium">
                    {formError}
                  </div>
                )}

                {/* Official Corporate Bank Account Box */}
                <div className="p-4 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                    <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-indigo-500" />
                      <span>Official Corporate Bank Account</span>
                    </span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                      {config.bankDetails.accountType.toUpperCase()}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Beneficiary Name</span>
                      <div className="flex items-center gap-1 font-bold text-slate-900 dark:text-white">
                        <span>{config.bankDetails.beneficiaryName}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(config.bankDetails.beneficiaryName, 'name')}
                          className="text-indigo-600 p-0.5 cursor-pointer"
                          title="Copy Beneficiary"
                        >
                          {copiedField === 'name' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Bank Name &amp; Branch</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {config.bankDetails.bankName} ({config.bankDetails.branchName})
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Account Number</span>
                      <div className="flex items-center gap-1 font-mono font-bold text-slate-900 dark:text-white">
                        <span>{config.bankDetails.accountNumber}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(config.bankDetails.accountNumber, 'ac')}
                          className="text-indigo-600 p-0.5 cursor-pointer"
                          title="Copy Account Number"
                        >
                          {copiedField === 'ac' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">IFSC Code</span>
                      <div className="flex items-center gap-1 font-mono font-bold text-slate-900 dark:text-white">
                        <span>{config.bankDetails.ifscCode}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(config.bankDetails.ifscCode, 'ifsc')}
                          className="text-indigo-600 p-0.5 cursor-pointer"
                          title="Copy IFSC Code"
                        >
                          {copiedField === 'ifsc' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Verified Indian Bank UPI QRs Only */}
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                        <QrCode className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Corporate Bank UPI QR:</span>
                      </span>
                      <div className="inline-flex p-0.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setSelectedQrTab('bob')}
                          className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                            selectedQrTab === 'bob' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs' : 'text-slate-500'
                          }`}
                        >
                          Bank of Baroda
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedQrTab('idbi')}
                          className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                            selectedQrTab === 'idbi' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs' : 'text-slate-500'
                          }`}
                        >
                          IDBI Bank
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-center">
                      <img
                        src={selectedQrTab === 'bob' ? '/assets/bank_of_baroda_qr.png' : '/assets/idbi_qr.png'}
                        alt={selectedQrTab === 'bob' ? 'Bank of Baroda Corporate UPI QR' : 'IDBI Bank Corporate UPI QR'}
                        className="w-40 h-40 object-contain rounded-xl bg-white p-2 border border-slate-200"
                      />
                    </div>
                  </div>
                </div>

                {/* Payer Name & UTR Reference */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Payer / Billing Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={billingName}
                      onChange={(e) => setBillingName(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      UTR / NEFT / IMPS / UPI Reference No *
                    </label>
                    <input
                      type="text"
                      required
                      value={utrNumber}
                      onChange={(e) => setUtrNumber(e.target.value)}
                      placeholder="e.g. 429182049102"
                      className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <label className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={policyAccepted}
                    onChange={(e) => setPolicyAccepted(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>
                    I understand this bank reference will be manually verified against corporate bank statements before
                    final receipt issuance, and I agree to the{' '}
                    <button type="button" onClick={() => handlePolicyJump('refund')} className="text-indigo-600 dark:text-indigo-400 underline font-semibold cursor-pointer">
                      Refund Policy
                    </button>
                    ,{' '}
                    <button type="button" onClick={() => handlePolicyJump('cancellation')} className="text-indigo-600 dark:text-indigo-400 underline font-semibold cursor-pointer">
                      Cancellation Policy
                    </button>
                    , and{' '}
                    <button type="button" onClick={() => handlePolicyJump('terms')} className="text-indigo-600 dark:text-indigo-400 underline font-semibold cursor-pointer">
                      Terms &amp; Conditions
                    </button>
                    .
                  </span>
                </label>

                <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/30 rounded-xl border border-indigo-200 dark:border-indigo-800/60 flex items-start gap-2 text-[11px] text-indigo-900 dark:text-indigo-200">
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Submitting a UTR logs your payment in <strong>Pending Bank Verification</strong> status. Official
                    activation occurs only after accounts reconciliation and Franchise Agreement execution.
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={processing}
                  className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {processing ? (
                    <span>Recording Payment Reference...</span>
                  ) : (
                    <span>Submit Bank Reference for Verification ({currencySymbol}{totalPayable.toLocaleString('en-IN')})</span>
                  )}
                </button>
              </form>
            )}
          </div>
        ) : (
          <div className="py-2 text-center space-y-5">
            <div className="w-14 h-14 bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto">
              <Clock className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Payment Reference Submitted — Pending Bank Verification
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Tracking Ref #{submittedPayment.receiptNumber} · Accounts reconciliation takes 1–2 business days.
              </p>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5 text-xs text-left">
              <div className="flex justify-between">
                <span className="text-slate-500">Beneficiary Entity</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{config.legalName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Corporate Bank</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {config.bankDetails.bankName} · A/C {config.bankDetails.accountNumber}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Declared Amount</span>
                <span className="font-bold font-mono text-slate-900 dark:text-slate-100">
                  {currencySymbol}{submittedPayment.amount.toLocaleString('en-IN')} {submittedPayment.currency}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">UTR / Bank Reference</span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{submittedPayment.referenceCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Current Verification Status</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">Pending Manual Reconciliation</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Submitted At</span>
                <span className="text-slate-900 dark:text-slate-100">
                  {new Date(submittedPayment.timestamp).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-slate-500 justify-center">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>An official tax invoice/confirmation is issued only after bank settlement is verified.</span>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2.5 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Acknowledgement</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl cursor-pointer"
              >
                Return to Portal
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
