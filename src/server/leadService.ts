/**
 * TRUEDEAL GLOBAL - Server-Side CRM Lead Ingestion Service
 *
 * Securely forwards validated customer leads to TRUEDEAL GLOBAL CRM:
 * Target: POST https://crm.truedealglobal.com/api/leads/ingest
 * Auth: x-api-key: process.env.TRUEDEAL_LEAD_API_KEY
 *
 * Enforces server-side validation, consent verification (consent=true),
 * IP/Email rate limiting, bot honeypot filtering, SendGrid email dispatch,
 * and resilient upstream status handling (201, duplicate_ignored, 400, 401, 429, 503).
 */

export interface LeadIngestRequest {
  name: string;
  email: string;
  phone: string;
  service: string;
  sourceWebsite?: string;
  message?: string;
  consent: boolean;
  // Honeypot spam trap
  hp_website_url?: string;
}

export interface LeadIngestResult {
  success: boolean;
  statusCode: number;
  status: 'created' | 'duplicate_ignored' | 'validation_error' | 'rate_limited' | 'auth_error' | 'crm_error';
  message: string;
  leadId?: string;
  crmResponse?: any;
  emailDispatched?: boolean;
  emailError?: string;
}

export interface RateLimitEntry {
  count: number;
  firstRequestTime: number;
}

// In-memory sliding window rate limiter
const ipRateLimits = new Map<string, RateLimitEntry>();
const emailRateLimits = new Map<string, RateLimitEntry>();

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_REQUESTS_PER_IP = 8;
const MAX_REQUESTS_PER_EMAIL = 4;

export const DEFAULT_SOURCE_WEBSITE = 'https://businessfranchise.truedealglobal.com';
export const DEFAULT_CRM_BASE_URL = 'https://crm.truedealglobal.com';

/**
 * Checks and increments rate limiting counters
 */
export function checkRateLimit(clientIp: string, email: string): { allowed: boolean; reason?: string } {
  const now = Date.now();

  // 1. IP check
  if (clientIp) {
    const ipEntry = ipRateLimits.get(clientIp);
    if (!ipEntry || now - ipEntry.firstRequestTime > RATE_LIMIT_WINDOW_MS) {
      ipRateLimits.set(clientIp, { count: 1, firstRequestTime: now });
    } else {
      if (ipEntry.count >= MAX_REQUESTS_PER_IP) {
        return {
          allowed: false,
          reason: 'Too many submissions from this network. Please wait a few minutes or reach our team via WhatsApp.'
        };
      }
      ipEntry.count++;
    }
  }

  // 2. Email check
  if (email) {
    const cleanEmail = email.toLowerCase().trim();
    const emailEntry = emailRateLimits.get(cleanEmail);
    if (!emailEntry || now - emailEntry.firstRequestTime > RATE_LIMIT_WINDOW_MS) {
      emailRateLimits.set(cleanEmail, { count: 1, firstRequestTime: now });
    } else {
      if (emailEntry.count >= MAX_REQUESTS_PER_EMAIL) {
        return {
          allowed: false,
          reason: 'Multiple enquiries received for this email. Our franchise director will respond shortly.'
        };
      }
      emailEntry.count++;
    }
  }

  return { allowed: true };
}

/**
 * Reset rate limits (useful for testing)
 */
export function resetRateLimits(): void {
  ipRateLimits.clear;
  emailRateLimits.clear();
}

/**
 * Validate customer lead fields server-side
 */
export function validateLeadPayload(payload: any): { valid: boolean; error?: string } {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Invalid JSON request payload' };
  }

  // Honeypot spam check
  if (payload.hp_website_url && typeof payload.hp_website_url === 'string' && payload.hp_website_url.trim().length > 0) {
    return { valid: false, error: 'Automated submission rejected' };
  }

  // Name
  if (!payload.name || typeof payload.name !== 'string' || payload.name.trim().length < 2) {
    return { valid: false, error: 'Full name is required (minimum 2 characters)' };
  }
  if (payload.name.trim().length > 100) {
    return { valid: false, error: 'Full name cannot exceed 100 characters' };
  }

  // Email
  if (!payload.email || typeof payload.email !== 'string') {
    return { valid: false, error: 'Valid email address is required' };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(payload.email.trim())) {
    return { valid: false, error: 'Please provide a valid email format (e.g. director@company.com)' };
  }

  // Phone
  if (!payload.phone || typeof payload.phone !== 'string') {
    return { valid: false, error: 'Contact phone / WhatsApp number is required' };
  }
  const digitsOnly = payload.phone.replace(/\D/g, '');
  if (digitsOnly.length < 7 || digitsOnly.length > 15) {
    return { valid: false, error: 'Phone number must contain between 7 and 15 digits' };
  }

  // Service
  if (!payload.service || typeof payload.service !== 'string' || payload.service.trim().length < 2) {
    return { valid: false, error: 'Interested franchise plan or business service is required' };
  }

  // Consent: strictly mandatory
  if (payload.consent !== true) {
    return {
      valid: false,
      error: 'Explicit consent is mandatory to process franchise enquiries and send onboarding updates.'
    };
  }

  return { valid: true };
}

