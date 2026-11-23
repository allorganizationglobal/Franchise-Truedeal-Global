import crypto from 'crypto';

/**
 * TRUEDEAL GLOBAL OPC PVT LTD — Razorpay Integration Readiness Blueprint (Phase 7)
 *
 * IMPORTANT:
 * Live Razorpay payment collection is intentionally NOT activated yet.
 * This architecture prepares the backend contract, signature verification,
 * idempotent payment state machine, and environment variable structure
 * so Razorpay can be enabled safely ONLY AFTER merchant KYC & website approval.
 */

export type PaymentLifecycleState =
  | 'created'
  | 'pending'
  | 'authorized'
  | 'captured'
  | 'failed'
  | 'refund_initiated'
  | 'refunded';

export interface RazorpayOrderCreateRequest {
  applicationId: string;
  planId: string;
  paymentPurpose: 'application_fee' | 'franchise_deposit';
  currency: 'INR';
  applicantEmail: string;
  applicantName: string;
  termsAcceptedAt: string;
}

export interface RazorpayOrderServerRecord {
  internalOrderId: string;
  razorpayOrderId: string;
  applicationId: string;
  planId: string;
  baseAmountPaise: number;
  gstAmountPaise: number;
  totalAmountPaise: number;
  currency: 'INR';
  state: PaymentLifecycleState;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface RazorpayCheckoutCallbackPayload {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  applicationId: string;
}

export interface RazorpayReadinessStatus {
  gateway: 'razorpay';
  liveCheckoutEnabled: boolean;
  merchantVerificationStatus: 'pending_approval';
  requiredServerEnvVars: string[];
  configuredEnvVars: Record<string, boolean>;
  plannedEndpoints: {
    method: 'POST' | 'GET';
    path: string;
    purpose: string;
    security: string;
  }[];
}

/**
 * Constant-time HMAC-SHA256 verification for Razorpay Checkout Callback signature:
 * expected = HMAC_SHA256(razorpay_order_id + "|" + razorpay_payment_id, RAZORPAY_KEY_SECRET)
 */
export function verifyRazorpayPaymentSignature(
  orderId: string,
  paymentId: string,
  providedSignature: string,
  keySecret: string
): boolean {
  if (!orderId || !paymentId || !providedSignature || !keySecret) {
    return false;
  }
  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  const expectedBuf = Buffer.from(expected, 'utf8');
  const providedBuf = Buffer.from(providedSignature, 'utf8');
  if (expectedBuf.length !== providedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

/**
 * Constant-time HMAC-SHA256 verification for Razorpay Webhook signature:
 * expected = HMAC_SHA256(rawRequestBody, RAZORPAY_WEBHOOK_SECRET)
 */
export function verifyRazorpayWebhookSignature(
  rawBody: string,
  providedSignature: string,
  webhookSecret: string
): boolean {
  if (!rawBody || !providedSignature || !webhookSecret) {
    return false;
  }
  const expected = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  const expectedBuf = Buffer.from(expected, 'utf8');
  const providedBuf = Buffer.from(providedSignature, 'utf8');
  if (expectedBuf.length !== providedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

/**
 * Returns honest readiness diagnostics without exposing any secret values.
 */
export function getRazorpayReadinessStatus(): RazorpayReadinessStatus {
  const mode = (process.env.RAZORPAY_MODE || 'test').toLowerCase().trim();
  const hasKeyId = Boolean(process.env.RAZORPAY_KEY_ID);
  const hasSecret = Boolean(process.env.RAZORPAY_KEY_SECRET);
  return {
    gateway: 'razorpay',
    liveCheckoutEnabled: mode === 'live' && hasKeyId && hasSecret,
    merchantVerificationStatus: 'pending_approval',
    requiredServerEnvVars: [
      'RAZORPAY_KEY_ID',
      'RAZORPAY_KEY_SECRET',
      'RAZORPAY_WEBHOOK_SECRET',
      'RAZORPAY_MODE'
    ],
    configuredEnvVars: {
      RAZORPAY_KEY_ID: hasKeyId,
      RAZORPAY_KEY_SECRET: hasSecret,
      RAZORPAY_WEBHOOK_SECRET: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET),
      RAZORPAY_MODE: Boolean(process.env.RAZORPAY_MODE)
    },
    plannedEndpoints: [
      {
        method: 'POST',
        path: '/api/create-order',
        purpose: 'Server-authoritative INR amount & GST calculation and Razorpay Order creation with idempotency key',
        security: 'Server-side pricing lookup; Firebase ID token auth; never trusts client-supplied amount'
      },
      {
        method: 'POST',
        path: '/api/verify-payment',
        purpose: 'Verify Razorpay HMAC-SHA256 payment signature against server-saved order ID and confirm capture via Razorpay API',
        security: 'crypto.timingSafeEqual HMAC check using RAZORPAY_KEY_SECRET + Razorpay Payments API fetch'
      },
      {
        method: 'POST',
        path: '/api/webhooks/razorpay',
        purpose: 'Idempotent Razorpay webhook reconciliation for payment.authorized, payment.captured, payment.failed, order.paid, refund.*',
        security: 'Raw-body HMAC verification using RAZORPAY_WEBHOOK_SECRET + event ID deduplication'
      },
      {
        method: 'GET',
        path: '/api/payments/razorpay/status',
        purpose: 'Public config readiness check (?mode=config) and authenticated owner/admin payment status lookup',
        security: 'Requires verified Firebase ID token & owner/admin RBAC check for payment records'
      }
    ]
  };
}

