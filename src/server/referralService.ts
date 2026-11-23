import crypto from 'crypto';
import { getAuthoritativePlan, AUTHORITATIVE_FRANCHISE_PLANS } from './plansCatalog.js';
import { sendTransactionalFranchiseEmail } from './emailService.js';

/**
 * TRUEDEAL GLOBAL OPC PVT LTD — Server-Side Franchise Referral Program Engine
 *
 * Security & Business Invariants:
 * 1. Referral commission is strictly 10% of the authoritative base franchise fee,
 *    rounded to the nearest whole rupee via Math.round(priceINR * 0.10):
 *      - ₹2,500 Basic Plan       -> ₹250
 *      - ₹4,999 Standard Plan    -> ₹500
 *      - ₹14,999 Corporate Plan  -> ₹1,500
 *      - ₹49,999 Platinum Plan   -> ₹5,000
 *      - ₹99,999 Entrepreneur    -> ₹10,000
 *      - ₹1,49,999 Legacy Plan   -> ₹15,000
 *      - ₹4,99,999 Enterprise    -> ₹50,000
 *      - ₹9,99,999 Global Plan   -> ₹1,00,000
 * 2. Commissions are credited ONLY after cryptographically verified Razorpay CAPTURED payment.
 * 3. Self-referrals are strictly blocked when applicant email OR 10-digit mobile matches referrer.
 * 4. Refunded or cancelled orders are automatically excluded / marked Rejected.
 * 5. Zero firebase-admin dependency for clean Vercel Node.js ESM serverless execution.
 */

export const REFERRAL_COMMISSION_RATE_PERCENT = 10;
export const REFERRAL_PORTAL_BASE_URL = 'https://businessfranchise.truedealglobal.com';
export const REFERRAL_ADMIN_EMAIL = 'info@truedealglobal.com';

export type ServerReferralPayoutStatus = 'Pending' | 'Approved' | 'Paid' | 'Rejected';

export interface ServerReferralPartner {
  referralCode: string;
  name: string;
  phone: string; // normalized 10-digit Indian mobile or international digits
  email: string;
  upiOrBankDetails: string;
  userId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServerReferralAttribution {
  referralId: string;
  referralCode: string;
  referrerName: string;
  referrerEmail: string;
  referrerPhone: string;
  referrerUpiOrBank: string;
  applicationId: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string;
  planId: string;
  planTitle: string;
  orderAmountINR: number;
  baseAmountINR: number;
  commissionRatePercent: number;
  commissionAmountINR: number;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  paymentStatus: 'PENDING' | 'CAPTURED' | 'REFUNDED' | 'FAILED';
  payoutStatus: ServerReferralPayoutStatus;
  payoutUtr?: string;
  paidAt?: string;
  approvedAt?: string;
  updatedBy?: string;
  selfReferralBlocked: boolean;
  blockReason?: string;
  referrerEmailSent?: boolean;
  adminEmailSent?: boolean;
  createdAt: string;
  updatedAt: string;
}

// In-memory store (paired with client Firestore persistence & stateless token hydration)
const partnersByCode = new Map<string, ServerReferralPartner>();
const partnerCodeByEmail = new Map<string, string>();
const partnerCodeByPhone10 = new Map<string, string>();
const referralsByOrderId = new Map<string, ServerReferralAttribution>();
const referralsById = new Map<string, ServerReferralAttribution>();

// Sliding-window rate limiters for public endpoints
const registerRateLimitMap = new Map<string, { count: number; resetAt: number }>();
const lookupRateLimitMap = new Map<string, { count: number; resetAt: number }>();

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
  if (entry.count >= maxRequests) return false;
  entry.count += 1;
  return true;
}

export function resetReferralStoreForTesting(): void {
  partnersByCode.clear();
  partnerCodeByEmail.clear();
  partnerCodeByPhone10.clear();
  referralsByOrderId.clear();
  referralsById.clear();
  registerRateLimitMap.clear();
  lookupRateLimitMap.clear();
}

/**
 * Authoritative 10% referral commission calculation rounded to nearest whole rupee.
 */
export function calculateReferralCommissionINR(basePriceINR: number): number {
  if (!Number.isFinite(basePriceINR) || basePriceINR <= 0) return 0;
  return Math.round(basePriceINR * (REFERRAL_COMMISSION_RATE_PERCENT / 100));
}

