import { useState } from 'react';
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
  AlertTriangle
} from 'lucide-react';
import { FranchiseApplication, PaymentRecord, Currency } from '../../types/franchise';
import { FranchiseStorageService, getPlanById } from '../../services/storage';
import { calculateFeeBreakdownINR } from '../../config/complianceConfig';
import { NotificationService } from '../../services/notificationService';
import { playApprovalSuccessSound } from '../../utils/audio';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  application: FranchiseApplication;
  paymentType: 'application_fee' | 'franchise_deposit';
  amount: number;
  currency?: Currency;
  onPaymentSuccess?: (payment: PaymentRecord) => void;
  onNavigate?: (tab: string) => void;
}

export function PaymentModal({
  isOpen,
  onClose,
  application,
  paymentType,
  amount,
  currency = 'INR',
  onPaymentSuccess,
  onNavigate
}: PaymentModalProps) {
  const config = FranchiseStorageService.getComplianceConfig();
  const plan = getPlanById(application.planId);
  const feeBreakdown = calculateFeeBreakdownINR(amount, config);

  // Two clear modes: Direct Corporate Bank Transfer / UPI Reference OR Online Razorpay Readiness Status (Disabled pending approval)
  const [activeMode, setActiveMode] = useState<'bank_upi' | 'razorpay_pending'>('bank_upi');
  const [selectedQrTab, setSelectedQrTab] = useState<'bob' | 'idbi'>('bob');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [utrNumber, setUtrNumber] = useState<string>('');
  const [billingName, setBillingName] = useState(application.applicant.fullName);
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [submittedPayment, setSubmittedPayment] = useState<PaymentRecord | null>(null);

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2500);
  };

  if (!isOpen) return null;

  const currencySymbol = currency === 'INR' ? '₹' : '$';
  const totalPayable = currency === 'INR' ? feeBreakdown.totalPayableINR : amount;

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
    }, 600);
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
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Total Payable ({currency})</span>
                  <span className="text-2xl font-black font-mono tabular-nums text-slate-900 dark:text-slate-100">
                    {currencySymbol}{totalPayable.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Transparent Tax Breakdown */}
              {currency === 'INR' && (
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
                </div>
              )}
            </div>

            {/* Channel Tabs: Verified Bank/UPI Reference vs Online Gateway (Razorpay Pending) */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
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
              <button
                type="button"
                onClick={() => setActiveMode('razorpay_pending')}
                className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeMode === 'razorpay_pending'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Online Gateway (Razorpay)</span>
              </button>
            </div>

            {activeMode === 'razorpay_pending' ? (
              <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-3 text-xs text-amber-950 dark:text-amber-200">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Online Payment Gateway Verification in Progress</span>
                </div>
                <p className="leading-relaxed">
                  Online Card, UPI Intent, and NetBanking checkout via <strong>Razorpay</strong> is currently disabled
                  while {config.legalName} completes merchant verification and KYC onboarding.
                </p>
                <p className="leading-relaxed">
                  For security and PCI-DSS compliance, this portal never collects raw card numbers or CVV codes directly.
                  Once Razorpay verification is approved, live hosted checkout with server-side HMAC signature
                  verification will be enabled here.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveMode('bank_upi')}
                    className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs cursor-pointer"
                  >
                    Use Verified Corporate Bank Transfer Reference Instead
                  </button>
                </div>
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
                      <span className="text-[10px] text-slate-400 block">Bank Name & Branch</span>
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

                  {/* Verified Indian Bank UPI QRs Only (NO crypto/Binance) */}
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

                {/* Explicit Policy Acknowledgement */}
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
                      Terms & Conditions
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
          /* Honest Pending Verification Acknowledgement Screen */
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
