import {
  registerReferralPartner,
  lookupReferralPartnerStatus,
  getReferralCommissionSchedule
} from '../src/server/referralService.js';

/**
 * Unified Vercel Serverless Function: /api/referrals
 * Also serves /api/referrals/register (POST) and /api/referrals/status (GET) via vercel.json rewrites.
 * Keeping register + status in one function keeps total Vercel API functions <= 12 (Hobby plan compatible).
 */
export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const clientIp =
    (req.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown';

  if (req.method === 'GET') {
    try {
      const urlObj = new URL(req.url || '/api/referrals', 'http://localhost');
      const mode = String(req.query?.mode || urlObj.searchParams.get('mode') || '').trim();

      if (mode === 'schedule') {
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: true, schedule: getReferralCommissionSchedule() }));
      }

      const queryVal = String(req.query?.query || urlObj.searchParams.get('query') || '').trim();
      const result = lookupReferralPartnerStatus(queryVal, clientIp);
      res.statusCode = result.statusCode;
      return res.end(JSON.stringify(result));
    } catch (err: any) {
      console.error('[API GET /api/referrals] Error:', err?.message || 'unknown');
      res.statusCode = 500;
      return res.end(
        JSON.stringify({
          ok: false,
          error: 'internal_server_error',
          message: 'Unable to fetch referral status right now.'
        })
      );
    }
  }

  if (req.method === 'POST') {
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
      console.error('[API POST /api/referrals] Error:', err?.message || 'unknown');
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

  res.statusCode = 405;
  return res.end(JSON.stringify({ ok: false, error: 'method_not_allowed', message: 'Use GET or POST.' }));
}
