import { EmailNotification, AppNotification, FranchiseApplication } from '../types/franchise';
import { playNotificationSound } from '../utils/audio';

const STORAGE_KEYS = {
  EMAILS: 'truedeal_emails_v1',
  NOTIFICATIONS: 'truedeal_notifications_v1',
};

// Seed initial email history
const INITIAL_EMAILS: EmailNotification[] = [
  {
    id: 'em_001',
    to: 'm.sterling@sterlingholdings.com',
    recipientName: 'Marcus Sterling',
    subject: 'Official Approval: TrueDeal Global Master Franchise License (TDG-2026-104)',
    previewText: 'Congratulations. The Executive Franchise Committee has approved your application for the Central Texas territory...',
    template: 'official_approval',
    sentAt: '2026-04-02T14:35:00.000Z',
    read: true,
    htmlBody: `
      <div style="font-family: sans-serif; line-height: 1.6; color: #1e293b;">
        <h2 style="color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">TrueDeal Global Franchise Network</h2>
        <p>Dear Marcus Sterling,</p>
        <p>We are delighted to formally confirm that your application for the <strong>Master Franchise Partner</strong> (Reference: <code>TDG-2026-104</code>) covering the <strong>Central Texas Corridor</strong> has received executive director approval and biometric verification.</p>
        <div style="background: #f1f5f9; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0 0 8px 0;"><strong>Assigned Territory:</strong> Central Texas (Austin - San Antonio)</p>
          <p style="margin: 0 0 8px 0;"><strong>Initial Term:</strong> 10 Years Renewable</p>
          <p style="margin: 0;"><strong>Next Step:</strong> Review countersigned agreements in your TrueDeal Portal vault.</p>
        </div>
        <p>Welcome to the TrueDeal Global leadership family.</p>
        <p style="color: #64748b; font-size: 13px;">TrueDeal Global Franchise Operations · franchise.truedealglobal.com</p>
      </div>
    `
  },
  {
    id: 'em_002',
    to: 'elena@novapartnergroup.com',
    recipientName: 'Elena Rostova',
    subject: 'Automated Preliminary Verification Passed - Next Steps for TDG-2026-108',
    previewText: 'Your Multi-Unit Franchise application for South Florida has cleared automated compliance scoring...',
    template: 'automated_passed',
    sentAt: '2026-04-04T11:25:00.000Z',
    read: false,
    htmlBody: `
      <div style="font-family: sans-serif; line-height: 1.6; color: #1e293b;">
        <h2 style="color: #0f172a;">TrueDeal Global Automated Compliance</h2>
        <p>Dear Elena Rostova,</p>
        <p>Our automated rule engine has evaluated your financial and operational profile for the <strong>Multi-Unit Operator</strong> plan. Your preliminary score is <strong>88/100 (Conditional Fast-Track)</strong>.</p>
        <p>Your application is now under final audit by Legal & Compliance Officer David Chen.</p>
        <p style="color: #64748b; font-size: 13px;">TrueDeal Global Franchise Operations</p>
      </div>
    `
  }
];

export class NotificationService {
  static getEmails(): EmailNotification[] {
    if (typeof window === 'undefined') return INITIAL_EMAILS;
    try {
      const data = localStorage.getItem(STORAGE_KEYS.EMAILS);
      return data ? JSON.parse(data) : INITIAL_EMAILS;
    } catch {
      return INITIAL_EMAILS;
    }
  }

