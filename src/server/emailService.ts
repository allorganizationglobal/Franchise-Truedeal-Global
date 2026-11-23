/**
 * TRUEDEAL GLOBAL — Server-Side Transactional Email Service (SendGrid)
 *
 * Dispatches verified payment confirmations, receipts, failure/pending alerts,
 * application confirmations, and approval/rejection notices via SendGrid.
 *
 * SECURITY RULE: Payment success emails MUST ONLY be dispatched after independent
 * server-side Razorpay HMAC-SHA256 verification and capture confirmation (status === 'CAPTURED').
 */

export type FranchiseEmailEvent =
  | 'application_submitted'
  | 'payment_success_receipt'
  | 'payment_failed'
  | 'payment_pending'
  | 'application_approved'
  | 'application_rejected';

export interface TransactionalEmailPayload {
  event: FranchiseEmailEvent;
  toEmail: string;
  applicantName: string;
  applicationId: string;
  planName: string;
  amountINR?: number;
  baseAmountINR?: number;
  gstAmountINR?: number;
  txnId?: string;
  payuTransactionId?: string;
  gatewayName?: string;
  receiptNumber?: string;
  reason?: string;
}

export interface EmailDispatchResult {
  sent: boolean;
  skippedReason?: string;
  error?: string;
}

function escapeHtml(input: string): string {
  return String(input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildEmailContent(payload: TransactionalEmailPayload): { subject: string; html: string } {
  const safeName = escapeHtml(payload.applicantName);
  const safeAppId = escapeHtml(payload.applicationId);
  const safePlan = escapeHtml(payload.planName);
  const safeAmount =
    typeof payload.amountINR === 'number'
      ? `₹${payload.amountINR.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
      : '';
  const safeBase =
    typeof payload.baseAmountINR === 'number'
      ? `₹${payload.baseAmountINR.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
      : '';
  const safeGst =
    typeof payload.gstAmountINR === 'number' && payload.gstAmountINR > 0
      ? `₹${payload.gstAmountINR.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
      : 'As applicable per invoice';
  const safeTxn = escapeHtml(payload.txnId || '');
  const safeGatewayRef = escapeHtml(payload.payuTransactionId || '');
  const safeGateway = escapeHtml(payload.gatewayName || 'Razorpay');
  const safeReceipt = escapeHtml(payload.receiptNumber || '');
  const safeReason = escapeHtml(payload.reason || '');

  switch (payload.event) {
    case 'payment_success_receipt':
      return {
        subject: `Verified Payment Receipt (${safeReceipt}) — TRUEDEAL GLOBAL Application #${safeAppId}`,
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;color:#0f172a;">
            <h2 style="color:#059669;">Payment Verified &amp; Receipt Issued</h2>
            <p>Dear ${safeName},</p>
            <p>Your franchise payment for <strong>${safePlan}</strong> has been independently verified and captured via ${safeGateway}.</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
              <tr><td style="padding:8px;border:1px solid #e2e8f0;"><strong>Receipt Number</strong></td><td style="padding:8px;border:1px solid #e2e8f0;">${safeReceipt}</td></tr>
              <tr><td style="padding:8px;border:1px solid #e2e8f0;"><strong>Application ID</strong></td><td style="padding:8px;border:1px solid #e2e8f0;">${safeAppId}</td></tr>
              <tr><td style="padding:8px;border:1px solid #e2e8f0;"><strong>Order / Reference ID</strong></td><td style="padding:8px;border:1px solid #e2e8f0;">${safeTxn}</td></tr>
              <tr><td style="padding:8px;border:1px solid #e2e8f0;"><strong>${safeGateway} Payment ID</strong></td><td style="padding:8px;border:1px solid #e2e8f0;">${safeGatewayRef || 'Recorded'}</td></tr>
              ${safeBase ? `<tr><td style="padding:8px;border:1px solid #e2e8f0;"><strong>Base Fee</strong></td><td style="padding:8px;border:1px solid #e2e8f0;">${safeBase} INR</td></tr>` : ''}
              ${safeBase ? `<tr><td style="padding:8px;border:1px solid #e2e8f0;"><strong>GST</strong></td><td style="padding:8px;border:1px solid #e2e8f0;">${safeGst}</td></tr>` : ''}
              <tr><td style="padding:8px;border:1px solid #e2e8f0;"><strong>Verified Total Captured</strong></td><td style="padding:8px;border:1px solid #e2e8f0;">${safeAmount} INR</td></tr>
            </table>
            <p><strong>Important:</strong> Payment confirmation is separate from franchise approval. Your application is queued for KYC verification and administrative approval by TRUEDEAL GLOBAL OPC PVT LTD.</p>
            <p style="font-size:12px;color:#64748b;">Official Portal: https://businessfranchise.truedealglobal.com/ | Support: info@truedealglobal.com</p>
          </div>`
      };

    case 'payment_failed':
      return {
        subject: `Payment Not Completed — TRUEDEAL GLOBAL Application #${safeAppId}`,
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;color:#0f172a;">
            <h2 style="color:#dc2626;">Payment Could Not Be Completed</h2>
            <p>Dear ${safeName},</p>
            <p>Your payment attempt (${safeTxn}) for <strong>${safePlan}</strong> (${safeAmount}) was not completed.${safeReason ? ` Reason: ${safeReason}` : ''}</p>
            <p>You can safely retry payment from your Application Tracker dashboard at https://businessfranchise.truedealglobal.com/tracker.</p>
            <p style="font-size:12px;color:#64748b;">TRUEDEAL GLOBAL OPC PVT LTD | info@truedealglobal.com</p>
          </div>`
      };

    case 'payment_pending':
      return {
        subject: `Payment Verification Pending — TRUEDEAL GLOBAL Application #${safeAppId}`,
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;color:#0f172a;">
            <h2 style="color:#d97706;">Payment Verification In Progress</h2>
            <p>Dear ${safeName},</p>
            <p>Your payment (${safeTxn}) for <strong>${safePlan}</strong> is currently pending final bank/gateway settlement confirmation.</p>
            <p>Please do not initiate a duplicate transfer until status updates in your Applicant Tracker at https://businessfranchise.truedealglobal.com/tracker.</p>
          </div>`
      };

    case 'application_approved':
      return {
        subject: `Franchise Application Approved — TRUEDEAL GLOBAL #${safeAppId}`,
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;color:#0f172a;">
            <h2 style="color:#059669;">Franchise Application Approved</h2>
            <p>Dear ${safeName},</p>
            <p>Your application <strong>#${safeAppId}</strong> for <strong>${safePlan}</strong> has been approved by TRUEDEAL GLOBAL OPC PVT LTD.</p>
            <p>Please sign in to https://businessfranchise.truedealglobal.com/tracker to review next onboarding steps and franchise agreement documentation.</p>
          </div>`
      };

    case 'application_rejected':
      return {
        subject: `Franchise Application Decision Update — TRUEDEAL GLOBAL #${safeAppId}`,
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;color:#0f172a;">
            <h2>Application Status Update</h2>
            <p>Dear ${safeName},</p>
            <p>After compliance review, your application <strong>#${safeAppId}</strong> for <strong>${safePlan}</strong> could not be approved at this stage.${safeReason ? ` Notes: ${safeReason}` : ''}</p>
            <p>For refund inquiries or clarifications, contact info@truedealglobal.com quoting your Application ID.</p>
          </div>`
      };

    case 'application_submitted':
    default:
      return {
        subject: `Franchise Application Received (#${safeAppId}) — TRUEDEAL GLOBAL`,
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;color:#0f172a;">
            <h2>Application Registered Successfully</h2>
            <p>Dear ${safeName},</p>
            <p>We have received your franchise application <strong>#${safeAppId}</strong> for <strong>${safePlan}</strong>.</p>
            <p>Track your application status and complete payment verification at https://businessfranchise.truedealglobal.com/tracker.</p>
          </div>`
      };
  }
}

export async function sendTransactionalFranchiseEmail(
  payload: TransactionalEmailPayload
): Promise<EmailDispatchResult> {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'info@truedealglobal.com';
  const adminCc = process.env.SENDGRID_TO_EMAIL;

  if (!apiKey) {
    return { sent: false, skippedReason: 'SENDGRID_API_KEY not configured in server environment.' };
  }

  const { subject, html } = buildEmailContent(payload);
  const personalization: Record<string, unknown> = {
    to: [{ email: payload.toEmail, name: payload.applicantName }]
  };
  if (adminCc && adminCc.toLowerCase() !== payload.toEmail.toLowerCase()) {
    personalization.bcc = [{ email: adminCc }];
  }

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        personalizations: [personalization],
        from: { email: fromEmail, name: 'TRUEDEAL GLOBAL OPC PVT LTD' },
        subject,
        content: [{ type: 'text/html', value: html }]
      })
    });

    if (response.status >= 200 && response.status < 300) {
      return { sent: true };
    }
    return { sent: false, error: `SendGrid HTTP ${response.status}` };
  } catch (err: any) {
    return { sent: false, error: err?.message || 'SendGrid network failure' };
  }
}
