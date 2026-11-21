import { processPayUGatewayResponse } from '../../../src/server/payuService';

/**
 * Vercel Serverless Function: POST /api/payments/payu/webhook
 *
 * Server-to-server PayU webhook endpoint. Validates reverse SHA-512 hash
 * (and optional PAYU_WEBHOOK_SECRET HMAC), calls PayU verify_payment independently,
 * records webhook events idempotently, and handles out-of-order / pre-redirect events.
 */
export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, error: 'method_not_allowed' }));
  }

  let payload = req.body;
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch {
      const params = new URLSearchParams(payload);
      const parsed: Record<string, string> = {};
      params.forEach((v, k) => {
        parsed[k] = v;
      });
      payload = parsed;
    }
  }

  const webhookSig =
    (req.headers['x-payu-signature'] as string) ||
    (req.headers['x-webhook-signature'] as string) ||
    undefined;

  const result = await processPayUGatewayResponse(payload || {}, 'webhook', webhookSig);

  res.statusCode = result.statusCode;
  return res.end(
    JSON.stringify({
      ok: result.ok,
      duplicate: Boolean(result.duplicate),
      status: result.finalStatus,
      txnid: result.payment?.txnId || payload?.txnid || null,
      receiptNumber: result.payment?.receiptNumber || null,
      error: result.error,
      message: result.message
    })
  );
}
