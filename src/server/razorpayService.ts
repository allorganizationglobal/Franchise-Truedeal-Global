import crypto from 'crypto';
import Razorpay from 'razorpay';
import { calculateServerPlanAmount, getAuthoritativePlan } from './plansCatalog';
import { sendTransactionalFranchiseEmail } from './emailService';

/**
 * TRUEDEAL GLOBAL OPC PVT LTD — Authoritative Razorpay Standard Web Checkout Engine
 *
 * Security Invariants:
 * 1. Package pricing, GST, and paise totals are ALWAYS calculated server-side from plansCatalog.ts.
 * 2. RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET are read exclusively from process.env on the server.
 * 3. Signature verification ALWAYS uses the server-saved razorpayOrderId + "|" + razorpay_payment_id
 *    compared via crypto.timingSafeEqual, followed by Razorpay Payments API fetch & capture verification.
 * 4. AUTHORIZED payments are NEVER marked CAPTURED / Paid.
 * 5. Payment capture NEVER auto-approves a franchise application (application approval remains separate).
 * 6. CAPTURED records are monotonically locked against downgrades from delayed/failed/cancelled events.
 * 7. Retries after failure create new Razorpay orders and NEVER overwrite prior payment history.
 */

export type RazorpayPaymentStatus =
  | 'CREATED'
  | 'PENDING'
  | 'AUTHORIZED'
  | 'CAPTURED'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUND_INITIATED'
  | 'REFUNDED'
  | 'VERIFICATION_REQUIRED';

export type RazorpayCaptureStatus = 'unpaid' | 'authorized' | 'captured' | 'failed' | 'refunded';
export type RazorpayRefundStatus = 'none' | 'initiated' | 'processed' | 'failed';

export interface RazorpayAttemptEntry {
  timestamp: string;
  event: string;
  status: RazorpayPaymentStatus;
  razorpayPaymentId?: string;
  details: string;
  source: 'create_order' | 'verify_api' | 'webhook' | 'checkout_client' | 'admin_reconcile' | 'admin_refund';
}

export interface RazorpayAdminNote {
  id: string;
  authorEmail: string;
  text: string;
  createdAt: string;
}

export interface RazorpayPaymentRecord {
  paymentRecordId: string;
  gateway: 'razorpay';
  applicationId: string;
  userId: string;
  applicantName: string;
  email: string;
  phone: string;
  planId: string;
  planTitle: string;
  paymentPurpose: 'application_fee' | 'franchise_deposit';
  baseAmountINR: number;
  gstRatePercent: number;
  gstAmountINR: number;
  finalAmountINR: number;
  amountPaise: number;
  currency: 'INR';
  gstMode: 'excluded' | 'included' | 'not_applicable';
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  signatureVerified: boolean;
  captureStatus: RazorpayCaptureStatus;
  paymentStatus: RazorpayPaymentStatus;
  paymentMethod?: string;
  paymentMethodDetails?: string;
  refundStatus: RazorpayRefundStatus;
  refundId?: string;
  refundAmountPaise?: number;
  refundedAt?: string;
  orderReceipt: string;
  receiptNumber?: string; // Issued strictly after verified CAPTURED
  paymentTimestamp?: string;
  verifiedAt?: string;
  confirmationEmailSent?: boolean;
  failureReason?: string;
  attemptHistory: RazorpayAttemptEntry[];
  internalNotes: RazorpayAdminNote[];
  mode: 'test' | 'live';
  createdAt: string;
  updatedAt: string;
}

export interface RazorpayWebhookEventRecord {
  eventId: string;
  eventType: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpayRefundId?: string;
  applicationId?: string;
  amountPaise?: number;
  status: string;
  signatureValid: boolean;
  duplicate: boolean;
  receivedAt: string;
  summary: string;
}

export interface RazorpayConfigStatus {
  provider: 'razorpay_standard_checkout';
  mode: 'test' | 'live';
  configured: boolean;
  keyIdPresent: boolean;
  keySecretPresent: boolean;
  webhookSecretPresent: boolean;
  publicKeyId: string | null;
  keyModeMismatch: boolean;
  missingEnvVars: string[];
  gstMode: 'excluded' | 'included' | 'not_applicable';
  gstRatePercent: number;
}

export interface RazorpayApiOrderResponse {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
}

export interface RazorpayApiPaymentResponse {
  id: string;
  order_id?: string;
  amount: number;
  currency: string;
  status: string;
  captured?: boolean;
  method?: string;
  bank?: string | null;
  wallet?: string | null;
  vpa?: string | null;
  card?: { last4?: string; network?: string; type?: string } | null;
  error_description?: string | null;
  created_at?: number;
}

export interface RazorpayApiRefundResponse {
  id: string;
  payment_id: string;
  amount: number;
  currency: string;
  status: string;
}

export interface RazorpayApiClient {
  createOrder(params: {
    amount: number;
    currency: 'INR';
    receipt: string;
    notes: Record<string, string>;
  }): Promise<RazorpayApiOrderResponse>;
  fetchPayment(paymentId: string): Promise<RazorpayApiPaymentResponse>;
  fetchOrderPayments(orderId: string): Promise<{ items: RazorpayApiPaymentResponse[] }>;
  createRefund(
    paymentId: string,
    params: { amount?: number; notes?: Record<string, string> }
  ): Promise<RazorpayApiRefundResponse>;
}

export interface RazorpayPersistenceAdapter {
  savePayment(record: RazorpayPaymentRecord): Promise<void>;
  getPaymentByOrderId(orderId: string): Promise<RazorpayPaymentRecord | null>;
  getPaymentByPaymentId(paymentId: string): Promise<RazorpayPaymentRecord | null>;
  getPaymentsByApplicationId(applicationId: string): Promise<RazorpayPaymentRecord[]>;
  getAllPayments(): Promise<RazorpayPaymentRecord[]>;
  hasWebhookEvent(eventId: string): Promise<boolean>;
  saveWebhookEvent(event: RazorpayWebhookEventRecord): Promise<void>;
  getAllWebhookEvents(): Promise<RazorpayWebhookEventRecord[]>;
  clear?(): void;
}

// =========================================================================
// Default In-Memory Persistence Adapter (Swappable for Server Firestore on GCP Upgrade)
// =========================================================================
class InMemoryRazorpayStore implements RazorpayPersistenceAdapter {
  private paymentsByOrderId = new Map<string, RazorpayPaymentRecord>();
  private webhookEvents = new Map<string, RazorpayWebhookEventRecord>();

  async savePayment(record: RazorpayPaymentRecord): Promise<void> {
    this.paymentsByOrderId.set(record.razorpayOrderId, structuredClone(record));
  }

  async getPaymentByOrderId(orderId: string): Promise<RazorpayPaymentRecord | null> {
    const rec = this.paymentsByOrderId.get(orderId);
    return rec ? structuredClone(rec) : null;
  }

  async getPaymentByPaymentId(paymentId: string): Promise<RazorpayPaymentRecord | null> {
    for (const rec of this.paymentsByOrderId.values()) {
      if (rec.razorpayPaymentId === paymentId) {
        return structuredClone(rec);
      }
    }
    return null;
  }

