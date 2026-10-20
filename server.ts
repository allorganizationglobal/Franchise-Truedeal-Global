import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { ingestLeadToCrm } from './src/server/leadService';
import {
  resolveServerUserRole,
  createSignedSessionToken,
  verifySessionToken,
  ROLE_PERMISSIONS,
  setRuntimeRoleOverride,
  getAllRuntimeRoleOverrides
} from './src/server/authService';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);
const isProduction = process.env.NODE_ENV === 'production';

// Webhook idempotency memory cache
const processedWebhookTxIds = new Set<string>();

async function createServer() {
  const app = express();

  // Middleware for parsing JSON bodies
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // API Health Endpoint
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      crmIntegration: {
        configured: !!process.env.TRUEDEAL_LEAD_API_KEY,
        endpoint: 'https://crm.truedealglobal.com/api/leads/ingest',
        sendgridConfigured: !!process.env.SENDGRID_API_KEY
      },
      security: {
        rbacActive: true,
        sessionExpiryHours: 8,
        webhookIdempotency: true
      }
    });
  });

  // Auth Verification & Token Issuance Endpoint
  app.post('/api/auth/verify', (req: Request, res: Response) => {
    const { email, uid, name } = req.body || {};
    if (!email || typeof email !== 'string' || !uid) {
      return res.status(400).json({
        authenticated: false,
        error: 'missing_credentials',
        message: 'Valid authenticated email and UID are required'
      });
    }

    const serverEnforcedRole = resolveServerUserRole(email);
    const permissions = ROLE_PERMISSIONS[serverEnforcedRole] || [];

    const sessionToken = createSignedSessionToken({
      uid,
      email,
      name: name || 'Authorized User',
      role: serverEnforcedRole
    });

    return res.status(200).json({
      authenticated: true,
      user: {
        uid,
        email: email.toLowerCase().trim(),
        name: name || 'Authorized User',
        role: serverEnforcedRole,
        permissions,
        isAdmin:
          serverEnforcedRole === 'super_admin' ||
          serverEnforcedRole === 'director' ||
          serverEnforcedRole === 'franchise_manager'
      },
      sessionToken,
      expiresInSeconds: 8 * 3600
    });
  });

  // Payment Webhook Handler (Idempotent)
  app.post('/api/webhooks/payment', (req: Request, res: Response) => {
    const body = req.body || {};
    const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET;
    const providedSig =
      (req.headers['x-webhook-signature'] as string) ||
      (req.headers['x-razorpay-signature'] as string) ||
      '';

    if (webhookSecret) {
      const rawPayload = JSON.stringify(body);
      const expectedSig = crypto.createHmac('sha256', webhookSecret).update(rawPayload).digest('hex');
      if (providedSig !== expectedSig) {
        return res.status(401).json({ error: 'invalid_signature', message: 'Signature verification failed' });
      }
    }

    const paymentData = body?.payload?.payment?.entity || body?.data || body;
    const transactionId = paymentData?.id || paymentData?.transactionId || paymentData?.referenceCode;
    const applicationId = paymentData?.notes?.applicationId || body?.applicationId;
    const amount = paymentData?.amount ? paymentData.amount / 100 : body?.amount;
    const currency = paymentData?.currency || body?.currency || 'INR';

    if (!transactionId) {
      return res.status(400).json({ error: 'missing_transaction_id' });
    }

    if (processedWebhookTxIds.has(transactionId)) {
      return res.status(200).json({
        success: true,
        status: 'duplicate_acknowledged',
        transactionId,
        message: 'Transaction already processed'
      });
    }

    processedWebhookTxIds.add(transactionId);

    return res.status(200).json({
      success: true,
      status: 'processed',
      transactionId,
      applicationId: applicationId || null,
      amount,
      currency,
      timestamp: new Date().toISOString(),
      message: 'Payment verification recorded successfully on server'
    });
  });

  // CRM Lead Ingestion Endpoints
  const handleLeadIngest = async (req: Request, res: Response) => {
    const clientIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      '127.0.0.1';

    try {
      const result = await ingestLeadToCrm(req.body, clientIp);
      res.status(result.statusCode).json(result);
    } catch (err: any) {
      console.error('[Server Lead Ingest] Uncaught error:', err);
      res.status(500).json({
        success: false,
        statusCode: 500,
        status: 'crm_error',
        message: 'Internal server error processing franchise lead.'
      });
    }
  };

  app.post('/api/leads/ingest', handleLeadIngest);
  app.post('/api/leads', handleLeadIngest);

  // Admin Reports CSV Export (Protected)
  app.get('/api/admin/export', (req: Request, res: Response) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const verification = verifySessionToken(token);

    if (!verification.valid || !verification.session) {
      return res.status(401).json({ error: 'unauthorized', message: 'Valid administrator session required' });
    }

    if (!verification.session.permissions.includes('export_reports')) {
      return res.status(403).json({ error: 'forbidden', message: 'Insufficient role permissions to export reports' });
    }

    // Return header
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="truedeal_franchise_applications.csv"');

    const csvHeader = 'ID,Applicant Name,Email,Phone,City,Country,Plan,Liquid Capital,Status,Submitted At\n';
    return res.status(200).send(csvHeader);
  });

  // Admin Role Management (Protected to Super Admin)
  app.post('/api/admin/roles', (req: Request, res: Response) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const verification = verifySessionToken(token);

    if (!verification.valid || !verification.session) {
      return res.status(401).json({ error: 'unauthorized', message: 'Valid administrator session required' });
    }

    const { targetEmail, newRole } = req.body || {};
    if (!targetEmail || !newRole) {
      return res.status(400).json({ error: 'missing_fields', message: 'targetEmail and newRole are required' });
    }

    const result = setRuntimeRoleOverride(targetEmail, newRole, verification.session.email);
    if (!result.success) {
      return res.status(403).json({ error: 'forbidden', message: result.message });
    }

    return res.status(200).json({
      success: true,
      message: result.message,
      overrides: getAllRuntimeRoleOverrides()
    });
  });

  // Development vs Production serving
  if (!isProduction) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        port: PORT
      },
      appType: 'spa'
    });

    app.use(vite.middlewares);
  } else {
    // In production, serve built static assets from dist
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));

    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[TRUEDEAL GLOBAL] Full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

createServer().catch(err => {
  console.error('[Server Error] Failed to bootstrap server:', err);
  process.exit(1);
});