  static getNotifications(): AppNotification[] {
    if (typeof window === 'undefined') return [];
    try {
      const data = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  static addNotification(
    title: string,
    message: string,
    type: AppNotification['type'] = 'info',
    applicationId?: string
  ) {
    const notifications = this.getNotifications();
    const newNotif: AppNotification = {
      id: 'notif_' + Math.random().toString(36).substring(2, 9),
      title,
      message,
      timestamp: new Date().toISOString(),
      read: false,
      type,
      applicationId
    };

    notifications.unshift(newNotif);
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications.slice(0, 50)));

    // Audio chime
    playNotificationSound();

    // Browser Push Notification (if granted)
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body: message,
          icon: '/favicon.ico'
        });
      } catch {
        // Ignored in non-supported frame
      }
    }
  }

  static async requestPushPermission(): Promise<NotificationPermission | 'unsupported'> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    try {
      return await Notification.requestPermission();
    } catch {
      return 'denied';
    }
  }

  static markAllNotificationsRead() {
    const list = this.getNotifications().map(n => ({ ...n, read: true }));
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(list));
  }

  static sendAutomatedEmail(
    app: FranchiseApplication,
    template: EmailNotification['template'],
    customNote?: string
  ): EmailNotification {
    const emails = this.getEmails();
    let subject = '';
    let previewText = '';
    let htmlBody = '';

    switch (template) {
      case 'application_submitted':
        subject = `Application Received: TrueDeal Global Franchise Plan (${app.id})`;
        previewText = `Thank you for applying to the TrueDeal Global franchise program for ${app.territoryRequested}. Reference ID: ${app.id}`;
        htmlBody = `
          <div style="font-family: sans-serif; line-height: 1.6; color: #1e293b;">
            <h2 style="color: #0f172a; margin-bottom: 4px;">TrueDeal Global Franchise Plan</h2>
            <p style="color: #64748b; font-size: 14px;">Official Application Confirmation</p>
            <p>Dear ${app.applicant.fullName},</p>
            <p>We have successfully received your franchise application <strong>${app.id}</strong> for the <strong>${app.territoryRequested}</strong> territory.</p>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 16px 0;">
              <p style="margin: 0 0 6px 0;"><strong>Application ID:</strong> ${app.id}</p>
              <p style="margin: 0 0 6px 0;"><strong>Plan Tier:</strong> ${app.planId.replace('plan_', '').toUpperCase()}</p>
              <p style="margin: 0;"><strong>Status:</strong> Processing automated eligibility scoring</p>
            </div>
            <p>Our automated rule engine will evaluate your liquidity ratio and territory clearance within minutes.</p>
            <p style="font-size: 13px; color: #64748b;">TrueDeal Global Operations Team</p>
          </div>
        `;
        break;

      case 'automated_passed':
        subject = `Automated Verification Passed: Preliminary Approval for ${app.id}`;
        previewText = `Your application scored ${app.automatedEvaluation.score}/100 and has cleared preliminary automated checks.`;
        htmlBody = `
          <div style="font-family: sans-serif; line-height: 1.6; color: #1e293b;">
            <h2 style="color: #059669;">Automated Verification Passed</h2>
            <p>Dear ${app.applicant.fullName},</p>
            <p>Good news! Your franchise plan application has achieved an automated score of <strong>${app.automatedEvaluation.score}/100</strong>.</p>
            <p><strong>Verdict:</strong> ${app.automatedEvaluation.preliminaryVerdict.replace(/_/g, ' ').toUpperCase()}</p>
            <p>Your documentation is now queued for compliance audit. Please keep an eye on your portal dashboard for further updates.</p>
            <p style="font-size: 13px; color: #64748b;">TrueDeal Global Compliance Division</p>
          </div>
        `;
        break;

      case 'official_approval':
        subject = `Official Executive Approval & Letter of Intent (${app.id})`;
        previewText = `The TrueDeal Global Franchise Board has approved your partnership. Legal agreements are ready for review.`;
        htmlBody = `
          <div style="font-family: sans-serif; line-height: 1.6; color: #1e293b;">
            <h2 style="color: #1e40af;">Official Franchise Agreement Approved</h2>
            <p>Dear ${app.applicant.fullName},</p>
            <p>We are honored to confirm that the TrueDeal Executive Franchise Board has officially approved your application for <strong>${app.territoryRequested}</strong>.</p>
            <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 16px; margin: 16px 0;">
              <p style="margin: 0 0 6px 0;"><strong>Franchisee Partner:</strong> ${app.applicant.fullName} (${app.applicant.companyName || 'Individual'})</p>
              <p style="margin: 0 0 6px 0;"><strong>Assigned Territory:</strong> ${app.territoryRequested}</p>
              <p style="margin: 0;"><strong>Deposit Status:</strong> Ready for franchise license deposit payment</p>
            </div>
            ${customNote ? `<p><strong>Director Note:</strong> ${customNote}</p>` : ''}
            <p>Please log in to your franchise tracker to review and countersign the Franchise Disclosure Document (FDD).</p>
            <p style="font-size: 13px; color: #64748b;">TrueDeal Global Executive Directorate</p>
          </div>
        `;
        break;

      case 'payment_confirmed':
        subject = `Deposit Receipt & Confirmation (${app.id})`;
        previewText = `Your payment has been successfully cleared and escrowed with TrueDeal Global.`;
        htmlBody = `
          <div style="font-family: sans-serif; line-height: 1.6; color: #1e293b;">
            <h2 style="color: #0f172a;">Payment Transaction Cleared</h2>
            <p>Dear ${app.applicant.fullName},</p>
            <p>We have received and securely escrowed your franchise license deposit. Your official onboarding kit and store deployment timeline are now active.</p>
            <p style="font-size: 13px; color: #64748b;">TrueDeal Global Treasury & Billing</p>
          </div>
        `;
        break;

      default:
        subject = `Status Update on TrueDeal Franchise Application ${app.id}`;
        previewText = `There is an update on your franchise application status.`;
        htmlBody = `<p>Your application status has been updated to: ${app.status}.</p>`;
    }

    const email: EmailNotification = {
      id: 'em_' + Math.random().toString(36).substring(2, 9),
      to: app.applicant.email,
      recipientName: app.applicant.fullName,
      subject,
      previewText,
      template,
      sentAt: new Date().toISOString(),
      read: false,
      htmlBody
    };

    emails.unshift(email);
    localStorage.setItem(STORAGE_KEYS.EMAILS, JSON.stringify(emails.slice(0, 100)));

    // Also trigger in-app alert
    this.addNotification(
      `Email Dispatched: ${subject}`,
      `Sent to ${app.applicant.email} regarding ${app.id}`,
      'info',
      app.id
    );

    return email;
  }
}
