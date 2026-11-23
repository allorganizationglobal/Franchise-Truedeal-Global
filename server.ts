import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { ingestLeadToCrm } from './src/server/leadService';
import {
  createSignedSessionToken,
  setRuntimeRoleOverride,
  getAllRuntimeRoleOverrides
} from './src/server/authService';
import { verifyFirebaseBearerToken } from './src/server/firebaseAuthVerify';
import {
  getRazorpayConfigStatus,
  createRazorpayOrder,
  verifyRazorpayPayment,
  processRazorpayWebhook,
  recordClientCheckoutAttemptEvent,
  reconcileRazorpayOrder,
  initiateRazorpayRefund,
  addRazorpayAdminNote,
  getRazorpayPersistenceAdapter
} from './src/server/razorpayService';
import { sendTransactionalFranchiseEmail } from './src/server/emailService';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);
const isProduction = process.env.NODE_ENV === 'production';

// Contact form rate limiting
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

  // Middleware for parsing JSON (capturing exact rawBody for Razorpay webhook HMAC verification) and URL-encoded bodies
  app.use(
    express.json({
      limit: '10mb',
      verify: (req: any, _res, buf) => {
        req.rawBody = buf.toString('utf8');
      }
    })
  );
  app.use(express.urlencoded({ extended: true }));

  // API Health Endpoint (never exposes secrets)
  app.get('/api/health', (_req: Request, res: Response) => {
    const razorpayStatus = getRazorpayConfigStatus();
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      crmIntegration: {
        configured: !!process.env.TRUEDEAL_LEAD_API_KEY,
        endpoint: 'https://crm.truedealglobal.com/api/leads/ingest',
        sendgridConfigured: !!process.env.SENDGRID_API_KEY
      },
      razorpayGateway: razorpayStatus,
      paymentGateway: razorpayStatus,
      security: {
        rbacActive: true,
        firebaseIdTokenVerification: true,
        sessionExpiryHours: 8,
        webhookIdempotency: true
      }
    });
  });

  // Payment Gateway Readiness Diagnostics (no secrets exposed)
  app.get('/api/payments/readiness', (_req: Request, res: Response) => {
    return res.status(200).json({
      razorpay: getRazorpayConfigStatus()
    });
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
  // RAZORPAY STANDARD WEB CHECKOUT ROUTES (Primary Gateway)
  // =========================================================================

  // 1. Create Razorpay Order (Authenticated, Server-Calculated Price & GST)
  app.post('/api/create-order', async (req: Request, res: Response) => {
    const caller = await verifyFirebaseBearerToken(req.headers.authorization);
    if (!caller.valid || !caller.uid || !caller.email) {
      return res.status(401).json({
        ok: false,
        error: 'unauthorized',
        message: caller.error || 'Please sign in with Google before initiating payment.'
      });
    }

    const body = req.body || {};
    const result = await createRazorpayOrder({
      applicationId: String(body.applicationId || ''),
      planId: String(body.planId || ''),
      paymentPurpose: body.paymentPurpose === 'application_fee' ? 'application_fee' : 'franchise_deposit',
      userId: caller.uid,
      applicantName: String(body.applicantName || caller.name || 'Franchise Applicant'),
      email: caller.email,
      phone: String(body.phone || ''),
      termsAccepted: body.termsAccepted !== false,
      forceNewOrder: Boolean(body.forceNewOrder),
      clientIp: getClientIp(req)
    });

    return res.status(result.statusCode).json(result);
  });

  // 2. Verify Razorpay Payment Signature + Fetch Capture Status
  app.post('/api/verify-payment', async (req: Request, res: Response) => {
    const caller = await verifyFirebaseBearerToken(req.headers.authorization);
    if (!caller.valid || !caller.uid) {
      return res.status(401).json({
        ok: false,
        verified: false,
        captured: false,
        error: 'unauthorized',
        message: caller.error || 'Authentication required to verify payment.'
      });
    }

    const body = req.body || {};
    const result = await verifyRazorpayPayment({
      razorpay_order_id: String(body.razorpay_order_id || ''),
      razorpay_payment_id: String(body.razorpay_payment_id || ''),
      razorpay_signature: String(body.razorpay_signature || ''),
      applicationId: body.applicationId ? String(body.applicationId) : undefined,
      callerUid: caller.uid,
      callerIsAdmin: Boolean(caller.isAdmin),
      clientIp: getClientIp(req)
    });

    return res.status(result.statusCode).json(result);
  });

  // 3. Razorpay Webhook Endpoint (Raw Body HMAC-SHA256 Verification + Event Deduplication)
  app.post('/api/webhooks/razorpay', async (req: Request, res: Response) => {
    const rawBody =
      typeof (req as any).rawBody === 'string'
        ? (req as any).rawBody
        : typeof req.body === 'string'
        ? req.body
        : JSON.stringify(req.body || {});

    const result = await processRazorpayWebhook({
      rawBody,
      signatureHeader: (req.headers['x-razorpay-signature'] as string) || '',
      eventIdHeader: (req.headers['x-razorpay-event-id'] as string) || undefined
    });

    return res.status(result.statusCode).json({
      ok: result.ok,
      duplicate: Boolean(result.duplicate),
      eventId: result.eventId || null,
      eventType: result.eventType || null,
      paymentStatus: result.paymentStatus || null,
      error: result.error,
      message: result.message
    });
  });

  // 4. Razorpay Config Readiness & Authenticated Owner/Admin Status Lookup
  app.get('/api/payments/razorpay/status', async (req: Request, res: Response) => {
    if (req.query.mode === 'config') {
      return res.status(200).json({ ok: true, config: getRazorpayConfigStatus() });
    }

    const caller = await verifyFirebaseBearerToken(req.headers.authorization);
    if (!caller.valid || !caller.uid) {
      return res.status(401).json({ ok: false, error: 'unauthorized', message: caller.error || 'Authentication required.' });
    }

    const orderId = String(req.query.orderId || '').trim();
    const applicationId = String(req.query.applicationId || '').trim();
    const store = getRazorpayPersistenceAdapter();

    if (orderId) {
      const payment = await store.getPaymentByOrderId(orderId);
      if (!payment) {
        return res.status(404).json({ ok: false, error: 'not_found', message: 'Razorpay order not found.' });
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

    return res.status(400).json({ ok: false, error: 'missing_query', message: 'Provide mode=config, orderId, or applicationId.' });
  });

  app.post('/api/payments/razorpay/status', async (req: Request, res: Response) => {
    const caller = await verifyFirebaseBearerToken(req.headers.authorization);
    if (!caller.valid || !caller.uid) {
      return res.status(401).json({ ok: false, error: 'unauthorized', message: caller.error || 'Authentication required.' });
    }
    const body = req.body || {};
    const targetOrderId = String(body.razorpayOrderId || '').trim();
    const outcome = body.outcome === 'failed' ? 'failed' : body.outcome === 'cancelled' ? 'cancelled' : null;
    if (!targetOrderId || !outcome) {
      return res.status(400).json({ ok: false, error: 'invalid_payload' });
    }
    const result = await recordClientCheckoutAttemptEvent({
      razorpayOrderId: targetOrderId,
      callerUid: caller.uid,
      callerIsAdmin: Boolean(caller.isAdmin),
      outcome,
      reason: body.reason ? String(body.reason).slice(0, 300) : undefined,
      razorpayPaymentId: body.razorpayPaymentId ? String(body.razorpayPaymentId).slice(0, 128) : undefined
    });
    return res.status(result.statusCode).json(result);
  });

  // 5. Admin Razorpay Payments Ledger, Stats, Reconciliation & Refund Management (Strictly Admin-Only)
  app.get('/api/admin/payments', async (req: Request, res: Response) => {
    const caller = await verifyFirebaseBearerToken(req.headers.authorization);
    if (!caller.valid || !caller.uid) {
      return res.status(401).json({ ok: false, error: 'unauthorized', message: caller.error || 'Authentication required.' });
    }
    if (!caller.isAdmin) {
      return res.status(403).json({ ok: false, error: 'forbidden', message: 'Administrator role required.' });
    }

    const rzpStore = getRazorpayPersistenceAdapter();
    const [razorpayPayments, razorpayWebhooks] = await Promise.all([
      rzpStore.getAllPayments(),
      rzpStore.getAllWebhookEvents()
    ]);

    const razorpayStats = {
      totalTransactions: razorpayPayments.length,
      capturedCount: razorpayPayments.filter((p) => p.paymentStatus === 'CAPTURED').length,
      pendingCount: razorpayPayments.filter((p) =>
        p.paymentStatus === 'CREATED' ||
        p.paymentStatus === 'PENDING' ||
        p.paymentStatus === 'AUTHORIZED' ||
        p.paymentStatus === 'VERIFICATION_REQUIRED'
      ).length,
      failedCount: razorpayPayments.filter((p) => p.paymentStatus === 'FAILED' || p.paymentStatus === 'CANCELLED').length,
      refundInitiatedCount: razorpayPayments.filter((p) => p.paymentStatus === 'REFUND_INITIATED').length,
      refundedCount: razorpayPayments.filter((p) => p.paymentStatus === 'REFUNDED').length,
      totalCapturedCollectionsINR: razorpayPayments
        .filter((p) => p.paymentStatus === 'CAPTURED')
        .reduce((sum, p) => sum + p.finalAmountINR, 0),
      gatewayConfig: getRazorpayConfigStatus()
    };

    return res.status(200).json({
      ok: true,
      razorpayStats,
      razorpayPayments,
      razorpayWebhooks
    });
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

    if (action === 'razorpay_reconcile') {
      const orderId = String(req.body?.orderId || '').trim();
      if (!orderId) return res.status(400).json({ ok: false, error: 'missing_order_id' });
      const result = await reconcileRazorpayOrder(orderId);
      return res.status(result.statusCode).json(result);
    }

    if (action === 'razorpay_refund') {
      const orderId = String(req.body?.orderId || '').trim();
      const reason = String(req.body?.reason || 'Administrative franchise refund').trim();
      if (!orderId) return res.status(400).json({ ok: false, error: 'missing_order_id' });
      const result = await initiateRazorpayRefund({
        orderId,
        reason,
        actorEmail: caller.email || 'admin@truedealglobal.com'
      });
      return res.status(result.statusCode).json(result);
    }

    if (action === 'razorpay_add_note') {
      const orderId = String(req.body?.orderId || '').trim();
      const note = String(req.body?.note || '').trim();
      if (!orderId || !note) return res.status(400).json({ ok: false, error: 'missing_fields' });
      const result = await addRazorpayAdminNote({
        orderId,
        note,
        actorEmail: caller.email || 'admin@truedealglobal.com'
      });
      return res.status(result.statusCode).json(result);
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

  // Legacy Payment Webhook Alias -> Strictly routes to Razorpay raw-body HMAC verification
  app.post('/api/webhooks/payment', async (req: Request, res: Response) => {
    const rawBody =
      typeof (req as any).rawBody === 'string'
        ? (req as any).rawBody
        : typeof req.body === 'string'
        ? req.body
        : JSON.stringify(req.body || {});

    const result = await processRazorpayWebhook({
      rawBody,
      signatureHeader: (req.headers['x-razorpay-signature'] as string) || '',
      eventIdHeader: (req.headers['x-razorpay-event-id'] as string) || undefined
    });

    return res.status(result.statusCode).json({
      ok: result.ok,
      duplicate: Boolean(result.duplicate),
      eventId: result.eventId || null,
      eventType: result.eventType || null,
      paymentStatus: result.paymentStatus || null,
      error: result.error,
      message: result.message
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
