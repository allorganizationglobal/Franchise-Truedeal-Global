import crypto from 'crypto';
import { processPayUGatewayResponse, timingSafeHexEquals } from '../../src/server/payuService';
import { processRazorpayWebhook } from '../../src/server/razorpayService';

/**
 * Vercel Serverless Function: POST /api/webhooks/payment
 * Legacy webhook endpoint updated to route Razorpay & PayU webhooks cleanly
 * or validate HMAC-SHA256 signatures in constant time when PAYMENT_WEBHOOK_SECRET is configured.
 */

const processedWebhookTxIds = new Set<string>();

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: 'method_not_allowed' }));
  }

  // Delegate Razorpay webhooks if x-razorpay-signature header is present
  const rzpSig = (req.headers?.['x-razorpay-signature'] as string) || '';
  if (rzpSig) {
    const rawBody =
      typeof req.rawBody === 'string'
        ? req.rawBody
        : typeof req.body === 'string'
        ? req.body
        : JSON.stringify(req.body || {});
    const result = await processRazorpayWebhook({
      rawBody,
      signatureHeader: rzpSig,
      eventIdHeader: (req.headers?.['x-razorpay-event-id'] as string) || undefined
    });
    res.statusCode = result.statusCode;
    return res.end(JSON.stringify(result));
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      if (body.trim().startsWith('{')) {
        body = JSON.parse(body);
      } else {
        body = Object.fromEntries(new URLSearchParams(body).entries());
      }
    } catch {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: 'invalid_payload' }));
    }
  }

  // Delegate PayU payloads directly to authoritative PayU processor
  if (body?.txnid && body?.hash && body?.key) {
    const sig =
      (req.headers?.['x-payu-signature'] as string) ||
      (req.headers?.['x-webhook-signature'] as string) ||
      undefined;
    const result = await processPayUGatewayResponse(body, 'webhook', sig);
    res.statusCode = result.statusCode;
    return res.end(JSON.stringify(result));
  }

  const webhookSecret = process.env.PAYU_WEBHOOK_SECRET || process.env.PAYMENT_WEBHOOK_SECRET;
  const providedSignature =
    (req.headers?.['x-payu-signature'] as string) ||
    (req.headers?.['x-webhook-signature'] as string) ||
    '';

  if (!webhookSecret) {
    res.statusCode = 503;
    return res.end(JSON.stringify({ error: 'webhook_not_configured', message: 'Payment webhook secret is not configured.' }));
  }

  const rawPayload = typeof req.body === 'string' ? req.body : JSON.stringify(body);
  const expectedSig = crypto.createHmac('sha256', webhookSecret).update(rawPayload).digest('hex');
  if (!timingSafeHexEquals(expectedSig, providedSignature)) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ error: 'invalid_signature', message: 'Webhook signature verification failed.' }));
  }

  const paymentData = body?.data || body;
  const transactionId = paymentData?.id || paymentData?.transactionId || paymentData?.referenceCode;
  if (!transactionId) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: 'missing_transaction_id' }));
  }

  if (processedWebhookTxIds.has(transactionId)) {
    res.statusCode = 200;
    return res.end(
      JSON.stringify({
        success: true,
        status: 'duplicate_acknowledged',
        transactionId
      })
    );
  }

  processedWebhookTxIds.add(transactionId);
  res.statusCode = 200;
  return res.end(
    JSON.stringify({
      success: true,
      status: 'processed',
      transactionId,
      timestamp: new Date().toISOString()
    })
  );
}