  async getPaymentsByApplicationId(applicationId: string): Promise<RazorpayPaymentRecord[]> {
    const matches: RazorpayPaymentRecord[] = [];
    for (const rec of this.paymentsByOrderId.values()) {
      if (rec.applicationId === applicationId) {
        matches.push(structuredClone(rec));
      }
    }
    return matches.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getAllPayments(): Promise<RazorpayPaymentRecord[]> {
    return Array.from(this.paymentsByOrderId.values())
      .map((r) => structuredClone(r))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async hasWebhookEvent(eventId: string): Promise<boolean> {
    return this.webhookEvents.has(eventId);
  }

  async saveWebhookEvent(event: RazorpayWebhookEventRecord): Promise<void> {
    this.webhookEvents.set(event.eventId, structuredClone(event));
  }

  async getAllWebhookEvents(): Promise<RazorpayWebhookEventRecord[]> {
    return Array.from(this.webhookEvents.values())
      .map((e) => structuredClone(e))
      .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  }

  clear(): void {
    this.paymentsByOrderId.clear();
    this.webhookEvents.clear();
  }
}

let activeStore: RazorpayPersistenceAdapter = new InMemoryRazorpayStore();
let apiClientOverride: RazorpayApiClient | null = null;

export function setRazorpayPersistenceAdapter(adapter: RazorpayPersistenceAdapter): void {
  activeStore = adapter;
}

export function getRazorpayPersistenceAdapter(): RazorpayPersistenceAdapter {
  return activeStore;
}

export function setRazorpayApiClientOverride(client: RazorpayApiClient | null): void {
  apiClientOverride = client;
}

// =========================================================================
// Rate Limiting (Sliding Window)
// =========================================================================
const orderRateLimitMap = new Map<string, { count: number; resetAt: number }>();
const verifyRateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function resetRazorpayRateLimits(): void {
  orderRateLimitMap.clear();
  verifyRateLimitMap.clear();
}

function checkRateLimit(
  bucket: Map<string, { count: number; resetAt: number }>,
  key: string,
  maxRequests: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const entry = bucket.get(key);
  if (!entry || now > entry.resetAt) {
    bucket.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxRequests) {
    return false;
  }
  entry.count += 1;
  return true;
}

// =========================================================================
// Configuration & Cryptographic Primitives
// =========================================================================
export function getRazorpayConfigStatus(): RazorpayConfigStatus {
  const keyId = (process.env.RAZORPAY_KEY_ID || '').trim();
  const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
  const webhookSecret = (process.env.RAZORPAY_WEBHOOK_SECRET || '').trim();

  // Auto-detect 'live' vs 'test' from RAZORPAY_KEY_ID prefix when RAZORPAY_MODE is omitted,
  // while preserving strict mismatch protection when RAZORPAY_MODE is explicitly configured.
  const explicitMode = (process.env.RAZORPAY_MODE || '').toLowerCase().trim();
  const mode: 'test' | 'live' =
    explicitMode === 'live'
      ? 'live'
      : explicitMode === 'test'
      ? 'test'
      : keyId.startsWith('rzp_live_')
      ? 'live'
      : 'test';

  const missingEnvVars: string[] = [];
  if (!keyId) missingEnvVars.push('RAZORPAY_KEY_ID');
  if (!keySecret) missingEnvVars.push('RAZORPAY_KEY_SECRET');

  const keyModeMismatch =
    Boolean(keyId) &&
    ((mode === 'test' && keyId.startsWith('rzp_live_')) ||
      (mode === 'live' && keyId.startsWith('rzp_test_')));

  const rawGstMode = (process.env.RAZORPAY_GST_MODE || 'not_applicable').toLowerCase().trim();
  const gstMode: 'excluded' | 'included' | 'not_applicable' =
    rawGstMode === 'excluded' || rawGstMode === 'included' ? rawGstMode : 'not_applicable';
  const rawGstRate = Number(process.env.RAZORPAY_GST_RATE_PERCENT || '18');
  const gstRatePercent = gstMode === 'not_applicable' || !Number.isFinite(rawGstRate) ? 0 : rawGstRate;

  return {
    provider: 'razorpay_standard_checkout',
    mode,
    configured: Boolean(keyId && keySecret && !keyModeMismatch),
    keyIdPresent: Boolean(keyId),
    keySecretPresent: Boolean(keySecret),
    webhookSecretPresent: Boolean(webhookSecret),
    publicKeyId: keyId || null,
    keyModeMismatch,
    missingEnvVars,
    gstMode,
    gstRatePercent
  };
}

export function timingSafeHexCompare(a: string, b: string): boolean {
  if (!a || !b || typeof a !== 'string' || typeof b !== 'string') return false;
  const cleanA = a.trim().toLowerCase();
  const cleanB = b.trim().toLowerCase();
  if (cleanA.length !== cleanB.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(cleanA, 'utf8'), Buffer.from(cleanB, 'utf8'));
  } catch {
    return false;
  }
}

/**
 * Computes Razorpay Standard Checkout payment signature:
 * HMAC_SHA256(server_saved_order_id + "|" + razorpay_payment_id, RAZORPAY_KEY_SECRET)
 */
export function computeRazorpayPaymentSignature(
  serverOrderId: string,
  paymentId: string,
  keySecret: string
): string {
  return crypto
    .createHmac('sha256', keySecret)
    .update(`${serverOrderId}|${paymentId}`)
    .digest('hex');
}

export function verifyRazorpayCheckoutSignature(
  serverOrderId: string,
  paymentId: string,
  providedSignature: string,
  keySecret: string
): boolean {
  if (!serverOrderId || !paymentId || !providedSignature || !keySecret) return false;
  const expected = computeRazorpayPaymentSignature(serverOrderId, paymentId, keySecret);
  return timingSafeHexCompare(expected, providedSignature);
}

/**
 * Computes & verifies Razorpay Webhook signature on exact raw request body:
 * HMAC_SHA256(rawBody, RAZORPAY_WEBHOOK_SECRET)
 */
export function computeRazorpayWebhookSignature(rawBody: string, webhookSecret: string): string {
  return crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
}

export function verifyRazorpayRawWebhookSignature(
  rawBody: string,
  providedSignature: string,
  webhookSecret: string
): boolean {
  if (!rawBody || !providedSignature || !webhookSecret) return false;
  const expected = computeRazorpayWebhookSignature(rawBody, webhookSecret);
  return timingSafeHexCompare(expected, providedSignature);
}

// =========================================================================
// Direct Applicant Checkout Identity & Signed Stateless Order Token
// =========================================================================
const EPHEMERAL_CHECKOUT_FALLBACK = crypto.randomBytes(32).toString('hex');

function getCheckoutTokenSecret(): string {
  return (
    (process.env.RAZORPAY_KEY_SECRET || '').trim() ||
    (process.env.SESSION_SECRET || '').trim() ||
    EPHEMERAL_CHECKOUT_FALLBACK
  );
}

/**
 * Deterministically derives a non-privileged guest applicant UID from their email address
 * for direct Razorpay checkout without Google Sign-In.
 */
export function deriveGuestApplicantUid(email: string): string {
  const normalized = String(email || '').trim().toLowerCase();
  const digest = crypto.createHash('sha256').update(`tdg_guest:${normalized}`).digest('hex').slice(0, 20);
  return `guest_${digest}`;
}

export interface SignedCheckoutTokenClaims {
  orderId: string;
  applicationId: string;
  userId: string;
  applicantName: string;
  email: string;
  phone: string;
  planId: string;
  planTitle: string;
  paymentPurpose: 'application_fee' | 'franchise_deposit';
  baseAmountINR: number;
  gstRatePercent: number;
  gstAmountINR: number;
  finalAmountINR: number;
  amountPaise: number;
  gstMode: 'excluded' | 'included' | 'not_applicable';
  orderReceipt: string;
  mode: 'test' | 'live';
  exp: number;
}

/**
 * Issues a server-signed HMAC-SHA256 checkout token binding an authoritative Razorpay order
 * to its applicant and server-calculated pricing so verification works cleanly across stateless
 * Vercel serverless containers and direct (non-Google-signed-in) applicant checkouts.
 */
export function createSignedCheckoutToken(record: RazorpayPaymentRecord): string {
  const claims: SignedCheckoutTokenClaims = {
    orderId: record.razorpayOrderId,
    applicationId: record.applicationId,
    userId: record.userId,
    applicantName: record.applicantName,
    email: record.email,
    phone: record.phone,
    planId: record.planId,
    planTitle: record.planTitle,
    paymentPurpose: record.paymentPurpose,
    baseAmountINR: record.baseAmountINR,
    gstRatePercent: record.gstRatePercent,
    gstAmountINR: record.gstAmountINR,
    finalAmountINR: record.finalAmountINR,
    amountPaise: record.amountPaise,
    gstMode: record.gstMode,
    orderReceipt: record.orderReceipt,
    mode: record.mode,
    exp: Date.now() + 2 * 60 * 60 * 1000 // 2 hours
  };
  const payloadB64 = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getCheckoutTokenSecret())
    .update(`tdg_rzp_checkout:${payloadB64}`)
    .digest('hex');
  return `${payloadB64}.${sig}`;
}

