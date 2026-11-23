import { verifyFirebaseBearerToken } from '../src/server/firebaseAuthVerify';
import { createRazorpayOrder } from '../src/server/razorpayService';

/**
 * Vercel Serverless Function: POST /api/create-order
 *
 * Creates a server-authoritative Razorpay Order using official Razorpay Orders API.
 * - Requires verified Firebase ID token.
 * - Looks up package price & GST strictly on the server (never trusts client amount).
 * - Returns order.id, amount (paise), currency ('INR'), and public RAZORPAY_KEY_ID only.
 */
export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, error: 'method_not_allowed', message: 'Use POST.' }));
  }

  const caller = await verifyFirebaseBearerToken(req.headers?.authorization);
  if (!caller.valid || !caller.uid || !caller.email) {
    res.statusCode = 401;
    return res.end(
      JSON.stringify({
        ok: false,
        error: 'unauthorized',
        message: caller.error || 'Please sign in with Google before initiating payment.'
      })
    );
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

  const clientIp =
    (req.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown';

  const result = await createRazorpayOrder({
    applicationId: String(body.applicationId || ''),
    planId: String(body.planId || ''),
    paymentPurpose: body.paymentPurpose === 'application_fee' ? 'application_fee' : 'franchise_deposit',
    userId: caller.uid,
    applicantName: String(body.applicantName || caller.name || 'Franchise Applicant'),
    email: caller.email,
    phone: String(body.phone || ''),
    termsAccepted: body.termsAccepted !== false,
    forceNewOrder: Boolean(body.forceNewOrder),
    clientIp
  });

  res.statusCode = result.statusCode;
  return res.end(JSON.stringify(result));
}
