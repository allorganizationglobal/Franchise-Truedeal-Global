import { verifyFirebaseBearerToken } from '../../../src/server/firebaseAuthVerify.js';
import { sendTransactionalFranchiseEmail } from '../../../src/server/emailService.js';

/**
 * Vercel Serverless Function: POST /api/admin/applications/notify
 * Triggers server-side SendGrid transactional emails on admin approval/rejection decisions.
 * Strictly requires an authenticated administrator Firebase ID token.
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

  if (!caller.isAdmin) {
    res.statusCode = 403;
    return res.end(JSON.stringify({ ok: false, error: 'forbidden', message: 'Administrator role required.' }));
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

  const { event, toEmail, applicantName, applicationId, planName, reason } = body || {};
  if (
    (event !== 'application_approved' && event !== 'application_rejected' && event !== 'application_submitted') ||
    !toEmail ||
    !applicationId
  ) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: 'invalid_payload', message: 'Valid event, toEmail, and applicationId are required.' }));
  }

  const emailRes = await sendTransactionalFranchiseEmail({
    event,
    toEmail: String(toEmail),
    applicantName: String(applicantName || 'Franchise Applicant'),
    applicationId: String(applicationId),
    planName: String(planName || 'TRUEDEAL GLOBAL Franchise Plan'),
    reason: reason ? String(reason) : undefined
  });

  res.statusCode = 200;
  return res.end(
    JSON.stringify({
      ok: true,
      emailDispatched: emailRes.sent,
      reason: emailRes.skippedReason || emailRes.error || null
    })
  );
}