export function verifySignedCheckoutToken(token: string): {
  valid: boolean;
  claims?: SignedCheckoutTokenClaims;
  error?: string;
} {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Missing checkout verification token.' };
  }
  const parts = token.trim().split('.');
  if (parts.length !== 2) {
    return { valid: false, error: 'Malformed checkout verification token.' };
  }
  const [payloadB64, providedSig] = parts;
  if (!payloadB64 || !providedSig) {
    return { valid: false, error: 'Malformed checkout verification token.' };
  }

  const expectedSig = crypto
    .createHmac('sha256', getCheckoutTokenSecret())
    .update(`tdg_rzp_checkout:${payloadB64}`)
    .digest('hex');

  if (!timingSafeHexCompare(expectedSig, providedSig)) {
    return { valid: false, error: 'Invalid checkout verification token signature.' };
  }

  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as SignedCheckoutTokenClaims;
    if (
      !parsed ||
      typeof parsed.orderId !== 'string' ||
      typeof parsed.applicationId !== 'string' ||
      typeof parsed.userId !== 'string' ||
      typeof parsed.amountPaise !== 'number' ||
      !Number.isInteger(parsed.amountPaise) ||
      parsed.amountPaise < 100 ||
      typeof parsed.exp !== 'number'
    ) {
      return { valid: false, error: 'Invalid checkout token payload.' };
    }
    if (Date.now() > parsed.exp) {
      return { valid: false, error: 'Checkout verification token has expired.' };
    }
    return { valid: true, claims: parsed };
  } catch {
    return { valid: false, error: 'Unable to decode checkout verification token.' };
  }
}

function hydrateRecordFromSignedClaims(claims: SignedCheckoutTokenClaims, source: 'verify_api' | 'checkout_client'): RazorpayPaymentRecord {
  const nowIso = new Date().toISOString();
  return {
    paymentRecordId: `rzp_${claims.orderId}`,
    gateway: 'razorpay',
    applicationId: claims.applicationId,
    userId: claims.userId,
    applicantName: claims.applicantName,
    email: claims.email,
    phone: claims.phone,
    planId: claims.planId,
    planTitle: claims.planTitle,
    paymentPurpose: claims.paymentPurpose,
    baseAmountINR: claims.baseAmountINR,
    gstRatePercent: claims.gstRatePercent,
    gstAmountINR: claims.gstAmountINR,
    finalAmountINR: claims.finalAmountINR,
    amountPaise: claims.amountPaise,
    currency: 'INR',
    gstMode: claims.gstMode,
    razorpayOrderId: claims.orderId,
    signatureVerified: false,
    captureStatus: 'unpaid',
    paymentStatus: 'CREATED',
    refundStatus: 'none',
    orderReceipt: claims.orderReceipt,
    attemptHistory: [
      {
        timestamp: nowIso,
        event: 'order.hydrated_from_signed_token',
        status: 'CREATED',
        details: `Hydrated server-signed Razorpay order ${claims.orderId} for ₹${claims.finalAmountINR.toFixed(2)} INR.`,
        source
      }
    ],
    internalNotes: [],
    mode: claims.mode,
    createdAt: nowIso,
    updatedAt: nowIso
  };
}

function getOfficialRazorpayClient(): RazorpayApiClient {
  if (apiClientOverride) {
    return apiClientOverride;
  }

  const keyId = (process.env.RAZORPAY_KEY_ID || '').trim();
  const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();

  const sdk = new Razorpay({
    key_id: keyId,
    key_secret: keySecret
  });

  return {
    async createOrder(params) {
      const order: any = await sdk.orders.create({
        amount: params.amount,
        currency: params.currency,
        receipt: params.receipt,
        notes: params.notes
      });
      return {
        id: String(order.id),
        amount: Number(order.amount),
        currency: String(order.currency || 'INR'),
        receipt: String(order.receipt || params.receipt),
        status: String(order.status || 'created')
      };
    },
    async fetchPayment(paymentId: string) {
      const payment: any = await sdk.payments.fetch(paymentId);
      return {
        id: String(payment.id),
        order_id: payment.order_id ? String(payment.order_id) : undefined,
        amount: Number(payment.amount),
        currency: String(payment.currency || 'INR'),
        status: String(payment.status || ''),
        captured: Boolean(payment.captured),
        method: payment.method ? String(payment.method) : undefined,
        bank: payment.bank ?? null,
        wallet: payment.wallet ?? null,
        vpa: payment.vpa ?? null,
        card: payment.card
          ? {
              last4: payment.card.last4,
              network: payment.card.network,
              type: payment.card.type
            }
          : null,
        error_description: payment.error_description ?? null,
        created_at: typeof payment.created_at === 'number' ? payment.created_at : undefined
      };
    },
    async fetchOrderPayments(orderId: string) {
      const resp: any = await sdk.orders.fetchPayments(orderId);
      const items = Array.isArray(resp?.items) ? resp.items : [];
      return {
        items: items.map((payment: any) => ({
          id: String(payment.id),
          order_id: payment.order_id ? String(payment.order_id) : undefined,
          amount: Number(payment.amount),
          currency: String(payment.currency || 'INR'),
          status: String(payment.status || ''),
          captured: Boolean(payment.captured),
          method: payment.method ? String(payment.method) : undefined,
          bank: payment.bank ?? null,
          wallet: payment.wallet ?? null,
          vpa: payment.vpa ?? null,
          card: payment.card
            ? {
                last4: payment.card.last4,
                network: payment.card.network,
                type: payment.card.type
              }
            : null,
          error_description: payment.error_description ?? null,
          created_at: typeof payment.created_at === 'number' ? payment.created_at : undefined
        }))
      };
    },
    async createRefund(paymentId, params) {
      const refund: any = await sdk.payments.refund(paymentId, {
        amount: params.amount,
        notes: params.notes
      });
      return {
        id: String(refund.id),
        payment_id: String(refund.payment_id || paymentId),
        amount: Number(refund.amount),
        currency: String(refund.currency || 'INR'),
        status: String(refund.status || 'processed')
      };
    }
  };
}

function summarizePaymentMethod(payment: RazorpayApiPaymentResponse): string | undefined {
  if (!payment.method) return undefined;
  if (payment.method === 'upi' && payment.vpa) {
    return `UPI (${payment.vpa})`;
  }
  if (payment.method === 'netbanking' && payment.bank) {
    return `NetBanking (${payment.bank})`;
  }
  if (payment.method === 'wallet' && payment.wallet) {
    return `Wallet (${payment.wallet})`;
  }
  if (payment.method === 'card' && payment.card?.last4) {
    return `Card (${payment.card.network || ''} •••• ${payment.card.last4})`.trim();
  }
  return payment.method.toUpperCase();
}

function generateVerifiedReceiptNumber(orderId: string): string {
  const year = new Date().getFullYear();
  const suffix = orderId.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase();
  return `REC-TDG-${year}-${suffix}`;
}

function generateOrderReceipt(applicationId: string): string {
  // Razorpay receipt max length is 40 chars
  const cleanApp = applicationId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 18);
  const rand = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `TDG_${cleanApp}_${rand}`.slice(0, 40);
}

// =========================================================================
// PHASE 3 — CREATE RAZORPAY ORDER (Server-Authoritative Pricing & GST)
// =========================================================================
export interface CreateRazorpayOrderInput {
  applicationId: string;
  planId: string;
  paymentPurpose?: 'application_fee' | 'franchise_deposit';
  userId: string;
  applicantName: string;
  email: string;
  phone: string;
  termsAccepted?: boolean;
  forceNewOrder?: boolean;
  clientIp?: string;
}

export interface CreateRazorpayOrderResult {
  ok: boolean;
  statusCode: number;
  error?: string;
  message?: string;
  reusedOrder?: boolean;
  order_id?: string;
  amount?: number; // paise
  currency?: 'INR';
  order?: {
    id: string;
    amount: number; // paise
    currency: 'INR';
    receipt: string;
    keyId: string;
    mode: 'test' | 'live';
    businessName: string;
    description: string;
    prefill: {
      name: string;
      email: string;
      contact: string;
    };
    notes: Record<string, string>;
  };
  pricing?: {
    planId: string;
    planTitle: string;
    baseAmountINR: number;
    gstRatePercent: number;
    gstAmountINR: number;
    finalAmountINR: number;
    amountPaise: number;
    gstMode: 'excluded' | 'included' | 'not_applicable';
    currency: 'INR';
  };
  checkoutToken?: string;
  paymentRecord?: RazorpayPaymentRecord;
}

