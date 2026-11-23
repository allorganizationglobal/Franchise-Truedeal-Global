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
import { RazorpayPaymentStatus, PaymentRecord } from '../../types/franchise';
import { PaymentModal } from '../common/PaymentModal';

interface PaymentResultViewProps {
  currentUser?: FirebaseUser | null;
  onSignInGoogle?: () => void;
  onNavigateToTracker: (applicationId: string) => void;
  onNavigate: (tab: string) => void;
  onRefresh: () => void;
}

interface VerifiedRazorpayPayload {
  paymentRecordId: string;
  applicationId: string;
  userId: string;
  applicantName: string;
  email: string;
  planId: string;
  planName: string;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  finalAmountINR: number;
  baseAmountINR: number;
  gstAmountINR: number;
  currency: 'INR';
  paymentStatus: RazorpayPaymentStatus;
  paymentMethodDetails?: string;
  receiptNumber?: string;
  failureReason?: string;
  paymentTimestamp?: string;
  createdAt: string;
  updatedAt: string;
  signatureVerified?: boolean;
  captureStatus?: PaymentRecord['captureStatus'];
}

export function PaymentResultView({
  currentUser,
  onSignInGoogle,
  onNavigateToTracker,
  onNavigate,
  onRefresh
}: PaymentResultViewProps) {
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const orderId = params.get('orderId') || params.get('razorpay_order_id') || params.get('txnid') || '';
  const applicationIdParam = params.get('applicationId') || '';
  const reasonParam = params.get('reason') || '';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payment, setPayment] = useState<VerifiedRazorpayPayload | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showRetryModal, setShowRetryModal] = useState(false);

  const complianceConfig = FranchiseStorageService.getComplianceConfig();

  const syncVerifiedPaymentToLocalApp = useCallback(
    (p: VerifiedRazorpayPayload) => {
      const apps = FranchiseStorageService.getApplications();
      const target = apps.find((a) => a.id === p.applicationId);
      if (!target) return;

      const mappedStatus: PaymentRecord['status'] =
        p.paymentStatus === 'CAPTURED'
          ? 'completed'
          : p.paymentStatus === 'FAILED' || p.paymentStatus === 'CANCELLED'
          ? 'failed'
          : p.paymentStatus === 'REFUNDED' || p.paymentStatus === 'REFUND_INITIATED'
          ? 'refunded'
          : 'processing';

      const updatedPay: PaymentRecord = {
        id: p.paymentRecordId || `rzp_${p.razorpayOrderId}`,
        applicationId: p.applicationId,
        type: 'franchise_deposit',
        amount: p.finalAmountINR,
        currency: 'INR',
        method: 'razorpay',
        gateway: 'razorpay',
        status: mappedStatus,
        payuStatus: p.paymentStatus,
        razorpayOrderId: p.razorpayOrderId,
        razorpayPaymentId: p.razorpayPaymentId,
        txnId: p.razorpayOrderId,
        transactionHash: p.razorpayPaymentId || p.razorpayOrderId,
        referenceCode: p.razorpayPaymentId || p.razorpayOrderId,
        timestamp: p.paymentTimestamp || p.updatedAt || p.createdAt,
        receiptNumber: p.receiptNumber || 'PENDING-RAZORPAY-VERIFICATION',
        billingName: p.applicantName,
        baseAmount: p.baseAmountINR,
        gstAmount: p.gstAmountINR,
        totalWithGst: p.finalAmountINR,
        signatureVerified: Boolean(p.signatureVerified),
        captureStatus: p.captureStatus,
        paymentMethodDetails: p.paymentMethodDetails,
        failureReason: p.failureReason
      };

      FranchiseStorageService.addPayment(p.applicationId, updatedPay);
      onRefresh();
    },
    [onRefresh]
  );

  const fetchAuthoritativeStatus = useCallback(async (isManualRefresh = false) => {
    if (!orderId && !applicationIdParam) {
      setErrorMsg('No Razorpay Order ID or Application ID was provided in the URL.');
      setLoading(false);
      return;
    }

    if (!currentUser) {
      setLoading(false);
      return;
    }

    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setErrorMsg(null);

    try {
      const idToken = await getFirebaseIdToken();
      if (!idToken) {
        setErrorMsg('Please sign in to fetch your verified Razorpay payment status.');
        return;
      }

      const query = orderId
        ? `orderId=${encodeURIComponent(orderId)}`
        : `applicationId=${encodeURIComponent(applicationIdParam)}`;
      const res = await fetch(`/api/payments/razorpay/status?${query}`, {
        headers: { Authorization: `Bearer ${idToken}` }
      });
      const data = await res.json().catch(() => null);

      const resolvedPayment: VerifiedRazorpayPayload | null =
        data?.payment || (Array.isArray(data?.payments) && data.payments.length > 0 ? data.payments[0] : null);

      if (!res.ok || !data?.ok || !resolvedPayment) {
        setErrorMsg(data?.message || 'Unable to verify Razorpay payment record from server.');
        setPayment(null);
      } else {
        setPayment(resolvedPayment);
        syncVerifiedPaymentToLocalApp(resolvedPayment);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Network error while verifying Razorpay payment status.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orderId, applicationIdParam, currentUser, syncVerifiedPaymentToLocalApp]);

  useEffect(() => {
    fetchAuthoritativeStatus(false);
  }, [fetchAuthoritativeStatus]);

  const linkedApp = FranchiseStorageService.getApplications().find(
    (a) => a.id === (payment?.applicationId || applicationIdParam)
  );

  const isSuccess = payment?.paymentStatus === 'CAPTURED';
  const isFailed = payment?.paymentStatus === 'FAILED' || payment?.paymentStatus === 'CANCELLED';

  return (
    <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6 space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl p-6 sm:p-8 space-y-6">
        {!currentUser ? (
          <div className="text-center space-y-4 py-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Sign In to Verify Your Razorpay Payment Status
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              For your security, TRUEDEAL GLOBAL never trusts URL query parameters as proof of payment. Sign in with your
              applicant Google account to load the server-verified transaction status for{' '}
              <code className="font-mono font-bold text-slate-800 dark:text-slate-200">{orderId || applicationIdParam || 'your order'}</code>.
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
              Verifying Transaction with Server &amp; Razorpay...
            </h2>
            <p className="text-xs text-slate-500">Checking cryptographic signature and authoritative capture status.</p>
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
                    ? 'Payment Verified & Captured'
                    : isFailed
                    ? `Payment ${payment?.paymentStatus || 'Failed'}`
                    : 'Payment Verification Pending'}
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {isSuccess
                    ? 'Your franchise fee payment has been independently verified & captured via Razorpay.'
                    : isFailed
                    ? payment?.failureReason || 'Your Razorpay transaction did not complete. You can safely retry below.'
                    : 'We are awaiting final capture confirmation from Razorpay. Refresh live status below.'}
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
                  <span className="font-semibold text-slate-900 dark:text-white">{payment.planName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Amount</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    ₹{payment.finalAmountINR.toLocaleString('en-IN')} INR
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Razorpay Order ID</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">{payment.razorpayOrderId}</span>
                </div>
                {payment.razorpayPaymentId && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Razorpay Payment ID</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200">{payment.razorpayPaymentId}</span>
                  </div>
                )}
                {payment.paymentMethodDetails && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Payment Mode</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{payment.paymentMethodDetails}</span>
                  </div>
                )}
                {payment.paymentTimestamp && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Verified Timestamp</span>
                    <span className="text-slate-800 dark:text-slate-200">
                      {new Date(payment.paymentTimestamp).toLocaleString('en-IN')}
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

              {!isSuccess && (orderId || applicationIdParam) && (
                <button
                  type="button"
                  disabled={refreshing}
                  onClick={() => fetchAuthoritativeStatus(true)}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                  <span>{refreshing ? 'Checking Razorpay...' : 'Refresh Razorpay Payment Status'}</span>
                </button>
              )}

              {isFailed && linkedApp && (
                <button
                  type="button"
                  onClick={() => setShowRetryModal(true)}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Pay / Retry via Razorpay</span>
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
          amount={payment?.finalAmountINR || linkedApp.amount || 4999}
          currency="INR"
          currentUser={currentUser}
          onSignInGoogle={onSignInGoogle}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
}
