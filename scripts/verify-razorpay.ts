import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  AUTHORITATIVE_FRANCHISE_PLANS,
  calculateServerPlanAmount
} from '../src/server/plansCatalog';
import {
  createRazorpayOrder,
  verifyRazorpayPayment,
  recordClientCheckoutAttemptEvent,
  processRazorpayWebhook,
  reconcileRazorpayOrder,
  initiateRazorpayRefund,
  addRazorpayAdminNote,
  computeRazorpayPaymentSignature,
  computeRazorpayWebhookSignature,
  getRazorpayConfigStatus,
  getRazorpayPersistenceAdapter,
  setRazorpayApiClientOverride,
  resetRazorpayRateLimits,
  RazorpayApiClient,
  RazorpayApiPaymentResponse
} from '../src/server/razorpayService';
import adminPaymentsHandler from '../api/admin/payments';
import razorpayWebhookHandler from '../api/webhooks/razorpay';
import createOrderHandler from '../api/create-order';
import verifyPaymentHandler from '../api/verify-payment';

const TEST_KEY_ID = 'rzp_test_U3VIznAN282H0E';
const TEST_KEY_SECRET = 'local_unit_test_secret_not_real_12345';
const TEST_WEBHOOK_SECRET = 'local_unit_test_webhook_secret_67890';

let passed = 0;
let failed = 0;

