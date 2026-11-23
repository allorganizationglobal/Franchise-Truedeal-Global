import { verifyFirebaseBearerToken } from '../src/server/firebaseAuthVerify';
import { verifyRazorpayPayment } from '../src/server/razorpayService';

/**
 * Vercel Serverless Function: POST /api/verify-payment
 *
 * Verifies Razorpay Standard Checkout payment signature using constant-time
 * HMAC_SHA256(server_saved_order_id + "|" + razorpay_payment_id, RAZORPAY_KEY_SECRET),
 * then fetches payment details from Razorpay API to confirm capture, amount, and currency.
 */
export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, verified: false, captured: false, error: 'method_not_allowed' }));
  }

  const caller = await verifyFirebaseBearerToken(req.headers?.authorization);
  if (!caller.valid || !caller.uid) {
    res.statusCode = 401;
    return res.end(
      JSON.stringify({
        ok: false,
        verified: false,
        captured: false,
        error: 'unauthorized',
        message: caller.error || 'Authentication required to verify payment.'
      })
    );
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      res.statusCode = 400;
      return res.end(JSON.stringify({ ok: false, verified: false, captured: false, error: 'invalid_json' }));
    }
  }
  body = body || {};

  const clientIp =
    (req.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown';

  const result = await verifyRazorpayPayment({
    razorpay_order_id: String(body.razorpay_order_id || ''),
    razorpay_payment_id: String(body.razorpay_payment_id || ''),
    razorpay_signature: String(body.razorpay_signature || ''),
    applicationId: body.applicationId ? String(body.applicationId) : undefined,
    callerUid: caller.uid,
    callerIsAdmin: Boolean(caller.isAdmin),
    clientIp
  });

  res.statusCode = result.statusCode;
  return res.end(JSON.stringify(result));
}