export function getReferralCommissionSchedule() {
  return Object.values(AUTHORITATIVE_FRANCHISE_PLANS).map((plan) => ({
    planId: plan.id,
    title: plan.title,
    priceINR: plan.priceINR,
    commissionRatePercent: REFERRAL_COMMISSION_RATE_PERCENT,
    commissionAmountINR: calculateReferralCommissionINR(plan.priceINR)
  }));
}

export function normalizeReferralCode(raw?: string | null): string {
  const cleaned = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '');
  if (cleaned.length < 4 || cleaned.length > 32) return '';
  return cleaned;
}

export function normalizeMobileLast10(raw?: string | null): string {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length < 10) return digits;
  return digits.slice(-10);
}

export function buildReferralShareUrl(referralCode: string): string {
  return `${REFERRAL_PORTAL_BASE_URL}/?ref=${encodeURIComponent(referralCode)}`;
}

export function generateUniqueReferralCode(name: string, phone: string): string {
  const nameAlpha = String(name || 'PARTNER')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 6);
  const prefix = nameAlpha.length >= 2 ? nameAlpha : 'PARTNER';
  const last4 = normalizeMobileLast10(phone).slice(-4) || String(Math.floor(1000 + Math.random() * 9000));
  const candidate = `TD-${prefix}${last4}`.slice(0, 24);
  if (!partnersByCode.has(candidate)) {
    return candidate;
  }
  const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `TD-${prefix.slice(0, 4)}${suffix}`.slice(0, 24);
}

export function isSelfReferralMatch(
  partner: Pick<ServerReferralPartner, 'email' | 'phone'> | null | undefined,
  applicantEmail: string,
  applicantPhone: string
): { blocked: boolean; reason?: string } {
  if (!partner) return { blocked: false };

  const normRefEmail = String(partner.email || '').trim().toLowerCase();
  const normAppEmail = String(applicantEmail || '').trim().toLowerCase();
  if (normRefEmail && normAppEmail && normRefEmail === normAppEmail) {
    return {
      blocked: true,
      reason: 'Self-referral detected: applicant email matches referrer email.'
    };
  }

  const normRefPhone = normalizeMobileLast10(partner.phone);
  const normAppPhone = normalizeMobileLast10(applicantPhone);
  if (normRefPhone.length >= 10 && normAppPhone.length >= 10 && normRefPhone === normAppPhone) {
    return {
      blocked: true,
      reason: 'Self-referral detected: applicant mobile number matches referrer mobile number.'
    };
  }

  return { blocked: false };
}

function maskPayoutHandle(value: string): string {
  const trimmed = String(value || '').trim();
  if (!trimmed) return 'Not provided';
  if (trimmed.includes('@')) {
    const [user, bank] = trimmed.split('@');
    const visible = user.length > 3 ? `${user.slice(0, 2)}***${user.slice(-1)}` : `${user[0] || '*'}**`;
    return `${visible}@${bank}`;
  }
  if (trimmed.length <= 6) return '***' + trimmed.slice(-2);
  return `${trimmed.slice(0, 3)}••••${trimmed.slice(-4)}`;
}

function maskApplicantDisplayName(name: string): string {
  const parts = String(name || 'Applicant').trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].length > 2 ? `${parts[0].slice(0, 2)}***` : parts[0];
  }
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

// =========================================================================
// 1. Register / Retrieve Referral Partner & Generate Unique Code/Link
// =========================================================================
export interface RegisterReferralPartnerInput {
  name: string;
  phone: string;
  email: string;
  upiOrBankDetails: string;
  userId?: string;
  clientIp?: string;
}

export interface RegisterReferralPartnerResult {
  ok: boolean;
  statusCode: number;
  error?: string;
  message?: string;
  reused?: boolean;
  partner?: ServerReferralPartner;
  referralCode?: string;
  shareUrl?: string;
}

