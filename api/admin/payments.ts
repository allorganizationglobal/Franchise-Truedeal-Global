import { verifyFirebaseBearerToken } from '../../src/server/firebaseAuthVerify.js';
import {
  getRazorpayPersistenceAdapter,
  getRazorpayConfigStatus,
  reconcileRazorpayOrder,
  initiateRazorpayRefund,
  addRazorpayAdminNote
} from '../../src/server/razorpayService.js';

/**
 * Vercel Serverless Function: GET / POST /api/admin/payments
 *
 * Strictly enforces server-side Firebase ID token verification AND authorized admin role.
 * Serves authoritative Razorpay payment statistics, transaction ledger, webhook audit logs,
 * live reconciliation, real Razorpay Refund API calls, and internal administrative notes.
 */
export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const caller = await verifyFirebaseBearerToken(req.headers?.authorization);
  if (!caller.valid || !caller.uid) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ ok: false, error: 'unauthorized', message: caller.error || 'Authentication required.' }));
  }

  if (!caller.isAdmin) {
    res.statusCode = 403;
    return res.end(
      JSON.stringify({
        ok: false,
        error: 'forbidden',
        message: 'Administrator role required to access franchise payment ledger.'
      })
    );
  }

  const rzpStore = getRazorpayPersistenceAdapter();

  if (req.method === 'GET') {
    const [razorpayPayments, razorpayWebhooks] = await Promise.all([
      rzpStore.getAllPayments(),
      rzpStore.getAllWebhookEvents()
    ]);

    const razorpayStats = {
      totalTransactions: razorpayPayments.length,
      capturedCount: razorpayPayments.filter((p) => p.paymentStatus === 'CAPTURED').length,
      pendingCount: razorpayPayments.filter((p) =>
        p.paymentStatus === 'CREATED' ||
        p.paymentStatus === 'PENDING' ||
        p.paymentStatus === 'AUTHORIZED' ||
        p.paymentStatus === 'VERIFICATION_REQUIRED'
      ).length,
      failedCount: razorpayPayments.filter((p) => p.paymentStatus === 'FAILED' || p.paymentStatus === 'CANCELLED').length,
      refundInitiatedCount: razorpayPayments.filter((p) => p.paymentStatus === 'REFUND_INITIATED').length,
      refundedCount: razorpayPayments.filter((p) => p.paymentStatus === 'REFUNDED').length,
      totalCapturedCollectionsINR: razorpayPayments
        .filter((p) => p.paymentStatus === 'CAPTURED')
        .reduce((sum, p) => sum + p.finalAmountINR, 0),
      gatewayConfig: getRazorpayConfigStatus()
    };

    res.statusCode = 200;
    return res.end(
      JSON.stringify({
        ok: true,
        razorpayStats,
        razorpayPayments,
        razorpayWebhooks
      })
    );
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

    const action = String(body.action || '').trim();

    if (action === 'razorpay_reconcile') {
      const orderId = String(body.orderId || '').trim();
      if (!orderId) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ ok: false, error: 'missing_order_id' }));
      }
      const result = await reconcileRazorpayOrder(orderId);
      res.statusCode = result.statusCode;
      return res.end(JSON.stringify(result));
    }

    if (action === 'razorpay_refund') {
      const orderId = String(body.orderId || '').trim();
      const reason = String(body.reason || 'Administrative franchise refund').trim();
      if (!orderId) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ ok: false, error: 'missing_order_id' }));
      }
      const result = await initiateRazorpayRefund({
        orderId,
        reason,
        actorEmail: caller.email || 'admin@truedealglobal.com'
      });
      res.statusCode = result.statusCode;
      return res.end(JSON.stringify(result));
    }

    if (action === 'razorpay_add_note') {
      const orderId = String(body.orderId || '').trim();
      const note = String(body.note || '').trim();
      if (!orderId || !note) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ ok: false, error: 'missing_fields', message: 'orderId and note are required.' }));
      }
      const result = await addRazorpayAdminNote({
        orderId,
        note,
        actorEmail: caller.email || 'admin@truedealglobal.com'
      });
      res.statusCode = result.statusCode;
      return res.end(JSON.stringify(result));
    }

    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: 'unsupported_action' }));
  }

  res.statusCode = 405;
  return res.end(JSON.stringify({ ok: false, error: 'method_not_allowed' }));
}
