import { verifyFirebaseBearerToken } from '../src/server/firebaseAuthVerify';
import { createRazorpayOrder, deriveGuestApplicantUid } from '../src/server/razorpayService';

/**
 * Vercel Serverless Function: POST /api/create-order
 *
 * Creates a server-authoritative Razorpay Order using official Razorpay Orders API.
 * - Supports verified Firebase ID tokens (Google Sign-In) AND direct applicant checkout
 *   using validated Full Name, Email Address, and Mobile Number.
 * - Looks up package price & GST strictly on the server (never trusts client amount).
 * - Returns order.id, amount (paise), currency ('INR'), public RAZORPAY_KEY_ID, and a
 *   server-signed checkoutToken for stateless verification.
 */
export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, error: 'method_not_allowed', message: 'Use POST.' }));
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      res.statusCode = 400;
      return res.end(JSON.stringify({ ok: false, error: 'invalid_json', message: 'Invalid JSON request body.' }));
    }
  }
  body = body || {};

  const authHeader = String(req.headers?.authorization || '').trim();
  let userId = '';
  let email = '';
  let applicantName = String(body.applicantName || '').trim();
  const phone = String(body.phone || '').trim();

  if (authHeader.toLowerCase().startsWith('bearer ')) {
    const caller = await verifyFirebaseBearerToken(authHeader);
    if (!caller.valid || !caller.uid || !caller.email) {
      res.statusCode = 401;
      return res.end(
        JSON.stringify({
          ok: false,
          error: 'unauthorized',
          message: caller.error || 'Invalid authentication token. Please retry or continue with your applicant details.'
        })
      );
    }
    userId = caller.uid;
    email = caller.email.toLowerCase();
    applicantName = applicantName || caller.name || 'Franchise Applicant';
  } else {
    // Direct applicant checkout without requiring Google Sign-In
    email = String(body.email || '').trim().toLowerCase();
    const phoneDigits = phone.replace(/\D/g, '');
    if (applicantName.length < 2 || applicantName.length > 120) {
      res.statusCode = 400;
      return res.end(
        JSON.stringify({
          ok: false,
          error: 'invalid_customer_name',
          message: 'Please enter your full name (2–120 characters) before launching Razorpay Checkout.'
        })
      );
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.statusCode = 400;
      return res.end(
        JSON.stringify({
          ok: false,
          error: 'invalid_customer_email',
          message: 'Please enter a valid email address for your Razorpay payment receipt.'
        })
      );
    }
    if (phoneDigits.length < 7 || phoneDigits.length > 15) {
      res.statusCode = 400;
      return res.end(
        JSON.stringify({
          ok: false,
          error: 'invalid_customer_phone',
          message: 'Please enter a valid mobile number (7–15 digits) before launching Razorpay Checkout.'
        })
      );
    }
    userId = deriveGuestApplicantUid(email);
  }

  const clientIp =
    (req.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown';

  const result = await createRazorpayOrder({
    applicationId: String(body.applicationId || ''),
    planId: String(body.planId || ''),
    paymentPurpose: body.paymentPurpose === 'application_fee' ? 'application_fee' : 'franchise_deposit',
    userId,
    applicantName,
    email,
    phone,
    termsAccepted: body.termsAccepted !== false,
    forceNewOrder: Boolean(body.forceNewOrder),
    clientIp
  });

  res.statusCode = result.statusCode;
  return res.end(JSON.stringify(result));
}
