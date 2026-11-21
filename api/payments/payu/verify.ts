import { verifyFirebaseBearerToken } from '../../../src/server/firebaseAuthVerify';
import { getPayUPersistenceAdapter, reconcilePayUTransaction } from '../../../src/server/payuService';

/**
 * Vercel Serverless Function: POST /api/payments/payu/verify
 *
 * Allows an authenticated applicant owner OR authorized admin to trigger an independent
 * live PayU `verify_payment` API reconciliation for a specific txnid.
 */
export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, error: 'method_not_allowed' }));
  }

  const caller = await verifyFirebaseBearerToken(req.headers?.authorization);
  if (!caller.valid || !caller.uid) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ ok: false, error: 'unauthorized', message: caller.error || 'Authentication required.' }));
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      res.statusCode = 400;
      return res.end(JSON.stringify({ ok: false, error: 'invalid_json' }));
    }
  }

  const txnid = String(body?.txnid || '').trim();
  if (!txnid) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: 'missing_txnid', message: 'txnid is required.' }));
  }

  const existing = await getPayUPersistenceAdapter().getPaymentByTxnId(txnid);
  if (!existing) {
    res.statusCode = 404;
    return res.end(JSON.stringify({ ok: false, error: 'not_found', message: 'Transaction not found.' }));
  }

  // Enforce strict ownership or admin authorization
  if (!caller.isAdmin && existing.userId !== caller.uid) {
    res.statusCode = 403;
    return res.end(
      JSON.stringify({
        ok: false,
        error: 'forbidden',
        message: 'You are not authorized to verify another applicant’s transaction.'
      })
    );
  }

  const result = await reconcilePayUTransaction(txnid);
  res.statusCode = result.statusCode;
  return res.end(JSON.stringify(result));
}
