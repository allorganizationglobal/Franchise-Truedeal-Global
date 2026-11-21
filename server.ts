import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { ingestLeadToCrm } from './src/server/leadService';
import {
  createSignedSessionToken,
  setRuntimeRoleOverride,
  getAllRuntimeRoleOverrides
} from './src/server/authService';
import { verifyFirebaseBearerToken } from './src/server/firebaseAuthVerify';
import {
  getPayUConfigStatus,
  initiatePayUPaymentOrder,
  processPayUGatewayResponse,
  reconcilePayUTransaction,
  getPayUPersistenceAdapter,
  timingSafeHexEquals
} from './src/server/payuService';
import { sendTransactionalFranchiseEmail } from './src/server/emailService';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);
const isProduction = process.env.NODE_ENV === 'production';

// Webhook idempotency memory cache & contact form rate limiting
const processedWebhookTxIds = new Set<string>();
const contactRateLimitMap = new Map<string, { count: number; resetAt: number }>();

function getClientIp(req: Request): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    '127.0.0.1'
  );
}

async function createServer() {
  const app = express();

  // Security headers matching Vercel production configuration
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=()');
    next();
  });

  // Middleware for parsing JSON and URL-encoded bodies (PayU sends application/x-www-form-urlencoded)
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // API Health Endpoint (never exposes secrets)
  app.get('/api/health', (_req: Request, res: Response) => {
    const payuStatus = getPayUConfigStatus();
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      crmIntegration: {
        configured: !!process.env.TRUEDEAL_LEAD_API_KEY,
        endpoint: 'https://crm.truedealglobal.com/api/leads/ingest',
        sendgridConfigured: !!process.env.SENDGRID_API_KEY
      },
      paymentGateway: payuStatus,
      security: {
        rbacActive: true,
        firebaseIdTokenVerification: true,
        sessionExpiryHours: 8,
        webhookIdempotency: true
      }
    });
  });

  // PayU Classic Hosted Checkout Readiness Diagnostics (no secrets exposed)
  app.get('/api/payments/readiness', (_req: Request, res: Response) => {
    return res.status(200).json(getPayUConfigStatus());
  });

  // Server-Validated Contact Us Inquiry Endpoint
  app.post('/api/contact', async (req: Request, res: Response) => {
    const clientIp = getClientIp(req);

    const now = Date.now();
    const rl = contactRateLimitMap.get(clientIp);
    if (rl && now <= rl.resetAt && rl.count >= 5) {
      return res.status(429).json({
        success: false,
        error: 'rate_limited',
        message:
          'Too many inquiries submitted recently. Please wait a few minutes or email info@truedealglobal.com directly.'
      });
    }
    contactRateLimitMap.set(clientIp, {
      count: rl && now <= rl.resetAt ? rl.count + 1 : 1,
      resetAt: rl && now <= rl.resetAt ? rl.resetAt : now + 10 * 60 * 1000
    });

    const body = req.body || {};
    if (body.website && String(body.website).trim().length > 0) {
      return res.status(400).json({ success: false, error: 'spam_detected', message: 'Invalid submission.' });
    }

    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const phone = String(body.phone || '').trim();
    const subject = String(body.subject || 'General Inquiry').trim();
    const inquiryType = String(body.inquiryType || 'franchise_inquiry').trim();
    const message = String(body.message || '').trim();
    const consent = body.consent === true;

    if (name.length < 2 || name.length > 120) {
      return res.status(400).json({ success: false, error: 'invalid_name', message: 'Please enter your full name (2–120 characters).' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, error: 'invalid_email', message: 'Please provide a valid email address.' });
    }
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) {
      return res.status(400).json({ success: false, error: 'invalid_phone', message: 'Please provide a valid telephone or mobile number.' });
    }
    if (message.length < 10 || message.length > 3000) {
      return res.status(400).json({ success: false, error: 'invalid_message', message: 'Please enter a message of at least 10 characters.' });
    }
    if (!consent) {
      return res.status(400).json({ success: false, error: 'consent_required', message: 'Please provide consent to be contacted regarding your inquiry.' });
    }

    const referenceCode = `TDG-INQ-${Date.now().toString().slice(-6)}`;
    let crmSynced = false;
    let emailDispatched = false;

    if (process.env.TRUEDEAL_LEAD_API_KEY) {
      try {
        const crmRes = await ingestLeadToCrm(
          {
            name,
            email,
            phone,
            service: `Contact Inquiry (${inquiryType}): ${subject}`,
            sourceWebsite: 'https://businessfranchise.truedealglobal.com/contact',
            message,
            consent: true
          },
          clientIp
        );
        crmSynced = crmRes.success;
        emailDispatched = Boolean(crmRes.emailDispatched);
      } catch {
        // Non-blocking fallback
      }
    }

    return res.status(201).json({
      success: true,
      referenceCode,
      receivedAt: new Date().toISOString(),
      crmSynced,
      emailDispatched,
      message: `Your inquiry (${referenceCode}) has been received by TRUEDEAL GLOBAL OPC PVT LTD. Our support desk will reply within 1–2 business days.`
    });
  });

  // Auth Verification & Token Issuance Endpoint (Cryptographically verifies Firebase ID Token)
  app.post('/api/auth/verify', async (req: Request, res: Response) => {
    const idToken = typeof req.body?.idToken === 'string' ? req.body.idToken : undefined;
    const verified = await verifyFirebaseBearerToken(req.headers.authorization, idToken);

    if (!verified.valid || !verified.uid || !verified.email || !verified.role) {
      return res.status(401).json({
        authenticated: false,
        error: 'invalid_firebase_token',
        message: verified.error || 'Valid verified Firebase ID token is required.'
      });
    }

    const sessionToken = createSignedSessionToken({
      uid: verified.uid,
      email: verified.email,
      name: verified.name || 'Authorized User',
      role: verified.role
    });

    return res.status(200).json({
      authenticated: true,
      user: {
        uid: verified.uid,
        email: verified.email,
        name: verified.name || 'Authorized User',
        role: verified.role,
        permissions: verified.permissions || [],
        isAdmin: Boolean(verified.isAdmin)
      },
      sessionToken,
      expiresInSeconds: 8 * 3600
    });
  });

  // =========================================================================
  // PAYU INDIA CLASSIC HOSTED CHECKOUT ROUTES
  // =========================================================================

  // 1. Initiate PayU Payment Order (Authenticated, Server-Calculated Amount & SHA-512 Hash)
  app.post('/api/payments/payu/initiate', async (req: Request, res: Response) => {
    const caller = await verifyFirebaseBearerToken(req.headers.authorization);
    if (!caller.valid || !caller.uid || !caller.email) {
      return res.status(401).json({
        ok: false,
        error: 'unauthorized',
        message: caller.error || 'Please sign in with Google before initiating payment.'
      });
    }

    const body = req.body || {};
    const host = req.headers.host;
    const proto = (req.headers['x-forwarded-proto'] as string) || 'http';
    const inferredOrigin = host ? `${proto}://${host}` : undefined;

    const result = await initiatePayUPaymentOrder({
      applicationId: String(body.applicationId || ''),
      planId: String(body.planId || ''),
      userId: caller.uid,
      applicantName: String(body.applicantName || caller.name || 'Franchise Applicant'),
      email: caller.email,
      phone: String(body.phone || ''),
      clientSuppliedAmount: typeof body.amount === 'number' ? body.amount : undefined,
      clientIp: getClientIp(req),
      appBaseUrlOverride: process.env.APP_BASE_URL || inferredOrigin
    });

    return res.status(result.statusCode).json(result);
  });

  // 2. PayU Browser Redirect Callback (surl / furl — POST form-urlencoded)
  app.post('/api/payments/payu/callback', async (req: Request, res: Response) => {
    const body = req.body || {};
    const result = await processPayUGatewayResponse(body, 'callback');
    const txnid = encodeURIComponent(String(body.txnid || result.payment?.txnId || ''));
    const appId = encodeURIComponent(String(result.payment?.applicationId || body.udf1 || ''));
    const statusParam = encodeURIComponent(result.finalStatus);
    const reasonParam = result.error ? `&reason=${encodeURIComponent(result.error)}` : '';

    return res.redirect(303, `/payment-result?txnid=${txnid}&applicationId=${appId}&status=${statusParam}${reasonParam}`);
  });

  // 3. PayU Server-to-Server Webhook (POST)
  app.post('/api/payments/payu/webhook', async (req: Request, res: Response) => {
    const body = req.body || {};
    const webhookSig =
      (req.headers['x-payu-signature'] as string) ||
      (req.headers['x-webhook-signature'] as string) ||
      undefined;

    const result = await processPayUGatewayResponse(body, 'webhook', webhookSig);
    return res.status(result.statusCode).json({
      ok: result.ok,
      duplicate: Boolean(result.duplicate),
      finalStatus: result.finalStatus,
      txnid: result.payment?.txnId || body?.txnid || null,
      receiptNumber: result.payment?.receiptNumber || null,
      error: result.error,
      message: result.message
    });
  });

  // 4. Independent PayU `verify_payment` Reconciliation (Authenticated Owner or Admin)
  app.post('/api/payments/payu/verify', async (req: Request, res: Response) => {
    const caller = await verifyFirebaseBearerToken(req.headers.authorization);
    if (!caller.valid || !caller.uid) {
      return res.status(401).json({ ok: false, error: 'unauthorized', message: caller.error || 'Authentication required.' });
    }

    const txnid = String(req.body?.txnid || '').trim();
    if (!txnid) {
      return res.status(400).json({ ok: false, error: 'missing_txnid', message: 'Transaction ID is required.' });
    }

    const store = getPayUPersistenceAdapter();
    const existing = await store.getPaymentByTxnId(txnid);
    if (!existing) {
      return res.status(404).json({ ok: false, error: 'not_found', message: 'Transaction not found.' });
    }

    if (!caller.isAdmin && existing.userId !== caller.uid) {
      return res.status(403).json({ ok: false, error: 'forbidden', message: 'You are not authorized to verify this transaction.' });
    }

    const result = await reconcilePayUTransaction(txnid);
    return res.status(result.statusCode).json(result);
  });

  // 5. Query Authoritative Payment Status (Public config check OR Authenticated Owner/Admin status lookup)
  app.get('/api/payments/payu/status', async (req: Request, res: Response) => {
    if (req.query.mode === 'config') {
      return res.status(200).json({ ok: true, config: getPayUConfigStatus() });
    }

    const caller = await verifyFirebaseBearerToken(req.headers.authorization);
    if (!caller.valid || !caller.uid) {
      return res.status(401).json({ ok: false, error: 'unauthorized', message: caller.error || 'Authentication required.' });
    }

    const txnid = String(req.query.txnid || '').trim();
    const applicationId = String(req.query.applicationId || '').trim();
    const store = getPayUPersistenceAdapter();

    if (txnid) {
      const payment = await store.getPaymentByTxnId(txnid);
      if (!payment) {
        return res.status(404).json({ ok: false, error: 'not_found', message: 'Payment record not found.' });
      }
      if (!caller.isAdmin && payment.userId !== caller.uid) {
        return res.status(403).json({ ok: false, error: 'forbidden', message: 'Unauthorized access to payment record.' });
      }
      return res.status(200).json({ ok: true, payment });
    }

    if (applicationId) {
      const payments = await store.getPaymentsByApplicationId(applicationId);
      const visible = caller.isAdmin ? payments : payments.filter((p) => p.userId === caller.uid);
      return res.status(200).json({ ok: true, payments: visible });
    }

    return res.status(400).json({ ok: false, error: 'missing_query', message: 'Provide txnid, applicationId, or mode=config.' });
  });

  // 6. Admin Payments Ledger, Stats, Reconciliation & Refund State Management (Strictly Admin-Only)
  app.get('/api/admin/payments', async (req: Request, res: Response) => {
    const caller = await verifyFirebaseBearerToken(req.headers.authorization);
    if (!caller.valid || !caller.uid) {
      return res.status(401).json({ ok: false, error: 'unauthorized', message: caller.error || 'Authentication required.' });
    }
    if (!caller.isAdmin) {
      return res.status(403).json({ ok: false, error: 'forbidden', message: 'Administrator role required.' });
    }

    const store = getPayUPersistenceAdapter();
    const payments = await store.getAllPayments();
    const webhookEvents = await store.getAllWebhookEvents();

    const stats = {
      totalTransactions: payments.length,
      pendingCount: payments.filter((p) => p.paymentStatus === 'PAYMENT_PENDING' || p.paymentStatus === 'CREATED' || p.paymentStatus === 'UNDER_REVIEW').length,
      successCount: payments.filter((p) => p.paymentStatus === 'SUCCESS').length,
      failedCount: payments.filter((p) => p.paymentStatus === 'FAILED' || p.paymentStatus === 'CANCELLED' || p.paymentStatus === 'EXPIRED').length,
      refundPendingCount: payments.filter((p) => p.paymentStatus === 'REFUND_PENDING').length,
      refundedCount: payments.filter((p) => p.paymentStatus === 'REFUNDED').length,
      totalVerifiedCollectionsINR: payments
        .filter((p) => p.paymentStatus === 'SUCCESS')
        .reduce((sum, p) => sum + p.amount, 0)
    };

    return res.status(200).json({ ok: true, stats, payments, webhookEvents });
  });

  app.post('/api/admin/payments', async (req: Request, res: Response) => {
    const caller = await verifyFirebaseBearerToken(req.headers.authorization);
    if (!caller.valid || !caller.uid) {
      return res.status(401).json({ ok: false, error: 'unauthorized', message: caller.error || 'Authentication required.' });
    }
    if (!caller.isAdmin) {
      return res.status(403).json({ ok: false, error: 'forbidden', message: 'Administrator role required.' });
    }

    const action = String(req.body?.action || '').trim();
    const txnid = String(req.body?.txnid || '').trim();
    if (!txnid) {
      return res.status(400).json({ ok: false, error: 'missing_txnid' });
    }

    if (action === 'reconcile') {
      const result = await reconcilePayUTransaction(txnid);
      return res.status(result.statusCode).json(result);
    }

    const store = getPayUPersistenceAdapter();
    if (action === 'mark_refund_pending' || action === 'mark_refunded') {
      const rec = await store.getPaymentByTxnId(txnid);
      if (!rec) {
        return res.status(404).json({ ok: false, error: 'not_found' });
      }
      if (rec.paymentStatus !== 'SUCCESS' && rec.paymentStatus !== 'REFUND_PENDING') {
        return res.status(400).json({
          ok: false,
          error: 'invalid_refund_state',
          message: 'Only verified SUCCESS or REFUND_PENDING transactions can transition to refund states.'
        });
      }
      rec.paymentStatus = action === 'mark_refunded' ? 'REFUNDED' : 'REFUND_PENDING';
      rec.updatedAt = new Date().toISOString();
      await store.savePayment(rec);
      return res.status(200).json({ ok: true, payment: rec });
    }

    return res.status(400).json({ ok: false, error: 'unsupported_action' });
  });

  // 7. Admin Application Approval / Rejection Transactional Email Trigger (Admin-Only)
  app.post('/api/admin/applications/notify', async (req: Request, res: Response) => {
    const caller = await verifyFirebaseBearerToken(req.headers.authorization);
    if (!caller.valid || !caller.uid) {
      return res.status(401).json({ ok: false, error: 'unauthorized', message: caller.error || 'Authentication required.' });
    }
    if (!caller.isAdmin) {
      return res.status(403).json({ ok: false, error: 'forbidden', message: 'Administrator role required.' });
    }

    const { event, toEmail, applicantName, applicationId, planName, reason } = req.body || {};
    if (
      (event !== 'application_approved' && event !== 'application_rejected' && event !== 'application_submitted') ||
      !toEmail ||
      !applicationId
    ) {
      return res.status(400).json({ ok: false, error: 'invalid_payload', message: 'Valid event, toEmail, and applicationId are required.' });
    }

    const emailRes = await sendTransactionalFranchiseEmail({
      event,
      toEmail: String(toEmail),
      applicantName: String(applicantName || 'Franchise Applicant'),
      applicationId: String(applicationId),
      planName: String(planName || 'TRUEDEAL GLOBAL Franchise Plan'),
      reason: reason ? String(reason) : undefined
    });

    return res.status(200).json({
      ok: true,
      emailDispatched: emailRes.sent,
      reason: emailRes.skippedReason || emailRes.error || null
    });
  });

  // Legacy Payment Webhook Handler (Routes PayU payloads cleanly or validates HMAC timing-safely)
  app.post('/api/webhooks/payment', async (req: Request, res: Response) => {
    const body = req.body || {};
    if (body?.txnid && body?.hash && body?.key) {
      const result = await processPayUGatewayResponse(
        body,
        'webhook',
        (req.headers['x-payu-signature'] as string) || (req.headers['x-webhook-signature'] as string) || undefined
      );
      return res.status(result.statusCode).json(result);
    }

    const webhookSecret = process.env.PAYU_WEBHOOK_SECRET || process.env.PAYMENT_WEBHOOK_SECRET;
    const providedSig =
      (req.headers['x-payu-signature'] as string) ||
      (req.headers['x-webhook-signature'] as string) ||
      '';

    if (webhookSecret) {
      const expectedSig = crypto
        .createHmac('sha256', webhookSecret)
        .update(JSON.stringify(body))
        .digest('hex');
      if (!timingSafeHexEquals(expectedSig, providedSig)) {
        return res.status(401).json({ error: 'invalid_signature', message: 'Signature verification failed' });
      }
    } else {
      return res.status(503).json({ error: 'webhook_not_configured', message: 'Payment webhook secret is not configured.' });
    }

    const paymentData = body?.data || body;
    const transactionId = paymentData?.id || paymentData?.transactionId || paymentData?.referenceCode;
    if (!transactionId) {
      return res.status(400).json({ error: 'missing_transaction_id' });
    }

    if (processedWebhookTxIds.has(transactionId)) {
      return res.status(200).json({
        success: true,
        status: 'duplicate_acknowledged',
        transactionId
      });
    }

    processedWebhookTxIds.add(transactionId);
    return res.status(200).json({
      success: true,
      status: 'processed',
      transactionId,
      timestamp: new Date().toISOString()
    });
  });

  // CRM Lead Ingestion Endpoints
  const handleLeadIngest = async (req: Request, res: Response) => {
    const clientIp = getClientIp(req);

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

  // Admin Reports CSV Export (Protected by Firebase ID token + permission)
  app.get('/api/admin/export', async (req: Request, res: Response) => {
    const caller = await verifyFirebaseBearerToken(req.headers.authorization);
    if (!caller.valid || !caller.uid) {
      return res.status(401).json({ error: 'unauthorized', message: 'Valid administrator session required' });
    }

    if (!caller.permissions?.includes('export_reports')) {
      return res.status(403).json({ error: 'forbidden', message: 'Insufficient role permissions to export reports' });
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="truedeal_franchise_applications.csv"');

    const csvHeader = 'ID,Applicant Name,Email,Phone,City,Country,Plan,Liquid Capital,Status,Submitted At\n';
    return res.status(200).send(csvHeader);
  });

  // Admin Role Management (Protected to Super Admin via Firebase ID token)
  app.post('/api/admin/roles', async (req: Request, res: Response) => {
    const caller = await verifyFirebaseBearerToken(req.headers.authorization);
    if (!caller.valid || !caller.email) {
      return res.status(401).json({ error: 'unauthorized', message: 'Valid administrator session required' });
    }

    const { targetEmail, newRole } = req.body || {};
    if (!targetEmail || !newRole) {
      return res.status(400).json({ error: 'missing_fields', message: 'targetEmail and newRole are required' });
    }

    const result = setRuntimeRoleOverride(targetEmail, newRole, caller.email);
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

createServer().catch((err) => {
  console.error('[Server Error] Failed to bootstrap server:', err);
  process.exit(1);
});
