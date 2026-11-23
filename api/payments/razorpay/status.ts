import { verifyFirebaseBearerToken } from '../../../src/server/firebaseAuthVerify';
import {
  getRazorpayConfigStatus,
  getRazorpayPersistenceAdapter,
  recordClientCheckoutAttemptEvent
} from '../../../src/server/razorpayService';

/**
 * Vercel Serverless Function: GET / POST /api/payments/razorpay/status
 *
 * - GET ?mode=config -> Public readiness diagnostics (public Key ID & mode ONLY; zero secrets).
 * - GET ?orderId=... | ?applicationId=... -> Authenticated Owner or Admin payment status lookup.
 * - POST { razorpayOrderId, outcome: 'cancelled' | 'failed', reason? } -> Authenticated owner logs
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

  const caller = await verifyFirebaseBearerToken(req.headers?.authorization);
  if (!caller.valid || !caller.uid) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ ok: false, error: 'unauthorized', message: caller.error || 'Authentication required.' }));
  }

  if (req.method === 'GET') {
    const store = getRazorpayPersistenceAdapter();

    if (orderId) {
      const payment = await store.getPaymentByOrderId(orderId);
      if (!payment) {
        res.statusCode = 404;
        return res.end(JSON.stringify({ ok: false, error: 'not_found', message: 'Razorpay order not found.' }));
      }
      if (!caller.isAdmin && payment.userId !== caller.uid) {
        res.statusCode = 403;
        return res.end(JSON.stringify({ ok: false, error: 'forbidden', message: 'Unauthorized access to payment record.' }));
      }
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, payment }));
    }

    if (applicationId) {
      const payments = await store.getPaymentsByApplicationId(applicationId);
      const visible = caller.isAdmin ? payments : payments.filter((p) => p.userId === caller.uid);
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, payments: visible }));
    }

    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: 'missing_query', message: 'Provide mode=config, orderId, or applicationId.' }));
  }

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        res.statusCode = 400;
        return res.end(JSON.stringify({ ok: false, error: 'invalid_json' }));
      }
    }
    body = body || {};

    const targetOrderId = String(body.razorpayOrderId || '').trim();
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
      callerUid: caller.uid,
      callerIsAdmin: Boolean(caller.isAdmin),
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
