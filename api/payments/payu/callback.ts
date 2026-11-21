import { getPayUConfigStatus, processPayUGatewayResponse } from '../../../src/server/payuService';

/**
 * Vercel Serverless Function: POST /api/payments/payu/callback
 *
 * Receives PayU Hosted Checkout browser POST redirect (surl / furl),
 * verifies reverse SHA-512 hash, calls PayU verify_payment API independently,
 * updates server payment state idempotently, and redirects to /payment-result.
 */
export default async function handler(req: any, res: any) {
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'POST') {
    const cfg = getPayUConfigStatus();
    res.statusCode = 303;
    res.setHeader('Location', `${cfg.appBaseUrl}/payment-result?error=invalid_method`);
    return res.end();
  }

  let payload = req.body;
  if (!payload || typeof payload === 'string') {
    const raw = typeof payload === 'string' ? payload : '';
    const params = new URLSearchParams(raw);
    const parsed: Record<string, string> = {};
    params.forEach((v, k) => {
      parsed[k] = v;
    });
    payload = parsed;
  }

  const result = await processPayUGatewayResponse(payload || {}, 'callback');
  const cfg = getPayUConfigStatus();
  const txnid = encodeURIComponent(String(payload?.txnid || ''));
  const appId = encodeURIComponent(String(result.payment?.applicationId || payload?.udf1 || ''));
  const statusParam = encodeURIComponent(result.finalStatus);
  const errParam = result.error ? `&error=${encodeURIComponent(result.error)}` : '';

  res.statusCode = 303;
  res.setHeader(
    'Location',
    `${cfg.appBaseUrl}/payment-result?txnid=${txnid}&applicationId=${appId}&status=${statusParam}${errParam}`
  );
  return res.end();
}
