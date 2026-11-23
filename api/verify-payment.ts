import { verifyFirebaseBearerToken } from '../src/server/firebaseAuthVerify';
import { verifyRazorpayPayment, verifySignedCheckoutToken } from '../src/server/razorpayService';

/**
 * Vercel Serverless Function: POST /api/verify-payment
 *
 * Verifies Razorpay Standard Checkout payment signature using constant-time
 * HMAC_SHA256(server_saved_order_id + "|" + razorpay_payment_id, RAZORPAY_KEY_SECRET),
 * then fetches payment details from Razorpay API to confirm capture, amount, and currency.
 * Accepts either a verified Firebase Bearer token OR a server-signed checkoutToken bound to the order.
 */
export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, verified: false, captured: false, error: 'method_not_allowed' }));
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

  const orderId = String(body.razorpay_order_id || '').trim();
  const checkoutToken =
    typeof body.checkoutToken === 'string' && body.checkoutToken.trim()
      ? body.checkoutToken.trim()
      : String(req.headers?.['x-checkout-token'] || '').trim();

  let callerUid = '';
  let callerIsAdmin = false;

  const authHeader = String(req.headers?.authorization || '').trim();
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    const caller = await verifyFirebaseBearerToken(authHeader);
    if (caller.valid && caller.uid) {
      callerUid = caller.uid;
      callerIsAdmin = Boolean(caller.isAdmin);
    }
  }

  if (!callerUid && checkoutToken) {
    const tokenCheck = verifySignedCheckoutToken(checkoutToken);
    if (tokenCheck.valid && tokenCheck.claims && tokenCheck.claims.orderId === orderId) {
      callerUid = tokenCheck.claims.userId;
      callerIsAdmin = false;
    }
  }

  if (!callerUid) {
    res.statusCode = 401;
    return res.end(
      JSON.stringify({
        ok: false,
        verified: false,
        captured: false,
        error: 'unauthorized',
        message: 'Valid authentication or server-signed checkout token is required to verify payment.'
      })
    );
  }

  const clientIp =
    (req.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown';

  const result = await verifyRazorpayPayment({
    razorpay_order_id: orderId,
    razorpay_payment_id: String(body.razorpay_payment_id || ''),
    razorpay_signature: String(body.razorpay_signature || ''),
    applicationId: body.applicationId ? String(body.applicationId) : undefined,
    checkoutToken: checkoutToken || undefined,
    callerUid,
    callerIsAdmin,
    clientIp
  });

  res.statusCode = result.statusCode;
  return res.end(JSON.stringify(result));
}