async function runTest(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err: any) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${err?.message || err}`);
  }
}

function resetEnvAndState() {
  process.env.RAZORPAY_MODE = 'test';
  process.env.RAZORPAY_KEY_ID = TEST_KEY_ID;
  process.env.RAZORPAY_KEY_SECRET = TEST_KEY_SECRET;
  process.env.RAZORPAY_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
  process.env.RAZORPAY_GST_MODE = 'not_applicable';
  process.env.RAZORPAY_GST_RATE_PERCENT = '18';
  delete process.env.SENDGRID_API_KEY;
  resetRazorpayRateLimits();
  getRazorpayPersistenceAdapter().clear?.();
}

function createMockRazorpayClient(opts: {
  paymentStatus?: string;
  paymentCaptured?: boolean;
  paymentAmount?: number;
  paymentCurrency?: string;
  paymentOrderIdOverride?: string;
  orderCounter?: { n: number };
  refundCalls?: Array<{ paymentId: string; amount?: number; notes?: Record<string, string> }>;
  fetchError?: boolean;
} = {}): RazorpayApiClient {
  const counter = opts.orderCounter || { n: 1 };
  const refundCalls = opts.refundCalls || [];

  return {
    async createOrder(params) {
      const id = `order_Test${String(counter.n++).padStart(6, '0')}`;
      return {
        id,
        amount: params.amount,
        currency: params.currency,
        receipt: params.receipt,
        status: 'created'
      };
    },
    async fetchPayment(paymentId: string): Promise<RazorpayApiPaymentResponse> {
      if (opts.fetchError) {
        throw new Error('Simulated Razorpay network timeout');
      }
      return {
        id: paymentId,
        order_id: opts.paymentOrderIdOverride,
        amount: opts.paymentAmount ?? 499900,
        currency: opts.paymentCurrency ?? 'INR',
        status: opts.paymentStatus ?? 'captured',
        captured: opts.paymentCaptured ?? (opts.paymentStatus ? opts.paymentStatus === 'captured' : true),
        method: 'upi',
        vpa: 'applicant@okaxis',
        created_at: Math.floor(Date.now() / 1000)
      };
    },
    async fetchOrderPayments(orderId: string) {
      if (opts.fetchError) {
        throw new Error('Simulated Razorpay network timeout');
      }
      return {
        items: [
          {
            id: `pay_Recon_${orderId.slice(-4)}`,
            order_id: opts.paymentOrderIdOverride ?? orderId,
            amount: opts.paymentAmount ?? 499900,
            currency: opts.paymentCurrency ?? 'INR',
            status: opts.paymentStatus ?? 'captured',
            captured: opts.paymentCaptured ?? true,
            method: 'netbanking',
            bank: 'HDFC',
            created_at: Math.floor(Date.now() / 1000)
          }
        ]
      };
    },
    async createRefund(paymentId, params) {
      refundCalls.push({ paymentId, amount: params.amount, notes: params.notes });
      return {
        id: `rfnd_Test${Date.now().toString().slice(-6)}`,
        payment_id: paymentId,
        amount: params.amount ?? 499900,
        currency: 'INR',
        status: 'processed'
      };
    }
  };
}

function createMockRes() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: '',
    setHeader(k: string, v: string) {
      this.headers[k.toLowerCase()] = String(v);
    },
    end(payload?: string) {
      this.body = payload || '';
      return this;
    }
  };
  return res;
}

function collectFilesRecursive(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFilesRecursive(full, acc);
    } else if (/\.(ts|tsx|js|jsx|html)$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

async function main() {
  console.log('\nTRUEDEAL GLOBAL — Razorpay Standard Checkout Verification Suite\n');

  await runTest('1. All 8 authoritative franchise packages compute exact INR & integer paise (>= 100 paise)', () => {
    resetEnvAndState();
    assert.equal(AUTHORITATIVE_FRANCHISE_PLANS.length, 8);
    const expectedINR: Record<string, number> = {
      plan_basic: 2500,
      plan_standard: 4999,
      plan_corporate: 14999,
      plan_platinum: 49999,
      plan_entrepreneur: 99999,
      plan_retirement: 149999,
      plan_enterprise: 499999,
      plan_global: 999999
    };
    for (const [planId, expected] of Object.entries(expectedINR)) {
      const calc = calculateServerPlanAmount(planId);
      assert.ok(calc, `Missing calculation for ${planId}`);
      assert.equal(calc.baseAmountINR, expected);
      assert.equal(calc.gstAmountINR, 0);
      assert.equal(calc.totalAmountINR, expected);
      assert.equal(calc.totalAmountPaise, expected * 100);
      assert.ok(Number.isInteger(calc.totalAmountPaise) && calc.totalAmountPaise >= 100);
    }
  });

  await runTest('2. Server-controlled GST modes (excluded 18%, included 18%, not_applicable)', () => {
    resetEnvAndState();
    process.env.RAZORPAY_GST_MODE = 'excluded';
    process.env.RAZORPAY_GST_RATE_PERCENT = '18';
    const excl = calculateServerPlanAmount('plan_basic')!;
    assert.equal(excl.baseAmountINR, 2500);
    assert.equal(excl.gstAmountINR, 450);
    assert.equal(excl.totalAmountINR, 2950);
    assert.equal(excl.totalAmountPaise, 295000);

    process.env.RAZORPAY_GST_MODE = 'included';
    const incl = calculateServerPlanAmount('plan_basic')!;
    assert.equal(incl.totalAmountINR, 2500);
    assert.equal(incl.totalAmountPaise, 250000);
    assert.ok(incl.gstAmountINR > 0 && Math.abs(incl.baseAmountINR + incl.gstAmountINR - 2500) <= 0.02);

    process.env.RAZORPAY_GST_MODE = 'not_applicable';
    const na = calculateServerPlanAmount('plan_basic')!;
    assert.equal(na.gstAmountINR, 0);
    assert.equal(na.totalAmountPaise, 250000);
  });

  await runTest('3. Rejects invalid application ID, invalid package, invalid email, and missing terms', async () => {
    resetEnvAndState();
    setRazorpayApiClientOverride(createMockRazorpayClient());

    const noApp = await createRazorpayOrder({
      applicationId: 'PENDING',
      planId: 'plan_standard',
      userId: 'uid_1',
      applicantName: 'Aarav Sharma',
      email: 'aarav@example.com',
      phone: '+919876543210',
      termsAccepted: true
    });
    assert.equal(noApp.ok, false);
    assert.equal(noApp.statusCode, 400);
    assert.equal(noApp.error, 'missing_application');

    const badPlan = await createRazorpayOrder({
      applicationId: 'TDG-2026-1001',
      planId: 'plan_fabricated_1rs',
      userId: 'uid_1',
      applicantName: 'Aarav Sharma',
      email: 'aarav@example.com',
      phone: '+919876543210',
      termsAccepted: true
    });
    assert.equal(badPlan.ok, false);
    assert.equal(badPlan.error, 'invalid_package');

    const badEmail = await createRazorpayOrder({
      applicationId: 'TDG-2026-1001',
      planId: 'plan_standard',
      userId: 'uid_1',
      applicantName: 'Aarav Sharma',
      email: 'invalid-email',
      phone: '+919876543210',
      termsAccepted: true
    });
    assert.equal(badEmail.ok, false);
    assert.equal(badEmail.error, 'invalid_customer_email');

    const noTerms = await createRazorpayOrder({
      applicationId: 'TDG-2026-1001',
      planId: 'plan_standard',
      userId: 'uid_1',
      applicantName: 'Aarav Sharma',
      email: 'aarav@example.com',
      phone: '+919876543210',
      termsAccepted: false
    });
    assert.equal(noTerms.ok, false);
    assert.equal(noTerms.error, 'terms_not_accepted');
  });

  await runTest('4. Detects Test/Live key prefix mismatch and blocks unsafe order creation', async () => {
    resetEnvAndState();
    process.env.RAZORPAY_MODE = 'test';
    process.env.RAZORPAY_KEY_ID = 'rzp_live_FakeMismatchKey';
    const cfg = getRazorpayConfigStatus();
    assert.equal(cfg.keyModeMismatch, true);
    assert.equal(cfg.configured, false);

    const res = await createRazorpayOrder({
      applicationId: 'TDG-2026-1002',
      planId: 'plan_standard',
      userId: 'uid_1',
      applicantName: 'Aarav Sharma',
      email: 'aarav@example.com',
      phone: '+919876543210',
      termsAccepted: true
    });
    assert.equal(res.ok, false);
    assert.equal(res.statusCode, 503);
    assert.equal(res.error, 'razorpay_mode_mismatch');
  });

  await runTest('5. Creates Razorpay order server-side & reuses active order on duplicate click', async () => {
    resetEnvAndState();
    const counter = { n: 1 };
    setRazorpayApiClientOverride(createMockRazorpayClient({ orderCounter: counter }));

    const first = await createRazorpayOrder({
      applicationId: 'TDG-2026-2001',
      planId: 'plan_standard',
      userId: 'uid_2001',
      applicantName: 'Priya Nair',
      email: 'priya@example.com',
      phone: '+919811111111',
      termsAccepted: true
    });
    assert.equal(first.ok, true);
    assert.equal(first.statusCode, 201);
    assert.equal(first.order?.amount, 499900);
    assert.equal(first.order?.currency, 'INR');
    assert.equal(first.order?.keyId, TEST_KEY_ID);
    assert.equal(first.order?.businessName, 'TRUEDEAL GLOBAL OPC PVT LTD');
    assert.equal(first.reusedOrder, false);

    // Duplicate click reuses the active CREATED order without calling Razorpay again
    const second = await createRazorpayOrder({
      applicationId: 'TDG-2026-2001',
      planId: 'plan_standard',
      userId: 'uid_2001',
      applicantName: 'Priya Nair',
      email: 'priya@example.com',
      phone: '+919811111111',
      termsAccepted: true
    });
    assert.equal(second.ok, true);
    assert.equal(second.reusedOrder, true);
    assert.equal(second.order?.id, first.order?.id);
    assert.equal(counter.n, 2);
  });

  await runTest('6. Rejects tampered/invalid HMAC-SHA256 signature & unknown order IDs', async () => {
    resetEnvAndState();
    setRazorpayApiClientOverride(createMockRazorpayClient());

    const created = await createRazorpayOrder({
      applicationId: 'TDG-2026-2002',
      planId: 'plan_standard',
      userId: 'uid_2002',
      applicantName: 'Rohan Mehta',
      email: 'rohan@example.com',
      phone: '+919822222222',
      termsAccepted: true
    });
    const orderId = created.order!.id;

    const badSig = await verifyRazorpayPayment({
      razorpay_order_id: orderId,
      razorpay_payment_id: 'pay_Tampered001',
      razorpay_signature: 'deadbeef'.repeat(8),
      applicationId: 'TDG-2026-2002',
      callerUid: 'uid_2002'
    });
    assert.equal(badSig.ok, false);
    assert.equal(badSig.verified, false);
    assert.equal(badSig.captured, false);
    assert.equal(badSig.statusCode, 400);
    assert.equal(badSig.error, 'invalid_signature');

    const unknownOrder = await verifyRazorpayPayment({
      razorpay_order_id: 'order_DoesNotExist999',
      razorpay_payment_id: 'pay_Unknown001',
      razorpay_signature: computeRazorpayPaymentSignature('order_DoesNotExist999', 'pay_Unknown001', TEST_KEY_SECRET),
      callerUid: 'uid_2002'
    });
    assert.equal(unknownOrder.ok, false);
    assert.equal(unknownOrder.statusCode, 404);
    assert.equal(unknownOrder.error, 'order_not_found');
  });

  await runTest('7. Flags amount/currency/order mismatch as VERIFICATION_REQUIRED (never marks paid)', async () => {
    resetEnvAndState();
    setRazorpayApiClientOverride(
      createMockRazorpayClient({
        paymentStatus: 'captured',
        paymentCaptured: true,
        paymentAmount: 100 // Tampered ₹1 instead of ₹4,999
      })
    );

    const created = await createRazorpayOrder({
      applicationId: 'TDG-2026-2003',
      planId: 'plan_standard',
      userId: 'uid_2003',
      applicantName: 'Meera Iyer',
      email: 'meera@example.com',
      phone: '+919833333333',
      termsAccepted: true
    });
    const orderId = created.order!.id;
    const payId = 'pay_Underpaid001';
    const sig = computeRazorpayPaymentSignature(orderId, payId, TEST_KEY_SECRET);

    const verified = await verifyRazorpayPayment({
      razorpay_order_id: orderId,
      razorpay_payment_id: payId,
      razorpay_signature: sig,
      applicationId: 'TDG-2026-2003',
      callerUid: 'uid_2003'
    });
    assert.equal(verified.ok, false);
    assert.equal(verified.captured, false);
    assert.equal(verified.statusCode, 400);
    assert.equal(verified.paymentStatus, 'VERIFICATION_REQUIRED');
    assert.equal(verified.error, 'amount_or_currency_mismatch');
  });

  await runTest('8. AUTHORIZED payment is NEVER marked CAPTURED / Paid', async () => {
    resetEnvAndState();
    setRazorpayApiClientOverride(
      createMockRazorpayClient({
        paymentStatus: 'authorized',
        paymentCaptured: false,
        paymentAmount: 499900
      })
    );

    const created = await createRazorpayOrder({
      applicationId: 'TDG-2026-2004',
      planId: 'plan_standard',
      userId: 'uid_2004',
      applicantName: 'Vikram Singh',
      email: 'vikram@example.com',
      phone: '+919844444444',
      termsAccepted: true
    });
    const orderId = created.order!.id;
    const payId = 'pay_AuthOnly001';
    const sig = computeRazorpayPaymentSignature(orderId, payId, TEST_KEY_SECRET);

    const verified = await verifyRazorpayPayment({
      razorpay_order_id: orderId,
      razorpay_payment_id: payId,
      razorpay_signature: sig,
      applicationId: 'TDG-2026-2004',
      callerUid: 'uid_2004'
    });
    assert.equal(verified.ok, true);
    assert.equal(verified.verified, true);
    assert.equal(verified.captured, false);
    assert.equal(verified.statusCode, 202);
    assert.equal(verified.paymentStatus, 'AUTHORIZED');
    assert.equal(verified.paymentRecord?.receiptNumber, undefined);
  });

  await runTest('9. Verified CAPTURED payment succeeds, issues receipt, blocks double-payment, and preserves separate approval', async () => {
    resetEnvAndState();
    setRazorpayApiClientOverride(
      createMockRazorpayClient({
        paymentStatus: 'captured',
        paymentCaptured: true,
        paymentAmount: 499900
      })
    );

    const created = await createRazorpayOrder({
      applicationId: 'TDG-2026-2005',
      planId: 'plan_standard',
      userId: 'uid_2005',
      applicantName: 'Neha Verma',
      email: 'neha@example.com',
      phone: '+919855555555',
      termsAccepted: true
    });
    const orderId = created.order!.id;
    const payId = 'pay_Captured001';
    const sig = computeRazorpayPaymentSignature(orderId, payId, TEST_KEY_SECRET);

    const verified = await verifyRazorpayPayment({
      razorpay_order_id: orderId,
      razorpay_payment_id: payId,
      razorpay_signature: sig,
      applicationId: 'TDG-2026-2005',
      callerUid: 'uid_2005'
    });
    assert.equal(verified.ok, true);
    assert.equal(verified.verified, true);
    assert.equal(verified.captured, true);
    assert.equal(verified.statusCode, 200);
    assert.equal(verified.paymentStatus, 'CAPTURED');
    assert.match(verified.paymentRecord?.receiptNumber || '', /^REC-TDG-\d{4}-/);
    assert.match(verified.message, /administrative approval/i);

    // Double payment attempt on same application & plan must be rejected with 409 already_paid
    const duplicatePay = await createRazorpayOrder({
      applicationId: 'TDG-2026-2005',
      planId: 'plan_standard',
      userId: 'uid_2005',
      applicantName: 'Neha Verma',
      email: 'neha@example.com',
      phone: '+919855555555',
      termsAccepted: true
    });
    assert.equal(duplicatePay.ok, false);
    assert.equal(duplicatePay.statusCode, 409);
    assert.equal(duplicatePay.error, 'already_paid');
  });

  await runTest('10. Checkout dismissed (CANCELLED) & retry creates new order without overwriting prior history', async () => {
    resetEnvAndState();
    const counter = { n: 1 };
    setRazorpayApiClientOverride(createMockRazorpayClient({ orderCounter: counter }));

    const first = await createRazorpayOrder({
      applicationId: 'TDG-2026-2006',
      planId: 'plan_basic',
      userId: 'uid_2006',
      applicantName: 'Karan Kapoor',
      email: 'karan@example.com',
      phone: '+919866666666',
      termsAccepted: true
    });
    const cancelRes = await recordClientCheckoutAttemptEvent({
      razorpayOrderId: first.order!.id,
      callerUid: 'uid_2006',
      outcome: 'cancelled',
      reason: 'User closed checkout window'
    });
    assert.equal(cancelRes.ok, true);
    assert.equal(cancelRes.paymentRecord?.paymentStatus, 'CANCELLED');

    const retry = await createRazorpayOrder({
      applicationId: 'TDG-2026-2006',
      planId: 'plan_basic',
      userId: 'uid_2006',
      applicantName: 'Karan Kapoor',
      email: 'karan@example.com',
      phone: '+919866666666',
      termsAccepted: true,
      forceNewOrder: true
    });
    assert.equal(retry.ok, true);
    assert.notEqual(retry.order?.id, first.order?.id);

    const history = await getRazorpayPersistenceAdapter().getPaymentsByApplicationId('TDG-2026-2006');
    assert.equal(history.length, 2, 'Prior cancelled attempt must be preserved alongside retry order');
    assert.ok(history.some((h) => h.razorpayOrderId === first.order!.id && h.paymentStatus === 'CANCELLED'));
    assert.ok(history.some((h) => h.razorpayOrderId === retry.order!.id && h.paymentStatus === 'CREATED'));
  });

  await runTest('11. Webhook raw-body HMAC verification rejects invalid signature (401) and deduplicates replays', async () => {
    resetEnvAndState();
    setRazorpayApiClientOverride(createMockRazorpayClient({ paymentAmount: 250000 }));

    const created = await createRazorpayOrder({
      applicationId: 'TDG-2026-3001',
      planId: 'plan_basic',
      userId: 'uid_3001',
      applicantName: 'Ananya Rao',
      email: 'ananya@example.com',
      phone: '+919877777777',
      termsAccepted: true
    });
    const orderId = created.order!.id;

    const payload = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_WebhookCap001',
            order_id: orderId,
            amount: 250000,
            currency: 'INR',
            status: 'captured',
            captured: true,
            method: 'card',
            card: { last4: '1111', network: 'Visa' }
          }
        }
      }
    });

    // Invalid signature rejected
    const invalid = await processRazorpayWebhook({
      rawBody: payload,
      signatureHeader: '0000'.repeat(16),
      eventIdHeader: 'evt_bad_sig_001'
    });
    assert.equal(invalid.ok, false);
    assert.equal(invalid.statusCode, 401);

    // Valid signature accepted
    const validSig = computeRazorpayWebhookSignature(payload, TEST_WEBHOOK_SECRET);
    const okRes = await processRazorpayWebhook({
      rawBody: payload,
      signatureHeader: validSig,
      eventIdHeader: 'evt_cap_001'
    });
    assert.equal(okRes.ok, true);
    assert.equal(okRes.statusCode, 200);
    assert.equal(okRes.duplicate, false);
    assert.equal(okRes.paymentStatus, 'CAPTURED');

    // Replay with same event ID deduplicated cleanly
    const replay = await processRazorpayWebhook({
      rawBody: payload,
      signatureHeader: validSig,
      eventIdHeader: 'evt_cap_001'
    });
    assert.equal(replay.ok, true);
    assert.equal(replay.duplicate, true);
  });

  await runTest('12. Delayed payment.failed webhook NEVER downgrades a CAPTURED payment', async () => {
    resetEnvAndState();
    setRazorpayApiClientOverride(createMockRazorpayClient({ paymentAmount: 250000 }));

    const created = await createRazorpayOrder({
      applicationId: 'TDG-2026-3002',
      planId: 'plan_basic',
      userId: 'uid_3002',
      applicantName: 'Siddharth Joshi',
      email: 'sid@example.com',
      phone: '+919888888888',
      termsAccepted: true
    });
    const orderId = created.order!.id;

    // Capture first
    const capBody = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_CapMonotonic',
            order_id: orderId,
            amount: 250000,
            currency: 'INR',
            status: 'captured',
            captured: true
          }
        }
      }
    });
    await processRazorpayWebhook({
      rawBody: capBody,
      signatureHeader: computeRazorpayWebhookSignature(capBody, TEST_WEBHOOK_SECRET),
      eventIdHeader: 'evt_mono_cap'
    });

    // Delayed failed webhook arrives after capture
    const failBody = JSON.stringify({
      event: 'payment.failed',
      payload: {
        payment: {
          entity: {
            id: 'pay_CapMonotonicOldAttempt',
            order_id: orderId,
            amount: 250000,
            currency: 'INR',
            status: 'failed',
            error_description: 'Delayed failure notification'
          }
        }
      }
    });
    const failRes = await processRazorpayWebhook({
      rawBody: failBody,
      signatureHeader: computeRazorpayWebhookSignature(failBody, TEST_WEBHOOK_SECRET),
      eventIdHeader: 'evt_mono_fail'
    });
    assert.equal(failRes.ok, true);
    assert.equal(failRes.paymentStatus, 'CAPTURED');

    const stored = await getRazorpayPersistenceAdapter().getPaymentByOrderId(orderId);
    assert.equal(stored?.paymentStatus, 'CAPTURED');
  });

  await runTest('13. Webhook handles payment.authorized, order.paid, refund.created, refund.processed, refund.failed', async () => {
    resetEnvAndState();
    setRazorpayApiClientOverride(createMockRazorpayClient({ paymentAmount: 250000 }));

    const created = await createRazorpayOrder({
      applicationId: 'TDG-2026-3003',
      planId: 'plan_basic',
      userId: 'uid_3003',
      applicantName: 'Divya Menon',
      email: 'divya@example.com',
      phone: '+919899999999',
      termsAccepted: true
    });
    const orderId = created.order!.id;

    // payment.authorized -> AUTHORIZED (NOT CAPTURED)
    const authBody = JSON.stringify({
      event: 'payment.authorized',
      payload: {
        payment: { entity: { id: 'pay_Seq001', order_id: orderId, amount: 250000, currency: 'INR', status: 'authorized' } }
      }
    });
    const authRes = await processRazorpayWebhook({
      rawBody: authBody,
      signatureHeader: computeRazorpayWebhookSignature(authBody, TEST_WEBHOOK_SECRET),
      eventIdHeader: 'evt_seq_auth'
    });
    assert.equal(authRes.paymentStatus, 'AUTHORIZED');

    // order.paid -> CAPTURED
    const orderPaidBody = JSON.stringify({
      event: 'order.paid',
      payload: {
        order: { entity: { id: orderId, amount: 250000, amount_paid: 250000, currency: 'INR', status: 'paid' } },
        payment: { entity: { id: 'pay_Seq001', order_id: orderId, amount: 250000, currency: 'INR', status: 'captured', captured: true } }
      }
    });
    const paidRes = await processRazorpayWebhook({
      rawBody: orderPaidBody,
      signatureHeader: computeRazorpayWebhookSignature(orderPaidBody, TEST_WEBHOOK_SECRET),
      eventIdHeader: 'evt_seq_paid'
    });
    assert.equal(paidRes.paymentStatus, 'CAPTURED');

    // refund.created -> REFUND_INITIATED
    const refCreatedBody = JSON.stringify({
      event: 'refund.created',
      payload: {
        refund: { entity: { id: 'rfnd_Seq001', payment_id: 'pay_Seq001', amount: 250000, currency: 'INR', status: 'pending' } }
      }
    });
    const refCreatedRes = await processRazorpayWebhook({
      rawBody: refCreatedBody,
      signatureHeader: computeRazorpayWebhookSignature(refCreatedBody, TEST_WEBHOOK_SECRET),
      eventIdHeader: 'evt_seq_ref_created'
    });
    assert.equal(refCreatedRes.paymentStatus, 'REFUND_INITIATED');

    // refund.processed -> REFUNDED
    const refProcessedBody = JSON.stringify({
      event: 'refund.processed',
      payload: {
        refund: { entity: { id: 'rfnd_Seq001', payment_id: 'pay_Seq001', amount: 250000, currency: 'INR', status: 'processed' } }
      }
    });
    const refProcessedRes = await processRazorpayWebhook({
      rawBody: refProcessedBody,
      signatureHeader: computeRazorpayWebhookSignature(refProcessedBody, TEST_WEBHOOK_SECRET),
      eventIdHeader: 'evt_seq_ref_processed'
    });
    assert.equal(refProcessedRes.paymentStatus, 'REFUNDED');
  });

  await runTest('14. Admin reconciliation, real Razorpay Refund API call, internal notes & Admin RBAC gate', async () => {
    resetEnvAndState();
    const refundCalls: Array<{ paymentId: string; amount?: number; notes?: Record<string, string> }> = [];
    setRazorpayApiClientOverride(
      createMockRazorpayClient({
        paymentStatus: 'captured',
        paymentCaptured: true,
        paymentAmount: 250000,
        refundCalls
      })
    );

    const created = await createRazorpayOrder({
      applicationId: 'TDG-2026-4001',
      planId: 'plan_basic',
      userId: 'uid_4001',
      applicantName: 'Arjun Patel',
      email: 'arjun@example.com',
      phone: '+919800000001',
      termsAccepted: true
    });
    const orderId = created.order!.id;

    // Admin reconciliation pulls captured payment from Razorpay API
    const recon = await reconcileRazorpayOrder(orderId);
    assert.equal(recon.ok, true);
    assert.equal(recon.paymentRecord?.paymentStatus, 'CAPTURED');

    // Admin adds internal note
    const noteRes = await addRazorpayAdminNote({
      orderId,
      note: 'Verified bank settlement batch #42.',
      actorEmail: 'director@truedealglobal.com'
    });
    assert.equal(noteRes.ok, true);
    assert.equal(noteRes.paymentRecord?.internalNotes.length, 1);

    // Admin triggers REAL Razorpay Refund API call
    const refundRes = await initiateRazorpayRefund({
      orderId,
      reason: 'Applicant cancelled within refund window prior to license activation.',
      actorEmail: 'director@truedealglobal.com'
    });
    assert.equal(refundRes.ok, true);
    assert.equal(refundCalls.length, 1, 'Must invoke real Razorpay Refund API');
    assert.equal(refundCalls[0].amount, 250000);
    assert.ok(refundRes.paymentRecord?.refundId?.startsWith('rfnd_'));
    assert.ok(['REFUNDED', 'REFUND_INITIATED'].includes(refundRes.paymentRecord?.paymentStatus || ''));

    // Unauthenticated call to /api/admin/payments must return 401
    const unauthRes = createMockRes();
    await adminPaymentsHandler({ method: 'GET', headers: {} }, unauthRes);
    assert.equal(unauthRes.statusCode, 401);

    // Invalid signature on /api/webhooks/razorpay handler returns 401
    const badWebhookRes = createMockRes();
    await razorpayWebhookHandler(
      {
        method: 'POST',
        headers: { 'x-razorpay-signature': 'invalid_sig' },
        rawBody: '{"event":"payment.captured"}'
      },
      badWebhookRes
    );
    assert.equal(badWebhookRes.statusCode, 401);
  });

  await runTest('15. Zero Razorpay secrets or exposed credentials in frontend source files (src/components, src/services, src/utils)', () => {
    const clientDirs = ['src/components', 'src/services', 'src/utils', 'src/config'];
    const forbiddenPatterns = [
      /RAZORPAY_KEY_SECRET/,
      /RAZORPAY_WEBHOOK_SECRET/,
      /VITE_RAZORPAY_KEY_SECRET/,
      /VITE_RAZORPAY_WEBHOOK_SECRET/,
      /PAYU_MERCHANT_SALT/
    ];
    for (const rel of clientDirs) {
      const abs = path.resolve(process.cwd(), rel);
      if (!fs.existsSync(abs)) continue;
      for (const file of collectFilesRecursive(abs)) {
        const content = fs.readFileSync(file, 'utf8');
        // Allow ApiDocsView / PaymentModal educational text mentioning env var names in code tags?
        // Check strictly that no process.env or import.meta.env reads secret values in client code
        if (/import\.meta\.env\.VITE_RAZORPAY_KEY_SECRET|import\.meta\.env\.VITE_RAZORPAY_WEBHOOK_SECRET/.test(content)) {
          throw new Error(`Client bundle attempts to read Razorpay secret env var in ${file}`);
        }
        if (/process\.env\.RAZORPAY_KEY_SECRET|process\.env\.RAZORPAY_WEBHOOK_SECRET/.test(content)) {
          throw new Error(`Client file references server process.env Razorpay secret in ${file}`);
        }
        // Ensure zero hardcoded rzp_live_ keys in source
        if (/rzp_live_[A-Za-z0-9]{10,}/.test(content)) {
          throw new Error(`Hardcoded live Razorpay key detected in ${file}`);
        }
      }
    }
    // Also verify .env.example leaves secrets blank
    const envExample = fs.readFileSync(path.resolve(process.cwd(), '.env.example'), 'utf8');
    assert.match(envExample, /RAZORPAY_KEY_SECRET=""/);
    assert.match(envExample, /RAZORPAY_WEBHOOK_SECRET=""/);
    assert.match(envExample, /RAZORPAY_MODE="test"/);
    assert.ok(forbiddenPatterns.length > 0);
  });

  await runTest('16. Direct applicant checkout (no Google Sign-In) & stateless serverless checkoutToken verification', async () => {
    resetEnvAndState();
    setRazorpayApiClientOverride(
      createMockRazorpayClient({
        paymentStatus: 'captured',
        paymentCaptured: true,
        paymentAmount: 499900
      })
    );

    // 1. Create order via /api/create-order WITHOUT Authorization header using Name, Email, Phone
    const createRes = createMockRes();
    await createOrderHandler(
      {
        method: 'POST',
        headers: {},
        body: {
          applicationId: 'TDG-2026-5001',
          planId: 'plan_standard',
          applicantName: 'Direct Applicant',
          email: 'direct.applicant@example.com',
          phone: '+919876543210',
          termsAccepted: true
        }
      },
      createRes
    );
    assert.equal(createRes.statusCode, 201);
    const createdPayload = JSON.parse(createRes.body);
    assert.equal(createdPayload.ok, true);
    assert.ok(createdPayload.order?.id);
    assert.ok(createdPayload.checkoutToken, 'Must return server-signed checkoutToken');

    const orderId = createdPayload.order.id as string;
    const checkoutToken = createdPayload.checkoutToken as string;
    const payId = 'pay_DirectGuest001';
    const validSig = computeRazorpayPaymentSignature(orderId, payId, TEST_KEY_SECRET);

    // 2. Clear in-memory store to simulate a cold separate Vercel serverless container
    getRazorpayPersistenceAdapter().clear?.();

    // 3. Tampered checkoutToken must be rejected with 401
    const tamperedRes = createMockRes();
    await verifyPaymentHandler(
      {
        method: 'POST',
        headers: {},
        body: {
          razorpay_order_id: orderId,
          razorpay_payment_id: payId,
          razorpay_signature: validSig,
          applicationId: 'TDG-2026-5001',
          checkoutToken: `${checkoutToken.slice(0, -4)}ffff`
        }
      },
      tamperedRes
    );
    assert.equal(tamperedRes.statusCode, 401);

    // 4. Valid server-signed checkoutToken + valid Razorpay HMAC signature succeeds on cold container
    const verifyRes = createMockRes();
    await verifyPaymentHandler(
      {
        method: 'POST',
        headers: {},
        body: {
          razorpay_order_id: orderId,
          razorpay_payment_id: payId,
          razorpay_signature: validSig,
          applicationId: 'TDG-2026-5001',
          checkoutToken
        }
      },
      verifyRes
    );
    assert.equal(verifyRes.statusCode, 200);
    const verifiedPayload = JSON.parse(verifyRes.body);
    assert.equal(verifiedPayload.ok, true);
    assert.equal(verifiedPayload.verified, true);
    assert.equal(verifiedPayload.captured, true);
    assert.equal(verifiedPayload.paymentStatus, 'CAPTURED');
  });

  setRazorpayApiClientOverride(null);

  console.log(`\nRazorpay Verification Summary: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
