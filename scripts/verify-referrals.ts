import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  calculateReferralCommissionINR,
  getReferralCommissionSchedule,
  registerReferralPartner,
  lookupReferralPartnerStatus,
  finalizeVerifiedReferralAttribution,
  voidReferralForRefundedOrder,
  listAllReferralsForAdmin,
  updateReferralPayoutStatus,
  resetReferralStoreForTesting
} from '../src/server/referralService.js';
import {
  createRazorpayOrder,
  verifyRazorpayPayment,
  setRazorpayApiClientOverride,
  getRazorpayPersistenceAdapter,
  resetRazorpayRateLimits
} from '../src/server/razorpayService.js';

async function runReferralVerification() {
  console.log('--- Running TRUEDEAL GLOBAL Referral Program Verification Suite ---');
  resetReferralStoreForTesting();
  resetRazorpayRateLimits();
  getRazorpayPersistenceAdapter().clear?.();

  // 1. Verify exact 10% commission across all 8 authoritative franchise plans
  const schedule = getReferralCommissionSchedule();
  assert.equal(schedule.length, 8, 'Must have exactly 8 franchise plans in commission schedule');

  const expectedByPlan: Record<string, { priceINR: number; commissionINR: number }> = {
    plan_basic: { priceINR: 2500, commissionINR: 250 },
    plan_standard: { priceINR: 4999, commissionINR: 500 },
    plan_corporate: { priceINR: 14999, commissionINR: 1500 },
    plan_platinum: { priceINR: 49999, commissionINR: 5000 },
    plan_entrepreneur: { priceINR: 99999, commissionINR: 10000 },
    plan_retirement: { priceINR: 149999, commissionINR: 15000 },
    plan_enterprise: { priceINR: 499999, commissionINR: 50000 },
    plan_global: { priceINR: 999999, commissionINR: 100000 }
  };

  for (const row of schedule) {
    const exp = expectedByPlan[row.planId];
    assert.ok(exp, `Unexpected planId ${row.planId}`);
    assert.equal(row.priceINR, exp.priceINR, `Price mismatch for ${row.planId}`);
    assert.equal(row.commissionRatePercent, 10, `Rate must be 10% for ${row.planId}`);
    assert.equal(row.commissionAmountINR, exp.commissionINR, `10% payout mismatch for ${row.planId}`);
    assert.equal(calculateReferralCommissionINR(row.priceINR), exp.commissionINR);
  }
  console.log('✓ Test 1 passed: All 8 franchise plans compute exact 10% rounded commissions (₹250 to ₹1,00,000)');

  // 2. Register referral partner & verify code + share URL + idempotent reuse
  const reg1 = registerReferralPartner({
    name: 'Rahul Sharma',
    phone: '+91 98765-43210',
    email: 'rahul.partner@example.com',
    upiOrBankDetails: 'rahulsharma@okicici',
    clientIp: '127.0.0.1'
  });
  assert.equal(reg1.ok, true);
  assert.equal(reg1.statusCode, 201);
  assert.ok(reg1.referralCode?.startsWith('TD-RAHUL'), `Expected TD-RAHUL* code, got ${reg1.referralCode}`);
  assert.equal(
    reg1.shareUrl,
    `https://businessfranchise.truedealglobal.com/?ref=${encodeURIComponent(reg1.referralCode!)}`
  );

  const reg2 = registerReferralPartner({
    name: 'Rahul Sharma',
    phone: '9876543210',
    email: 'rahul.partner@example.com',
    upiOrBankDetails: 'rahul.updated@okhdfcbank',
    clientIp: '127.0.0.1'
  });
  assert.equal(reg2.ok, true);
  assert.equal(reg2.reused, true);
  assert.equal(reg2.referralCode, reg1.referralCode, 'Existing partner must reuse their unique referral code');
  assert.equal(reg2.partner?.upiOrBankDetails, 'rahul.updated@okhdfcbank');
  console.log(`✓ Test 2 passed: Referral partner registered (${reg1.referralCode}) & idempotent update verified`);

  // 3. End-to-end Razorpay order creation & HMAC-verified capture with referralCode attribution
  process.env.RAZORPAY_MODE = 'test';
  process.env.RAZORPAY_KEY_ID = 'rzp_test_referralcheck';
  process.env.RAZORPAY_KEY_SECRET = 'rzp_secret_referralcheck_123456';
  process.env.RAZORPAY_GST_MODE = 'not_applicable';

  setRazorpayApiClientOverride({
    async createOrder(params) {
      assert.equal(params.notes?.referralCode, reg1.referralCode, 'Razorpay order notes must include referralCode');
      return {
        id: 'order_RefGlobal001',
        amount: params.amount,
        currency: params.currency,
        receipt: params.receipt,
        status: 'created'
      };
    },
    async fetchPayment(paymentId: string) {
      return {
        id: paymentId,
        order_id: 'order_RefGlobal001',
        amount: 99999900,
        currency: 'INR',
        status: 'captured',
        captured: true,
        method: 'upi',
        vpa: 'applicant@upi',
        created_at: Math.floor(Date.now() / 1000)
      };
    },
    async fetchOrderPayments() {
      return { items: [] };
    },
    async createRefund(paymentId: string) {
      return {
        id: `rfnd_${paymentId}`,
        payment_id: paymentId,
        amount: 99999900,
        currency: 'INR',
        status: 'processed'
      };
    }
  });

  try {
    const orderRes = await createRazorpayOrder({
      applicationId: 'TDG-2026-REF001',
      userId: 'guest_test_applicant_001',
      planId: 'plan_global',
      paymentPurpose: 'franchise_deposit',
      applicantName: 'Vikram Patel',
      email: 'vikram.applicant@example.com',
      phone: '9811122233',
      referralCode: reg1.referralCode,
      termsAccepted: true,
      clientIp: '127.0.0.1'
    });
    assert.equal(orderRes.ok, true);
    assert.equal(orderRes.order?.notes.referralCode, reg1.referralCode);
    assert.ok(orderRes.checkoutToken);

    // Confirm pending signup shows in lookup BEFORE capture (with ₹0 earned)
    const beforeCaptureLookup = lookupReferralPartnerStatus(reg1.referralCode!, '127.0.0.1');
    assert.equal(beforeCaptureLookup.ok, true);
    assert.equal(beforeCaptureLookup.summary?.pendingSignups, 1);
    assert.equal(beforeCaptureLookup.summary?.verifiedSignups, 0);
    assert.equal(beforeCaptureLookup.summary?.totalCommissionEarnedINR, 0);

    // Verify captured payment via valid HMAC-SHA256 signature
    const sig = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update('order_RefGlobal001|pay_RefGlobal001')
      .digest('hex');

    const verifyRes = await verifyRazorpayPayment({
      callerUid: 'guest_test_applicant_001',
      razorpay_order_id: 'order_RefGlobal001',
      razorpay_payment_id: 'pay_RefGlobal001',
      razorpay_signature: sig,
      applicationId: 'TDG-2026-REF001',
      checkoutToken: orderRes.checkoutToken
    });
    assert.equal(verifyRes.ok, true);
    assert.equal(verifyRes.verified, true);
    assert.equal(verifyRes.captured, true);
    assert.equal(verifyRes.referralAttribution?.commissionAmountINR, 100000);
    assert.equal(verifyRes.referralAttribution?.payoutStatus, 'Pending');
    assert.equal(verifyRes.referralAttribution?.selfReferralBlocked, false);

    // Lookup by 10-digit mobile number must now reflect ₹1,00,000 verified commission
    const afterCaptureByMobile = lookupReferralPartnerStatus('9876543210', '127.0.0.1');
    assert.equal(afterCaptureByMobile.ok, true);
    assert.equal(afterCaptureByMobile.summary?.verifiedSignups, 1);
    assert.equal(afterCaptureByMobile.summary?.totalCommissionEarnedINR, 100000);
    assert.equal(afterCaptureByMobile.summary?.pendingCommissionINR, 100000);
    console.log('✓ Test 3 passed: Verified Razorpay capture credits ₹1,00,000 for Global Plan & updates lookup by code/mobile');

    // 4. Self-referral prevention (same email OR same 10-digit mobile)
    const selfByEmail = await finalizeVerifiedReferralAttribution({
      referralCode: reg1.referralCode,
      applicationId: 'TDG-2026-SELF1',
      applicantName: 'Rahul Self',
      applicantEmail: 'RAHUL.PARTNER@example.com',
      applicantPhone: '9000011111',
      planId: 'plan_standard',
      planTitle: 'Standard Plan',
      baseAmountINR: 4999,
      orderAmountINR: 4999,
      razorpayOrderId: 'order_SelfEmail01',
      razorpayPaymentId: 'pay_SelfEmail01'
    });
    assert.equal(selfByEmail?.selfReferralBlocked, true);
    assert.equal(selfByEmail?.commissionAmountINR, 0);
    assert.equal(selfByEmail?.payoutStatus, 'Rejected');

    const selfByPhone = await finalizeVerifiedReferralAttribution({
      referralCode: reg1.referralCode,
      applicationId: 'TDG-2026-SELF2',
      applicantName: 'Rahul Alt Email',
      applicantEmail: 'other.email@example.com',
      applicantPhone: '+91 9876543210',
      planId: 'plan_corporate',
      planTitle: 'Corporate Plan',
      baseAmountINR: 14999,
      orderAmountINR: 14999,
      razorpayOrderId: 'order_SelfPhone01',
      razorpayPaymentId: 'pay_SelfPhone01'
    });
    assert.equal(selfByPhone?.selfReferralBlocked, true);
    assert.equal(selfByPhone?.commissionAmountINR, 0);
    assert.equal(selfByPhone?.payoutStatus, 'Rejected');
    console.log('✓ Test 4 passed: Self-referrals blocked cleanly by matching email or 10-digit mobile');

    // 5. Refunded order exclusion
    const refundedOrderRef = await finalizeVerifiedReferralAttribution({
      referralCode: reg1.referralCode,
      applicationId: 'TDG-2026-REFUND1',
      applicantName: 'Neha Verma',
      applicantEmail: 'neha.verma@example.com',
      applicantPhone: '9822233344',
      planId: 'plan_platinum',
      planTitle: 'Platinum Plan',
      baseAmountINR: 49999,
      orderAmountINR: 49999,
      razorpayOrderId: 'order_RefundRef01',
      razorpayPaymentId: 'pay_RefundRef01'
    });
    assert.equal(refundedOrderRef?.commissionAmountINR, 5000);
    const voided = voidReferralForRefundedOrder('order_RefundRef01', 'Razorpay refund processed');
    assert.equal(voided?.paymentStatus, 'REFUNDED');
    assert.equal(voided?.payoutStatus, 'Rejected');
    assert.equal(voided?.commissionAmountINR, 0);
    console.log('✓ Test 5 passed: Refunded order automatically voids referral commission');

    // 6. Admin payout lifecycle: Approve -> Mark as Paid with UTR, and block ineligible records
    const validId = verifyRes.referralAttribution!.referralId;
    const approveRes = updateReferralPayoutStatus({
      referralId: validId,
      payoutStatus: 'Approved',
      actorEmail: 'director@truedealglobal.com'
    });
    assert.equal(approveRes.ok, true);
    assert.equal(approveRes.referral?.payoutStatus, 'Approved');

    const paidRes = updateReferralPayoutStatus({
      referralId: validId,
      payoutStatus: 'Paid',
      payoutUtr: 'UTR20261123000999',
      actorEmail: 'director@truedealglobal.com'
    });
    assert.equal(paidRes.ok, true);
    assert.equal(paidRes.referral?.payoutStatus, 'Paid');
    assert.equal(paidRes.referral?.payoutUtr, 'UTR20261123000999');

    const blockedPayAttempt = updateReferralPayoutStatus({
      referralId: selfByEmail!.referralId,
      payoutStatus: 'Paid',
      actorEmail: 'director@truedealglobal.com'
    });
    assert.equal(blockedPayAttempt.ok, false, 'Admin must not be able to pay a blocked self-referral');

    const adminLedger = listAllReferralsForAdmin();
    assert.equal(adminLedger.stats.verifiedReferrals, 1);
    assert.equal(adminLedger.stats.blockedSelfReferrals, 2);
    assert.equal(adminLedger.stats.paidPayoutsINR, 100000);
    assert.equal(adminLedger.stats.pendingPayoutsINR, 0);
    console.log('✓ Test 6 passed: Admin Approve -> Mark as Paid (UTR) & ledger stats verified');
  } finally {
    setRazorpayApiClientOverride(null);
  }

  console.log('\n✅ ALL 6 FRANCHISE REFERRAL PROGRAM VERIFICATION CHECKS PASSED!\n');
}

runReferralVerification().catch((err) => {
  console.error('❌ Referral verification failed:', err);
  process.exit(1);
});