export async function createRazorpayOrder(
  input: CreateRazorpayOrderInput
): Promise<CreateRazorpayOrderResult> {
  const rateKey = `${input.clientIp || 'unknown'}:${input.userId}`;
  if (!checkRateLimit(orderRateLimitMap, rateKey, 15, 10 * 60 * 1000)) {
    return {
      ok: false,
      statusCode: 429,
      error: 'rate_limited',
      message: 'Too many payment order requests. Please wait a few minutes and try again.'
    };
  }

  const applicationId = String(input.applicationId || '').trim();
  const planId = String(input.planId || '').trim();
  const applicantName = String(input.applicantName || '').trim();
  const email = String(input.email || '').trim().toLowerCase();
  const phone = String(input.phone || '').replace(/[^\d+]/g, '').slice(0, 15);

  if (!applicationId || applicationId === 'PENDING' || !/^[a-zA-Z0-9_-]{3,64}$/.test(applicationId)) {
    return {
      ok: false,
      statusCode: 400,
      error: 'missing_application',
      message: 'A valid submitted Application Reference ID is required before creating a Razorpay order.'
    };
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return {
      ok: false,
      statusCode: 400,
      error: 'invalid_customer_email',
      message: 'A valid verified applicant email address is required.'
    };
  }

  if (applicantName.length < 2 || applicantName.length > 120) {
    return {
      ok: false,
      statusCode: 400,
      error: 'invalid_customer_name',
      message: 'Applicant full name must be between 2 and 120 characters.'
    };
  }

  if (input.termsAccepted === false) {
    return {
      ok: false,
      statusCode: 400,
      error: 'terms_not_accepted',
      message: 'You must accept the Refund Policy, Cancellation Policy, and Terms & Conditions before paying.'
    };
  }

  const plan = getAuthoritativePlan(planId);
  const fee = calculateServerPlanAmount(planId);
  if (!plan || !fee) {
    return {
      ok: false,
      statusCode: 400,
      error: 'invalid_package',
      message: `Franchise package "${planId}" is invalid or inactive.`
    };
  }

  if (!Number.isInteger(fee.totalAmountPaise) || fee.totalAmountPaise < 100) {
    return {
      ok: false,
      statusCode: 400,
      error: 'invalid_amount',
      message: 'Calculated payable amount must be at least 100 paise (₹1.00 INR).'
    };
  }

  const config = getRazorpayConfigStatus();
  if (config.keyModeMismatch) {
    return {
      ok: false,
      statusCode: 503,
      error: 'razorpay_mode_mismatch',
      message: `Server configuration error: RAZORPAY_MODE="${config.mode}" does not match the configured RAZORPAY_KEY_ID prefix.`
    };
  }

  if (!config.configured || !config.publicKeyId) {
    return {
      ok: false,
      statusCode: 503,
      error: 'razorpay_not_configured',
      message:
        'Razorpay checkout is awaiting server-side RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET configuration in Vercel Environment Variables.'
    };
  }

  // Idempotency & double-payment protection
  const existingPayments = await activeStore.getPaymentsByApplicationId(applicationId);
  const alreadyCaptured = existingPayments.find(
    (p) => p.planId === plan.id && p.paymentStatus === 'CAPTURED'
  );
  if (alreadyCaptured) {
    return {
      ok: false,
      statusCode: 409,
      error: 'already_paid',
      message: `Application ${applicationId} already has a verified captured payment (${alreadyCaptured.razorpayPaymentId || alreadyCaptured.razorpayOrderId}).`
    };
  }

  // Reuse an active CREATED/PENDING order created within the last 10 minutes to guard against double clicks
  if (!input.forceNewOrder) {
    const tenMinAgo = Date.now() - 10 * 60 * 1000;
    const reusable = existingPayments.find(
      (p) =>
        p.userId === input.userId &&
        p.planId === plan.id &&
        p.amountPaise === fee.totalAmountPaise &&
        (p.paymentStatus === 'CREATED' || p.paymentStatus === 'PENDING') &&
        new Date(p.createdAt).getTime() >= tenMinAgo
    );
    if (reusable) {
      return {
        ok: true,
        statusCode: 200,
        reusedOrder: true,
        order_id: reusable.razorpayOrderId,
        amount: reusable.amountPaise,
        currency: 'INR',
        order: {
          id: reusable.razorpayOrderId,
          amount: reusable.amountPaise,
          currency: 'INR',
          receipt: reusable.orderReceipt,
          keyId: config.publicKeyId,
          mode: config.mode,
          businessName: 'TRUEDEAL GLOBAL OPC PVT LTD',
          description: `${plan.title} — Franchise Application #${applicationId}`,
          prefill: {
            name: applicantName,
            email,
            contact: phone
          },
          notes: {
            applicationId,
            planId: plan.id,
            planTitle: plan.title,
            userId: input.userId
          }
        },
        pricing: {
          planId: plan.id,
          planTitle: plan.title,
          baseAmountINR: fee.baseAmountINR,
          gstRatePercent: fee.gstRatePercent,
          gstAmountINR: fee.gstAmountINR,
          finalAmountINR: fee.totalAmountINR,
          amountPaise: fee.totalAmountPaise,
          gstMode: fee.gstMode,
          currency: 'INR'
        },
        checkoutToken: createSignedCheckoutToken(reusable),
        paymentRecord: reusable
      };
    }
  }

  const orderReceipt = generateOrderReceipt(applicationId);
  const paymentPurpose = input.paymentPurpose === 'application_fee' ? 'application_fee' : 'franchise_deposit';
  const notes: Record<string, string> = {
    applicationId,
    planId: plan.id,
    planTitle: plan.title,
    userId: input.userId,
    paymentPurpose,
    company: 'TRUEDEAL GLOBAL OPC PVT LTD'
  };

  let createdOrder: RazorpayApiOrderResponse;
  try {
    const client = getOfficialRazorpayClient();
    createdOrder = await client.createOrder({
      amount: fee.totalAmountPaise,
      currency: 'INR',
      receipt: orderReceipt,
      notes
    });
  } catch (err: any) {
    const statusCode = Number(err?.statusCode || err?.error?.statusCode || 0);
    if (statusCode === 401 || statusCode === 403 || /authentication failed/i.test(String(err?.error?.description || err?.message || ''))) {
      return {
        ok: false,
        statusCode: 401,
        error: 'razorpay_auth_failed',
        message: 'Razorpay authentication failed on server. Please verify RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.'
      };
    }
    return {
      ok: false,
      statusCode: 500,
      error: 'razorpay_api_error',
      message: 'Unable to create Razorpay order right now. Please try again shortly.'
    };
  }

  const nowIso = new Date().toISOString();
  const record: RazorpayPaymentRecord = {
    paymentRecordId: `rzp_${createdOrder.id}`,
    gateway: 'razorpay',
    applicationId,
    userId: input.userId,
    applicantName,
    email,
    phone,
    planId: plan.id,
    planTitle: plan.title,
    paymentPurpose,
    baseAmountINR: fee.baseAmountINR,
    gstRatePercent: fee.gstRatePercent,
    gstAmountINR: fee.gstAmountINR,
    finalAmountINR: fee.totalAmountINR,
    amountPaise: fee.totalAmountPaise,
    currency: 'INR',
    gstMode: fee.gstMode,
    razorpayOrderId: createdOrder.id,
    signatureVerified: false,
    captureStatus: 'unpaid',
    paymentStatus: 'CREATED',
    refundStatus: 'none',
    orderReceipt,
    attemptHistory: [
      {
        timestamp: nowIso,
        event: 'order.created',
        status: 'CREATED',
        details: `Created Razorpay order ${createdOrder.id} for ₹${fee.totalAmountINR.toFixed(2)} INR (${fee.totalAmountPaise} paise).`,
        source: 'create_order'
      }
    ],
    internalNotes: [],
    mode: config.mode,
    createdAt: nowIso,
    updatedAt: nowIso
  };

  await activeStore.savePayment(record);

  return {
    ok: true,
    statusCode: 201,
    reusedOrder: false,
    order_id: createdOrder.id,
    amount: fee.totalAmountPaise,
    currency: 'INR',
    order: {
      id: createdOrder.id,
      amount: fee.totalAmountPaise,
      currency: 'INR',
      receipt: orderReceipt,
      keyId: config.publicKeyId,
      mode: config.mode,
      businessName: 'TRUEDEAL GLOBAL OPC PVT LTD',
      description: `${plan.title} — Franchise Application #${applicationId}`,
      prefill: {
        name: applicantName,
        email,
        contact: phone
      },
      notes
    },
    pricing: {
      planId: plan.id,
      planTitle: plan.title,
      baseAmountINR: fee.baseAmountINR,
      gstRatePercent: fee.gstRatePercent,
      gstAmountINR: fee.gstAmountINR,
      finalAmountINR: fee.totalAmountINR,
      amountPaise: fee.totalAmountPaise,
      gstMode: fee.gstMode,
      currency: 'INR'
    },
    checkoutToken: createSignedCheckoutToken(record),
    paymentRecord: record
  };
}

