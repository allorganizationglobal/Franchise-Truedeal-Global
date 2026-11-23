import { lookupReferralPartnerStatus, getReferralCommissionSchedule } from '../../src/server/referralService.js';

/**
 * Vercel Serverless Function: GET /api/referrals/status
 * - ?mode=schedule -> returns authoritative 10% commission schedule across all 8 franchise plans
 * - ?query=CODE_OR_MOBILE -> returns partner summary, verified vs. pending referrals, and payout status
 */
export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'GET') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, error: 'method_not_allowed', message: 'Use GET.' }));
  }

  try {
    const urlObj = new URL(req.url || '/api/referrals/status', 'http://localhost');
    const mode = String(req.query?.mode || urlObj.searchParams.get('mode') || '').trim();

    if (mode === 'schedule') {
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, schedule: getReferralCommissionSchedule() }));
    }

    const queryVal = String(req.query?.query || urlObj.searchParams.get('query') || '').trim();
    const clientIp =
      (req.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      'unknown';

    const result = lookupReferralPartnerStatus(queryVal, clientIp);
    res.statusCode = result.statusCode;
    return res.end(JSON.stringify(result));
  } catch (err: any) {
    console.error('[API /api/referrals/status] Error:', err?.message || 'unknown');
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