export function registerReferralPartner(
  input: RegisterReferralPartnerInput
): RegisterReferralPartnerResult {
  const rateKey = `reg:${input.clientIp || 'unknown'}`;
  if (!checkRateLimit(registerRateLimitMap, rateKey, 20, 10 * 60 * 1000)) {
    return {
      ok: false,
      statusCode: 429,
      error: 'rate_limited',
      message: 'Too many referral link requests. Please wait a few minutes and try again.'
    };
  }

  const name = String(input.name || '').trim();
  const email = String(input.email || '').trim().toLowerCase();
  const phoneDigits = String(input.phone || '').replace(/\D/g, '');
  const phone10 = normalizeMobileLast10(phoneDigits);
  const upiOrBankDetails = String(input.upiOrBankDetails || '').trim();

  if (name.length < 2 || name.length > 120) {
    return {
      ok: false,
      statusCode: 400,
      error: 'invalid_name',
      message: 'Please enter your full name (2–120 characters).'
    };
  }

  if (phone10.length !== 10 || !/^[6-9]\d{9}$/.test(phone10)) {
    return {
      ok: false,
      statusCode: 400,
      error: 'invalid_phone',
      message: 'Please enter a valid 10-digit Indian WhatsApp mobile number.'
    };
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) {
    return {
      ok: false,
      statusCode: 400,
      error: 'invalid_email',
      message: 'Please enter a valid email address for referral commission alerts.'
    };
  }

  if (upiOrBankDetails.length < 4 || upiOrBankDetails.length > 200) {
    return {
      ok: false,
      statusCode: 400,
      error: 'invalid_payout_details',
      message: 'Please enter a valid UPI ID (e.g., name@upi) or Bank Account + IFSC details.'
    };
  }

  const nowIso = new Date().toISOString();
  const existingCode = partnerCodeByEmail.get(email) || partnerCodeByPhone10.get(phone10);

  if (existingCode) {
    const existing = partnersByCode.get(existingCode);
    if (existing) {
      const updated: ServerReferralPartner = {
        ...existing,
        name,
        phone: phone10,
        email,
        upiOrBankDetails,
        userId: input.userId || existing.userId,
        updatedAt: nowIso
      };
      partnersByCode.set(existingCode, updated);
      partnerCodeByEmail.set(email, existingCode);
      partnerCodeByPhone10.set(phone10, existingCode);
      return {
        ok: true,
        statusCode: 200,
        reused: true,
        partner: structuredClone(updated),
        referralCode: updated.referralCode,
        shareUrl: buildReferralShareUrl(updated.referralCode),
        message: 'Retrieved your existing TRUEDEAL GLOBAL referral code and updated payout details.'
      };
    }
  }

  const referralCode = generateUniqueReferralCode(name, phone10);
  const partner: ServerReferralPartner = {
    referralCode,
    name,
    phone: phone10,
    email,
    upiOrBankDetails,
    userId: input.userId ? String(input.userId).slice(0, 128) : undefined,
    createdAt: nowIso,
    updatedAt: nowIso
  };

  partnersByCode.set(referralCode, partner);
  partnerCodeByEmail.set(email, referralCode);
  partnerCodeByPhone10.set(phone10, referralCode);

  return {
    ok: true,
    statusCode: 201,
    reused: false,
    partner: structuredClone(partner),
    referralCode,
    shareUrl: buildReferralShareUrl(referralCode),
    message: 'Your unique TRUEDEAL GLOBAL referral link is ready to share.'
  };
}

export function getReferralPartnerByCode(code?: string | null): ServerReferralPartner | null {
  const normalized = normalizeReferralCode(code);
  if (!normalized) return null;
  const partner = partnersByCode.get(normalized);
  return partner ? structuredClone(partner) : null;
}

// =========================================================================
// 2. Public Referral Partner Status Lookup (By Referral Code OR Mobile)
// =========================================================================
export interface ReferralPartnerStatusResponse {
  ok: boolean;
  statusCode: number;
  error?: string;
  message?: string;
  partner?: {
    referralCode: string;
    name: string;
    shareUrl: string;
    payoutHandleMasked: string;
    createdAt: string;
  };
  summary?: {
    totalReferrals: number;
    pendingSignups: number;
    verifiedSignups: number;
    blockedSelfReferrals: number;
    totalCommissionEarnedINR: number;
    pendingCommissionINR: number;
    approvedCommissionINR: number;
    paidCommissionINR: number;
  };
  referrals?: Array<{
    referralId: string;
    applicantDisplayName: string;
    planTitle: string;
    orderAmountINR: number;
    commissionAmountINR: number;
    paymentStatus: ServerReferralAttribution['paymentStatus'];
    payoutStatus: ServerReferralPayoutStatus;
    payoutUtr?: string;
    selfReferralBlocked: boolean;
    createdAt: string;
  }>;
}

