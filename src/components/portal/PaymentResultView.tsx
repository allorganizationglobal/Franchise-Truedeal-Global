import { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  Printer,
  ArrowRight,
  ShieldCheck,
  LogIn,
  CreditCard
} from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import { getFirebaseIdToken } from '../../services/firebase';
import { FranchiseStorageService } from '../../services/storage';
import { PayUPaymentStatus, PaymentRecord } from '../../types/franchise';
import { PaymentModal } from '../common/PaymentModal';

interface PaymentResultViewProps {
  currentUser?: FirebaseUser | null;
  onSignInGoogle?: () => void;
  onNavigateToTracker: (applicationId: string) => void;
  onNavigate: (tab: string) => void;
  onRefresh: () => void;
}

interface VerifiedPaymentPayload {
  paymentId: string;
  applicationId: string;
  userId: string;
  applicantName: string;
  email: string;
  franchisePlanId: string;
  franchisePlanName: string;
  txnId: string;
  payuTransactionId?: string;
  amount: number;
  formattedAmount: string;
  currency: 'INR';
  paymentStatus: PayUPaymentStatus;
  paymentMethod?: string;
  bankRefNum?: string;
  receiptNumber?: string;
  errorMessage?: string;
  verifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export function PaymentResultView({
  currentUser,
  onSignInGoogle,
  onNavigateToTracker,
  onNavigate,
  onRefresh
}: PaymentResultViewProps) {
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const txnid = params.get('txnid') || '';
  const applicationIdParam = params.get('applicationId') || '';
  const reasonParam = params.get('reason') || '';

  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [payment, setPayment] = useState<VerifiedPaymentPayload | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showRetryModal, setShowRetryModal] = useState(false);

  const complianceConfig = FranchiseStorageService.getComplianceConfig();

  const syncVerifiedPaymentToLocalApp = useCallback(
    (p: VerifiedPaymentPayload) => {
      const apps = FranchiseStorageService.getApplications();
      const target = apps.find((a) => a.id === p.applicationId);
      if (!target) return;

      const mappedStatus: PaymentRecord['status'] =
        p.paymentStatus === 'SUCCESS'
          ? 'completed'
          : p.paymentStatus === 'FAILED' || p.paymentStatus === 'CANCELLED' || p.paymentStatus === 'EXPIRED'
          ? 'failed'
          : 'processing';

      const existingIdx = target.payments.findIndex((x) => x.txnId === p.txnId || x.referenceCode === p.txnId);
      const updatedPay: PaymentRecord = {
        id: p.paymentId,
        applicationId: p.applicationId,
        type: 'franchise_deposit',
        amount: p.amount,
        currency: 'INR',
        method: 'payu_hosted',
        status: mappedStatus,
        payuStatus: p.paymentStatus,
        txnId: p.txnId,
        payuTransactionId: p.payuTransactionId,
        paymentMethod: p.paymentMethod,
        verifiedAt: p.verifiedAt,
        transactionHash: p.payuTransactionId || p.txnId,
        referenceCode: p.txnId,
        timestamp: p.verifiedAt || p.updatedAt || p.createdAt,
        receiptNumber: p.receiptNumber || 'PENDING-VERIFICATION',
        billingName: p.applicantName,
        totalWithGst: p.amount
      };

      const updatedPayments = [...target.payments];
      if (existingIdx >= 0) {
        updatedPayments[existingIdx] = updatedPay;
      } else {
        updatedPayments.push(updatedPay);
      }

      target.payments = updatedPayments;
      target.paymentStatus = p.paymentStatus;
      target.txnId = p.txnId;
      target.payuTransactionId = p.payuTransactionId;
      if (p.paymentStatus === 'SUCCESS' && (target.status === 'PAYMENT_PENDING' || target.status === 'draft')) {
        target.status = 'submitted';
      }
      target.updatedAt = new Date().toISOString();
      FranchiseStorageService.saveApplication(target);
      onRefresh();
    },
    [onRefresh]
  );

  const fetchAuthoritativeStatus = useCallback(async () => {
    if (!txnid) {
      setErrorMsg('No PayU transaction ID was provided in the return URL.');
      setLoading(false);
      return;
    }

    if (!currentUser) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const idToken = await getFirebaseIdToken();
      if (!idToken) {
        setErrorMsg('Please sign in to fetch your verified payment status.');
        setLoading(false);
        return;
      }

      const res = await fetch(`/api/payments/payu/status?txnid=${encodeURIComponent(txnid)}`, {
        headers: { Authorization: `Bearer ${idToken}` }
      });
      const data = await res.json();

      if (!res.ok || !data?.ok || !data?.payment) {
        setErrorMsg(data?.message || 'Unable to verify payment record from server.');
        setPayment(null);
      } else {
        setPayment(data.payment);
        syncVerifiedPaymentToLocalApp(data.payment);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Network error while verifying payment status.');
    } finally {
      setLoading(false);
    }
  }, [txnid, currentUser, syncVerifiedPaymentToLocalApp]);

  useEffect(() => {
    fetchAuthoritativeStatus();
  }, [fetchAuthoritativeStatus]);

