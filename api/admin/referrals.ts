import { verifyFirebaseBearerToken } from '../../src/server/firebaseAuthVerify.js';
import {
  listAllReferralsForAdmin,
  updateReferralPayoutStatus,
  ServerReferralPayoutStatus
} from '../../src/server/referralService.js';

/**
 * Vercel Serverless Function: GET / POST /api/admin/referrals
 * Strictly Admin-Only (verified Firebase ID Token + admin role check):
 * - GET: returns all referral partners, attributed referral payout records, and aggregate KPIs
 * - POST: updates payout status (Pending / Approved / Paid) with optional UTR reference
 */
export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, error: 'method_not_allowed', message: 'Use GET or POST.' }));
  }

  try {
    const caller = await verifyFirebaseBearerToken(req.headers?.authorization);
    if (!caller.valid || !caller.uid) {
      res.statusCode = 401;
      return res.end(
        JSON.stringify({
          ok: false,
          error: 'unauthorized',
          message: caller.error || 'Administrator authentication required.'
        })
      );
    }

    if (!caller.isAdmin) {
      res.statusCode = 403;
      return res.end(
        JSON.stringify({
          ok: false,
          error: 'forbidden',
          message: 'Administrator role required to access referral payouts.'
        })
      );
    }

    if (req.method === 'GET') {
      const data = listAllReferralsForAdmin();
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, ...data }));
    }

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

    const referralId = String(body.referralId || '').trim();
    const rawStatus = String(body.payoutStatus || '').trim();
    const allowed: ServerReferralPayoutStatus[] = ['Pending', 'Approved', 'Paid', 'Rejected'];
    if (!referralId || !allowed.includes(rawStatus as ServerReferralPayoutStatus)) {
      res.statusCode = 400;
      return res.end(
        JSON.stringify({
          ok: false,
          error: 'invalid_payload',
          message: 'Valid referralId and payoutStatus (Pending, Approved, Paid, Rejected) are required.'
        })
      );
    }

    const result = updateReferralPayoutStatus({
      referralId,
      payoutStatus: rawStatus as ServerReferralPayoutStatus,
      payoutUtr: typeof body.payoutUtr === 'string' ? body.payoutUtr : undefined,
      actorEmail: caller.email || 'admin@truedealglobal.com'
    });

    res.statusCode = result.statusCode;
    return res.end(JSON.stringify(result));
  } catch (err: any) {
    console.error('[API /api/admin/referrals] Error:', err?.message || 'unknown');
    res.statusCode = 500;
    return res.end(
      JSON.stringify({
        ok: false,
        error: 'internal_server_error',
        message: 'Unable to process admin referral payout request.'
      })
    );
  }
}