// =========================================================================
// PHASE 5 — VERIFY PAYMENT SIGNATURE + RAZORPAY CAPTURE STATUS
// =========================================================================
export interface VerifyRazorpayPaymentInput {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  applicationId?: string;
  checkoutToken?: string;
  callerUid: string;
  callerIsAdmin?: boolean;
  clientIp?: string;
}

export interface VerifyRazorpayPaymentResult {
  ok: boolean;
  verified: boolean;
  captured: boolean;
  statusCode: number;
  paymentStatus: RazorpayPaymentStatus;
  error?: string;
  message: string;
  paymentRecord?: RazorpayPaymentRecord;
  emailDispatched?: boolean;
}

export async function verifyRazorpayPayment(
  input: VerifyRazorpayPaymentInput
): Promise<VerifyRazorpayPaymentResult> {
  const rateKey = `${input.clientIp || 'unknown'}:${input.callerUid}`;
  if (!checkRateLimit(verifyRateLimitMap, rateKey, 25, 10 * 60 * 1000)) {
    return {
      ok: false,
      verified: false,
      captured: false,
      statusCode: 429,
      paymentStatus: 'VERIFICATION_REQUIRED',
      error: 'rate_limited',
      message: 'Too many verification attempts. Please wait a moment and try again.'
    };
  }

  const orderId = String(input.razorpay_order_id || '').trim();
  const paymentId = String(input.razorpay_payment_id || '').trim();
  const signature = String(input.razorpay_signature || '').trim();

  if (!orderId || !paymentId || !signature) {
    return {
      ok: false,
      verified: false,
      captured: false,
      statusCode: 400,
      paymentStatus: 'FAILED',
      error: 'missing_verification_fields',
      message: 'razorpay_order_id, razorpay_payment_id, and razorpay_signature are all required.'
    };
  }

  const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
  if (!keySecret) {
    return {
      ok: false,
      verified: false,
      captured: false,
      statusCode: 503,
      paymentStatus: 'VERIFICATION_REQUIRED',
      error: 'razorpay_not_configured',
      message: 'Server payment secret is not configured.'
    };
  }

  // Strictly look up server-saved order record (or hydrate from server-signed checkoutToken across stateless serverless containers)
  let record = await activeStore.getPaymentByOrderId(orderId);
  if (!record && input.checkoutToken) {
    const tokenCheck = verifySignedCheckoutToken(input.checkoutToken);
    if (tokenCheck.valid && tokenCheck.claims && tokenCheck.claims.orderId === orderId) {
      record = hydrateRecordFromSignedClaims(tokenCheck.claims, 'verify_api');
      await activeStore.savePayment(record);
    }
  }
  if (!record) {
    return {
      ok: false,
      verified: false,
      captured: false,
      statusCode: 404,
      paymentStatus: 'FAILED',
      error: 'order_not_found',
      message: 'No matching server-created Razorpay order found for verification.'
    };
  }

  if (input.applicationId && input.applicationId.trim() !== record.applicationId) {
    return {
      ok: false,
      verified: false,
      captured: false,
      statusCode: 400,
      paymentStatus: record.paymentStatus,
      error: 'application_mismatch',
      message: 'Order ID does not belong to the specified franchise application.'
    };
  }

  if (!input.callerIsAdmin && record.userId !== input.callerUid) {
    return {
      ok: false,
      verified: false,
      captured: false,
      statusCode: 403,
      paymentStatus: record.paymentStatus,
      error: 'forbidden',
      message: 'You are not authorized to verify this payment order.'
    };
  }

  // Already captured & verified (idempotent response)
  if (record.paymentStatus === 'CAPTURED' && record.signatureVerified && record.razorpayPaymentId === paymentId) {
    return {
      ok: true,
      verified: true,
      captured: true,
      statusCode: 200,
      paymentStatus: 'CAPTURED',
      message: 'Payment already verified and captured.',
      paymentRecord: record,
      emailDispatched: Boolean(record.confirmationEmailSent)
    };
  }

  // 1. Constant-time HMAC-SHA256 verification using SERVER-SAVED order ID
  const sigValid = verifyRazorpayCheckoutSignature(
    record.razorpayOrderId,
    paymentId,
    signature,
    keySecret
  );

  const nowIso = new Date().toISOString();

  if (!sigValid) {
    record.attemptHistory.push({
      timestamp: nowIso,
      event: 'signature.rejected',
      status: record.paymentStatus === 'CAPTURED' ? 'CAPTURED' : 'FAILED',
      razorpayPaymentId: paymentId,
      details: 'HMAC-SHA256 signature verification failed against server-saved order ID.',
      source: 'verify_api'
    });
    if (record.paymentStatus !== 'CAPTURED') {
      record.signatureVerified = false;
      record.paymentStatus = 'FAILED';
      record.captureStatus = 'failed';
      record.failureReason = 'Invalid cryptographic payment signature.';
    }
    record.updatedAt = nowIso;
    await activeStore.savePayment(record);

    return {
      ok: false,
      verified: false,
      captured: false,
      statusCode: 400,
      paymentStatus: record.paymentStatus,
      error: 'invalid_signature',
      message: 'Payment signature verification failed. Application was NOT marked as paid.'
    };
  }

  // 2. Signature matched! Now fetch authoritative payment state from Razorpay Payments API
  let rzpPayment: RazorpayApiPaymentResponse;
  try {
    const client = getOfficialRazorpayClient();
    rzpPayment = await client.fetchPayment(paymentId);
  } catch {
    record.signatureVerified = true;
    record.razorpayPaymentId = paymentId;
    if (record.paymentStatus !== 'CAPTURED') {
      record.paymentStatus = 'VERIFICATION_REQUIRED';
    }
    record.attemptHistory.push({
      timestamp: nowIso,
      event: 'payment.fetch_deferred',
      status: record.paymentStatus,
      razorpayPaymentId: paymentId,
      details: 'Signature verified, but live Razorpay payment fetch could not complete. Awaiting webhook/reconciliation.',
      source: 'verify_api'
    });
    record.updatedAt = nowIso;
    await activeStore.savePayment(record);

    return {
      ok: false,
      verified: false,
      captured: false,
      statusCode: 502,
      paymentStatus: record.paymentStatus,
      error: 'razorpay_fetch_failed',
      message: 'Payment signature matched, but confirmation from Razorpay is pending. Do not pay again — wait for verification.',
      paymentRecord: record
    };
  }

  // 3. Validate order_id, amount, and currency match server-saved record
  if (
    (rzpPayment.order_id && rzpPayment.order_id !== record.razorpayOrderId) ||
    rzpPayment.amount !== record.amountPaise ||
    String(rzpPayment.currency || '').toUpperCase() !== 'INR'
  ) {
    record.attemptHistory.push({
      timestamp: nowIso,
      event: 'payment.mismatch_rejected',
      status: record.paymentStatus === 'CAPTURED' ? 'CAPTURED' : 'VERIFICATION_REQUIRED',
      razorpayPaymentId: paymentId,
      details: `Amount/Currency/Order mismatch from Razorpay API (got ${rzpPayment.amount} ${rzpPayment.currency} for order ${rzpPayment.order_id}).`,
      source: 'verify_api'
    });
    if (record.paymentStatus !== 'CAPTURED') {
      record.paymentStatus = 'VERIFICATION_REQUIRED';
      record.failureReason = 'Amount or currency mismatch detected during Razorpay verification.';
    }
    record.updatedAt = nowIso;
    await activeStore.savePayment(record);

    return {
      ok: false,
      verified: false,
      captured: false,
      statusCode: 400,
      paymentStatus: record.paymentStatus,
      error: 'amount_or_currency_mismatch',
      message: 'Payment amount, currency, or order ID did not match the server order. Flagged for verification.',
      paymentRecord: record
    };
  }

  record.signatureVerified = true;
  record.razorpayPaymentId = paymentId;
  record.paymentMethod = rzpPayment.method || record.paymentMethod;
  record.paymentMethodDetails = summarizePaymentMethod(rzpPayment) || record.paymentMethodDetails;

  const isCaptured = rzpPayment.status === 'captured' || rzpPayment.captured === true;

  if (isCaptured) {
    record.paymentStatus = 'CAPTURED';
    record.captureStatus = 'captured';
    record.receiptNumber = record.receiptNumber || generateVerifiedReceiptNumber(record.razorpayOrderId);
    record.paymentTimestamp = rzpPayment.created_at
      ? new Date(rzpPayment.created_at * 1000).toISOString()
      : nowIso;
    record.verifiedAt = nowIso;
    record.failureReason = undefined;
    record.attemptHistory.push({
      timestamp: nowIso,
      event: 'payment.verified_captured',
      status: 'CAPTURED',
      razorpayPaymentId: paymentId,
      details: `HMAC signature verified and Razorpay confirmed payment captured (${record.paymentMethodDetails || 'INR'}). Receipt: ${record.receiptNumber}.`,
      source: 'verify_api'
    });
    record.updatedAt = nowIso;

    let emailDispatched = Boolean(record.confirmationEmailSent);
    if (!emailDispatched) {
      const emailRes = await sendTransactionalFranchiseEmail({
        event: 'payment_success_receipt',
        toEmail: record.email,
        applicantName: record.applicantName,
        applicationId: record.applicationId,
        planName: record.planTitle,
        amountINR: record.finalAmountINR,
        txnId: record.razorpayOrderId,
        payuTransactionId: paymentId,
        gatewayName: 'Razorpay',
        baseAmountINR: record.baseAmountINR,
        gstAmountINR: record.gstAmountINR,
        receiptNumber: record.receiptNumber
      });
      emailDispatched = emailRes.sent;
      record.confirmationEmailSent = emailDispatched;
    }

    await activeStore.savePayment(record);

    return {
      ok: true,
      verified: true,
      captured: true,
      statusCode: 200,
      paymentStatus: 'CAPTURED',
      message: 'Payment verified and captured successfully. Franchise application remains queued for administrative approval.',
      paymentRecord: record,
      emailDispatched
    };
  }

  // Authorized is NEVER treated as Captured/Paid
  if (rzpPayment.status === 'authorized') {
    if (record.paymentStatus !== 'CAPTURED') {
      record.paymentStatus = 'AUTHORIZED';
      record.captureStatus = 'authorized';
    }
    record.attemptHistory.push({
      timestamp: nowIso,
      event: 'payment.authorized_pending_capture',
      status: record.paymentStatus,
      razorpayPaymentId: paymentId,
      details: 'Payment is authorized by bank/Razorpay but NOT yet captured. Awaiting capture confirmation via webhook.',
      source: 'verify_api'
    });
    record.updatedAt = nowIso;
    await activeStore.savePayment(record);

    return {
      ok: true,
      verified: true,
      captured: false,
      statusCode: 202,
      paymentStatus: record.paymentStatus,
      message: 'Payment is authorized and pending final capture verification. Please check your Application Tracker shortly.',
      paymentRecord: record
    };
  }

  // Failed or unexpected status
  if (record.paymentStatus !== 'CAPTURED') {
    record.paymentStatus = rzpPayment.status === 'failed' ? 'FAILED' : 'VERIFICATION_REQUIRED';
    record.captureStatus = rzpPayment.status === 'failed' ? 'failed' : 'unpaid';
    record.failureReason = rzpPayment.error_description || `Razorpay payment status: ${rzpPayment.status}`;
  }
  record.attemptHistory.push({
    timestamp: nowIso,
    event: `payment.${rzpPayment.status || 'unknown'}`,
    status: record.paymentStatus,
    razorpayPaymentId: paymentId,
    details: record.failureReason || 'Payment not captured.',
    source: 'verify_api'
  });
  record.updatedAt = nowIso;
  await activeStore.savePayment(record);

  return {
    ok: false,
    verified: false,
    captured: false,
    statusCode: 402,
    paymentStatus: record.paymentStatus,
    error: 'payment_not_captured',
    message: record.failureReason || 'Payment was not captured.',
    paymentRecord: record
  };
}

