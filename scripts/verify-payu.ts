import {
  getPayUConfigStatus,
  generatePayURequestHash,
  generatePayUResponseHash,
  verifyPayUResponseHash,
  initiatePayUPaymentOrder,
  processPayUGatewayResponse,
  reconcilePayUTransaction,
  defaultPayUStore,
  setPayUPersistenceAdapter,
  setPayUVerifyFetcherForTests,
  resetPayURateLimits,
  PayUPersistenceAdapter
} from '../src/server/payuService';
import { createSignedSessionToken } from '../src/server/authService';
import initiateHandler from '../api/payments/payu/initiate';
import statusHandler from '../api/payments/payu/status';
import adminPaymentsHandler from '../api/admin/payments';

interface TestCaseResult {
  num: number;
  name: string;
  passed: boolean;
  detail?: string;
}

const results: TestCaseResult[] = [];

function record(num: number, name: string, passed: boolean, detail?: string) {
  results.push({ num, name, passed, detail });
}

function createMockRes() {
  let statusCode = 200;
  const headers: Record<string, string> = {};
  let rawBody = '';
  return {
    get statusCode() {
      return statusCode;
    },
    set statusCode(code: number) {
      statusCode = code;
    },
    setHeader(k: string, v: string) {
      headers[k.toLowerCase()] = v;
    },
    end(payload: string) {
      rawBody = payload || '';
    },
    json() {
      return rawBody ? JSON.parse(rawBody) : null;
    }
  };
}

