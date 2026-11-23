import { verifyFirebaseBearerToken } from '../../../src/server/firebaseAuthVerify.js';
import {
  getRazorpayConfigStatus,
  getRazorpayPersistenceAdapter,
  recordClientCheckoutAttemptEvent,
  verifySignedCheckoutToken
} from '../../../src/server/razorpayService.js';

/**
 * Vercel Serverless Function: GET / POST /api/payments/razorpay/status
 *
 * - GET ?mode=config -> Public readiness diagnostics (public Key ID & mode ONLY; zero secrets).
 * - GET ?orderId=... | ?applicationId=... -> Authenticated Owner/Admin (or checkoutToken owner) status lookup.
 * - POST { razorpayOrderId, outcome: 'cancelled' | 'failed', reason?, checkoutToken? } -> Logs
 *   checkout dismissal/failure without ever being able to mark a payment as CAPTURED.
 */
export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const urlObj = new URL(req.url || '/api/payments/razorpay/status', 'https://businessfranchise.truedealglobal.com');
  const mode = String(req.query?.mode || urlObj.searchParams.get('mode') || '').trim();
  const orderId = String(req.query?.orderId || urlObj.searchParams.get('orderId') || '').trim();
  const applicationId = String(req.query?.applicationId || urlObj.searchParams.get('applicationId') || '').trim();

  if (req.method === 'GET' && mode === 'config') {
    const config = getRazorpayConfigStatus();
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, config }));
  }

  let body: any = {};
  if (req.method === 'POST') {
    body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        res.statusCode = 400;
        return res.end(JSON.stringify({ ok: false, error: 'invalid_json' }));
      }
    }
    body = body || {};
  }

  const targetOrderId = req.method === 'POST' ? String(body.razorpayOrderId || '').trim() : orderId;
  const checkoutToken =
    (typeof body.checkoutToken === 'string' && body.checkoutToken.trim()) ||
    String(req.headers?.['x-checkout-token'] || urlObj.searchParams.get('checkoutToken') || '').trim();

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

  if (!callerUid && checkoutToken && targetOrderId) {
    const tokenCheck = verifySignedCheckoutToken(checkoutToken);
    if (tokenCheck.valid && tokenCheck.claims && tokenCheck.claims.orderId === targetOrderId) {
      callerUid = tokenCheck.claims.userId;
      callerIsAdmin = false;
    }
  }

  if (!callerUid) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ ok: false, error: 'unauthorized', message: 'Authentication required.' }));
  }

  if (req.method === 'GET') {
    const store = getRazorpayPersistenceAdapter();

    if (orderId) {
      const payment = await store.getPaymentByOrderId(orderId);
      if (!payment) {
        res.statusCode = 404;
        return res.end(JSON.stringify({ ok: false, error: 'not_found', message: 'Razorpay order not found.' }));
      }
      if (!callerIsAdmin && payment.userId !== callerUid) {
        res.statusCode = 403;
        return res.end(JSON.stringify({ ok: false, error: 'forbidden', message: 'Unauthorized access to payment record.' }));
      }
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, payment }));
    }

    if (applicationId) {
      const payments = await store.getPaymentsByApplicationId(applicationId);
      const visible = callerIsAdmin ? payments : payments.filter((p) => p.userId === callerUid);
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, payments: visible }));
    }

    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: 'missing_query', message: 'Provide mode=config, orderId, or applicationId.' }));
  }

  if (req.method === 'POST') {
    const outcome = body.outcome === 'failed' ? 'failed' : body.outcome === 'cancelled' ? 'cancelled' : null;
    if (!targetOrderId || !outcome) {
      res.statusCode = 400;
      return res.end(
        JSON.stringify({
          ok: false,
          error: 'invalid_payload',
          message: 'razorpayOrderId and outcome ("cancelled" | "failed") are required.'
        })
      );
    }

    const result = await recordClientCheckoutAttemptEvent({
      razorpayOrderId: targetOrderId,
      callerUid,
      callerIsAdmin,
      checkoutToken: checkoutToken || undefined,
      outcome,
      reason: body.reason ? String(body.reason).slice(0, 300) : undefined,
      razorpayPaymentId: body.razorpayPaymentId ? String(body.razorpayPaymentId).slice(0, 128) : undefined
    });

    res.statusCode = result.statusCode;
    return res.end(JSON.stringify(result));
  }

  res.statusCode = 405;
  return res.end(JSON.stringify({ ok: false, error: 'method_not_allowed' }));
}
