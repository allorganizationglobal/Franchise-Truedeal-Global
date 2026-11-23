import { registerReferralPartner } from '../../src/server/referralService.js';

/**
 * Vercel Serverless Function: POST /api/referrals/register
 * Registers a referral partner and returns their unique TRUEDEAL GLOBAL
 * referral code (e.g., TD-NAME1234) and shareable link.
 */
export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, error: 'method_not_allowed', message: 'Use POST.' }));
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        res.statusCode = 400;
        return res.end(JSON.stringify({ ok: false, error: 'invalid_json', message: 'Invalid JSON request body.' }));
      }
    } else if (!body && req && typeof req[Symbol.asyncIterator] === 'function') {
      try {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const raw = Buffer.concat(chunks).toString('utf8').trim();
        body = raw ? JSON.parse(raw) : {};
      } catch {
        res.statusCode = 400;
        return res.end(JSON.stringify({ ok: false, error: 'invalid_json', message: 'Invalid JSON request body.' }));
      }
    }
    body = body || {};

    const clientIp =
      (req.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      'unknown';

    const result = registerReferralPartner({
      name: String(body.name || ''),
      phone: String(body.phone || ''),
      email: String(body.email || ''),
      upiOrBankDetails: String(body.upiOrBankDetails || ''),
      userId: typeof body.userId === 'string' ? body.userId : undefined,
      clientIp
    });

    res.statusCode = result.statusCode;
    return res.end(JSON.stringify(result));
  } catch (err: any) {
    console.error('[API /api/referrals/register] Error:', err?.message || 'unknown');
    res.statusCode = 500;
    return res.end(
      JSON.stringify({
        ok: false,
        error: 'internal_server_error',
        message: 'Unable to generate referral link right now. Please try again.'
      })
    );
  }
}