/**
 * Optional server-side SendGrid notification dispatch
 * Note: Failure of email MUST NEVER fail or erase the saved CRM lead.
 */
export async function sendSendgridNotification(lead: {
  name: string;
  email: string;
  phone: string;
  service: string;
  sourceWebsite: string;
  message?: string;
}): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;
  const toEmail = process.env.SENDGRID_TO_EMAIL;

  if (!apiKey || !fromEmail || !toEmail) {
    return { sent: false, error: 'SendGrid not configured on server (skipping email dispatch)' };
  }

  try {
    const emailPayload = {
      personalizations: [
        {
          to: [{ email: toEmail.trim() }],
          subject: `[TRUEDEAL CRM] New Franchise Lead: ${lead.name} (${lead.service})`
        }
      ],
      from: {
        email: fromEmail.trim(),
        name: 'TRUEDEAL GLOBAL Lead Ingest System'
      },
      content: [
        {
          type: 'text/html',
          value: `
            <div style="font-family: system-ui, sans-serif; max-width: 600px; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
              <h2 style="color: #0f172a; margin-top: 0;">New Verified Franchise Lead Ingested</h2>
              <p>A new applicant submitted an enquiry through <strong>${lead.sourceWebsite}</strong>.</p>
              <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                <tr><td style="padding: 8px; border-bottom: 1px solid #f1f5f9; font-weight: bold;">Name:</td><td style="padding: 8px; border-bottom: 1px solid #f1f5f9;">${lead.name}</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #f1f5f9; font-weight: bold;">Email:</td><td style="padding: 8px; border-bottom: 1px solid #f1f5f9;"><a href="mailto:${lead.email}">${lead.email}</a></td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #f1f5f9; font-weight: bold;">Phone:</td><td style="padding: 8px; border-bottom: 1px solid #f1f5f9;"><a href="tel:${lead.phone}">${lead.phone}</a></td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #f1f5f9; font-weight: bold;">Service / Plan:</td><td style="padding: 8px; border-bottom: 1px solid #f1f5f9;">${lead.service}</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #f1f5f9; font-weight: bold;">Website:</td><td style="padding: 8px; border-bottom: 1px solid #f1f5f9;">${lead.sourceWebsite}</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #f1f5f9; font-weight: bold;">Notes:</td><td style="padding: 8px; border-bottom: 1px solid #f1f5f9;">${lead.message || 'No additional notes provided'}</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #f1f5f9; font-weight: bold;">Consent Verified:</td><td style="padding: 8px; border-bottom: 1px solid #f1f5f9; color: #16a34a; font-weight: bold;">Yes (consent=true)</td></tr>
              </table>
              <p style="font-size: 11px; color: #64748b;">This notification was dispatched securely via server-side SendGrid integration.</p>
            </div>
          `
        }
      ]
    };

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(emailPayload)
    });

    if (response.status >= 200 && response.status < 300) {
      return { sent: true };
    } else {
      const errText = await response.text();
      return { sent: false, error: `SendGrid error (${response.status}): ${errText.slice(0, 100)}` };
    }
  } catch (err: any) {
    return { sent: false, error: `SendGrid dispatch failed: ${err?.message || 'Network error'}` };
  }
}

/**
 * Main server-side ingestion handler that connects to TRUEDEAL GLOBAL CRM
 */