export function lookupReferralPartnerStatus(
  rawQuery: string,
  clientIp?: string
): ReferralPartnerStatusResponse {
  const rateKey = `lookup:${clientIp || 'unknown'}`;
  if (!checkRateLimit(lookupRateLimitMap, rateKey, 40, 10 * 60 * 1000)) {
    return {
      ok: false,
      statusCode: 429,
      error: 'rate_limited',
      message: 'Too many status lookup requests. Please wait a minute and try again.'
    };
  }

  const trimmed = String(rawQuery || '').trim();
  if (!trimmed || trimmed.length < 4 || trimmed.length > 64) {
    return {
      ok: false,
      statusCode: 400,
      error: 'invalid_query',
      message: 'Enter your Referral Code (e.g., TD-RAHUL1234) or 10-digit registered Mobile Number.'
    };
  }

  const normCode = normalizeReferralCode(trimmed);
  const digits = normalizeMobileLast10(trimmed);

  let partner: ServerReferralPartner | undefined;
  if (normCode && partnersByCode.has(normCode)) {
    partner = partnersByCode.get(normCode);
  } else if (digits.length === 10 && partnerCodeByPhone10.has(digits)) {
    const code = partnerCodeByPhone10.get(digits)!;
    partner = partnersByCode.get(code);
  }

  const matchingCode = partner?.referralCode || (normCode.startsWith('TD-') ? normCode : '');
  const matchedRecords = matchingCode
    ? Array.from(referralsById.values())
        .filter((r) => r.referralCode === matchingCode)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : [];

  if (!partner && matchedRecords.length === 0) {
    return {
      ok: false,
      statusCode: 404,
      error: 'partner_not_found',
      message: 'No referral partner or tracked referrals found for that Code or Mobile Number.'
    };
  }

  const verifiedValid = matchedRecords.filter(
    (r) => r.paymentStatus === 'CAPTURED' && !r.selfReferralBlocked && r.payoutStatus !== 'Rejected'
  );
  const pendingSignups = matchedRecords.filter((r) => r.paymentStatus === 'PENDING').length;
  const blockedSelfReferrals = matchedRecords.filter((r) => r.selfReferralBlocked).length;

  const totalCommissionEarnedINR = verifiedValid.reduce((sum, r) => sum + r.commissionAmountINR, 0);
  const pendingCommissionINR = verifiedValid
    .filter((r) => r.payoutStatus === 'Pending')
    .reduce((sum, r) => sum + r.commissionAmountINR, 0);
  const approvedCommissionINR = verifiedValid
    .filter((r) => r.payoutStatus === 'Approved')
    .reduce((sum, r) => sum + r.commissionAmountINR, 0);
  const paidCommissionINR = verifiedValid
    .filter((r) => r.payoutStatus === 'Paid')
    .reduce((sum, r) => sum + r.commissionAmountINR, 0);

  const effectiveCode = partner?.referralCode || matchingCode;

  return {
    ok: true,
    statusCode: 200,
    partner: {
      referralCode: effectiveCode,
      name: partner?.name || matchedRecords[0]?.referrerName || 'Registered Referral Partner',
      shareUrl: buildReferralShareUrl(effectiveCode),
      payoutHandleMasked: maskPayoutHandle(partner?.upiOrBankDetails || matchedRecords[0]?.referrerUpiOrBank || ''),
      createdAt: partner?.createdAt || matchedRecords[0]?.createdAt || new Date().toISOString()
    },
    summary: {
      totalReferrals: matchedRecords.length,
      pendingSignups,
      verifiedSignups: verifiedValid.length,
      blockedSelfReferrals,
      totalCommissionEarnedINR,
      pendingCommissionINR,
      approvedCommissionINR,
      paidCommissionINR
    },
    referrals: matchedRecords.map((r) => ({
      referralId: r.referralId,
      applicantDisplayName: maskApplicantDisplayName(r.applicantName),
      planTitle: r.planTitle,
      orderAmountINR: r.orderAmountINR,
      commissionAmountINR: r.selfReferralBlocked || r.paymentStatus !== 'CAPTURED' ? 0 : r.commissionAmountINR,
      paymentStatus: r.paymentStatus,
      payoutStatus: r.payoutStatus,
      payoutUtr: r.payoutUtr,
      selfReferralBlocked: r.selfReferralBlocked,
      createdAt: r.createdAt
    }))
  };
}

