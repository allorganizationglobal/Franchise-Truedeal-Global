import React, { useState } from 'react';
import {
  Mail,
  Phone,
  MapPin,
  Clock,
  Globe,
  Building2,
  Send,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Loader2,
  FileText
} from 'lucide-react';
import { FranchiseStorageService } from '../../services/storage';
import { getDisplayRegisteredAddress } from '../../config/complianceConfig';
import { ContactInquiry } from '../../types/franchise';
import { WhatsAppIcon } from '../common/WhatsAppSupportWidget';

interface ContactUsPageProps {
  onNavigate: (tab: string) => void;
}

export function ContactUsPage({ onNavigate }: ContactUsPageProps) {
  const config = FranchiseStorageService.getComplianceConfig();
  const displayAddress = getDisplayRegisteredAddress(config);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [inquiryType, setInquiryType] = useState<ContactInquiry['inquiryType']>('franchise_inquiry');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState(''); // Honeypot spam trap
  const [consent, setConsent] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);
  const [deliverySummary, setDeliverySummary] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (name.trim().length < 2) {
      setErrorMsg('Please enter your full name (at least 2 characters).');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (phone.replace(/\D/g, '').length < 7) {
      setErrorMsg('Please enter a valid phone number with country/area code.');
      return;
    }
    if (subject.trim().length < 3) {
      setErrorMsg('Please enter a brief subject for your inquiry.');
      return;
    }
    if (message.trim().length < 10) {
      setErrorMsg('Please provide at least 10 characters describing your inquiry.');
      return;
    }
    if (!consent) {
      setErrorMsg('Please confirm consent to our Privacy Policy and Terms & Conditions before submitting.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          inquiryType,
          subject: subject.trim(),
          message: message.trim(),
          consent: true,
          website
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.ok) {
        setErrorMsg(
          data.message || 'Unable to submit your inquiry right now. Please email info@truedealglobal.com directly.'
        );
        return;
      }

      const refCode = data.referenceCode || `TDG-INQ-${Date.now().toString().slice(-6)}`;
      const inquiryRecord: ContactInquiry = {
        id: `inq_${Date.now()}`,
        referenceCode: refCode,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        subject: subject.trim(),
        inquiryType,
        message: message.trim(),
        consentGiven: true,
        createdAt: data.receivedAt || new Date().toISOString(),
        status: 'new',
        crmSynced: Boolean(data.crmSynced),
        emailDispatched: Boolean(data.emailDispatched)
      };

      FranchiseStorageService.saveContactInquiry(inquiryRecord);
      setSubmittedRef(refCode);
      setDeliverySummary(
        data.message ||
          'Your inquiry has been received. Our support team responds within 1–2 business days.'
      );
      setName('');
      setEmail('');
      setPhone('');
      setSubject('');
      setMessage('');
      setConsent(false);
    } catch {
      setErrorMsg(
        'Network error while submitting the contact form. Please check your connection or email info@truedealglobal.com directly.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      {/* Header */}
      <div className="space-y-3 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
          <Mail className="w-4 h-4" />
          <span>Official Merchant & Customer Support</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
          Contact Us
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed">
          Reach <strong className="text-slate-900 dark:text-slate-200">{config.legalName}</strong> for franchise
          package inquiries, onboarding documentation, billing and refund questions, or grievance support.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Verified Company Contact Directory */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-5">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span>Corporate Identity & Channels</span>
            </h2>

            <div className="space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <Building2 className="w-4 h-4 text-slate-400 mt-1 shrink-0" />
                <div>
                  <div className="text-xs font-semibold uppercase text-slate-400">Legal Entity Name</div>
                  <div className="font-bold text-slate-900 dark:text-white">{config.legalName}</div>
                  {config.cin ? (
                    <div className="text-xs text-slate-500 font-mono mt-0.5">CIN: {config.cin}</div>
                  ) : (
                    <div className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                      MCA Registered OPC Private Limited (CIN pending display confirmation)
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-slate-400 mt-1 shrink-0" />
                <div>
                  <div className="text-xs font-semibold uppercase text-slate-400">Registered / Operating Location</div>
                  <div className="text-slate-800 dark:text-slate-200 leading-relaxed">{displayAddress}</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-indigo-500 mt-1 shrink-0" />
                <div>
                  <div className="text-xs font-semibold uppercase text-slate-400">Official Support Email</div>
                  <a
                    href={`mailto:${config.officialEmail}`}
                    className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    {config.officialEmail}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-amber-500 mt-1 shrink-0" />
                <div>
                  <div className="text-xs font-semibold uppercase text-slate-400">Customer Support Phone</div>
                  <a
                    href={`tel:${config.supportPhone.replace(/[^+\d]/g, '')}`}
                    className="font-mono font-bold text-slate-900 dark:text-white hover:text-indigo-600"
                  >
                    {config.supportPhone}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <WhatsAppIcon className="w-4 h-4 text-emerald-500 mt-1 shrink-0" />
                <div>
                  <div className="text-xs font-semibold uppercase text-slate-400">Official WhatsApp Support Desk</div>
                  <a
                    href={`https://wa.me/${config.whatsappNumber.replace(/\D/g, '')}?text=Hello%20TRUEDEAL%20GLOBAL%20Support,%20I%20have%20a%20franchise%20inquiry.`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    {config.whatsappNumber}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock className="w-4 h-4 text-slate-400 mt-1 shrink-0" />
                <div>
                  <div className="text-xs font-semibold uppercase text-slate-400">Business & Support Hours</div>
                  <div className="text-slate-700 dark:text-slate-300">{config.supportHours}</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Globe className="w-4 h-4 text-slate-400 mt-1 shrink-0" />
                <div>
                  <div className="text-xs font-semibold uppercase text-slate-400">Official Websites</div>
                  <div className="space-y-1">
                    <a
                      href={config.mainWebsite}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                    >
                      Main Corporate Site: {config.mainWebsite}
                    </a>
                    <div className="text-xs text-slate-500">
                      Franchise Portal: {config.franchisePortalUrl}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 text-xs text-slate-600 dark:text-slate-400">
            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-500" />
              <span>Helpful Policy & Support Links</span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              <button type="button" onClick={() => onNavigate('grievance')} className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer">
                Grievance Redressal
              </button>
              <button type="button" onClick={() => onNavigate('refund')} className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer">
                Refund Policy
              </button>
              <button type="button" onClick={() => onNavigate('cancellation')} className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer">
                Cancellation Policy
              </button>
              <button type="button" onClick={() => onNavigate('pricing')} className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer">
                Pricing & Packages
              </button>
            </div>
          </div>
        </div>

        {/* Right: Validated Server-Backed Contact Form */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xs">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
            Send Us a Message
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
            All fields marked with * are required. You will receive a tracking reference number upon submission.
          </p>

          {submittedRef && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-sm space-y-1">
              <div className="flex items-center gap-2 font-bold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Inquiry Received — Reference: {submittedRef}</span>
              </div>
              <p className="text-xs leading-relaxed">{deliverySummary}</p>
            </div>
          )}

          {errorMsg && (
            <div className="mb-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Hidden Honeypot field for bot filtering */}
            <div className="hidden" aria-hidden="true">
              <label htmlFor="contact-website">Website</label>
              <input
                id="contact-website"
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91-XXXXXXXXXX"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Inquiry Category *
                </label>
                <select
                  value={inquiryType}
                  onChange={(e) => setInquiryType(e.target.value as ContactInquiry['inquiryType'])}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="franchise_inquiry">Franchise Package Inquiry</option>
                  <option value="billing_refund">Billing, Cancellation or Refund Request</option>
                  <option value="grievance">Customer Grievance / Escalation</option>
                  <option value="general_support">General Support & Documentation</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Subject *
              </label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief summary of your request"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Message *
              </label>
              <textarea
                rows={4}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Share your questions, application ID (if applicable), or support details..."
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <label className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>
                I consent to {config.legalName} processing the contact details above to respond to my inquiry in
                accordance with the{' '}
                <button
                  type="button"
                  onClick={() => onNavigate('privacy')}
                  className="text-indigo-600 dark:text-indigo-400 underline font-semibold cursor-pointer"
                >
                  Privacy Policy
                </button>{' '}
                and{' '}
                <button
                  type="button"
                  onClick={() => onNavigate('terms')}
                  className="text-indigo-600 dark:text-indigo-400 underline font-semibold cursor-pointer"
                >
                  Terms & Conditions
                </button>
                .
              </span>
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting Inquiry...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Submit Contact Inquiry</span>
                </>
              )}
            </button>

            <div className="pt-2 flex items-center gap-2 text-[11px] text-slate-500">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Server-validated submission with rate limiting and privacy protection.</span>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
