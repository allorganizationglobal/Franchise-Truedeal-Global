import { createSignedSessionToken } from '../../src/server/authService.js';
import { verifyFirebaseBearerToken } from '../../src/server/firebaseAuthVerify.js';

/**
 * Vercel Serverless Function: POST /api/auth/verify
 * Cryptographically verifies a Firebase Auth ID token (never trusts client-supplied email/uid/role)
 * and issues a signed server session token with server-resolved RBAC permissions.
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

  const verified = await verifyFirebaseBearerToken(req.headers?.authorization, body?.idToken);
  if (!verified.valid || !verified.uid || !verified.email || !verified.role) {
    res.statusCode = 401;
    return res.end(
      JSON.stringify({
        authenticated: false,
        error: 'unauthorized',
        message: verified.error || 'Valid Firebase ID token is required.'
      })
    );
  }

  const sessionToken = createSignedSessionToken({
    uid: verified.uid,
    email: verified.email,
    name: verified.name || 'Authorized User',
    role: verified.role
  });

  res.statusCode = 200;
  return res.end(
    JSON.stringify({
      authenticated: true,
      user: {
        uid: verified.uid,
        email: verified.email,
        name: verified.name,
        role: verified.role,
        permissions: verified.permissions || [],
        isAdmin: Boolean(verified.isAdmin)
      },
      sessionToken,
      expiresInSeconds: 8 * 3600
    })
  );
}