// =========================================================================
// RECORD CLIENT CHECKOUT DISMISSAL / FAILURE (Never allowed to set CAPTURED)
// =========================================================================
export async function recordClientCheckoutAttemptEvent(params: {
  razorpayOrderId: string;
  callerUid: string;
  callerIsAdmin?: boolean;
  checkoutToken?: string;
  outcome: 'cancelled' | 'failed';
  reason?: string;
  razorpayPaymentId?: string;
}): Promise<{ ok: boolean; statusCode: number; paymentRecord?: RazorpayPaymentRecord; message: string }> {
  let record = await activeStore.getPaymentByOrderId(params.razorpayOrderId);
  if (!record && params.checkoutToken) {
    const tokenCheck = verifySignedCheckoutToken(params.checkoutToken);
    if (tokenCheck.valid && tokenCheck.claims && tokenCheck.claims.orderId === params.razorpayOrderId) {
      record = hydrateRecordFromSignedClaims(tokenCheck.claims, 'checkout_client');
    }
  }
  if (!record) {
    return { ok: false, statusCode: 404, message: 'Order not found.' };
  }
  if (!params.callerIsAdmin && record.userId !== params.callerUid) {
    return { ok: false, statusCode: 403, message: 'Unauthorized.' };
  }

  // Never downgrade a captured or refunded payment!
  if (
    record.paymentStatus === 'CAPTURED' ||
    record.paymentStatus === 'REFUND_INITIATED' ||
    record.paymentStatus === 'REFUNDED'
  ) {
    return {
      ok: true,
      statusCode: 200,
      paymentRecord: record,
      message: 'Payment is already finalized; client event ignored.'
    };
  }

  const nowIso = new Date().toISOString();
  const nextStatus: RazorpayPaymentStatus = params.outcome === 'cancelled' ? 'CANCELLED' : 'FAILED';
  record.paymentStatus = nextStatus;
  if (params.outcome === 'failed') {
    record.captureStatus = 'failed';
  }
  if (params.razorpayPaymentId) {
    record.razorpayPaymentId = params.razorpayPaymentId;
  }
  record.failureReason =
    params.reason ||
    (params.outcome === 'cancelled' ? 'Customer dismissed Razorpay Checkout before completing payment.' : 'Payment failed in checkout.');
  record.attemptHistory.push({
    timestamp: nowIso,
    event: params.outcome === 'cancelled' ? 'checkout.dismissed' : 'checkout.failed',
    status: nextStatus,
    razorpayPaymentId: params.razorpayPaymentId,
    details: record.failureReason,
    source: 'checkout_client'
  });
  record.updatedAt = nowIso;

  await activeStore.savePayment(record);
  return { ok: true, statusCode: 200, paymentRecord: record, message: `Recorded ${nextStatus} status.` };
}

// =========================================================================
// PHASE 6 — RAZORPAY WEBHOOK PROCESSOR (Raw Body HMAC + Event Deduplication)
// =========================================================================
export interface ProcessRazorpayWebhookResult {
  ok: boolean;
  statusCode: number;
  duplicate?: boolean;
  eventId?: string;
  eventType?: string;
  paymentStatus?: RazorpayPaymentStatus;
  error?: string;
  message: string;
  paymentRecord?: RazorpayPaymentRecord;
}