export async function ingestLeadToCrm(
  payload: LeadIngestRequest,
  clientIp: string = '127.0.0.1'
): Promise<LeadIngestResult> {
  // 1. Server-side validation
  const validation = validateLeadPayload(payload);
  if (!validation.valid) {
    return {
      success: false,
      statusCode: 400,
      status: 'validation_error',
      message: validation.error || 'Invalid lead payload'
    };
  }

  // 2. Rate limiting check
  const rateLimit = checkRateLimit(clientIp, payload.email);
  if (!rateLimit.allowed) {
    return {
      success: false,
      statusCode: 429,
      status: 'rate_limited',
      message: rateLimit.reason || 'Rate limit exceeded. Please wait before retrying.'
    };
  }

  // 3. Read server-side API Key
  const apiKey = process.env.TRUEDEAL_LEAD_API_KEY;
  const crmBaseUrl = process.env.TRUEDEAL_CRM_BASE_URL || DEFAULT_CRM_BASE_URL;
  const endpoint = `${crmBaseUrl.replace(/\/+$/, '')}/api/leads/ingest`;

  // Sanitized customer fields for CRM
  const crmPayload = {
    name: payload.name.trim(),
    email: payload.email.toLowerCase().trim(),
    phone: payload.phone.trim(),
    service: payload.service.trim(),
    sourceWebsite: (payload.sourceWebsite || DEFAULT_SOURCE_WEBSITE).trim(),
    message: (payload.message || '').trim(),
    consent: true
  };

  // If no API key configured on server:
  if (!apiKey) {
    // In staging/development test mode when API key is pending configuration,
    // we provide a safe diagnostic error so admins know to set the secret in Vercel / server env.
    console.warn('[CRM Proxy] TRUEDEAL_LEAD_API_KEY environment variable is not defined on server.');
    return {
      success: false,
      statusCode: 500,
      status: 'auth_error',
      message: 'Server error: TRUEDEAL_LEAD_API_KEY is not configured in environment variables.'
    };
  }

  // 4. Dispatch request to CRM with timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 9000);

  try {
    const crmResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
      },
      body: JSON.stringify(crmPayload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const contentType = crmResponse.headers.get('content-type') || '';
    let responseData: any = {};
    if (contentType.includes('application/json')) {
      try {
        responseData = await crmResponse.json();
      } catch {
        responseData = {};
      }
    } else {
      const rawText = await crmResponse.text();
      responseData = { message: rawText.slice(0, 200) };
    }

    // 5. Handle upstream CRM status codes honestly
    // 201 Created: New lead registered
    if (crmResponse.status === 201) {
      // Dispatch background email if SendGrid configured (never fails lead)
      let emailResult: { sent: boolean; error?: string } = { sent: false };
      try {
        emailResult = await sendSendgridNotification(crmPayload);
      } catch {}

      return {
        success: true,
        statusCode: 201,
        status: 'created',
        message: responseData.message || 'Lead successfully ingested into TRUEDEAL GLOBAL CRM.',
        leadId: responseData.leadId || responseData.id || `crm_${Date.now()}`,
        crmResponse: responseData,
        emailDispatched: emailResult.sent,
        emailError: emailResult.error
      };
    }

    // 200 OK or Duplicate Ignored:
    if (
      crmResponse.status === 200 ||
      responseData.status === 'duplicate_ignored' ||
      responseData.duplicate === true ||
      (responseData.message && responseData.message.toLowerCase().includes('duplicate'))
    ) {
      return {
        success: true,
        statusCode: 200,
        status: 'duplicate_ignored',
        message: 'Lead inquiry received. An active record already exists in our CRM.',
        leadId: responseData.leadId || responseData.id,
        crmResponse: responseData
      };
    }

    // 400 Bad Request
    if (crmResponse.status === 400) {
      return {
        success: false,
        statusCode: 400,
        status: 'validation_error',
        message: responseData.message || responseData.error || 'CRM rejected payload fields.',
        crmResponse: responseData
      };
    }

    // 401 Unauthorized / Forbidden
    if (crmResponse.status === 401 || crmResponse.status === 403) {
      console.error('[CRM Proxy] CRM rejected server API key with 401/403.');
      return {
        success: false,
        statusCode: 500,
        status: 'auth_error',
        message: 'CRM authentication failure. Verify server TRUEDEAL_LEAD_API_KEY configuration.'
      };
    }

    // 429 Too Many Requests
    if (crmResponse.status === 429) {
      return {
        success: false,
        statusCode: 429,
        status: 'rate_limited',
        message: 'CRM rate limit reached. Please retry in a few moments.'
      };
    }

    // 500+ Server error on CRM side
    return {
      success: false,
      statusCode: 502,
      status: 'crm_error',
      message: 'TRUEDEAL GLOBAL CRM server returned an unexpected error. Please retry shortly or connect via WhatsApp.'
    };
  } catch (err: any) {
    clearTimeout(timeoutId);

    if (err?.name === 'AbortError') {
      return {
        success: false,
        statusCode: 504,
        status: 'crm_error',
        message: 'CRM server response timed out. Please check your connection or retry.'
      };
    }

    console.warn('[CRM Proxy] Network exception calling CRM:', err?.message);
    return {
      success: false,
      statusCode: 503,
      status: 'crm_error',
      message: 'Unable to reach CRM server. Please check network or connect with us directly via WhatsApp.'
    };
  }
}
