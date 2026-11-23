import { useState, useEffect, useRef } from 'react';
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
  Loader2,
  LogIn,
  CheckCircle2,
  RefreshCw,
  XCircle
} from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import { FranchiseApplication, PaymentRecord, Currency, RazorpayPaymentStatus } from '../../types/franchise';
import { FranchiseStorageService, getPlanById } from '../../services/storage';
import { calculateFeeBreakdownINR } from '../../config/complianceConfig';
import { NotificationService } from '../../services/notificationService';
import { playApprovalSuccessSound } from '../../utils/audio';
import { getFirebaseIdToken } from '../../services/firebase';
import {
  loadRazorpayCheckoutScript,
  RazorpayCheckoutFailedEvent,
  RazorpayCheckoutSuccessResponse
} from '../../utils/razorpayCheckout';
import { OfficialReceiptCard } from './OfficialReceiptCard';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  application: FranchiseApplication;
  paymentType: 'application_fee' | 'franchise_deposit';
  amount: number;
  currency?: Currency;
  currentUser?: FirebaseUser | null;
  onSignInGoogle?: () => void | Promise<void | { ok: boolean; error?: string }>;
  onPaymentSuccess?: (payment: PaymentRecord) => void;
  onNavigate?: (tab: string) => void;
}

interface RazorpayStatusConfig {
  configured: boolean;
  mode: 'test' | 'live';
  publicKeyId: string | null;
  keyModeMismatch: boolean;
  missingEnvVars: string[];
  gstMode: 'excluded' | 'included' | 'not_applicable';
  gstRatePercent: number;
}

