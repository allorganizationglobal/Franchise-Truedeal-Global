import crypto from 'crypto';
import { calculateServerPlanAmount, getAuthoritativePlan } from './plansCatalog';
import { sendTransactionalFranchiseEmail } from './emailService';

/**
 * TRUEDEAL GLOBAL — Official PayU India Classic Hosted Checkout Engine
 *
 * Implements PayU India Hosted Checkout strictly per official specifications:
 * - Test Checkout URL:       https://test.payu.in/_payment
 * - Production Checkout URL: https://secure.payu.in/_payment
 * - Test Verify API URL:     https://test.payu.in/merchant/postservice.php?form=2
 * - Prod Verify API URL:     https://info.payu.in/merchant/postservice.php?form=2
 *
 * Security Invariants:
 * 1. Merchant Salt & Secrets live strictly in server-side process.env.
 * 2. Payment amounts are computed ONLY on the server from plansCatalog.ts.
 * 3. Outgoing request SHA-512 hash & incoming reverse SHA-512 hash use timing-safe comparison.
 * 4. Independent server-to-server PayU verify_payment API confirmation is required before SUCCESS.
 * 5. Monotonic State Machine: verified SUCCESS can NEVER be downgraded to FAILED/CANCELLED/PENDING.
 * 6. Full idempotency for duplicate callbacks, duplicate webhooks, and webhooks arriving before redirect.
 * 7. Never stores card numbers, CVV, OTP, or logs sensitive merchant salt/credentials.
 */

export type PayUEnv = 'test' | 'production';

export type PayUPaymentStatus =
  | 'CREATED'
  | 'PAYMENT_PENDING'
  | 'SUCCESS'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'REFUND_PENDING'
  | 'REFUNDED'
  | 'UNDER_REVIEW';

export interface PayUConfigStatus {
  provider: 'payu_classic_hosted';
  env: PayUEnv;
  configured: boolean;
  liveCheckoutEnabled: boolean;
  checkoutUrl: string;
  verifyApiUrl: string;
  appBaseUrl: string;
  callbackUrl: string;
  webhookUrl: string;
  requiredEnvVars: string[];
  missingEnvVars: string[];
}

export interface ServerPaymentRecord {
  paymentId: string;
  applicationId: string;
  userId: string;
  applicantName: string;
  email: string;
  phone: string;
  franchisePlanId: string;
  franchisePlanName: string;
  txnId: string;
  payuTransactionId?: string;
  amount: number;
  formattedAmount: string;
  baseAmountINR: number;
  gstAmountINR: number;
  currency: 'INR';
  paymentStatus: PayUPaymentStatus;
  paymentMethod?: string;
  bankRefNum?: string;
  errorMessage?: string;
  receiptNumber?: string;
  gatewayResponse?: {
    mihpayid?: string;
    mode?: string;
    status?: string;
    unmappedstatus?: string;
    bankRefNum?: string;
    field9?: string;
    verifiedByApi?: boolean;
  };
  verifiedAt?: string;
  emailSent?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookEventRecord {
  eventId: string;
  txnId: string;
  applicationId?: string;
  payuTransactionId?: string;
  amount?: number;
  status: string;
  source: 'webhook' | 'callback' | 'verify_api';
  duplicate: boolean;
  receivedAt: string;
}

export interface PayUHostedFormFields {
  key: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  phone: string;
  surl: string;
  furl: string;
  udf1: string; // applicationId
  udf2: string; // userId
  udf3: string; // franchisePlanId
  udf4: string; // paymentId
  udf5: string; // currency
  hash: string;
}

export interface PayUInitiateInput {
  applicationId: string;
  planId: string;
  userId: string;
  applicantName: string;
  email: string;
  phone: string;
  clientSuppliedAmount?: number; // Strictly audited & ignored/rejected if tampered
  clientIp?: string;
  appBaseUrlOverride?: string;
}

export interface PayUVerifyApiResponse {
  ok: boolean;
  status: PayUPaymentStatus;
  rawGatewayStatus?: string;
  mihpayid?: string;
  amount?: string;
  mode?: string;
  bankRefNum?: string;
  errorMessage?: string;
  unmappedstatus?: string;
}

export interface PayUPersistenceAdapter {
  savePayment(record: ServerPaymentRecord): Promise<void>;
  getPaymentByTxnId(txnId: string): Promise<ServerPaymentRecord | null>;
  getPaymentsByApplicationId(applicationId: string): Promise<ServerPaymentRecord[]>;
  getAllPayments(): Promise<ServerPaymentRecord[]>;
  hasWebhookEvent(eventId: string): Promise<boolean>;
  saveWebhookEvent(event: WebhookEventRecord): Promise<void>;
  getAllWebhookEvents(): Promise<WebhookEventRecord[]>;
}

/**
 * Default in-memory persistence adapter (used on Starter Tier / serverless warm instances & tests).
 * Can be swapped cleanly via setPayUPersistenceAdapter() after upgrading to a user-owned GCP project.
 */
export class InMemoryPayUStore implements PayUPersistenceAdapter {
  private paymentsByTxn = new Map<string, ServerPaymentRecord>();
  private webhookEvents = new Map<string, WebhookEventRecord>();