export async function processRazorpayWebhook(params: {
  rawBody: string;
  signatureHeader?: string;
  eventIdHeader?: string;
}): Promise<ProcessRazorpayWebhookResult> {
  const webhookSecret = (process.env.RAZORPAY_WEBHOOK_SECRET || '').trim();
  if (!webhookSecret) {
    return {
      ok: false,
      statusCode: 503,
      error: 'webhook_secret_not_configured',
      message: 'RAZORPAY_WEBHOOK_SECRET is not configured on the server.'
    };
  }

  const signature = String(params.signatureHeader || '').trim();
  if (!signature || !verifyRazorpayRawWebhookSignature(params.rawBody, signature, webhookSecret)) {
    return {
      ok: false,
      statusCode: 401,
      error: 'invalid_webhook_signature',
      message: 'Razorpay webhook signature verification failed.'
    };
  }

  let payload: any;
  try {
    payload = JSON.parse(params.rawBody);
  } catch {
    return {
      ok: false,
      statusCode: 400,
      error: 'invalid_json',
      message: 'Webhook body is not valid JSON.'
    };
  }

  const eventType = String(payload?.event || '').trim();
  const paymentEntity = payload?.payload?.payment?.entity;
  const orderEntity = payload?.payload?.order?.entity;
  const refundEntity = payload?.payload?.refund?.entity;

  const rzpOrderId = String(paymentEntity?.order_id || orderEntity?.id || '').trim() || undefined;
  const rzpPaymentId = String(paymentEntity?.id || refundEntity?.payment_id || '').trim() || undefined;
  const rzpRefundId = String(refundEntity?.id || '').trim() || undefined;
  const amountPaise = Number(paymentEntity?.amount ?? orderEntity?.amount_paid ?? refundEntity?.amount ?? 0) || undefined;

  const eventId =
    String(params.eventIdHeader || '').trim() ||
    `rzp_ev_${crypto
      .createHash('sha256')
      .update(`${eventType}|${rzpOrderId || ''}|${rzpPaymentId || ''}|${rzpRefundId || ''}|${payload?.created_at || ''}`)
      .digest('hex')
      .slice(0, 24)}`;

  const nowIso = new Date().toISOString();

  // Deduplication check
  if (await activeStore.hasWebhookEvent(eventId)) {
    return {
      ok: true,
      statusCode: 200,
      duplicate: true,
      eventId,
      eventType,
      message: `Duplicate webhook event ${eventId} acknowledged without reprocessing.`
    };
  }

  // Locate matching payment record by orderId or paymentId
  let record: RazorpayPaymentRecord | null = null;
  if (rzpOrderId) {
    record = await activeStore.getPaymentByOrderId(rzpOrderId);
  }
  if (!record && rzpPaymentId) {
    record = await activeStore.getPaymentByPaymentId(rzpPaymentId);
  }

  let summary = `Received ${eventType}`;

  if (record) {
    if (rzpPaymentId && !record.razorpayPaymentId) {
      record.razorpayPaymentId = rzpPaymentId;
    }

    switch (eventType) {
      case 'payment.authorized': {
        // NEVER treat authorized as captured/paid!
        if (record.paymentStatus !== 'CAPTURED' && record.paymentStatus !== 'REFUND_INITIATED' && record.paymentStatus !== 'REFUNDED') {
          record.paymentStatus = 'AUTHORIZED';
          record.captureStatus = 'authorized';
          record.paymentMethod = paymentEntity?.method || record.paymentMethod;
          record.paymentMethodDetails = summarizePaymentMethod(paymentEntity) || record.paymentMethodDetails;
          summary = `Payment ${rzpPaymentId} authorized (pending capture — NOT marked paid).`;
        } else {
          summary = `Ignored delayed payment.authorized for already finalized order ${record.razorpayOrderId}.`;
        }
        break;
      }

      case 'payment.captured': {
        const entityAmount = Number(paymentEntity?.amount || 0);
        const entityCurrency = String(paymentEntity?.currency || '').toUpperCase();
        if (entityAmount !== record.amountPaise || entityCurrency !== 'INR') {
          record.paymentStatus = 'VERIFICATION_REQUIRED';
          record.failureReason = `Webhook amount/currency mismatch (${entityAmount} ${entityCurrency} vs expected ${record.amountPaise} INR).`;
          summary = record.failureReason;
        } else if (record.paymentStatus !== 'REFUND_INITIATED' && record.paymentStatus !== 'REFUNDED') {
          record.paymentStatus = 'CAPTURED';
          record.captureStatus = 'captured';
          record.signatureVerified = true;
          record.razorpayPaymentId = rzpPaymentId || record.razorpayPaymentId;
          record.paymentMethod = paymentEntity?.method || record.paymentMethod;
          record.paymentMethodDetails = summarizePaymentMethod(paymentEntity) || record.paymentMethodDetails;
          record.receiptNumber = record.receiptNumber || generateVerifiedReceiptNumber(record.razorpayOrderId);
          record.paymentTimestamp = paymentEntity?.created_at
            ? new Date(paymentEntity.created_at * 1000).toISOString()
            : record.paymentTimestamp || nowIso;
          record.verifiedAt = record.verifiedAt || nowIso;
          record.failureReason = undefined;
          summary = `Webhook confirmed payment.captured for ${record.razorpayOrderId} (${record.receiptNumber}).`;

          if (!record.confirmationEmailSent) {
            const emailRes = await sendTransactionalFranchiseEmail({
              event: 'payment_success_receipt',
              toEmail: record.email,
              applicantName: record.applicantName,
              applicationId: record.applicationId,
              planName: record.planTitle,
              amountINR: record.finalAmountINR,
              txnId: record.razorpayOrderId,
              payuTransactionId: record.razorpayPaymentId,
              gatewayName: 'Razorpay',
              baseAmountINR: record.baseAmountINR,
              gstAmountINR: record.gstAmountINR,
              receiptNumber: record.receiptNumber
            });
            record.confirmationEmailSent = emailRes.sent;
          }
        } else {
          summary = `Payment ${record.razorpayOrderId} already in refund lifecycle (${record.paymentStatus}).`;
        }
        break;
      }

      case 'order.paid': {
        const amountPaid = Number(orderEntity?.amount_paid || 0);
        const orderCurrency = String(orderEntity?.currency || '').toUpperCase();
        if (amountPaid < record.amountPaise || orderCurrency !== 'INR') {
          record.paymentStatus = 'VERIFICATION_REQUIRED';
          summary = `order.paid amount mismatch (${amountPaid} ${orderCurrency} < ${record.amountPaise} INR).`;
        } else if (record.paymentStatus !== 'REFUND_INITIATED' && record.paymentStatus !== 'REFUNDED') {
          record.paymentStatus = 'CAPTURED';
          record.captureStatus = 'captured';
          record.signatureVerified = true;
          record.receiptNumber = record.receiptNumber || generateVerifiedReceiptNumber(record.razorpayOrderId);
          record.verifiedAt = record.verifiedAt || nowIso;
          record.paymentTimestamp = record.paymentTimestamp || nowIso;
          summary = `Webhook confirmed order.paid for ${record.razorpayOrderId}.`;
        }
        break;
      }

      case 'payment.failed': {
        // Monotonic guard: NEVER overwrite CAPTURED/REFUNDED with a late payment.failed event
        if (
          record.paymentStatus !== 'CAPTURED' &&
          record.paymentStatus !== 'REFUND_INITIATED' &&
          record.paymentStatus !== 'REFUNDED'
        ) {
          record.paymentStatus = 'FAILED';
          record.captureStatus = 'failed';
          record.failureReason =
            paymentEntity?.error_description || paymentEntity?.error_reason || 'Payment failed at Razorpay.';
          summary = `Webhook recorded payment.failed: ${record.failureReason}`;
        } else {
          summary = `Ignored delayed payment.failed because order ${record.razorpayOrderId} is already ${record.paymentStatus}.`;
        }
        break;
      }

      case 'refund.created': {
        if (record.paymentStatus === 'CAPTURED' || record.paymentStatus === 'REFUND_INITIATED') {
          record.paymentStatus = 'REFUND_INITIATED';
          record.refundStatus = 'initiated';
          record.refundId = rzpRefundId || record.refundId;
          record.refundAmountPaise = Number(refundEntity?.amount || record.amountPaise);
          summary = `Refund ${record.refundId} initiated via Razorpay.`;
        } else {
          summary = `Logged refund.created for order in state ${record.paymentStatus}.`;
        }
        break;
      }

      case 'refund.processed': {
        if (record.paymentStatus === 'CAPTURED' || record.paymentStatus === 'REFUND_INITIATED' || record.paymentStatus === 'REFUNDED') {
          record.paymentStatus = 'REFUNDED';
          record.captureStatus = 'refunded';
          record.refundStatus = 'processed';
          record.refundId = rzpRefundId || record.refundId;
          record.refundAmountPaise = Number(refundEntity?.amount || record.amountPaise);
          record.refundedAt = nowIso;
          summary = `Refund ${record.refundId} processed by Razorpay.`;
        } else {
          summary = `Logged refund.processed for order in state ${record.paymentStatus}.`;
        }
        break;
      }

      case 'refund.failed': {
        record.refundStatus = 'failed';
        record.refundId = rzpRefundId || record.refundId;
        if (record.paymentStatus === 'REFUND_INITIATED') {
          record.paymentStatus = 'CAPTURED';
        }
        summary = `Refund ${record.refundId || ''} failed; payment restored to ${record.paymentStatus}.`;
        break;
      }

      default: {
        summary = `Acknowledged informational webhook event: ${eventType}`;
      }
    }

    record.attemptHistory.push({
      timestamp: nowIso,
      event: eventType,
      status: record.paymentStatus,
      razorpayPaymentId: rzpPaymentId,
      details: summary,
      source: 'webhook'
    });
    record.updatedAt = nowIso;
    await activeStore.savePayment(record);
  } else {
    summary = `Webhook ${eventType} verified and logged (order ${rzpOrderId || 'unknown'} not present in active instance store).`;
  }

  await activeStore.saveWebhookEvent({
    eventId,
    eventType,
    razorpayOrderId: rzpOrderId,
    razorpayPaymentId: rzpPaymentId,
    razorpayRefundId: rzpRefundId,
    applicationId: record?.applicationId,
    amountPaise,
    status: record?.paymentStatus || eventType,
    signatureValid: true,
    duplicate: false,
    receivedAt: nowIso,
    summary
  });

  return {
    ok: true,
    statusCode: 200,
    duplicate: false,
    eventId,
    eventType,
    paymentStatus: record?.paymentStatus,
    message: summary,
    paymentRecord: record || undefined
  };
}

