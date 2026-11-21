import { verifyFirebaseBearerToken } from '../../../src/server/firebaseAuthVerify';
import { initiatePayUPaymentOrder } from '../../../src/server/payuService';

/**
 * Vercel Serverless Function: POST /api/payments/payu/initiate
 *
 * Authenticates the applicant via Firebase ID token, computes the authoritative
 * INR franchise plan amount strictly server-side, generates a unique txnid and
 * official PayU SHA-512 request hash, and returns Hosted Checkout POST form fields.
 */
export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, error: 'method_not_allowed', message: 'Use POST.' }));
  }

  const caller = await verifyFirebaseBearerToken(req.headers?.authorization);
  if (!caller.valid || !caller.uid || !caller.email) {
    res.statusCode = 401;
    return res.end(
      JSON.stringify({
        ok: false,
        error: 'unauthorized',
        message: caller.error || 'Please sign in with Google before initiating payment.'
      })
    );
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      res.statusCode = 400;
      return res.end(JSON.stringify({ ok: false, error: 'invalid_json', message: 'Malformed JSON body.' }));
    }
  }
  body = body || {};

  const clientIp =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown';

  const result = await initiatePayUPaymentOrder({
    applicationId: String(body.applicationId || ''),
    planId: String(body.planId || ''),
    userId: caller.uid,
    applicantName: String(body.applicantName || caller.name || 'Applicant'),
    email: caller.email,
    phone: String(body.phone || ''),
    clientSuppliedAmount:
      typeof body.amount === 'number' ? body.amount : body.amount !== undefined ? Number(body.amount) : undefined,
    clientIp
  });

  res.statusCode = result.statusCode;
  return res.end(JSON.stringify(result));
}
