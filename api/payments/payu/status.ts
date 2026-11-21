import { verifyFirebaseBearerToken } from '../../../src/server/firebaseAuthVerify';
import { getPayUConfigStatus, getPayUPersistenceAdapter } from '../../../src/server/payuService';

/**
 * Vercel Serverless Function: GET /api/payments/payu/status
 *
 * Returns authoritative server-verified payment status and receipt details
 * strictly for the owning applicant or an authorized administrator.
 */
export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'GET') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, error: 'method_not_allowed' }));
  }

  const url = new URL(req.url || '/', 'https://businessfranchise.truedealglobal.com');
  const mode = (typeof req.query?.mode === 'string' ? req.query.mode : url.searchParams.get('mode')) || '';

  // Public gateway readiness check (exposes zero secrets or payment records)
  if (mode === 'config') {
    const cfg = getPayUConfigStatus();
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, config: cfg, gateway: cfg }));
  }

  const caller = await verifyFirebaseBearerToken(req.headers?.authorization);
  if (!caller.valid || !caller.uid) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ ok: false, error: 'unauthorized', message: caller.error || 'Sign in required.' }));
  }

  const txnid = (typeof req.query?.txnid === 'string' ? req.query.txnid : url.searchParams.get('txnid') || '').trim();
  const applicationId = (
    typeof req.query?.applicationId === 'string' ? req.query.applicationId : url.searchParams.get('applicationId') || ''
  ).trim();
  const store = getPayUPersistenceAdapter();

  if (txnid) {
    const payment = await store.getPaymentByTxnId(txnid);
    if (!payment) {
      res.statusCode = 404;
      return res.end(JSON.stringify({ ok: false, error: 'not_found', message: 'Payment record not found.' }));
    }
    if (!caller.isAdmin && payment.userId !== caller.uid) {
      res.statusCode = 403;
      return res.end(JSON.stringify({ ok: false, error: 'forbidden', message: 'Access denied to another user’s payment.' }));
    }
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, payment }));
  }

  if (applicationId) {
    const payments = await store.getPaymentsByApplicationId(applicationId);
    const filtered = caller.isAdmin ? payments : payments.filter((p) => p.userId === caller.uid);
    if (payments.length > 0 && filtered.length === 0 && !caller.isAdmin) {
      res.statusCode = 403;
      return res.end(JSON.stringify({ ok: false, error: 'forbidden', message: 'Access denied to another user’s application payments.' }));
    }
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, payments: filtered }));
  }

  res.statusCode = 400;
  return res.end(JSON.stringify({ ok: false, error: 'missing_query', message: 'Provide txnid or applicationId.' }));
}