  async savePayment(record: ServerPaymentRecord): Promise<void> {
    this.paymentsByTxn.set(record.txnId, { ...record });
  }

  async getPaymentByTxnId(txnId: string): Promise<ServerPaymentRecord | null> {
    const rec = this.paymentsByTxn.get(txnId);
    return rec ? { ...rec } : null;
  }

  async getPaymentsByApplicationId(applicationId: string): Promise<ServerPaymentRecord[]> {
    const results: ServerPaymentRecord[] = [];
    for (const rec of this.paymentsByTxn.values()) {
      if (rec.applicationId === applicationId) {
        results.push({ ...rec });
      }
    }
    return results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getAllPayments(): Promise<ServerPaymentRecord[]> {
    return Array.from(this.paymentsByTxn.values())
      .map((r) => ({ ...r }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async hasWebhookEvent(eventId: string): Promise<boolean> {
    return this.webhookEvents.has(eventId);
  }

  async saveWebhookEvent(event: WebhookEventRecord): Promise<void> {
    this.webhookEvents.set(event.eventId, { ...event });
  }

  async getAllWebhookEvents(): Promise<WebhookEventRecord[]> {
    return Array.from(this.webhookEvents.values())
      .map((e) => ({ ...e }))
      .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  }

  clear(): void {
    this.paymentsByTxn.clear();
    this.webhookEvents.clear();
  }
}

export const defaultPayUStore = new InMemoryPayUStore();
let activeStore: PayUPersistenceAdapter = defaultPayUStore;

export function setPayUPersistenceAdapter(adapter: PayUPersistenceAdapter): void {
  activeStore = adapter;
}

export function getPayUPersistenceAdapter(): PayUPersistenceAdapter {
  return activeStore;
}

// Inject-friendly verify fetcher (uses real PayU HTTPS API in runtime; mockable in unit tests)
export type PayUVerifyFetcher = (
  txnid: string,
  config: { key: string; salt: string; verifyApiUrl: string }
) => Promise<PayUVerifyApiResponse>;

let customVerifyFetcher: PayUVerifyFetcher | null = null;

export function setPayUVerifyFetcherForTests(fetcher: PayUVerifyFetcher | null): void {
  customVerifyFetcher = fetcher;
}

// Initiation rate limiter (max 10 initiations per 10 minutes per IP / user)
const initRateLimits = new Map<string, { count: number; resetAt: number }>();
const INIT_RATE_WINDOW_MS = 10 * 60 * 1000;
const INIT_RATE_MAX = 10;

export function resetPayURateLimits(): void {
  initRateLimits.clear();
}

function checkInitiateRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = initRateLimits.get(key);
  if (!entry || now > entry.resetAt) {
    initRateLimits.set(key, { count: 1, resetAt: now + INIT_RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= INIT_RATE_MAX) {
    return false;
  }
  entry.count += 1;
  return true;
}

/**
 * Resolves PayU environment & URLs strictly from server-side environment variables.
 */
export function getPayUConfigStatus(appBaseUrlOverride?: string): PayUConfigStatus {
  const rawEnv = (process.env.PAYU_ENV || 'test').toLowerCase().trim();
  const env: PayUEnv = rawEnv === 'production' || rawEnv === 'prod' || rawEnv === 'live' ? 'production' : 'test';

  const key = (process.env.PAYU_MERCHANT_KEY || '').trim();
  const salt = (process.env.PAYU_MERCHANT_SALT || '').trim();
  const appBaseUrl = (
    appBaseUrlOverride ||
    process.env.APP_BASE_URL ||
    process.env.APP_URL ||
    'https://businessfranchise.truedealglobal.com'
  ).replace(/\/+$/, '');

  const checkoutUrl = env === 'production' ? 'https://secure.payu.in/_payment' : 'https://test.payu.in/_payment';
  const verifyApiUrl =
    env === 'production'
      ? 'https://info.payu.in/merchant/postservice.php?form=2'
      : 'https://test.payu.in/merchant/postservice.php?form=2';

  const requiredEnvVars = ['PAYU_ENV', 'PAYU_MERCHANT_KEY', 'PAYU_MERCHANT_SALT', 'APP_BASE_URL'];
  const missingEnvVars: string[] = [];
  if (!key) missingEnvVars.push('PAYU_MERCHANT_KEY');
  if (!salt) missingEnvVars.push('PAYU_MERCHANT_SALT');

  const configured = Boolean(key && salt);

  return {
    provider: 'payu_classic_hosted',
    env,
    configured,
    liveCheckoutEnabled: configured,
    checkoutUrl,
    verifyApiUrl,
    appBaseUrl,
    callbackUrl: `${appBaseUrl}/api/payments/payu/callback`,
    webhookUrl: `${appBaseUrl}/api/payments/payu/webhook`,
    requiredEnvVars,
    missingEnvVars
  };
}

/**
 * Constant-time hex string equality check to prevent timing attacks on hash comparisons.
 */
export function timingSafeHexEquals(a: string, b: string): boolean {
  if (!a || !b || typeof a !== 'string' || typeof b !== 'string') return false;
  const normA = a.trim().toLowerCase();
  const normB = b.trim().toLowerCase();
  if (normA.length !== normB.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(normA, 'utf8'), Buffer.from(normB, 'utf8'));
  } catch {
    return false;
  }
}

/**
 * Official PayU Classic Hosted Checkout SHA-512 Request Hash:
 * sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||SALT)
 */
export function generatePayURequestHash(
  params: {
    key: string;
    txnid: string;
    amount: string;
    productinfo: string;
    firstname: string;
    email: string;
    udf1?: string;
    udf2?: string;
    udf3?: string;
    udf4?: string;
    udf5?: string;
  },
  salt: string
): string {
  const hashSequence = [
    params.key,
    params.txnid,
    params.amount,
    params.productinfo,
    params.firstname,
    params.email,
    params.udf1 || '',
    params.udf2 || '',
    params.udf3 || '',
    params.udf4 || '',
    params.udf5 || '',
    '',
    '',
    '',
    '',
    '',
    salt
  ].join('|');

  return crypto.createHash('sha512').update(hashSequence).digest('hex');
}

/**
 * Official PayU Reverse SHA-512 Response Hash (SURL / FURL / Webhook):
 * Standard: sha512(SALT|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key)
 * With additionalCharges: sha512(additionalCharges|SALT|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key)
 */
export function generatePayUResponseHash(
  params: {
    key: string;
    txnid: string;
    amount: string;
    productinfo: string;
    firstname: string;
    email: string;
    status: string;
    udf1?: string;
    udf2?: string;
    udf3?: string;
    udf4?: string;
    udf5?: string;
    additionalCharges?: string;
  },
  salt: string
): string {
  const baseParts = [
    salt,
    params.status,
    '',
    '',
    '',
    '',
    '',
    params.udf5 || '',
    params.udf4 || '',
    params.udf3 || '',
    params.udf2 || '',
    params.udf1 || '',
    params.email,
    params.firstname,
    params.productinfo,
    params.amount,
    params.txnid,
    params.key
  ];

  const sequence =
    params.additionalCharges && String(params.additionalCharges).trim() !== ''
      ? [String(params.additionalCharges).trim(), ...baseParts].join('|')
      : baseParts.join('|');

  return crypto.createHash('sha512').update(sequence).digest('hex');
}

export function verifyPayUResponseHash(
  payload: {
    key: string;
    txnid: string;
    amount: string;
    productinfo: string;
    firstname: string;
    email: string;
    status: string;
    udf1?: string;
    udf2?: string;
    udf3?: string;
    udf4?: string;
    udf5?: string;
    additionalCharges?: string;
    hash: string;
  },
  salt: string
): boolean {
  if (!payload.hash || !salt) return false;
  const expected = generatePayUResponseHash(payload, salt);
  return timingSafeHexEquals(expected, payload.hash);
}

/**
 * Official PayU Verify Payment API Command Hash:
 * sha512(key|verify_payment|txnid|salt)
 */
export function generatePayUVerifyCommandHash(key: string, txnid: string, salt: string): string {
  return crypto.createHash('sha512').update(`${key}|verify_payment|${txnid}|${salt}`).digest('hex');
}

/**
 * Maps PayU gateway status strings into our standardized Payment Status State Machine.
 */
export function mapPayUStatusToInternal(
  gatewayStatus?: string,
  unmappedStatus?: string
): PayUPaymentStatus {
  const norm = String(gatewayStatus || '').toLowerCase().trim();
  const unmapped = String(unmappedStatus || '').toLowerCase().trim();

  if (norm === 'success' || unmapped === 'captured') return 'SUCCESS';
  if (norm === 'pending' || unmapped === 'in progress' || unmapped === 'initiated' || unmapped === 'pending') {
    return 'PAYMENT_PENDING';
  }
  if (unmapped === 'usercancelled' || norm === 'cancelled' || norm === 'usercancelled') {
    return 'CANCELLED';
  }
  if (unmapped === 'dropped' || unmapped === 'bounced' || norm === 'expired') {
    return 'EXPIRED';
  }
  if (norm === 'refunded') return 'REFUNDED';
  if (norm === 'refund_pending') return 'REFUND_PENDING';
  if (norm === 'failure' || norm === 'failed' || unmapped === 'failed' || unmapped === 'auto_refund') {
    return 'FAILED';
  }
  return 'UNDER_REVIEW';
}

/**
 * Independently verifies a transaction with PayU India's official Verify Payment API.
 */
export async function callPayUVerifyPaymentApi(txnid: string): Promise<PayUVerifyApiResponse> {
  const cfg = getPayUConfigStatus();
  const key = (process.env.PAYU_MERCHANT_KEY || '').trim();
  const salt = (process.env.PAYU_MERCHANT_SALT || '').trim();

  if (!key || !salt) {
    return {
      ok: false,
      status: 'UNDER_REVIEW',
      errorMessage: 'PayU merchant credentials are not configured on the server.'
    };
  }

  if (customVerifyFetcher) {
    return customVerifyFetcher(txnid, { key, salt, verifyApiUrl: cfg.verifyApiUrl });
  }

  const hash = generatePayUVerifyCommandHash(key, txnid, salt);
  const formBody = new URLSearchParams({
    key,
    command: 'verify_payment',
    var1: txnid,
    hash
  });

  try {
    const response = await fetch(cfg.verifyApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json'
      },
      body: formBody.toString()
    });

    if (!response.ok) {
      return {
        ok: false,
        status: 'UNDER_REVIEW',
        errorMessage: `PayU verify_payment API returned HTTP ${response.status}`
      };
    }

    const data: any = await response.json();
    const txDetails = data?.transaction_details?.[txnid];
    if (!txDetails) {
      return {
        ok: false,
        status: 'UNDER_REVIEW',
        errorMessage: 'Transaction not found in PayU verify_payment response.'
      };
    }

    const mappedStatus = mapPayUStatusToInternal(txDetails.status, txDetails.unmappedstatus);
    return {
      ok: true,
      status: mappedStatus,
      rawGatewayStatus: String(txDetails.status || ''),
      mihpayid: txDetails.mihpayid ? String(txDetails.mihpayid) : undefined,
      amount: txDetails.amt ? String(txDetails.amt) : txDetails.transaction_amount ? String(txDetails.transaction_amount) : undefined,
      mode: txDetails.mode ? String(txDetails.mode) : undefined,
      bankRefNum: txDetails.bank_ref_num ? String(txDetails.bank_ref_num) : undefined,
      errorMessage: txDetails.error_Message ? String(txDetails.error_Message) : undefined,
      unmappedstatus: txDetails.unmappedstatus ? String(txDetails.unmappedstatus) : undefined
    };
  } catch (err: any) {
    return {
      ok: false,
      status: 'UNDER_REVIEW',
      errorMessage: err?.message || 'Network error calling PayU verify_payment API.'
    };
  }
}

/**
 * Sanitizes applicant strings sent to PayU (PayU rejects pipes `|` and control chars in hash fields).
 */
function sanitizePayUField(val: string, maxLen: number): string {
  return String(val || '')
    .replace(/[|\r\n\t<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

/**
 * Generates an authoritative server-side PayU Hosted Checkout initiation order.
 */
export async function initiatePayUPaymentOrder(input: PayUInitiateInput): Promise<{
  ok: boolean;
  statusCode: number;
  error?: string;
  message?: string;
  checkoutUrl?: string;
  env?: PayUEnv;
  payment?: ServerPaymentRecord;
  formFields?: PayUHostedFormFields;
}> {
  // 1. Rate limiting
  const rateKey = `${input.clientIp || 'unknown'}:${input.userId}`;
  if (!checkInitiateRateLimit(rateKey)) {
    return {
      ok: false,
      statusCode: 429,
      error: 'rate_limited',
      message: 'Too many payment initiation attempts. Please wait a few minutes before retrying.'
    };
  }

  // 2. Validate Application ID & Applicant fields
  const applicationId = String(input.applicationId || '').trim();
  if (!/^[a-zA-Z0-9_-]{4,64}$/.test(applicationId)) {
    return {
      ok: false,
      statusCode: 400,
      error: 'invalid_application_id',
      message: 'Invalid or malformed Franchise Application ID.'
    };
  }

  const plan = getAuthoritativePlan(input.planId);
  const feeCalc = calculateServerPlanAmount(input.planId);
  if (!plan || !feeCalc) {
    return {
      ok: false,
      statusCode: 400,
      error: 'invalid_plan',
      message: 'Selected franchise plan is invalid or no longer active.'
    };
  }

  // 3. Reject obvious browser price tampering attempts if client supplied a mismatched amount
  if (
    typeof input.clientSuppliedAmount === 'number' &&
    Number.isFinite(input.clientSuppliedAmount) &&
    Math.abs(input.clientSuppliedAmount - feeCalc.totalAmountINR) > 0.01
  ) {
    return {
      ok: false,
      statusCode: 400,
      error: 'amount_tampering_detected',
      message: `Payment amount mismatch detected. Authoritative price for ${plan.title} is ₹${feeCalc.formattedAmount} INR.`
    };
  }

  // 4. Prevent duplicate payment if application already has a verified SUCCESS payment
  const existingPayments = await activeStore.getPaymentsByApplicationId(applicationId);
  const alreadyPaid = existingPayments.find((p) => p.paymentStatus === 'SUCCESS');
  if (alreadyPaid) {
    return {
      ok: false,
      statusCode: 409,
      error: 'already_paid',
      message: `Application ${applicationId} already has a verified successful payment (Receipt ${alreadyPaid.receiptNumber}).`
    };
  }

  // 5. Check PayU Server Configuration
  const cfg = getPayUConfigStatus(input.appBaseUrlOverride);
  const merchantKey = (process.env.PAYU_MERCHANT_KEY || '').trim();
  const merchantSalt = (process.env.PAYU_MERCHANT_SALT || '').trim();

  if (!cfg.configured || !merchantKey || !merchantSalt) {
    return {
      ok: false,
      statusCode: 503,
      error: 'payu_not_configured',
      message:
        'PayU India Hosted Checkout credentials (PAYU_MERCHANT_KEY / PAYU_MERCHANT_SALT) are not yet activated on this server. Your PayU account is currently under verification.'
    };
  }

  // 6. Generate unique server-side txnid (<= 25 chars for PayU) & paymentId
  const randHex = crypto.randomBytes(4).toString('hex').toUpperCase();
  const tsPart = Date.now().toString(36).toUpperCase();
  const txnId = `TDG${tsPart}${randHex}`.slice(0, 24);
  const paymentId = `pay_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const nowIso = new Date().toISOString();

  const firstname = sanitizePayUField(input.applicantName.split(' ')[0] || input.applicantName, 40) || 'Applicant';
  const email = sanitizePayUField(input.email.toLowerCase(), 120);
  const phone = String(input.phone || '').replace(/[^0-9+]/g, '').slice(0, 15) || '9999999999';
  const productinfo = sanitizePayUField(`TRUEDEAL GLOBAL ${plan.title}`, 90);

  const udf1 = applicationId;
  const udf2 = sanitizePayUField(input.userId, 64);
  const udf3 = plan.id;
  const udf4 = paymentId;
  const udf5 = 'INR';

  const hash = generatePayURequestHash(
    {
      key: merchantKey,
      txnid: txnId,
      amount: feeCalc.formattedAmount,
      productinfo,
      firstname,
      email,
      udf1,
      udf2,
      udf3,
      udf4,
      udf5
    },
    merchantSalt
  );

  const paymentRecord: ServerPaymentRecord = {
    paymentId,
    applicationId,
    userId: input.userId,
    applicantName: sanitizePayUField(input.applicantName, 120),
    email,
    phone,
    franchisePlanId: plan.id,
    franchisePlanName: plan.title,
    txnId,
    amount: feeCalc.totalAmountINR,
    formattedAmount: feeCalc.formattedAmount,
    baseAmountINR: feeCalc.baseAmountINR,
    gstAmountINR: feeCalc.gstAmountINR,
    currency: 'INR',
    paymentStatus: 'PAYMENT_PENDING',
    createdAt: nowIso,
    updatedAt: nowIso
  };

  try {
    await activeStore.savePayment(paymentRecord);
  } catch (dbErr: any) {
    return {
      ok: false,
      statusCode: 500,
      error: 'database_write_failed',
      message: 'Failed to persist payment initiation record safely. Please retry.'
    };
  }

  return {
    ok: true,
    statusCode: 201,
    checkoutUrl: cfg.checkoutUrl,
    env: cfg.env,
    payment: paymentRecord,
    formFields: {
      key: merchantKey,
      txnid: txnId,
      amount: feeCalc.formattedAmount,
      productinfo,
      firstname,
      email,
      phone,
      surl: cfg.callbackUrl,
      furl: cfg.callbackUrl,
      udf1,
      udf2,
      udf3,
      udf4,
      udf5,
      hash
    }
  };
}

export interface PayUCallbackPayload {
  key?: string;
  txnid?: string;
  amount?: string;
  productinfo?: string;
  firstname?: string;
  email?: string;
  status?: string;
  unmappedstatus?: string;
  mihpayid?: string;
  mode?: string;
  bank_ref_num?: string;
  error_Message?: string;
  field9?: string;
  udf1?: string;
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
  additionalCharges?: string;
  hash?: string;
}

export interface ProcessPayUResponseResult {
  ok: boolean;
  statusCode: number;
  error?: string;
  duplicate?: boolean;
  payment?: ServerPaymentRecord;
  finalStatus: PayUPaymentStatus;
  message: string;
}

/**
 * Authoritative handler for BOTH PayU Browser Redirect Callbacks (`surl`/`furl`)
 * AND PayU Server-to-Server Webhooks (`/api/payments/payu/webhook`).
 *
 * Enforces:
 * - Merchant key validation
 * - Timing-safe SHA-512 Reverse Hash verification
 * - Independent server-to-server PayU `verify_payment` confirmation
 * - Exact 2-decimal INR amount comparison
 * - Strict idempotency & event de-duplication
 * - Monotonic state protection (SUCCESS never downgraded)
 * - Receipt generation & SendGrid email ONLY after verified SUCCESS
 */
export async function processPayUGatewayResponse(
  rawPayload: PayUCallbackPayload,
  source: 'callback' | 'webhook',
  webhookHeaderSignature?: string
): Promise<ProcessPayUResponseResult> {
  const merchantKey = (process.env.PAYU_MERCHANT_KEY || '').trim();
  const merchantSalt = (process.env.PAYU_MERCHANT_SALT || '').trim();
  const webhookSecret = (process.env.PAYU_WEBHOOK_SECRET || '').trim();

  if (!merchantKey || !merchantSalt) {
    return {
      ok: false,
      statusCode: 503,
      error: 'payu_not_configured',
      finalStatus: 'UNDER_REVIEW',
      message: 'PayU server configuration missing.'
    };
  }

  // Optional extra HMAC verification if merchant configures a PayU webhook header secret
  if (source === 'webhook' && webhookSecret && webhookHeaderSignature) {
    const expectedHmac = crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(rawPayload))
      .digest('hex');
    if (!timingSafeHexEquals(expectedHmac, webhookHeaderSignature)) {
      return {
        ok: false,
        statusCode: 401,
        error: 'invalid_webhook_signature',
        finalStatus: 'UNDER_REVIEW',
        message: 'Webhook HMAC signature verification failed.'
      };
    }
  }

  const txnid = String(rawPayload.txnid || '').trim();
  const key = String(rawPayload.key || '').trim();
  const status = String(rawPayload.status || '').trim();
  const amountStr = String(rawPayload.amount || '').trim();
  const providedHash = String(rawPayload.hash || '').trim();

  if (!txnid || !key || !status || !amountStr || !providedHash) {
    return {
      ok: false,
      statusCode: 400,
      error: 'missing_required_fields',
      finalStatus: 'UNDER_REVIEW',
      message: 'Incomplete PayU callback payload.'
    };
  }

  // 1. Validate Merchant Identity
  if (key !== merchantKey) {
    return {
      ok: false,
      statusCode: 401,
      error: 'merchant_key_mismatch',
      finalStatus: 'UNDER_REVIEW',
      message: 'Merchant key does not match configured PayU account.'
    };
  }

  // 2. Verify Reverse SHA-512 Hash (timing-safe)
  const hashValid = verifyPayUResponseHash(
    {
      key,
      txnid,
      amount: amountStr,
      productinfo: String(rawPayload.productinfo || ''),
      firstname: String(rawPayload.firstname || ''),
      email: String(rawPayload.email || ''),
      status,
      udf1: String(rawPayload.udf1 || ''),
      udf2: String(rawPayload.udf2 || ''),
      udf3: String(rawPayload.udf3 || ''),
      udf4: String(rawPayload.udf4 || ''),
      udf5: String(rawPayload.udf5 || ''),
      additionalCharges: rawPayload.additionalCharges ? String(rawPayload.additionalCharges) : undefined,
      hash: providedHash
    },
    merchantSalt
  );

  if (!hashValid) {
    return {
      ok: false,
      statusCode: 401,
      error: 'invalid_response_hash',
      finalStatus: 'UNDER_REVIEW',
      message: 'PayU reverse SHA-512 hash verification failed.'
    };
  }

  // 3. Look up authoritative server-initiated payment order
  const existingRecord = await activeStore.getPaymentByTxnId(txnid);
  if (!existingRecord) {
    return {
      ok: false,
      statusCode: 404,
      error: 'unknown_transaction',
      finalStatus: 'UNDER_REVIEW',
      message: `Transaction ${txnid} was not initiated by this server.`
    };
  }

  // Validate application ID binding if udf1 provided
  if (rawPayload.udf1 && rawPayload.udf1 !== existingRecord.applicationId) {
    return {
      ok: false,
      statusCode: 400,
      error: 'application_id_mismatch',
      finalStatus: 'UNDER_REVIEW',
      message: 'Application ID in PayU response does not match initiated order.'
    };
  }

  // 4. Event Idempotency Check
  const eventId = `evt_${source}_${txnid}_${status.toLowerCase()}_${rawPayload.mihpayid || 'none'}`;
  const isDuplicateEvent = await activeStore.hasWebhookEvent(eventId);
  if (isDuplicateEvent) {
    return {
      ok: true,
      statusCode: 200,
      duplicate: true,
      payment: existingRecord,
      finalStatus: existingRecord.paymentStatus,
      message: 'Duplicate PayU event acknowledged idempotently.'
    };
  }

  // 5. Monotonic Guard: NEVER downgrade an already verified SUCCESS payment!
  if (existingRecord.paymentStatus === 'SUCCESS') {
    await activeStore.saveWebhookEvent({
      eventId,
      txnId: txnid,
      applicationId: existingRecord.applicationId,
      payuTransactionId: rawPayload.mihpayid,
      amount: Number(amountStr),
      status,
      source,
      duplicate: true,
      receivedAt: new Date().toISOString()
    });
    return {
      ok: true,
      statusCode: 200,
      duplicate: true,
      payment: existingRecord,
      finalStatus: 'SUCCESS',
      message: 'Transaction already verified as SUCCESS; protected against downgrade or duplicate replay.'
    };
  }

  // 6. Validate Callback Amount against Server-Calculated Order Amount
  const callbackAmount = Number(amountStr);
  if (!Number.isFinite(callbackAmount) || Math.abs(callbackAmount - existingRecord.amount) > 0.01) {
    existingRecord.paymentStatus = 'UNDER_REVIEW';
    existingRecord.errorMessage = `Amount mismatch: expected ₹${existingRecord.formattedAmount}, gateway returned ₹${amountStr}`;
    existingRecord.updatedAt = new Date().toISOString();
    try {
      await activeStore.savePayment(existingRecord);
    } catch {
      // ignore secondary persistence error
    }
    return {
      ok: false,
      statusCode: 400,
      error: 'amount_mismatch',
      payment: existingRecord,
      finalStatus: 'UNDER_REVIEW',
      message: 'Payment amount mismatch detected. Transaction flagged for manual review.'
    };
  }

  // 7. Independent Server-to-Server PayU `verify_payment` API Confirmation
  const verifyResult = await callPayUVerifyPaymentApi(txnid);
  let authoritativeStatus: PayUPaymentStatus;

  if (verifyResult.ok) {
    // Also verify amount returned by PayU verify_payment API
    if (verifyResult.amount) {
      const verifiedAmt = Number(verifyResult.amount);
      if (Number.isFinite(verifiedAmt) && Math.abs(verifiedAmt - existingRecord.amount) > 0.01) {
        existingRecord.paymentStatus = 'UNDER_REVIEW';
        existingRecord.errorMessage = `Verify API amount mismatch: expected ₹${existingRecord.formattedAmount}, verified ₹${verifyResult.amount}`;
        existingRecord.updatedAt = new Date().toISOString();
        try {
          await activeStore.savePayment(existingRecord);
        } catch {}
        return {
          ok: false,
          statusCode: 400,
          error: 'verified_amount_mismatch',
          payment: existingRecord,
          finalStatus: 'UNDER_REVIEW',
          message: 'Verified payment amount did not match order amount. Flagged UNDER_REVIEW.'
        };
      }
    }
    authoritativeStatus = verifyResult.status;
  } else {
    // Never mark SUCCESS solely from browser callback if verify_payment could not confirm it
    const callbackMapped = mapPayUStatusToInternal(status, rawPayload.unmappedstatus);
    authoritativeStatus = callbackMapped === 'SUCCESS' ? 'UNDER_REVIEW' : callbackMapped;
  }

  // 8. Update Authoritative Payment Record (Minimum Necessary Gateway Data — NO Card/CVV/OTP)
  const nowIso = new Date().toISOString();
  const updatedRecord: ServerPaymentRecord = {
    ...existingRecord,
    payuTransactionId: verifyResult.mihpayid || rawPayload.mihpayid || existingRecord.payuTransactionId,
    paymentStatus: authoritativeStatus,
    paymentMethod: verifyResult.mode || rawPayload.mode || existingRecord.paymentMethod,
    bankRefNum: verifyResult.bankRefNum || rawPayload.bank_ref_num || existingRecord.bankRefNum,
    errorMessage:
      authoritativeStatus === 'SUCCESS'
        ? undefined
        : verifyResult.errorMessage || rawPayload.error_Message || rawPayload.field9 || undefined,
    gatewayResponse: {
      mihpayid: verifyResult.mihpayid || rawPayload.mihpayid,
      mode: verifyResult.mode || rawPayload.mode,
      status: verifyResult.rawGatewayStatus || status,
      unmappedstatus: verifyResult.unmappedstatus || rawPayload.unmappedstatus,
      bankRefNum: verifyResult.bankRefNum || rawPayload.bank_ref_num,
      field9: rawPayload.field9,
      verifiedByApi: verifyResult.ok
    },
    verifiedAt: authoritativeStatus === 'SUCCESS' ? nowIso : existingRecord.verifiedAt,
    receiptNumber:
      authoritativeStatus === 'SUCCESS'
        ? existingRecord.receiptNumber || `REC-TDG-${new Date().getFullYear()}-${txnid.slice(-6)}`
        : undefined,
    updatedAt: nowIso
  };

  try {
    await activeStore.savePayment(updatedRecord);
    await activeStore.saveWebhookEvent({
      eventId,
      txnId: txnid,
      applicationId: updatedRecord.applicationId,
      payuTransactionId: updatedRecord.payuTransactionId,
      amount: updatedRecord.amount,
      status: authoritativeStatus,
      source,
      duplicate: false,
      receivedAt: nowIso
    });
  } catch (dbErr: any) {
    return {
      ok: false,
      statusCode: 500,
      error: 'database_update_failed',
      finalStatus: 'UNDER_REVIEW',
      message: 'Verified gateway response could not be persisted; flagged for reconciliation.'
    };
  }

  // 9. Send Transactional Email ONLY After Authoritative Verification (non-blocking)
  if (authoritativeStatus === 'SUCCESS' && !existingRecord.emailSent) {
    const emailRes = await sendTransactionalFranchiseEmail({
      event: 'payment_success_receipt',
      toEmail: updatedRecord.email,
      applicantName: updatedRecord.applicantName,
      applicationId: updatedRecord.applicationId,
      planName: updatedRecord.franchisePlanName,
      amountINR: updatedRecord.amount,
      txnId: updatedRecord.txnId,
      payuTransactionId: updatedRecord.payuTransactionId,
      receiptNumber: updatedRecord.receiptNumber
    });
    if (emailRes.sent) {
      updatedRecord.emailSent = true;
      await activeStore.savePayment(updatedRecord).catch(() => {});
    }
  } else if (authoritativeStatus === 'FAILED' || authoritativeStatus === 'CANCELLED') {
    await sendTransactionalFranchiseEmail({
      event: 'payment_failed',
      toEmail: updatedRecord.email,
      applicantName: updatedRecord.applicantName,
      applicationId: updatedRecord.applicationId,
      planName: updatedRecord.franchisePlanName,
      amountINR: updatedRecord.amount,
      txnId: updatedRecord.txnId,
      reason: updatedRecord.errorMessage
    }).catch(() => {});
  } else if (authoritativeStatus === 'PAYMENT_PENDING' || authoritativeStatus === 'UNDER_REVIEW') {
    await sendTransactionalFranchiseEmail({
      event: 'payment_pending',
      toEmail: updatedRecord.email,
      applicantName: updatedRecord.applicantName,
      applicationId: updatedRecord.applicationId,
      planName: updatedRecord.franchisePlanName,
      amountINR: updatedRecord.amount,
      txnId: updatedRecord.txnId
    }).catch(() => {});
  }

  return {
    ok: true,
    statusCode: 200,
    duplicate: false,
    payment: updatedRecord,
    finalStatus: authoritativeStatus,
    message:
      authoritativeStatus === 'SUCCESS'
        ? `Payment independently verified with PayU. Receipt ${updatedRecord.receiptNumber} issued.`
        : `Payment status updated to ${authoritativeStatus}.`
  };
}

/**
 * Reconciles an existing transaction live via PayU `verify_payment` API (used by Applicant / Admin).
 */
export async function reconcilePayUTransaction(txnid: string): Promise<ProcessPayUResponseResult> {
  const existingRecord = await activeStore.getPaymentByTxnId(txnid);
  if (!existingRecord) {
    return {
      ok: false,
      statusCode: 404,
      error: 'not_found',
      finalStatus: 'UNDER_REVIEW',
      message: `No payment record found for transaction ID ${txnid}.`
    };
  }

  if (existingRecord.paymentStatus === 'SUCCESS') {
    return {
      ok: true,
      statusCode: 200,
      payment: existingRecord,
      finalStatus: 'SUCCESS',
      message: `Transaction ${txnid} is already verified as SUCCESS.`
    };
  }

  const verifyResult = await callPayUVerifyPaymentApi(txnid);
  if (!verifyResult.ok) {
    return {
      ok: false,
      statusCode: 502,
      error: 'verify_api_unavailable',
      payment: existingRecord,
      finalStatus: existingRecord.paymentStatus,
      message: verifyResult.errorMessage || 'Could not reach PayU verify_payment API.'
    };
  }

  if (verifyResult.amount) {
    const verifiedAmt = Number(verifyResult.amount);
    if (Number.isFinite(verifiedAmt) && Math.abs(verifiedAmt - existingRecord.amount) > 0.01) {
      existingRecord.paymentStatus = 'UNDER_REVIEW';
      existingRecord.errorMessage = `Reconciliation amount mismatch (expected ₹${existingRecord.formattedAmount}, got ₹${verifyResult.amount})`;
      existingRecord.updatedAt = new Date().toISOString();
      await activeStore.savePayment(existingRecord);
      return {
        ok: false,
        statusCode: 400,
        error: 'amount_mismatch',
        payment: existingRecord,
        finalStatus: 'UNDER_REVIEW',
        message: 'Reconciled amount does not match expected order amount.'
      };
    }
  }

  const nowIso = new Date().toISOString();
  const updated: ServerPaymentRecord = {
    ...existingRecord,
    payuTransactionId: verifyResult.mihpayid || existingRecord.payuTransactionId,
    paymentStatus: verifyResult.status,
    paymentMethod: verifyResult.mode || existingRecord.paymentMethod,
    bankRefNum: verifyResult.bankRefNum || existingRecord.bankRefNum,
    errorMessage: verifyResult.status === 'SUCCESS' ? undefined : verifyResult.errorMessage,
    gatewayResponse: {
      mihpayid: verifyResult.mihpayid,
      mode: verifyResult.mode,
      status: verifyResult.rawGatewayStatus,
      unmappedstatus: verifyResult.unmappedstatus,
      bankRefNum: verifyResult.bankRefNum,
      verifiedByApi: true
    },
    verifiedAt: verifyResult.status === 'SUCCESS' ? nowIso : existingRecord.verifiedAt,
    receiptNumber:
      verifyResult.status === 'SUCCESS'
        ? existingRecord.receiptNumber || `REC-TDG-${new Date().getFullYear()}-${txnid.slice(-6)}`
        : undefined,
    updatedAt: nowIso
  };

  await activeStore.savePayment(updated);
  await activeStore.saveWebhookEvent({
    eventId: `evt_verify_${txnid}_${verifyResult.status}_${Date.now()}`,
    txnId: txnid,
    applicationId: updated.applicationId,
    payuTransactionId: updated.payuTransactionId,
    amount: updated.amount,
    status: verifyResult.status,
    source: 'verify_api',
    duplicate: false,
    receivedAt: nowIso
  });

  if (verifyResult.status === 'SUCCESS' && !existingRecord.emailSent) {
    const mail = await sendTransactionalFranchiseEmail({
      event: 'payment_success_receipt',
      toEmail: updated.email,
      applicantName: updated.applicantName,
      applicationId: updated.applicationId,
      planName: updated.franchisePlanName,
      amountINR: updated.amount,
      txnId: updated.txnId,
      payuTransactionId: updated.payuTransactionId,
      receiptNumber: updated.receiptNumber
    });
    if (mail.sent) {
      updated.emailSent = true;
      await activeStore.savePayment(updated).catch(() => {});
    }
  }

  return {
    ok: true,
    statusCode: 200,
    payment: updated,
    finalStatus: updated.paymentStatus,
    message: `Reconciled transaction ${txnid} with PayU: status is ${updated.paymentStatus}.`
  };
}
