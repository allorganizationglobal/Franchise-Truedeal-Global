import { verifyFirebaseBearerToken } from '../../src/server/firebaseAuthVerify';
import { getPayUPersistenceAdapter, reconcilePayUTransaction } from '../../src/server/payuService';
import {
  getRazorpayPersistenceAdapter,
  getRazorpayConfigStatus,
  reconcileRazorpayOrder,
  initiateRazorpayRefund,
  addRazorpayAdminNote
} from '../../src/server/razorpayService';

/**
 * Vercel Serverless Function: GET / POST /api/admin/payments
 *
 * Strictly enforces server-side Firebase ID token verification AND authorized admin role.
 * Serves unified Razorpay + PayU authoritative payment statistics, transaction ledgers,
 * webhook audit logs, live reconciliation, real Razorpay Refund API calls, and internal notes.
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

  const payuStore = getPayUPersistenceAdapter();
  const rzpStore = getRazorpayPersistenceAdapter();

  if (req.method === 'GET') {
    const [payments, webhookEvents, razorpayPayments, razorpayWebhooks] = await Promise.all([
      payuStore.getAllPayments(),
      payuStore.getAllWebhookEvents(),
      rzpStore.getAllPayments(),
      rzpStore.getAllWebhookEvents()
    ]);

    const stats = {
      totalTransactions: payments.length,
      pendingCount: payments.filter((p) => p.paymentStatus === 'PAYMENT_PENDING' || p.paymentStatus === 'CREATED' || p.paymentStatus === 'UNDER_REVIEW').length,
      successCount: payments.filter((p) => p.paymentStatus === 'SUCCESS').length,
      failedCount: payments.filter((p) => p.paymentStatus === 'FAILED' || p.paymentStatus === 'CANCELLED' || p.paymentStatus === 'EXPIRED').length,
      refundPendingCount: payments.filter((p) => p.paymentStatus === 'REFUND_PENDING').length,
      refundedCount: payments.filter((p) => p.paymentStatus === 'REFUNDED').length,
      totalVerifiedCollectionsINR: payments
        .filter((p) => p.paymentStatus === 'SUCCESS')
        .reduce((sum, p) => sum + p.amount, 0)
    };

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
        stats,
        payments,
        webhookEvents,
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

    // Razorpay Admin Actions
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

    // Preserved PayU Admin Actions
    const txnid = String(body.txnid || '').trim();
    if (!txnid) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ ok: false, error: 'missing_txnid' }));
    }

    if (action === 'reconcile') {
      const result = await reconcilePayUTransaction(txnid);
      res.statusCode = result.statusCode;
      return res.end(JSON.stringify(result));
    }

    if (action === 'mark_refund_pending' || action === 'mark_refunded') {
      const rec = await payuStore.getPaymentByTxnId(txnid);
      if (!rec) {
        res.statusCode = 404;
        return res.end(JSON.stringify({ ok: false, error: 'not_found' }));
      }
      if (rec.paymentStatus !== 'SUCCESS' && rec.paymentStatus !== 'REFUND_PENDING') {
        res.statusCode = 400;
        return res.end(
          JSON.stringify({
            ok: false,
            error: 'invalid_refund_state',
            message: 'Only verified SUCCESS or REFUND_PENDING transactions can transition to refund states.'
          })
        );
      }
      rec.paymentStatus = action === 'mark_refunded' ? 'REFUNDED' : 'REFUND_PENDING';
      rec.updatedAt = new Date().toISOString();
      await payuStore.savePayment(rec);
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, payment: rec }));
    }

    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: 'unsupported_action' }));
  }

  res.statusCode = 405;
  return res.end(JSON.stringify({ ok: false, error: 'method_not_allowed' }));
}
