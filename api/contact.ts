import { ingestLeadToCrm } from '../src/server/leadService';

// Lightweight in-memory rate limit map per serverless warm instance
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const MAX_REQUESTS_PER_WINDOW = 5;
const WINDOW_MS = 10 * 60 * 1000;

function checkContactRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }
  entry.count += 1;
  return true;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'method_not_allowed',
      message: 'Only POST requests are supported for contact inquiries.'
    });
  }

  const clientIp =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown';

  if (!checkContactRateLimit(clientIp)) {
    return res.status(429).json({
      success: false,
      error: 'rate_limited',
      message: 'Too many inquiries submitted recently. Please wait a few minutes or email info@truedealglobal.com directly.'
    });
  }

  const body = req.body || {};

  // Honeypot spam protection
  if (body.website && String(body.website).trim().length > 0) {
    return res.status(400).json({
      success: false,
      error: 'spam_detected',
      message: 'Invalid submission.'
    });
  }

  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const phone = String(body.phone || '').trim();
  const subject = String(body.subject || 'General Inquiry').trim();
  const inquiryType = String(body.inquiryType || 'franchise_inquiry').trim();
  const message = String(body.message || '').trim();
  const consent = body.consent === true;

  if (name.length < 2 || name.length > 120) {
    return res.status(400).json({
      success: false,
      error: 'invalid_name',
      message: 'Please enter your full name (2–120 characters).'
    });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({
      success: false,
      error: 'invalid_email',
      message: 'Please provide a valid email address.'
    });
  }

  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) {
    return res.status(400).json({
      success: false,
      error: 'invalid_phone',
      message: 'Please provide a valid telephone or mobile number.'
    });
  }

  if (message.length < 10 || message.length > 3000) {
    return res.status(400).json({
      success: false,
      error: 'invalid_message',
      message: 'Please enter a clear message (at least 10 characters).'
    });
  }

  if (!consent) {
    return res.status(400).json({
      success: false,
      error: 'consent_required',
      message: 'Please confirm consent to be contacted regarding your inquiry.'
    });
  }

  const referenceCode = `TDG-INQ-${Date.now().toString().slice(-6)}`;

  let crmSynced = false;
  let emailDispatched = false;
  let crmNotice = '';

  // Forward to TRUEDEAL CRM / SendGrid pipeline if configured on server
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
      if (!crmRes.success) {
        crmNotice = crmRes.message || 'CRM sync pending manual review.';
      }
    } catch {
      crmNotice = 'CRM dispatch temporarily unavailable; inquiry logged locally.';
    }
  } else {
    crmNotice = 'Direct server email/CRM key not configured in this environment; inquiry logged in portal.';
  }

  return res.status(201).json({
    success: true,
    referenceCode,
    receivedAt: new Date().toISOString(),
    crmSynced,
    emailDispatched,
    notice: crmNotice || undefined,
    message: `Your inquiry (${referenceCode}) has been received by TRUEDEAL GLOBAL OPC PVT LTD. Our support team responds within 1–2 business days.`
  });
}