// =========================================================================
// PHASE 9 — ADMIN RECONCILIATION, REAL RAZORPAY REFUND API & INTERNAL NOTES
// =========================================================================
export async function reconcileRazorpayOrder(orderId: string): Promise<{
  ok: boolean;
  statusCode: number;
  message: string;
  paymentRecord?: RazorpayPaymentRecord;
}> {
  const record = await activeStore.getPaymentByOrderId(orderId);
  if (!record) {
    return { ok: false, statusCode: 404, message: `Order ${orderId} not found.` };
  }

  const config = getRazorpayConfigStatus();
  if (!config.configured) {
    return {
      ok: false,
      statusCode: 503,
      message: 'Razorpay credentials are not configured on the server for live reconciliation.'
    };
  }

  try {
    const client = getOfficialRazorpayClient();
    const { items } = await client.fetchOrderPayments(orderId);
    const nowIso = new Date().toISOString();

    const capturedPayment = items.find((p) => p.status === 'captured' || p.captured === true);
    const authorizedPayment = items.find((p) => p.status === 'authorized');
    const failedPayment = items.find((p) => p.status === 'failed');

    if (capturedPayment) {
      if (capturedPayment.amount === record.amountPaise && String(capturedPayment.currency).toUpperCase() === 'INR') {
        if (record.paymentStatus !== 'REFUND_INITIATED' && record.paymentStatus !== 'REFUNDED') {
          record.paymentStatus = 'CAPTURED';
          record.captureStatus = 'captured';
        }
        record.signatureVerified = true;
        record.razorpayPaymentId = capturedPayment.id;
        record.paymentMethod = capturedPayment.method || record.paymentMethod;
        record.paymentMethodDetails = summarizePaymentMethod(capturedPayment) || record.paymentMethodDetails;
        record.receiptNumber = record.receiptNumber || generateVerifiedReceiptNumber(record.razorpayOrderId);
        record.verifiedAt = record.verifiedAt || nowIso;
        record.paymentTimestamp = capturedPayment.created_at
          ? new Date(capturedPayment.created_at * 1000).toISOString()
          : record.paymentTimestamp || nowIso;
      } else {
        record.paymentStatus = 'VERIFICATION_REQUIRED';
        record.failureReason = 'Amount/currency mismatch during Razorpay API reconciliation.';
      }
    } else if (authorizedPayment && record.paymentStatus !== 'CAPTURED') {
      record.paymentStatus = 'AUTHORIZED';
      record.captureStatus = 'authorized';
      record.razorpayPaymentId = authorizedPayment.id;
    } else if (failedPayment && record.paymentStatus !== 'CAPTURED') {
      record.paymentStatus = 'FAILED';
      record.captureStatus = 'failed';
      record.razorpayPaymentId = failedPayment.id;
      record.failureReason = failedPayment.error_description || 'Payment failed at Razorpay.';
    }

    record.attemptHistory.push({
      timestamp: nowIso,
      event: 'admin.reconciled',
      status: record.paymentStatus,
      razorpayPaymentId: record.razorpayPaymentId,
      details: `Reconciled against Razorpay Orders API (${items.length} payment attempt(s) found). Current status: ${record.paymentStatus}.`,
      source: 'admin_reconcile'
    });
    record.updatedAt = nowIso;
    await activeStore.savePayment(record);

    return {
      ok: true,
      statusCode: 200,
      message: `Reconciled order ${orderId} with Razorpay: status is ${record.paymentStatus}.`,
      paymentRecord: record
    };
  } catch {
    return {
      ok: false,
      statusCode: 502,
      message: 'Failed to reach Razorpay API during reconciliation.'
    };
  }
}

/**
 * Calls the REAL Razorpay Refund API (`POST /v1/payments/:id/refund`).
 * Strictly requires Admin authorization and a verified CAPTURED payment. Never fakes refunds.
 */
export async function initiateRazorpayRefund(params: {
  orderId: string;
  reason: string;
  actorEmail: string;
}): Promise<{
  ok: boolean;
  statusCode: number;
  error?: string;
  message: string;
  paymentRecord?: RazorpayPaymentRecord;
  refund?: RazorpayApiRefundResponse;
}> {
  const record = await activeStore.getPaymentByOrderId(params.orderId);
  if (!record) {
    return { ok: false, statusCode: 404, error: 'not_found', message: 'Razorpay order record not found.' };
  }

  if (record.paymentStatus !== 'CAPTURED' || !record.razorpayPaymentId) {
    return {
      ok: false,
      statusCode: 400,
      error: 'invalid_refund_state',
      message: 'Only verified CAPTURED payments with a Razorpay Payment ID can be refunded via Razorpay API.'
    };
  }

  const config = getRazorpayConfigStatus();
  if (!config.configured) {
    return {
      ok: false,
      statusCode: 503,
      error: 'razorpay_not_configured',
      message: 'Razorpay credentials are not configured on the server to process refunds.'
    };
  }

  try {
    const client = getOfficialRazorpayClient();
    const refund = await client.createRefund(record.razorpayPaymentId, {
      amount: record.amountPaise,
      notes: {
        applicationId: record.applicationId,
        reason: params.reason.slice(0, 200),
        initiatedBy: params.actorEmail
      }
    });

    const nowIso = new Date().toISOString();
    const isProcessed = refund.status === 'processed';
    record.paymentStatus = isProcessed ? 'REFUNDED' : 'REFUND_INITIATED';
    record.refundStatus = isProcessed ? 'processed' : 'initiated';
    if (isProcessed) {
      record.captureStatus = 'refunded';
      record.refundedAt = nowIso;
    }
    record.refundId = refund.id;
    record.refundAmountPaise = refund.amount;
    record.attemptHistory.push({
      timestamp: nowIso,
      event: isProcessed ? 'refund.processed' : 'refund.created',
      status: record.paymentStatus,
      razorpayPaymentId: record.razorpayPaymentId,
      details: `Admin (${params.actorEmail}) initiated Razorpay Refund ${refund.id} (${refund.status}). Reason: ${params.reason}`,
      source: 'admin_refund'
    });
    record.internalNotes.push({
      id: `note_${crypto.randomBytes(4).toString('hex')}`,
      authorEmail: params.actorEmail,
      text: `Razorpay Refund ${refund.id} (${refund.status}): ${params.reason}`,
      createdAt: nowIso
    });
    record.updatedAt = nowIso;
    await activeStore.savePayment(record);

    return {
      ok: true,
      statusCode: 200,
      message: `Razorpay refund ${refund.id} ${isProcessed ? 'processed' : 'initiated'} successfully.`,
      paymentRecord: record,
      refund
    };
  } catch (err: any) {
    return {
      ok: false,
      statusCode: 502,
      error: 'razorpay_refund_failed',
      message: err?.error?.description || 'Razorpay Refund API call failed. Payment status unchanged.'
    };
  }
}

export async function addRazorpayAdminNote(params: {
  orderId: string;
  note: string;
  actorEmail: string;
}): Promise<{
  ok: boolean;
  statusCode: number;
  message: string;
  paymentRecord?: RazorpayPaymentRecord;
}> {
  const cleanNote = String(params.note || '').trim();
  if (cleanNote.length < 2 || cleanNote.length > 500) {
    return { ok: false, statusCode: 400, message: 'Internal note must be between 2 and 500 characters.' };
  }

  const record = await activeStore.getPaymentByOrderId(params.orderId);
  if (!record) {
    return { ok: false, statusCode: 404, message: 'Razorpay order record not found.' };
  }

  const nowIso = new Date().toISOString();
  record.internalNotes.push({
    id: `note_${crypto.randomBytes(4).toString('hex')}`,
    authorEmail: params.actorEmail,
    text: cleanNote,
    createdAt: nowIso
  });
  record.updatedAt = nowIso;
  await activeStore.savePayment(record);

  return { ok: true, statusCode: 200, message: 'Internal note saved.', paymentRecord: record };
}