  const handleManualReconcile = async () => {
    if (!txnid || !currentUser) return;
    setVerifying(true);
    setErrorMsg(null);
    try {
      const idToken = await getFirebaseIdToken();
      if (!idToken) return;
      const res = await fetch('/api/payments/payu/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({ txnid })
      });
      const data = await res.json();
      if (data?.payment) {
        setPayment(data.payment);
        syncVerifiedPaymentToLocalApp(data.payment);
      }
      if (!data?.ok) {
        setErrorMsg(data?.message || 'PayU verify_payment API could not confirm transaction yet.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not contact PayU verification endpoint.');
    } finally {
      setVerifying(false);
    }
  };

  const linkedApp = FranchiseStorageService.getApplications().find(
    (a) => a.id === (payment?.applicationId || applicationIdParam)
  );

  const isSuccess = payment?.paymentStatus === 'SUCCESS';
  const isFailed =
    payment?.paymentStatus === 'FAILED' ||
    payment?.paymentStatus === 'CANCELLED' ||
    payment?.paymentStatus === 'EXPIRED';

  return (
    <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6 space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl p-6 sm:p-8 space-y-6">
        {!currentUser ? (
          <div className="text-center space-y-4 py-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Sign In to Verify Your PayU Payment Status
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              For your security, TRUEDEAL GLOBAL never trusts URL query parameters as proof of payment. Sign in with your
              applicant Google account to load the server-verified transaction status for{' '}
              <code className="font-mono font-bold text-slate-800 dark:text-slate-200">{txnid || 'your order'}</code>.
            </p>
            {onSignInGoogle && (
              <button
                type="button"
                onClick={onSignInGoogle}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In with Google</span>
              </button>
            )}
          </div>
        ) : loading ? (
          <div className="text-center py-10 space-y-3">
            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Verifying Transaction with Server &amp; PayU...
            </h2>
            <p className="text-xs text-slate-500">Checking cryptographic signature and authoritative settlement status.</p>
          </div>
        ) : (
          <>
            {/* Status Header */}
            <div className="text-center space-y-3">
              {isSuccess ? (
                <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
              ) : isFailed ? (
                <div className="w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
                  <XCircle className="w-8 h-8" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
                  <Clock className="w-8 h-8" />
                </div>
              )}

              <div>
                <h1 className="text-2xl font-black text-slate-900 dark:text-white">
                  {isSuccess
                    ? 'Payment Verified & Confirmed'
                    : isFailed
                    ? `Payment ${payment?.paymentStatus || 'Failed'}`
                    : 'Payment Verification Pending'}
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {isSuccess
                    ? 'Your franchise fee payment has been independently verified via PayU India.'
                    : isFailed
                    ? payment?.errorMessage || 'Your PayU transaction did not complete. No duplicate charge will be made if you retry safely.'
                    : 'We are awaiting final confirmation from PayU. You can re-check live status below.'}
                </p>
              </div>
            </div>

            {(errorMsg || reasonParam) && !isSuccess && (
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <span>{errorMsg || `Gateway notice: ${reasonParam.replace(/_/g, ' ')}`}</span>
              </div>
            )}

            {/* Official Verified Receipt / Transaction Details Card */}
            {payment && (
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                  <span className="font-bold text-slate-900 dark:text-white">{complianceConfig.legalName}</span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      isSuccess
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : isFailed
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    }`}
                  >
                    {payment.paymentStatus}
                  </span>
                </div>

                {isSuccess && payment.receiptNumber && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Official Receipt No</span>
                    <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                      {payment.receiptNumber}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">Application ID</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{payment.applicationId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Franchise Plan</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{payment.franchisePlanName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Amount Paid</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    ₹{payment.amount.toLocaleString('en-IN')} INR
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Merchant Txn ID</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">{payment.txnId}</span>
                </div>
                {payment.payuTransactionId && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">PayU Reference (mihpayid)</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200">{payment.payuTransactionId}</span>
                  </div>
                )}
                {payment.paymentMethod && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Payment Mode</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{payment.paymentMethod}</span>
                  </div>
                )}
                {payment.verifiedAt && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Verified Timestamp</span>
                    <span className="text-slate-800 dark:text-slate-200">
                      {new Date(payment.verifiedAt).toLocaleString('en-IN')}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2.5 justify-center pt-2">
              {isSuccess && (
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print / Download Verified Receipt</span>
                </button>
              )}

              {!isSuccess && txnid && (
                <button
                  type="button"
                  disabled={verifying}
                  onClick={handleManualReconcile}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${verifying ? 'animate-spin' : ''}`} />
                  <span>{verifying ? 'Checking PayU...' : 'Verify Payment Status with PayU'}</span>
                </button>
              )}

              {isFailed && linkedApp && (
                <button
                  type="button"
                  onClick={() => setShowRetryModal(true)}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Retry Payment via PayU</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  const targetAppId = payment?.applicationId || applicationIdParam;
                  if (targetAppId) {
                    onNavigateToTracker(targetAppId);
                  } else {
                    onNavigate('tracker');
                  }
                }}
                className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                <span>Open Application Tracker</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </>
        )}
      </div>

      {showRetryModal && linkedApp && (
        <PaymentModal
          isOpen={showRetryModal}
          onClose={() => setShowRetryModal(false)}
          application={linkedApp}
          paymentType="franchise_deposit"
          amount={payment?.amount || linkedApp.amount || 4999}
          currency="INR"
          currentUser={currentUser}
          onSignInGoogle={onSignInGoogle}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
}
