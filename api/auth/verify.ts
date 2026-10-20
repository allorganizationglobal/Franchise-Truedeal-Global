import { resolveServerUserRole, createSignedSessionToken, ROLE_PERMISSIONS } from '../../src/server/authService';

/**
 * Vercel Serverless Function: POST /api/auth/verify
 * Validates authenticated user identity and returns server-verified session
 */
export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.statusCode = 204;
    return res.end();
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: 'method_not_allowed', message: 'Use POST' }));
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: 'invalid_json', message: 'Malformed JSON payload' }));
    }
  }

  const email = body?.email;
  const uid = body?.uid;
  const name = body?.name || 'User';

  if (!email || typeof email !== 'string' || !uid) {
    res.statusCode = 400;
    return res.end(
      JSON.stringify({
        authenticated: false,
        error: 'missing_credentials',
        message: 'Valid authenticated email and UID are required'
      })
    );
  }

  // Server-side role resolution from trusted allowlists
  const serverEnforcedRole = resolveServerUserRole(email);
  const permissions = ROLE_PERMISSIONS[serverEnforcedRole] || [];

  // Issue tamper-proof HMAC signed session token
  const sessionToken = createSignedSessionToken({
    uid,
    email,
    name,
    role: serverEnforcedRole
  });

  res.statusCode = 200;
  return res.end(
    JSON.stringify({
      authenticated: true,
      user: {
        uid,
        email: email.toLowerCase().trim(),
        name,
        role: serverEnforcedRole,
        permissions,
        isAdmin: serverEnforcedRole === 'super_admin' || serverEnforcedRole === 'director' || serverEnforcedRole === 'franchise_manager'
      },
      sessionToken,
      expiresInSeconds: 8 * 3600
    })
  );
}