// =========================================================================
// 3. Razorpay Order Creation & Verified Payment Attribution
// =========================================================================
export function recordPendingReferralForOrder(params: {
  referralCode?: string | null;
  applicationId: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string;
  planId: string;
  planTitle: string;
  baseAmountINR: number;
  orderAmountINR: number;
  razorpayOrderId: string;
}): ServerReferralAttribution | null {
  const code = normalizeReferralCode(params.referralCode);
  if (!code) return null;

  const existing = referralsByOrderId.get(params.razorpayOrderId);
  if (existing) return structuredClone(existing);

  const partner = partnersByCode.get(code) || null;
  const selfCheck = isSelfReferralMatch(partner, params.applicantEmail, params.applicantPhone);
  const authPlan = getAuthoritativePlan(params.planId);
  const authoritativeBase = authPlan?.priceINR ?? params.baseAmountINR;
  const commissionAmountINR = selfCheck.blocked ? 0 : calculateReferralCommissionINR(authoritativeBase);
  const nowIso = new Date().toISOString();
  const referralId = `ref_${params.razorpayOrderId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const record: ServerReferralAttribution = {
    referralId,
    referralCode: code,
    referrerName: partner?.name || `Partner (${code})`,
    referrerEmail: partner?.email || '',
    referrerPhone: partner?.phone || '',
    referrerUpiOrBank: partner?.upiOrBankDetails || '',
    applicationId: params.applicationId,
    applicantName: params.applicantName,
    applicantEmail: params.applicantEmail.toLowerCase(),
    applicantPhone: params.applicantPhone,
    planId: params.planId,
    planTitle: authPlan?.title || params.planTitle,
    orderAmountINR: params.orderAmountINR,
    baseAmountINR: authoritativeBase,
    commissionRatePercent: REFERRAL_COMMISSION_RATE_PERCENT,
    commissionAmountINR,
    razorpayOrderId: params.razorpayOrderId,
    paymentStatus: 'PENDING',
    payoutStatus: selfCheck.blocked ? 'Rejected' : 'Pending',
    selfReferralBlocked: selfCheck.blocked,
    blockReason: selfCheck.reason,
    createdAt: nowIso,
    updatedAt: nowIso
  };

  referralsByOrderId.set(params.razorpayOrderId, record);
  referralsById.set(referralId, record);
  return structuredClone(record);
}

export async function finalizeVerifiedReferralAttribution(params: {
  referralCode?: string | null;
  applicationId: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string;
  planId: string;
  planTitle: string;
  baseAmountINR: number;
  orderAmountINR: number;
  razorpayOrderId: string;
  razorpayPaymentId: string;
}): Promise<ServerReferralAttribution | null> {
  const existing = referralsByOrderId.get(params.razorpayOrderId);
  const code = normalizeReferralCode(params.referralCode || existing?.referralCode);
  if (!code) return null;

  const partner = partnersByCode.get(code) || null;
  const selfCheck = isSelfReferralMatch(
    partner || (existing?.referrerEmail || existing?.referrerPhone
      ? { email: existing.referrerEmail, phone: existing.referrerPhone }
      : null),
    params.applicantEmail,
    params.applicantPhone
  );

  const authPlan = getAuthoritativePlan(params.planId);
  const authoritativeBase = authPlan?.priceINR ?? params.baseAmountINR;
  const commissionAmountINR = selfCheck.blocked ? 0 : calculateReferralCommissionINR(authoritativeBase);
  const nowIso = new Date().toISOString();
  const referralId = existing?.referralId || `ref_${params.razorpayOrderId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const record: ServerReferralAttribution = existing
    ? {
        ...existing,
        referrerName: partner?.name || existing.referrerName || `Partner (${code})`,
        referrerEmail: partner?.email || existing.referrerEmail,
        referrerPhone: partner?.phone || existing.referrerPhone,
        referrerUpiOrBank: partner?.upiOrBankDetails || existing.referrerUpiOrBank,
        razorpayPaymentId: params.razorpayPaymentId,
        orderAmountINR: params.orderAmountINR,
        baseAmountINR: authoritativeBase,
        commissionAmountINR,
        paymentStatus: 'CAPTURED',
        payoutStatus: selfCheck.blocked
          ? 'Rejected'
          : existing.payoutStatus === 'Paid' || existing.payoutStatus === 'Approved'
          ? existing.payoutStatus
          : 'Pending',
        selfReferralBlocked: selfCheck.blocked,
        blockReason: selfCheck.reason,
        updatedAt: nowIso
      }
    : {
        referralId,
        referralCode: code,
        referrerName: partner?.name || `Partner (${code})`,
        referrerEmail: partner?.email || '',
        referrerPhone: partner?.phone || '',
        referrerUpiOrBank: partner?.upiOrBankDetails || '',
        applicationId: params.applicationId,
        applicantName: params.applicantName,
        applicantEmail: params.applicantEmail.toLowerCase(),
        applicantPhone: params.applicantPhone,
        planId: params.planId,
        planTitle: authPlan?.title || params.planTitle,
        orderAmountINR: params.orderAmountINR,
        baseAmountINR: authoritativeBase,
        commissionRatePercent: REFERRAL_COMMISSION_RATE_PERCENT,
        commissionAmountINR,
        razorpayOrderId: params.razorpayOrderId,
        razorpayPaymentId: params.razorpayPaymentId,
        paymentStatus: 'CAPTURED',
        payoutStatus: selfCheck.blocked ? 'Rejected' : 'Pending',
        selfReferralBlocked: selfCheck.blocked,
        blockReason: selfCheck.reason,
        createdAt: nowIso,
        updatedAt: nowIso
      };

  // Send SendGrid email notifications ONLY for valid non-self-referral captured payments (deduplicated)
  if (!record.selfReferralBlocked && record.commissionAmountINR > 0) {
    if (!record.referrerEmailSent && record.referrerEmail) {
      const refMail = await sendTransactionalFranchiseEmail({
        event: 'referral_commission_referrer',
        toEmail: record.referrerEmail,
        applicantName: record.applicantName,
        applicationId: record.applicationId,
        planName: record.planTitle,
        amountINR: record.orderAmountINR,
        txnId: record.razorpayOrderId,
        payuTransactionId: record.razorpayPaymentId,
        referralCode: record.referralCode,
        referrerName: record.referrerName,
        referrerPhone: record.referrerPhone,
        referrerEmail: record.referrerEmail,
        referrerUpiOrBank: record.referrerUpiOrBank,
        commissionAmountINR: record.commissionAmountINR,
        commissionRatePercent: REFERRAL_COMMISSION_RATE_PERCENT
      });
      record.referrerEmailSent = refMail.sent;
    }

    if (!record.adminEmailSent) {
      const adminTarget = (process.env.SENDGRID_TO_EMAIL || REFERRAL_ADMIN_EMAIL).trim() || REFERRAL_ADMIN_EMAIL;
      const adminMail = await sendTransactionalFranchiseEmail({
        event: 'referral_commission_admin',
        toEmail: adminTarget,
        applicantName: record.applicantName,
        applicationId: record.applicationId,
        planName: record.planTitle,
        amountINR: record.orderAmountINR,
        txnId: record.razorpayOrderId,
        payuTransactionId: record.razorpayPaymentId,
        referralCode: record.referralCode,
        referrerName: record.referrerName,
        referrerPhone: record.referrerPhone,
        referrerEmail: record.referrerEmail,
        referrerUpiOrBank: record.referrerUpiOrBank,
        commissionAmountINR: record.commissionAmountINR,
        commissionRatePercent: REFERRAL_COMMISSION_RATE_PERCENT
      });
      record.adminEmailSent = adminMail.sent;
    }
  }

  referralsByOrderId.set(params.razorpayOrderId, record);
  referralsById.set(record.referralId, record);
  return structuredClone(record);
}

/**
 * Excludes cancelled / refunded Razorpay orders from referral commission payouts.
 */
export function voidReferralForRefundedOrder(razorpayOrderId: string, reason = 'Order refunded or cancelled'): ServerReferralAttribution | null {
  const existing = referralsByOrderId.get(razorpayOrderId);
  if (!existing) return null;
  const nowIso = new Date().toISOString();
  existing.paymentStatus = 'REFUNDED';
  existing.payoutStatus = 'Rejected';
  existing.commissionAmountINR = 0;
  existing.blockReason = reason;
  existing.updatedAt = nowIso;
  referralsByOrderId.set(razorpayOrderId, existing);
  referralsById.set(existing.referralId, existing);
  return structuredClone(existing);
}

// =========================================================================
// 4. Admin Referral Payout Tracker APIs
// =========================================================================
export function listAllReferralsForAdmin(): {
  partners: ServerReferralPartner[];
  referrals: ServerReferralAttribution[];
  stats: {
    totalPartners: number;
    totalReferrals: number;
    verifiedReferrals: number;
    blockedSelfReferrals: number;
    totalCommissionEarnedINR: number;
    pendingPayoutsINR: number;
    approvedPayoutsINR: number;
    paidPayoutsINR: number;
  };
} {
  const partners = Array.from(partnersByCode.values())
    .map((p) => structuredClone(p))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const referrals = Array.from(referralsById.values())
    .map((r) => structuredClone(r))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const validVerified = referrals.filter(
    (r) => r.paymentStatus === 'CAPTURED' && !r.selfReferralBlocked && r.payoutStatus !== 'Rejected'
  );

  return {
    partners,
    referrals,
    stats: {
      totalPartners: partners.length,
      totalReferrals: referrals.length,
      verifiedReferrals: validVerified.length,
      blockedSelfReferrals: referrals.filter((r) => r.selfReferralBlocked).length,
      totalCommissionEarnedINR: validVerified.reduce((s, r) => s + r.commissionAmountINR, 0),
      pendingPayoutsINR: validVerified
        .filter((r) => r.payoutStatus === 'Pending')
        .reduce((s, r) => s + r.commissionAmountINR, 0),
      approvedPayoutsINR: validVerified
        .filter((r) => r.payoutStatus === 'Approved')
        .reduce((s, r) => s + r.commissionAmountINR, 0),
      paidPayoutsINR: validVerified
        .filter((r) => r.payoutStatus === 'Paid')
        .reduce((s, r) => s + r.commissionAmountINR, 0)
    }
  };
}

export function updateReferralPayoutStatus(params: {
  referralId: string;
  payoutStatus: ServerReferralPayoutStatus;
  payoutUtr?: string;
  actorEmail: string;
}): {
  ok: boolean;
  statusCode: number;
  error?: string;
  message: string;
  referral?: ServerReferralAttribution;
} {
  const id = String(params.referralId || '').trim();
  const target = referralsById.get(id);
  if (!target) {
    return { ok: false, statusCode: 404, error: 'not_found', message: 'Referral record not found.' };
  }

  if (target.selfReferralBlocked || target.paymentStatus === 'REFUNDED') {
    return {
      ok: false,
      statusCode: 400,
      error: 'ineligible_referral',
      message: 'Self-referrals and refunded orders are excluded from payouts and cannot be marked Paid.'
    };
  }

  if (params.payoutStatus === 'Paid' && target.paymentStatus !== 'CAPTURED') {
    return {
      ok: false,
      statusCode: 400,
      error: 'payment_not_captured',
      message: 'Referral commissions can only be marked Paid after verified Razorpay payment capture.'
    };
  }

  const nowIso = new Date().toISOString();
  target.payoutStatus = params.payoutStatus;
  target.updatedAt = nowIso;
  target.updatedBy = params.actorEmail;

  const cleanUtr = String(params.payoutUtr || '').trim().slice(0, 64);
  if (cleanUtr) {
    target.payoutUtr = cleanUtr;
  }
  if (params.payoutStatus === 'Approved') {
    target.approvedAt = nowIso;
  }
  if (params.payoutStatus === 'Paid') {
    target.paidAt = nowIso;
  }

  referralsById.set(target.referralId, target);
  referralsByOrderId.set(target.razorpayOrderId, target);

  return {
    ok: true,
    statusCode: 200,
    message: `Referral payout ${target.referralId} updated to ${params.payoutStatus}.`,
    referral: structuredClone(target)
  };
}
