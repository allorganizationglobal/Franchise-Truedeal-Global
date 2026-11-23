import { processRazorpayWebhook } from '../../src/server/razorpayService.js';

/**
 * Vercel Serverless Function: POST /api/webhooks/payment
 * Legacy payment webhook alias — routes directly to Razorpay raw-body HMAC-SHA256 verification.
 * Primary official webhook URL: https://businessfranchise.truedealglobal.com/api/webhooks/razorpay
 */
export const config = {
  api: {
    bodyParser: false
  }
};

async function readRawBody(req: any): Promise<string> {
  if (typeof req.rawBody === 'string') return req.rawBody;
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  if (typeof req.body === 'string') return req.body;
  if (req && typeof req[Symbol.asyncIterator] === 'function') {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    if (chunks.length > 0) return Buffer.concat(chunks).toString('utf8');
  }
  if (req.body && typeof req.body === 'object') return JSON.stringify(req.body);
  return '';
}

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, error: 'method_not_allowed' }));
  }

  const rawBody = await readRawBody(req);
  if (!rawBody) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: 'empty_body', message: 'Webhook body is empty.' }));
  }

  const result = await processRazorpayWebhook({
    rawBody,
    signatureHeader:
      (req.headers?.['x-razorpay-signature'] as string) ||
      (req.headers?.['X-Razorpay-Signature'] as string) ||
      '',
    eventIdHeader:
      (req.headers?.['x-razorpay-event-id'] as string) ||
      (req.headers?.['X-Razorpay-Event-Id'] as string) ||
      undefined
  });

  res.statusCode = result.statusCode;
  return res.end(JSON.stringify(result));
}