type RazorpayFlowBanner =
  | null
  | {
      state: 'creating_order' | 'checkout_open' | 'verifying' | 'pending_verification' | 'failed' | 'cancelled' | 'already_paid';
      title: string;
      message: string;
      orderId?: string;
      paymentId?: string;
    };

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

  const [activeMode, setActiveMode] = useState<'razorpay' | 'bank_upi'>('razorpay');

  const cleanInitialField = (value: string | undefined, placeholders: string[]) => {
    const trimmed = (value || '').trim();
    if (!trimmed) return '';
    return placeholders.includes(trimmed.toLowerCase()) ? '' : trimmed;
  };

  // Razorpay Standard Checkout state
  const [rzpConfig, setRzpConfig] = useState<RazorpayStatusConfig | null>(null);
  const [loadingRzpConfig, setLoadingRzpConfig] = useState(false);
  const [rzpPolicyAccepted, setRzpPolicyAccepted] = useState(false);
  const [rzpBusy, setRzpBusy] = useState(false);
  const [rzpBanner, setRzpBanner] = useState<RazorpayFlowBanner>(null);
  const [verifiedRazorpayPayment, setVerifiedRazorpayPayment] = useState<PaymentRecord | null>(null);
  const [hasFailedOrCancelledAttempt, setHasFailedOrCancelledAttempt] = useState(false);
  const rzpClickLockRef = useRef(false);

  // Applicant details for direct Razorpay Checkout (works with or without Google Sign-In)
  const [payerName, setPayerName] = useState(() =>
    cleanInitialField(currentUser?.displayName || application.applicant.fullName, ['franchise applicant'])
  );
  const [payerEmail, setPayerEmail] = useState(() =>
    cleanInitialField(currentUser?.email || application.applicant.email, ['applicant@truedealglobal.com'])
  );
  const [payerPhone, setPayerPhone] = useState(() =>
    cleanInitialField(application.applicant.phone, ['+91-9317194033'])
  );
  const [signInBusy, setSignInBusy] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  // Corporate Bank / UPI Transfer state (preserved)
  const [selectedQrTab, setSelectedQrTab] = useState<'bob' | 'idbi'>('bob');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [utrNumber, setUtrNumber] = useState<string>('');
  const [billingName, setBillingName] = useState(
    cleanInitialField(currentUser?.displayName || application.applicant.fullName, ['franchise applicant'])
  );
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [submittedPayment, setSubmittedPayment] = useState<PaymentRecord | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSignInError(null);
    setPayerName((prev) =>
      prev || cleanInitialField(currentUser?.displayName || application.applicant.fullName, ['franchise applicant'])
    );
    setPayerEmail((prev) =>
      currentUser?.email || prev || cleanInitialField(application.applicant.email, ['applicant@truedealglobal.com'])
    );
    setPayerPhone((prev) =>
      prev || cleanInitialField(application.applicant.phone, ['+91-9317194033'])
    );
  }, [isOpen, currentUser, application.id]);

  useEffect(() => {
    if (!isOpen) return;
    setActiveMode('razorpay');
    let active = true;
    setLoadingRzpConfig(true);

    fetch('/api/payments/razorpay/status?mode=config')
      .then((res) => {
        if (!res.ok) throw new Error('Config endpoint returned non-200');
        return res.json();
      })
      .then((data) => {
        if (active && data?.config) {
          setRzpConfig({
            configured: Boolean(data.config.configured),
            mode: data.config.mode === 'live' ? 'live' : 'test',
            publicKeyId: data.config.publicKeyId || null,
            keyModeMismatch: Boolean(data.config.keyModeMismatch),
            missingEnvVars: Array.isArray(data.config.missingEnvVars) ? data.config.missingEnvVars : [],
            gstMode: data.config.gstMode || 'not_applicable',
            gstRatePercent: Number(data.config.gstRatePercent || 0)
          });
        } else if (active) {
          setRzpConfig(null);
        }
      })
      .catch(() => {
        if (active) setRzpConfig(null);
      })
      .finally(() => {
        if (active) setLoadingRzpConfig(false);
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

  const persistLocalRazorpayAttempt = (
    orderId: string,
    status: PaymentRecord['status'],
    rzpStatus: RazorpayPaymentStatus,
    details: {
      paymentId?: string;
      receiptNumber?: string;
      amountINR?: number;
      baseAmountINR?: number;
      gstAmountINR?: number;
      signatureVerified?: boolean;
      captureStatus?: PaymentRecord['captureStatus'];
      paymentMethodDetails?: string;
      failureReason?: string;
      timestamp?: string;
    } = {}
  ): PaymentRecord => {
    const record: PaymentRecord = {
      id: `rzp_${orderId}`,
      applicationId: application.id,
      type: paymentType,
      amount: details.amountINR ?? feeBreakdown.totalPayableINR,
      currency: 'INR',
      method: 'razorpay',
      gateway: 'razorpay',
      status,
      payuStatus: rzpStatus,
      razorpayOrderId: orderId,
      razorpayPaymentId: details.paymentId,
      txnId: orderId,
      transactionHash: details.paymentId || orderId,
      referenceCode: details.paymentId || orderId,
      timestamp: details.timestamp || new Date().toISOString(),
      receiptNumber: details.receiptNumber || 'PENDING-RAZORPAY-VERIFICATION',
      billingName: payerName.trim() || application.applicant.fullName || 'Franchise Applicant',
      baseAmount: details.baseAmountINR ?? feeBreakdown.baseFeeINR,
      gstAmount: details.gstAmountINR ?? feeBreakdown.gstAmountINR,
      totalWithGst: details.amountINR ?? feeBreakdown.totalPayableINR,
      signatureVerified: Boolean(details.signatureVerified),
      captureStatus: details.captureStatus || (status === 'completed' ? 'captured' : status === 'failed' ? 'failed' : 'unpaid'),
      paymentMethodDetails: details.paymentMethodDetails,
      failureReason: details.failureReason
    };
    FranchiseStorageService.addPayment(application.id, record);
    return record;
  };

  const reportClientCheckoutOutcome = async (
    idToken: string | null,
    checkoutToken: string | undefined,
    orderId: string,
    outcome: 'cancelled' | 'failed',
    reason: string,
    paymentId?: string
  ) => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (idToken) headers.Authorization = `Bearer ${idToken}`;
      if (checkoutToken) headers['X-Checkout-Token'] = checkoutToken;
      await fetch('/api/payments/razorpay/status', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          razorpayOrderId: orderId,
          outcome,
          reason,
          razorpayPaymentId: paymentId,
          checkoutToken
        })
      });
    } catch {
      // Non-blocking audit report
    }
  };

  const handleOptionalGoogleSignIn = async () => {
    if (!onSignInGoogle || signInBusy) return;
    setSignInError(null);
    setSignInBusy(true);
    try {
      const res = await onSignInGoogle();
      if (res && typeof res === 'object' && 'error' in res && res.error) {
        setSignInError(res.error);
      }
    } catch (err: any) {
      setSignInError(
        err?.message ||
          'Google Sign-In could not be completed. You can still pay directly via Razorpay Checkout below.'
      );
    } finally {
      setSignInBusy(false);
    }
  };

  const handleLaunchRazorpayCheckout = async (forceNewOrder = false) => {
    if (rzpClickLockRef.current || rzpBusy) return;

    const cleanName = payerName.trim();
    const cleanEmail = (currentUser?.email || payerEmail).trim().toLowerCase();
    const cleanPhone = payerPhone.trim();
    const phoneDigits = cleanPhone.replace(/\D/g, '');

    if (cleanName.length < 2 || cleanName.length > 120) {
      setRzpBanner({
        state: 'failed',
        title: 'Applicant Name Required',
        message: 'Please enter your full name (2–120 characters) for your Razorpay payment receipt.'
      });
      return;
    }

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setRzpBanner({
        state: 'failed',
        title: 'Valid Email Required',
        message: 'Please enter a valid email address so your Razorpay receipt and application ID can be linked.'
      });
      return;
    }

    if (phoneDigits.length < 7 || phoneDigits.length > 15) {
      setRzpBanner({
        state: 'failed',
        title: 'Mobile Number Required',
        message: 'Please enter a valid mobile number (e.g., +91 98XXXXXXXX) before opening Razorpay Checkout.'
      });
      return;
    }

    if (!rzpPolicyAccepted) {
      setRzpBanner({
        state: 'failed',
        title: 'Policy Acceptance Required',
        message: 'Please confirm that you have reviewed the Refund Policy, Cancellation Policy, and Terms & Conditions before proceeding.'
      });
      return;
    }

    if (!application.id || application.id === 'PENDING') {
      setRzpBanner({
        state: 'failed',
        title: 'Submit Application First',
        message: 'Please complete Step 6 and submit your franchise application first to generate an official Application Reference ID before paying online.'
      });
      return;
    }

    // Persist confirmed applicant contact details locally and unlock tracker view for this session
    try {
      FranchiseStorageService.saveApplication({
        ...application,
        userId: currentUser?.uid || application.userId,
        applicant: {
          ...application.applicant,
          fullName: cleanName,
          email: cleanEmail,
          phone: cleanPhone
        },
        updatedAt: new Date().toISOString()
      });
      sessionStorage.setItem(`tdg_auth_${application.id}`, 'true');
    } catch {
      // Non-blocking local update
    }

    rzpClickLockRef.current = true;
    setRzpBusy(true);
    setRzpBanner({
      state: 'creating_order',
      title: 'Creating Verified Razorpay Order...',
      message: 'Calculating authoritative package fee on the server and creating a secure Razorpay order.'
    });

    try {
      const idToken = currentUser ? await getFirebaseIdToken() : null;
      const createHeaders: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (idToken) {
        createHeaders.Authorization = `Bearer ${idToken}`;
      }

      // Step 1: Create authoritative server-side Razorpay order
      const createRes = await fetch('/api/create-order', {
        method: 'POST',
        headers: createHeaders,
        body: JSON.stringify({
          applicationId: application.id,
          planId: application.planId,
          paymentPurpose: paymentType,
          applicantName: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
          termsAccepted: true,
          forceNewOrder: forceNewOrder || hasFailedOrCancelledAttempt
        })
      });

      const createData = await createRes.json().catch(() => null);

      if (createRes.status === 409 && createData?.error === 'already_paid') {
        setRzpBanner({
          state: 'already_paid',
          title: 'Payment Already Verified',
          message: createData?.message || 'This franchise application already has a verified captured payment.'
        });
        rzpClickLockRef.current = false;
        setRzpBusy(false);
        return;
      }

      if (!createRes.ok || !createData?.ok || !createData?.order?.id) {
        setRzpBanner({
          state: 'failed',
          title: createRes.status === 503 ? 'Razorpay Server Configuration Pending' : 'Order Creation Failed',
          message:
            createData?.message ||
            'Unable to create Razorpay order right now. Please try again or contact support.'
        });
        rzpClickLockRef.current = false;
        setRzpBusy(false);
        return;
      }

      const order = createData.order;
      const pricing = createData.pricing;
      const checkoutToken: string | undefined = typeof createData.checkoutToken === 'string' ? createData.checkoutToken : undefined;

      if (checkoutToken) {
        try {
          sessionStorage.setItem(`tdg_rzp_token_${order.id}`, checkoutToken);
          sessionStorage.setItem(`tdg_rzp_latest_app_${application.id}`, JSON.stringify({ orderId: order.id, checkoutToken }));
        } catch {
          // Non-blocking sessionStorage cache
        }
      }

      // Record created order in local tracker history immediately
      persistLocalRazorpayAttempt(order.id, 'processing', 'CREATED', {
        amountINR: pricing?.finalAmountINR ?? feeBreakdown.totalPayableINR,
        baseAmountINR: pricing?.baseAmountINR ?? feeBreakdown.baseFeeINR,
        gstAmountINR: pricing?.gstAmountINR ?? feeBreakdown.gstAmountINR,
        captureStatus: 'unpaid'
      });

      // Step 2: Load official checkout.js
      const scriptLoaded = await loadRazorpayCheckoutScript();
      if (!scriptLoaded || typeof window.Razorpay !== 'function') {
        setRzpBanner({
          state: 'failed',
          title: 'Razorpay Checkout Script Blocked',
          message:
            'Could not load https://checkout.razorpay.com/v1/checkout.js. Please check your internet connection or disable script blockers and retry.',
          orderId: order.id
        });
        rzpClickLockRef.current = false;
        setRzpBusy(false);
        return;
      }

      let handlerInvoked = false;
      let failedInvoked = false;

      setRzpBanner({
        state: 'checkout_open',
        title: 'Razorpay Secure Checkout Open',
        message: 'Complete your payment inside the Razorpay window. Do not close this browser tab until verification finishes.',
        orderId: order.id
      });

      const rzp = new window.Razorpay({
        key: order.keyId || import.meta.env.VITE_RAZORPAY_KEY_ID || '',
        amount: order.amount,
        currency: 'INR',
        name: order.businessName || 'TRUEDEAL GLOBAL OPC PVT LTD',
        description: order.description || `${plan?.title || application.planId} — #${application.id}`,
        order_id: order.id,
        prefill: {
          name: order.prefill?.name || cleanName,
          email: order.prefill?.email || cleanEmail,
          contact: order.prefill?.contact || cleanPhone
        },
        notes: order.notes || {
          applicationId: application.id,
          planId: application.planId
        },
        theme: {
          color: '#4f46e5'
        },
        modal: {
          confirm_close: true,
          ondismiss: async () => {
            if (handlerInvoked || failedInvoked) return;
            setHasFailedOrCancelledAttempt(true);
            persistLocalRazorpayAttempt(order.id, 'failed', 'CANCELLED', {
              amountINR: pricing?.finalAmountINR,
              baseAmountINR: pricing?.baseAmountINR,
              gstAmountINR: pricing?.gstAmountINR,
              captureStatus: 'unpaid',
              failureReason: 'Payment checkout closed before completion.'
            });
            await reportClientCheckoutOutcome(
              idToken,
              checkoutToken,
              order.id,
              'cancelled',
              'Customer dismissed Razorpay Standard Checkout modal.'
            );
            setRzpBanner({
              state: 'cancelled',
              title: 'Payment Cancelled',
              message: 'You closed the Razorpay checkout window before completing payment. No confirmed payment was recorded. You can safely retry.',
              orderId: order.id
            });
            rzpClickLockRef.current = false;
            setRzpBusy(false);
          }
        },
        handler: async (response: RazorpayCheckoutSuccessResponse) => {
          handlerInvoked = true;
          setRzpBanner({
            state: 'verifying',
            title: 'Verifying Payment with Server...',
            message: 'Validating cryptographic HMAC-SHA256 signature and confirming payment capture with Razorpay.',
            orderId: order.id,
            paymentId: response.razorpay_payment_id
          });

          try {
            const verifyHeaders: Record<string, string> = {
              'Content-Type': 'application/json'
            };
            if (idToken) verifyHeaders.Authorization = `Bearer ${idToken}`;
            if (checkoutToken) verifyHeaders['X-Checkout-Token'] = checkoutToken;

            const verifyRes = await fetch('/api/verify-payment', {
              method: 'POST',
              headers: verifyHeaders,
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                applicationId: application.id,
                checkoutToken
              })
            });

            const verifyData = await verifyRes.json().catch(() => null);

            // STRICT RULE: Show "Payment Successful" ONLY if backend confirmed verified === true AND captured === true
            if (verifyRes.ok && verifyData?.verified === true && verifyData?.captured === true && verifyData?.paymentStatus === 'CAPTURED') {
              const serverRec = verifyData.paymentRecord;
              const capturedRecord = persistLocalRazorpayAttempt(order.id, 'completed', 'CAPTURED', {
                paymentId: response.razorpay_payment_id,
                receiptNumber: serverRec?.receiptNumber || `REC-TDG-${new Date().getFullYear()}-${order.id.slice(-6).toUpperCase()}`,
                amountINR: serverRec?.finalAmountINR ?? pricing?.finalAmountINR,
                baseAmountINR: serverRec?.baseAmountINR ?? pricing?.baseAmountINR,
                gstAmountINR: serverRec?.gstAmountINR ?? pricing?.gstAmountINR,
                signatureVerified: true,
                captureStatus: 'captured',
                paymentMethodDetails: serverRec?.paymentMethodDetails,
                timestamp: serverRec?.paymentTimestamp || new Date().toISOString()
              });

              NotificationService.addNotification(
                `Payment Successful (₹${capturedRecord.amount.toLocaleString('en-IN')} INR)`,
                `Razorpay Payment ${response.razorpay_payment_id} verified & captured. Receipt: ${capturedRecord.receiptNumber}. Franchise application remains queued for administrative approval.`,
                'success',
                application.id
              );

              playApprovalSuccessSound();
              setVerifiedRazorpayPayment(capturedRecord);
              setRzpBanner(null);
              onPaymentSuccess?.(capturedRecord);
            } else if (
              verifyData?.paymentStatus === 'AUTHORIZED' ||
              verifyData?.paymentStatus === 'VERIFICATION_REQUIRED' ||
              verifyRes.status === 202 ||
              verifyRes.status === 502
            ) {
              // AUTHORIZED or deferred capture is NEVER shown as Payment Successful
              const pendingStatus: RazorpayPaymentStatus =
                verifyData?.paymentStatus === 'AUTHORIZED' ? 'AUTHORIZED' : 'VERIFICATION_REQUIRED';
              persistLocalRazorpayAttempt(order.id, 'processing', pendingStatus, {
                paymentId: response.razorpay_payment_id,
                amountINR: pricing?.finalAmountINR,
                baseAmountINR: pricing?.baseAmountINR,
                gstAmountINR: pricing?.gstAmountINR,
                signatureVerified: Boolean(verifyData?.verified),
                captureStatus: pendingStatus === 'AUTHORIZED' ? 'authorized' : 'unpaid'
              });

              setRzpBanner({
                state: 'pending_verification',
                title: 'Payment Pending Verification',
                message:
                  verifyData?.message ||
                  'Your payment has been authorized but final capture is still being verified by Razorpay. Please do not pay again — check your Application Tracker shortly.',
                orderId: order.id,
                paymentId: response.razorpay_payment_id
              });
            } else {
              setHasFailedOrCancelledAttempt(true);
              persistLocalRazorpayAttempt(order.id, 'failed', 'FAILED', {
                paymentId: response.razorpay_payment_id,
                amountINR: pricing?.finalAmountINR,
                baseAmountINR: pricing?.baseAmountINR,
                gstAmountINR: pricing?.gstAmountINR,
                signatureVerified: false,
                captureStatus: 'failed',
                failureReason: verifyData?.message || 'Payment verification failed.'
              });
              setRzpBanner({
                state: 'failed',
                title: 'Payment Verification Failed',
                message:
                  verifyData?.message ||
                  'Server cryptographic verification did not confirm this payment. Application was NOT marked as paid.',
                orderId: order.id,
                paymentId: response.razorpay_payment_id
              });
            }
          } catch {
            persistLocalRazorpayAttempt(order.id, 'processing', 'VERIFICATION_REQUIRED', {
              paymentId: response.razorpay_payment_id,
              amountINR: pricing?.finalAmountINR,
              baseAmountINR: pricing?.baseAmountINR,
              gstAmountINR: pricing?.gstAmountINR,
              captureStatus: 'unpaid',
              failureReason: 'Network error during server verification.'
            });
            setRzpBanner({
              state: 'pending_verification',
              title: 'Payment Pending Verification',
              message:
                'A network interruption occurred while verifying your payment. If your bank was debited, Razorpay webhooks will reconcile your payment automatically — check your Application Tracker before retrying.',
              orderId: order.id,
              paymentId: response.razorpay_payment_id
            });
          } finally {
            rzpClickLockRef.current = false;
            setRzpBusy(false);
          }
        }
      });

      rzp.on('payment.failed', async (failedEvent: RazorpayCheckoutFailedEvent) => {
        failedInvoked = true;
        setHasFailedOrCancelledAttempt(true);
        const failReason =
          failedEvent?.error?.description ||
          failedEvent?.error?.reason ||
          'Payment failed in Razorpay Checkout.';
        const failedPaymentId = failedEvent?.error?.metadata?.payment_id;

        persistLocalRazorpayAttempt(order.id, 'failed', 'FAILED', {
          paymentId: failedPaymentId,
          amountINR: pricing?.finalAmountINR,
          baseAmountINR: pricing?.baseAmountINR,
          gstAmountINR: pricing?.gstAmountINR,
          captureStatus: 'failed',
          failureReason: failReason
        });

        await reportClientCheckoutOutcome(idToken, checkoutToken, order.id, 'failed', failReason, failedPaymentId);

        setRzpBanner({
          state: 'failed',
          title: 'Payment Failed',
          message: `${failReason} Your previous attempt has been logged. Click "Retry Payment" to generate a fresh Razorpay order.`,
          orderId: order.id,
          paymentId: failedPaymentId
        });
        rzpClickLockRef.current = false;
        setRzpBusy(false);
      });

      rzp.open();
    } catch (err: any) {
      setRzpBanner({
        state: 'failed',
        title: 'Payment Initiation Error',
        message: err?.message || 'Network error while connecting to the server payment endpoint.'
      });
      rzpClickLockRef.current = false;
      setRzpBusy(false);
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
        gateway: 'bank_transfer',
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

        {verifiedRazorpayPayment ? (
          /* STRICTLY VERIFIED & CAPTURED RAZORPAY RECEIPT VIEW */
          <OfficialReceiptCard
            receipt={{
              receiptNumber: verifiedRazorpayPayment.receiptNumber,
              applicationId: application.id,
              applicantName: payerName.trim() || application.applicant.fullName || 'Franchise Applicant',
              applicantEmail: (currentUser?.email || payerEmail || application.applicant.email || '').trim(),
              applicantPhone: (payerPhone || application.applicant.phone || '').trim(),
              planId: application.planId,
              planTitle: plan?.title || application.planId,
              amountINR: verifiedRazorpayPayment.amount,
              baseAmountINR: verifiedRazorpayPayment.baseAmount,
              gstAmountINR: verifiedRazorpayPayment.gstAmount,
              razorpayOrderId: verifiedRazorpayPayment.razorpayOrderId,
              razorpayPaymentId: verifiedRazorpayPayment.razorpayPaymentId,
              referenceCode: verifiedRazorpayPayment.referenceCode,
              paymentMethodDetails: verifiedRazorpayPayment.paymentMethodDetails,
              timestamp: verifiedRazorpayPayment.timestamp,
              signatureVerified: true,
              gateway: 'razorpay'
            }}
            onOpenTracker={
              onNavigate
                ? () => {
                    onClose();
                    onNavigate('tracker');
                  }
                : undefined
            }
            onClose={onClose}
            closeLabel="Return to Portal"
          />
        ) : !submittedPayment ? (
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

            {/* Channel Tabs: Razorpay Standard Checkout (Primary) | Corporate Bank / UPI */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveMode('razorpay')}
                className={`py-2.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeMode === 'razorpay'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span>Razorpay Checkout</span>
                {rzpConfig?.configured && (
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/20 uppercase">
                    {rzpConfig.mode === 'live' ? 'Live' : 'Active'}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveMode('bank_upi')}
                className={`py-2.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeMode === 'bank_upi'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 shrink-0" />
                <span>Corporate Bank / UPI</span>
              </button>
            </div>

            {activeMode === 'razorpay' ? (
              <div className="space-y-4">
                {/* Razorpay Security & Mode Banner */}
                <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <span>Razorpay Standard Web Checkout</span>
                    </span>
                    {loadingRzpConfig ? (
                      <span className="text-[10px] font-mono text-slate-500">Checking gateway...</span>
                    ) : rzpConfig?.configured ? (
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                          rzpConfig.mode === 'live'
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                            : 'bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300'
                        }`}
                      >
                        {rzpConfig.mode === 'live' ? 'LIVE READY' : 'TEST MODE READY'}
                      </span>
                    ) : rzpConfig !== null ? (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 uppercase">
                        KEY SECRET NEEDED
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase">
                        SECURE SERVER CHECKOUT
                      </span>
                    )}
                  </div>
                  <p className="text-indigo-900/90 dark:text-indigo-200/90 leading-relaxed">
                    Pay securely via UPI, Cards, NetBanking, or Wallets using official Razorpay Standard Checkout.
                    Order amount is calculated strictly on our server, and payment capture is cryptographically verified
                    via HMAC-SHA256 + Razorpay API before any receipt is issued.
                  </p>
                </div>

                {/* Honest Missing Secret Notice */}
                {!loadingRzpConfig && rzpConfig && !rzpConfig.configured && (
                  <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-2 text-xs text-amber-950 dark:text-amber-200">
                    <div className="flex items-center gap-2 font-bold">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        {rzpConfig.keyModeMismatch
                          ? 'Razorpay Mode / Key Prefix Mismatch'
                          : 'Razorpay Server Credentials Pending'}
                      </span>
                    </div>
                    <p className="leading-relaxed">
                      {rzpConfig.keyModeMismatch ? (
                        <>
                          Server <code className="font-mono">RAZORPAY_MODE</code> does not match the configured{' '}
                          <code className="font-mono">RAZORPAY_KEY_ID</code> prefix.
                        </>
                      ) : (
                        <>
                          Configure <code className="font-mono">RAZORPAY_KEY_ID</code> and{' '}
                          <code className="font-mono">RAZORPAY_KEY_SECRET</code> in Vercel Environment Variables to
                          activate Razorpay Standard Checkout.
                        </>
                      )}
                    </p>
                  </div>
                )}

                {/* Applicant Billing Details (Enables Immediate Checkout Without Requiring Google Sign-In) */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block">
                        Applicant Details for Razorpay Receipt
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {currentUser
                          ? `Signed in as ${currentUser.email}`
                          : 'Enter your contact details below — no Google Sign-In required to pay.'}
                      </span>
                    </div>
                    {!currentUser && onSignInGoogle && (
                      <button
                        type="button"
                        disabled={signInBusy}
                        onClick={handleOptionalGoogleSignIn}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-[11px] flex items-center gap-1 shrink-0 cursor-pointer disabled:opacity-50"
                        title="Optional: Sign in with Google to sync receipts across devices"
                      >
                        <LogIn className="w-3 h-3" />
                        <span>{signInBusy ? 'Signing In...' : 'Optional Google Sign-In'}</span>
                      </button>
                    )}
                  </div>

                  {signInError && (
                    <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
                      {signInError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Full Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={payerName}
                        onChange={(e) => setPayerName(e.target.value)}
                        placeholder="Enter applicant full name"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Email Address <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        value={currentUser?.email || payerEmail}
                        readOnly={Boolean(currentUser?.email)}
                        onChange={(e) => setPayerEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none read-only:opacity-75"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Mobile Number <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        value={payerPhone}
                        onChange={(e) => setPayerPhone(e.target.value)}
                        placeholder="+91 98XXXXXXXX"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Status / Error / Pending Verification Banner */}
                {rzpBanner && (
                  <div
                    className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                      rzpBanner.state === 'failed' || rzpBanner.state === 'cancelled'
                        ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                        : rzpBanner.state === 'pending_verification' || rzpBanner.state === 'already_paid'
                        ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                        : 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold">
                      {rzpBanner.state === 'creating_order' || rzpBanner.state === 'verifying' || rzpBanner.state === 'checkout_open' ? (
                        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                      ) : rzpBanner.state === 'failed' || rzpBanner.state === 'cancelled' ? (
                        <XCircle className="w-4 h-4 shrink-0" />
                      ) : (
                        <Clock className="w-4 h-4 shrink-0" />
                      )}
                      <span>{rzpBanner.title}</span>
                    </div>
                    <p className="leading-relaxed">{rzpBanner.message}</p>
                    {(rzpBanner.orderId || rzpBanner.paymentId) && (
                      <div className="text-[10px] font-mono opacity-80">
                        {rzpBanner.orderId ? `Order: ${rzpBanner.orderId}` : ''}
                        {rzpBanner.paymentId ? ` · Payment: ${rzpBanner.paymentId}` : ''}
                      </div>
                    )}
                  </div>
                )}

                {/* Policy Acknowledgement */}
                <label className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rzpPolicyAccepted}
                    onChange={(e) => setRzpPolicyAccepted(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>
                    I understand payment confirmation is verified server-side via Razorpay before receipt issuance, that
                    payment does not auto-approve my franchise application, and I agree to the{' '}
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
                  disabled={
                    rzpBusy ||
                    (rzpConfig !== null && !rzpConfig.configured) ||
                    rzpBanner?.state === 'already_paid' ||
                    rzpBanner?.state === 'pending_verification'
                  }
                  onClick={() => handleLaunchRazorpayCheckout(hasFailedOrCancelledAttempt)}
                  className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                >
                  {rzpBusy ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Processing Secure Razorpay Checkout...</span>
                    </>
                  ) : hasFailedOrCancelledAttempt ? (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      <span>
                        Retry Payment via Razorpay (₹{feeBreakdown.totalPayableINR.toLocaleString('en-IN')} INR)
                      </span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>
                        Pay Now via Razorpay (₹{feeBreakdown.totalPayableINR.toLocaleString('en-IN')} INR)
                      </span>
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
