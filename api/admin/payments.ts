import { verifyFirebaseBearerToken } from '../../src/server/firebaseAuthVerify';
import { getPayUPersistenceAdapter, reconcilePayUTransaction } from '../../src/server/payuService';

/**
 * Vercel Serverless Function: GET / POST /api/admin/payments
 *
 * Strictly enforces server-side Firebase ID token verification AND authorized admin role.
 * Provides authoritative payment statistics, transaction ledger, webhook events, and
 * refund/reconciliation actions. Never returns dummy statistics.
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

  const store = getPayUPersistenceAdapter();

  if (req.method === 'GET') {
    const payments = await store.getAllPayments();
    const webhookEvents = await store.getAllWebhookEvents();

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

    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, stats, payments, webhookEvents }));
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

    const action = String(body?.action || '').trim();
    const txnid = String(body?.txnid || '').trim();

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
      const rec = await store.getPaymentByTxnId(txnid);
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
      await store.savePayment(rec);
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, payment: rec }));
    }

    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: 'unsupported_action' }));
  }

  res.statusCode = 405;
  return res.end(JSON.stringify({ ok: false, error: 'method_not_allowed' }));
}