async function runSuite() {
  console.log('================================================================');
  console.log('TRUEDEAL GLOBAL — PAYU CLASSIC HOSTED CHECKOUT 18-SCENARIO SUITE');
  console.log('================================================================\n');

  // Configure isolated synthetic PayU test credentials strictly in memory for test run
  process.env.PAYU_ENV = 'test';
  process.env.PAYU_MERCHANT_KEY = 'TEST_KEY_TRUEDEAL';
  process.env.PAYU_MERCHANT_SALT = 'TEST_SALT_SECRET_987654321';
  process.env.APP_BASE_URL = 'https://businessfranchise.truedealglobal.com';
  process.env.SESSION_SECRET = 'test_session_secret_for_payu_suite_only_32bytes';

  const KEY = process.env.PAYU_MERCHANT_KEY;
  const SALT = process.env.PAYU_MERCHANT_SALT;

  defaultPayUStore.clear();
  setPayUPersistenceAdapter(defaultPayUStore);
  resetPayURateLimits();

  // 1. Valid Payment Initiation
  {
    const init = await initiatePayUPaymentOrder({
      applicationId: 'TDG-2026-2001',
      planId: 'plan_standard',
      userId: 'uid_applicant_1',
      applicantName: 'Aarav Mehta',
      email: 'aarav@example.com',
      phone: '+919876543210',
      clientIp: '10.0.0.1'
    });

    const expectedHash = init.formFields
      ? generatePayURequestHash(
          {
            key: KEY,
            txnid: init.formFields.txnid,
            amount: '4999.00',
            productinfo: init.formFields.productinfo,
            firstname: init.formFields.firstname,
            email: init.formFields.email,
            udf1: init.formFields.udf1,
            udf2: init.formFields.udf2,
            udf3: init.formFields.udf3,
            udf4: init.formFields.udf4,
            udf5: init.formFields.udf5
          },
          SALT
        )
      : '';

    const ok =
      init.ok &&
      init.statusCode === 201 &&
      init.checkoutUrl === 'https://test.payu.in/_payment' &&
      init.formFields?.amount === '4999.00' &&
      init.formFields?.hash === expectedHash &&
      init.payment?.paymentStatus === 'PAYMENT_PENDING';

    record(1, 'Valid PayU payment initiation (server amount + SHA-512 hash + PAYMENT_PENDING)', ok, init.message);
  }

  // 2. Invalid Application ID
  {
    const res = await initiatePayUPaymentOrder({
      applicationId: '../../etc/passwd',
      planId: 'plan_standard',
      userId: 'uid_applicant_1',
      applicantName: 'Aarav Mehta',
      email: 'aarav@example.com',
      phone: '+919876543210',
      clientIp: '10.0.0.2'
    });
    record(2, 'Invalid application ID rejected (400)', !res.ok && res.statusCode === 400 && res.error === 'invalid_application_id');
  }

  // 3. Tampered Amount from Browser
  {
    const res = await initiatePayUPaymentOrder({
      applicationId: 'TDG-2026-2003',
      planId: 'plan_platinum', // Authoritative price ₹49,999
      userId: 'uid_applicant_1',
      applicantName: 'Aarav Mehta',
      email: 'aarav@example.com',
      phone: '+919876543210',
      clientSuppliedAmount: 1, // Tampered ₹1 attempt
      clientIp: '10.0.0.3'
    });
    record(
      3,
      'Tampered amount from browser rejected (400 amount_tampering_detected)',
      !res.ok && res.statusCode === 400 && res.error === 'amount_tampering_detected'
    );
  }

  // 4. Unauthorized Payment Initiation (via API handler without valid token)
  {
    const mockRes = createMockRes();
    await initiateHandler(
      {
        method: 'POST',
        headers: {},
        body: { applicationId: 'TDG-2026-2004', planId: 'plan_basic' }
      },
      mockRes
    );
    record(4, 'Unauthorized payment initiation rejected (401)', mockRes.statusCode === 401 && mockRes.json()?.error === 'unauthorized');
  }

  // 5. Incorrect Request Hash Detection
  {
    const validHash = generatePayURequestHash(
      {
        key: KEY,
        txnid: 'TDG_HASH_TEST_1',
        amount: '4999.00',
        productinfo: 'Standard Plan',
        firstname: 'Aarav',
        email: 'aarav@example.com',
        udf1: 'TDG-2026-2005'
      },
      SALT
    );
    const alteredAmountHash = generatePayURequestHash(
      {
        key: KEY,
        txnid: 'TDG_HASH_TEST_1',
        amount: '1.00',
        productinfo: 'Standard Plan',
        firstname: 'Aarav',
        email: 'aarav@example.com',
        udf1: 'TDG-2026-2005'
      },
      SALT
    );
    const wrongSaltHash = generatePayURequestHash(
      {
        key: KEY,
        txnid: 'TDG_HASH_TEST_1',
        amount: '4999.00',
        productinfo: 'Standard Plan',
        firstname: 'Aarav',
        email: 'aarav@example.com',
        udf1: 'TDG-2026-2005'
      },
      'WRONG_SALT'
    );
    record(
      5,
      'Incorrect request hash detection (altered amount or wrong salt fails SHA-512 match)',
      validHash.length === 128 && validHash !== alteredAmountHash && validHash !== wrongSaltHash
    );
  }

  // 6. Incorrect Response / Callback Hash Rejected
  {
    const init = await initiatePayUPaymentOrder({
      applicationId: 'TDG-2026-2006',
      planId: 'plan_basic',
      userId: 'uid_applicant_6',
      applicantName: 'Neha Singh',
      email: 'neha@example.com',
      phone: '+919900112233',
      clientIp: '10.0.0.6'
    });
    const ff = init.formFields!;
    const badCallback = await processPayUGatewayResponse(
      {
        key: ff.key,
        txnid: ff.txnid,
        amount: ff.amount,
        productinfo: ff.productinfo,
        firstname: ff.firstname,
        email: ff.email,
        udf1: ff.udf1,
        udf2: ff.udf2,
        udf3: ff.udf3,
        udf4: ff.udf4,
        udf5: ff.udf5,
        status: 'success',
        mihpayid: '9000000006',
        hash: '0'.repeat(128) // Forged hash
      },
      'callback'
    );
    record(
      6,
      'Incorrect response/callback reverse SHA-512 hash rejected (401)',
      !badCallback.ok && badCallback.statusCode === 401 && badCallback.error === 'invalid_response_hash'
    );
  }

  // 7. Verified Successful Payment (Reverse Hash + Independent verify_payment API + additionalCharges)
  let verifiedSuccessTxnId = '';
  let verifiedSuccessFields: any = null;
  {
    const init = await initiatePayUPaymentOrder({
      applicationId: 'TDG-2026-2007',
      planId: 'plan_corporate',
      userId: 'uid_applicant_7',
      applicantName: 'Rohan Sharma',
      email: 'rohan@example.com',
      phone: '+919811223344',
      clientIp: '10.0.0.7'
    });
    const ff = init.formFields!;
    verifiedSuccessTxnId = ff.txnid;
    verifiedSuccessFields = ff;

    setPayUVerifyFetcherForTests(async () => ({
      ok: true,
      status: 'SUCCESS',
      rawGatewayStatus: 'success',
      mihpayid: '4039937155290007',
      amount: '14999.00',
      mode: 'UPI',
      bankRefNum: 'UTR4290077711'
    }));

    const additionalCharges = '10.00';
    const validReverseHash = generatePayUResponseHash(
      {
        key: ff.key,
        txnid: ff.txnid,
        amount: ff.amount,
        productinfo: ff.productinfo,
        firstname: ff.firstname,
        email: ff.email,
        udf1: ff.udf1,
        udf2: ff.udf2,
        udf3: ff.udf3,
        udf4: ff.udf4,
        udf5: ff.udf5,
        status: 'success',
        additionalCharges
      },
      SALT
    );

    const verified = await processPayUGatewayResponse(
      {
        key: ff.key,
        txnid: ff.txnid,
        amount: ff.amount,
        productinfo: ff.productinfo,
        firstname: ff.firstname,
        email: ff.email,
        udf1: ff.udf1,
        udf2: ff.udf2,
        udf3: ff.udf3,
        udf4: ff.udf4,
        udf5: ff.udf5,
        status: 'success',
        additionalCharges,
        mihpayid: '4039937155290007',
        mode: 'UPI',
        hash: validReverseHash
      },
      'callback'
    );

    record(
      7,
      'Verified successful payment (reverse SHA-512 + additionalCharges + verify_payment + receipt)',
      verified.ok &&
        verified.finalStatus === 'SUCCESS' &&
        Boolean(verified.payment?.receiptNumber?.startsWith('REC-TDG-')) &&
        Boolean(verified.payment?.verifiedAt)
    );
  }

  // 8. Failed Payment
  let failedAppId = 'TDG-2026-2008';
  {
    const init = await initiatePayUPaymentOrder({
      applicationId: failedAppId,
      planId: 'plan_basic',
      userId: 'uid_applicant_8',
      applicantName: 'Priya Nair',
      email: 'priya@example.com',
      phone: '+919822334455',
      clientIp: '10.0.0.8'
    });
    const ff = init.formFields!;

    setPayUVerifyFetcherForTests(async () => ({
      ok: true,
      status: 'FAILED',
      rawGatewayStatus: 'failure',
      mihpayid: '4039937155290008',
      amount: '2500.00',
      errorMessage: 'Insufficient funds'
    }));

    const hash = generatePayUResponseHash({ ...ff, status: 'failure' }, SALT);
    const res = await processPayUGatewayResponse(
      { ...ff, status: 'failure', mihpayid: '4039937155290008', error_Message: 'Insufficient funds', hash },
      'callback'
    );
    record(
      8,
      'Failed payment accurately marked FAILED without issuing a receipt',
      res.ok && res.finalStatus === 'FAILED' && !res.payment?.receiptNumber
    );
  }

  // 9. Pending Payment (and verify_payment unreachable never blindly marks SUCCESS)
  {
    const init = await initiatePayUPaymentOrder({
      applicationId: 'TDG-2026-2009',
      planId: 'plan_basic',
      userId: 'uid_applicant_9',
      applicantName: 'Kabir Verma',
      email: 'kabir@example.com',
      phone: '+919833445566',
      clientIp: '10.0.0.9'
    });
    const ff = init.formFields!;

    setPayUVerifyFetcherForTests(async () => ({
      ok: true,
      status: 'PAYMENT_PENDING',
      rawGatewayStatus: 'pending',
      mihpayid: '4039937155290009',
      amount: '2500.00'
    }));

    const hash = generatePayUResponseHash({ ...ff, status: 'pending' }, SALT);
    const res = await processPayUGatewayResponse(
      { ...ff, status: 'pending', mihpayid: '4039937155290009', hash },
      'callback'
    );
    record(
      9,
      'Pending payment accurately recorded as PAYMENT_PENDING without receipt',
      res.ok && res.finalStatus === 'PAYMENT_PENDING' && !res.payment?.receiptNumber
    );
  }

  // 10. Cancelled Payment
  {
    const init = await initiatePayUPaymentOrder({
      applicationId: 'TDG-2026-2010',
      planId: 'plan_basic',
      userId: 'uid_applicant_10',
      applicantName: 'Ananya Rao',
      email: 'ananya@example.com',
      phone: '+919844556677',
      clientIp: '10.0.0.10'
    });
    const ff = init.formFields!;

    setPayUVerifyFetcherForTests(async () => ({
      ok: true,
      status: 'CANCELLED',
      rawGatewayStatus: 'failure',
      unmappedstatus: 'userCancelled',
      mihpayid: '4039937155290010',
      amount: '2500.00'
    }));

    const hash = generatePayUResponseHash({ ...ff, status: 'failure' }, SALT);
    const res = await processPayUGatewayResponse(
      { ...ff, status: 'failure', unmappedstatus: 'userCancelled', mihpayid: '4039937155290010', hash },
      'callback'
    );
    record(
      10,
      'Cancelled payment accurately recorded as CANCELLED without receipt',
      res.ok && res.finalStatus === 'CANCELLED' && !res.payment?.receiptNumber
    );
  }

  // 11. Duplicate Webhook Delivery (Idempotent Acknowledgment)
  {
    const init = await initiatePayUPaymentOrder({
      applicationId: 'TDG-2026-2011',
      planId: 'plan_standard',
      userId: 'uid_applicant_11',
      applicantName: 'Vikram Patel',
      email: 'vikram@example.com',
      phone: '+919855667788',
      clientIp: '10.0.0.11'
    });
    const ff = init.formFields!;
    setPayUVerifyFetcherForTests(async () => ({
      ok: true,
      status: 'SUCCESS',
      rawGatewayStatus: 'success',
      mihpayid: '4039937155290011',
      amount: '4999.00',
      mode: 'NB'
    }));
    const hash = generatePayUResponseHash({ ...ff, status: 'success' }, SALT);
    const payload = { ...ff, status: 'success', mihpayid: '4039937155290011', mode: 'NB', hash };

    const first = await processPayUGatewayResponse(payload, 'webhook');
    const second = await processPayUGatewayResponse(payload, 'webhook');
    record(
      11,
      'Duplicate webhook delivery handled idempotently without duplicate mutation',
      first.ok && !first.duplicate && second.ok && Boolean(second.duplicate) && first.payment?.receiptNumber === second.payment?.receiptNumber
    );
  }

  // 12. Duplicate / Delayed Failure Callback NEVER Downgrades Verified SUCCESS
  {
    const ff = verifiedSuccessFields;
    const delayedFailHash = generatePayUResponseHash({ ...ff, status: 'failure' }, SALT);
    setPayUVerifyFetcherForTests(async () => ({
      ok: true,
      status: 'FAILED',
      rawGatewayStatus: 'failure',
      mihpayid: '4039937155290007',
      amount: '14999.00'
    }));
    const replay = await processPayUGatewayResponse(
      { ...ff, status: 'failure', mihpayid: '4039937155290007', hash: delayedFailHash },
      'webhook'
    );
    const stored = await defaultPayUStore.getPaymentByTxnId(verifiedSuccessTxnId);
    record(
      12,
      'Delayed failure webhook/callback NEVER downgrades already verified SUCCESS',
      replay.ok && replay.finalStatus === 'SUCCESS' && stored?.paymentStatus === 'SUCCESS'
    );
  }

  // 13. Payment Amount Mismatch on Callback Flagged UNDER_REVIEW
  {
    const init = await initiatePayUPaymentOrder({
      applicationId: 'TDG-2026-2013',
      planId: 'plan_corporate', // ₹14,999.00
      userId: 'uid_applicant_13',
      applicantName: 'Siddharth Bose',
      email: 'sid@example.com',
      phone: '+919866778899',
      clientIp: '10.0.0.13'
    });
    const ff = init.formFields!;
    const mismatchedPayload = { ...ff, amount: '500.00', status: 'success' };
    const hash = generatePayUResponseHash(mismatchedPayload, SALT);
    const res = await processPayUGatewayResponse({ ...mismatchedPayload, mihpayid: '4039937155290013', hash }, 'callback');
    record(
      13,
      'Payment amount mismatch on gateway callback rejected (400) & flagged UNDER_REVIEW',
      !res.ok && res.statusCode === 400 && res.error === 'amount_mismatch' && res.finalStatus === 'UNDER_REVIEW'
    );
  }

  // 14. Unauthorized Admin Access Rejected (401 unauth, 403 applicant)
  {
    const resUnauth = createMockRes();
    await adminPaymentsHandler({ method: 'GET', headers: {} }, resUnauth);

    const applicantToken = createSignedSessionToken({
      uid: 'uid_applicant_14',
      email: 'random.applicant@gmail.com',
      name: 'Random Applicant',
      role: 'applicant'
    });
    const resApplicant = createMockRes();
    await adminPaymentsHandler(
      { method: 'GET', headers: { authorization: `Bearer ${applicantToken}` } },
      resApplicant
    );

    const adminToken = createSignedSessionToken({
      uid: 'uid_super_admin',
      email: 'director@truedealglobal.com',
      name: 'Managing Director',
      role: 'super_admin'
    });
    const resAdmin = createMockRes();
    await adminPaymentsHandler(
      { method: 'GET', headers: { authorization: `Bearer ${adminToken}` } },
      resAdmin
    );

    record(
      14,
      'Unauthorized admin access blocked (401 unauth, 403 applicant, 200 verified admin)',
      resUnauth.statusCode === 401 && resApplicant.statusCode === 403 && resAdmin.statusCode === 200 && resAdmin.json()?.ok === true
    );
  }

  // 15. Cross-Applicant Record Isolation (User B cannot access User A payment)
  {
    const userBToken = createSignedSessionToken({
      uid: 'uid_applicant_B_intruder',
      email: 'intruder@example.com',
      name: 'Intruder User',
      role: 'applicant'
    });
    const resStatus = createMockRes();
    await statusHandler(
      {
        method: 'GET',
        headers: { authorization: `Bearer ${userBToken}` },
        query: { txnid: verifiedSuccessTxnId }
      },
      resStatus
    );

    const ownerToken = createSignedSessionToken({
      uid: 'uid_applicant_7',
      email: 'rohan@example.com',
      name: 'Rohan Sharma',
      role: 'applicant'
    });
    const resOwner = createMockRes();
    await statusHandler(
      {
        method: 'GET',
        headers: { authorization: `Bearer ${ownerToken}` },
        query: { txnid: verifiedSuccessTxnId }
      },
      resOwner
    );

    record(
      15,
      'Cross-applicant payment record isolation enforced (403 other applicant, 200 owner)',
      resStatus.statusCode === 403 && resOwner.statusCode === 200 && resOwner.json()?.payment?.txnId === verifiedSuccessTxnId
    );
  }

  // 16. Retry After Failed Payment Allowed, Retry After Verified SUCCESS Blocked (409)
  {
    const retryAfterFail = await initiatePayUPaymentOrder({
      applicationId: failedAppId,
      planId: 'plan_basic',
      userId: 'uid_applicant_8',
      applicantName: 'Priya Nair',
      email: 'priya@example.com',
      phone: '+919822334455',
      clientIp: '10.0.0.16'
    });

    const retryAfterSuccess = await initiatePayUPaymentOrder({
      applicationId: 'TDG-2026-2007', // Already SUCCESS
      planId: 'plan_corporate',
      userId: 'uid_applicant_7',
      applicantName: 'Rohan Sharma',
      email: 'rohan@example.com',
      phone: '+919811223344',
      clientIp: '10.0.0.16'
    });

    record(
      16,
      'Retry allowed after FAILED payment (201 fresh txnid) & blocked after SUCCESS (409 already_paid)',
      retryAfterFail.ok &&
        retryAfterFail.statusCode === 201 &&
        !retryAfterSuccess.ok &&
        retryAfterSuccess.statusCode === 409 &&
        retryAfterSuccess.error === 'already_paid'
    );
  }

  // 17. Database Update Failure Returns Safe 500 Without Corrupting State
  {
    const failingAdapter: PayUPersistenceAdapter = {
      savePayment: async () => {
        throw new Error('Simulated DB write outage');
      },
      getPaymentByTxnId: (tx) => defaultPayUStore.getPaymentByTxnId(tx),
      getPaymentsByApplicationId: (appId) => defaultPayUStore.getPaymentsByApplicationId(appId),
      getAllPayments: () => defaultPayUStore.getAllPayments(),
      hasWebhookEvent: (id) => defaultPayUStore.hasWebhookEvent(id),
      saveWebhookEvent: async () => {
        throw new Error('Simulated DB write outage');
      },
      getAllWebhookEvents: () => defaultPayUStore.getAllWebhookEvents()
    };

    setPayUPersistenceAdapter(failingAdapter);
    const dbFailInit = await initiatePayUPaymentOrder({
      applicationId: 'TDG-2026-2017',
      planId: 'plan_basic',
      userId: 'uid_applicant_17',
      applicantName: 'Deepak Jain',
      email: 'deepak@example.com',
      phone: '+919877889900',
      clientIp: '10.0.0.17'
    });
    setPayUPersistenceAdapter(defaultPayUStore);

    record(
      17,
      'Database write failure safely returns 500 database_write_failed without leaking secrets',
      !dbFailInit.ok && dbFailInit.statusCode === 500 && dbFailInit.error === 'database_write_failed'
    );
  }

  // 18. Webhook Arriving BEFORE Browser Redirect
  {
    const init = await initiatePayUPaymentOrder({
      applicationId: 'TDG-2026-2018',
      planId: 'plan_standard',
      userId: 'uid_applicant_18',
      applicantName: 'Meera Iyer',
      email: 'meera@example.com',
      phone: '+919888990011',
      clientIp: '10.0.0.18'
    });
    const ff = init.formFields!;

    setPayUVerifyFetcherForTests(async () => ({
      ok: true,
      status: 'SUCCESS',
      rawGatewayStatus: 'success',
      mihpayid: '4039937155290018',
      amount: '4999.00',
      mode: 'CC'
    }));

    const hash = generatePayUResponseHash({ ...ff, status: 'success' }, SALT);
    const payload = { ...ff, status: 'success', mihpayid: '4039937155290018', mode: 'CC', hash };

    // Webhook arrives first
    const webhookRes = await processPayUGatewayResponse(payload, 'webhook');
    // Browser redirect arrives second
    const callbackRes = await processPayUGatewayResponse(payload, 'callback');

    record(
      18,
      'Webhook arriving BEFORE browser redirect preserves SUCCESS & identical receipt cleanly',
      webhookRes.ok &&
        webhookRes.finalStatus === 'SUCCESS' &&
        callbackRes.ok &&
        callbackRes.finalStatus === 'SUCCESS' &&
        callbackRes.duplicate === true &&
        webhookRes.payment?.receiptNumber === callbackRes.payment?.receiptNumber
    );
  }

  // Reset test hooks
  setPayUVerifyFetcherForTests(null);

  // Print Summary
  let passed = 0;
  for (const r of results) {
    if (r.passed) {
      passed++;
      console.log(`  [PASS #${String(r.num).padStart(2, '0')}] ${r.name}`);
    } else {
      console.error(`  [FAIL #${String(r.num).padStart(2, '0')}] ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
    }
  }

  console.log(`\n================================================================`);
  console.log(`PAYU VERIFICATION RESULT: ${passed}/${results.length} PASSED`);
  console.log(`================================================================\n`);

  if (passed < results.length) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Fatal PayU verification suite error:', err);
  process.exit(1);
});
