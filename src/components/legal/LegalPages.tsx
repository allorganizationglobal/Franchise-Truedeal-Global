import React from 'react';
import {
  Building2,
  FileText,
  Shield,
  RefreshCw,
  XCircle,
  Scale,
  AlertTriangle,
  Truck,
  CheckCircle2,
  Mail,
  Phone,
  Globe,
  Clock,
  ArrowRight
} from 'lucide-react';
import { FranchiseStorageService } from '../../services/storage';
import { getDisplayRegisteredAddress } from '../../config/complianceConfig';

interface LegalPageProps {
  onNavigate: (tab: string) => void;
}

function LegalPageShell({
  badge,
  icon: Icon,
  title,
  subtitle,
  lastUpdated,
  children,
  onNavigate
}: {
  badge: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  lastUpdated: string;
  children: React.ReactNode;
  onNavigate: (tab: string) => void;
}) {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <div className="space-y-3 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
          <Icon className="w-4 h-4" />
          <span>{badge}</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
          {title}
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
          {subtitle}
        </p>
        <div className="text-xs text-slate-400 font-mono">
          Last Reviewed: {new Date(lastUpdated).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })} · Domain: https://businessfranchise.truedealglobal.com/
        </div>
      </div>

      <div className="space-y-6 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
        {children}
      </div>

      {/* Cross-navigation footer bar for legal reviewers */}
      <div className="pt-8 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-indigo-600 dark:text-indigo-400 font-semibold">
          <button type="button" onClick={() => onNavigate('about')} className="hover:underline cursor-pointer">About Us</button>
          <button type="button" onClick={() => onNavigate('pricing')} className="hover:underline cursor-pointer">Pricing</button>
          <button type="button" onClick={() => onNavigate('terms')} className="hover:underline cursor-pointer">Terms</button>
          <button type="button" onClick={() => onNavigate('privacy')} className="hover:underline cursor-pointer">Privacy</button>
          <button type="button" onClick={() => onNavigate('refund')} className="hover:underline cursor-pointer">Refunds</button>
          <button type="button" onClick={() => onNavigate('cancellation')} className="hover:underline cursor-pointer">Cancellations</button>
          <button type="button" onClick={() => onNavigate('franchise-terms')} className="hover:underline cursor-pointer">Franchise Terms</button>
          <button type="button" onClick={() => onNavigate('delivery')} className="hover:underline cursor-pointer">Service Delivery</button>
          <button type="button" onClick={() => onNavigate('grievance')} className="hover:underline cursor-pointer">Grievance</button>
          <button type="button" onClick={() => onNavigate('contact')} className="hover:underline cursor-pointer">Contact Us</button>
        </div>
      </div>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-3 shadow-2xs">
      <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
      <div className="space-y-2.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
        {children}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* 1. ABOUT US PAGE                                                           */
/* -------------------------------------------------------------------------- */
export function AboutUsPage({ onNavigate }: LegalPageProps) {
  const config = FranchiseStorageService.getComplianceConfig();
  const displayAddress = getDisplayRegisteredAddress(config);

  return (
    <LegalPageShell
      badge="Corporate Identity & Business Model"
      icon={Building2}
      title={`About ${config.legalName}`}
      subtitle="Transparent overview of our corporate identity, franchise business model, onboarding workflow, and compliance commitments."
      lastUpdated={config.lastUpdatedAt}
      onNavigate={onNavigate}
    >
      <SectionCard title="1. Who We Are">
        <p>
          <strong>{config.legalName}</strong> (operating under the brand name <strong>{config.brandName}</strong>) is an
          Indian One Person Company (Private Limited) registered under the Companies Act, 2013 with the Ministry of
          Corporate Affairs (MCA), Government of India, and recognized under DPIIT Startup India and Udyam MSME
          registrations.
        </p>
        <p>
          Our main corporate website is{' '}
          <a href={config.mainWebsite} target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 underline font-semibold">
            {config.mainWebsite}
          </a>
          , and this dedicated franchise onboarding portal is hosted exclusively at{' '}
          <strong className="font-mono text-xs">{config.franchisePortalUrl}</strong>.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
            <span className="text-slate-400 block font-semibold">Registered / Operating Location</span>
            <span className="text-slate-800 dark:text-slate-200 font-medium">{displayAddress}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
            <span className="text-slate-400 block font-semibold">Corporate Identification</span>
            <span className="text-slate-800 dark:text-slate-200 font-medium">
              {config.cin ? `CIN: ${config.cin}` : 'MCA Registered OPC Pvt Ltd (CIN pending display confirmation)'}
              {config.gstin ? ` · GSTIN: ${config.gstin}` : ''}
            </span>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="2. Our Franchise Business Model & What Customers Purchase">
        <p>
          {config.legalName} offers structured <strong>Business Service Franchise Partnerships</strong>. When an
          approved applicant purchases a franchise package, they pay a one-time onboarding and franchise license fee
          for:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Authorized commercial rights to market and source clients for approved B2B and consumer services (such as software/web development, digital marketing, travel & tourism bookings, visa documentation assistance, real estate advisory, education counseling, and corporate event services).</li>
          <li>Centralized backend operational fulfillment managed by {config.legalName} delivery teams.</li>
          <li>Partner onboarding documentation, commercial rate cards, brand usage guidelines, and training materials.</li>
          <li>Access to the Franchise Partner Portal and commission settlement tracking under the signed Franchise Agreement.</li>
        </ul>
        <p className="text-xs text-slate-500 pt-1">
          <strong>Important:</strong> {config.legalName} does not sell investment schemes, MLM recruitment chains,
          cryptocurrency trading plans, or guaranteed passive income products. All partnerships are commercial service
          franchises governed by written contract.
        </p>
      </SectionCard>

      <SectionCard title="3. Application Review, Agreement Execution & Post-Payment Process">
        <ol className="list-decimal pl-5 space-y-2">
          <li><strong>Online Application:</strong> Prospective partners review package fees and terms, then submit an application with KYC documents through this portal.</li>
          <li><strong>Manual Compliance & Eligibility Review:</strong> Our compliance team reviews identity documents, territory fit, and eligibility. Submitting an application does <strong>not</strong> constitute automatic approval.</li>
          <li><strong>Fee Payment & Reconciliation:</strong> Only after package confirmation, the applicable franchise fee is paid through verified channels with full GST/invoice transparency.</li>
          <li><strong>Written Franchise Agreement:</strong> Both parties execute the formal Franchise Agreement defining territory scope, commission terms, obligations, and termination rights.</li>
          <li><strong>Digital Onboarding & Activation:</strong> Within 3–7 business days of verification and countersignature, partner credentials, digital onboarding kits, and support contacts are delivered.</li>
        </ol>
      </SectionCard>

      <SectionCard title="4. Official Contact & Governance">
        <div className="flex flex-wrap gap-6 text-xs">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-indigo-500" />
            <a href={`mailto:${config.officialEmail}`} className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">{config.officialEmail}</a>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-amber-500" />
            <span className="font-mono font-bold">{config.supportPhone}</span>
          </div>
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-emerald-500" />
            <a href={config.mainWebsite} target="_blank" rel="noopener noreferrer" className="hover:underline">{config.mainWebsite}</a>
          </div>
        </div>
        <div className="pt-3 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => onNavigate('pricing')}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <span>View Full INR Pricing & Packages</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onNavigate('contact')}
            className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold cursor-pointer"
          >
            Contact Support
          </button>
        </div>
      </SectionCard>
    </LegalPageShell>
  );
}

/* -------------------------------------------------------------------------- */
/* 2. TERMS AND CONDITIONS PAGE                                               */
/* -------------------------------------------------------------------------- */
export function TermsPage({ onNavigate }: LegalPageProps) {
  const config = FranchiseStorageService.getComplianceConfig();
  const displayAddress = getDisplayRegisteredAddress(config);

  return (
    <LegalPageShell
      badge="Legal Agreement · Public Terms"
      icon={FileText}
      title="Terms and Conditions"
      subtitle={`These Terms and Conditions govern your access to ${config.franchisePortalUrl} and all franchise applications, inquiries, and payments processed by ${config.legalName}.`}
      lastUpdated={config.lastUpdatedAt}
      onNavigate={onNavigate}
    >
      <SectionCard title="1. Company Identity & Scope">
        <p>
          This portal (<strong>{config.franchisePortalUrl}</strong>) is owned and operated by{' '}
          <strong>{config.legalName}</strong>, a company incorporated under the Companies Act, 2013 in India ({displayAddress}).
          By accessing this website, submitting an application, or initiating any payment, you agree to be legally bound
          by these Terms and Conditions, our Privacy Policy, Refund Policy, Cancellation Policy, and Franchise Agreement Terms.
        </p>
      </SectionCard>

      <SectionCard title="2. Eligibility to Apply">
        <p>
          Applicants must be at least 18 years of age and legally competent to enter into a binding contract under the
          Indian Contract Act, 1872 (or applicable local laws for international business applicants). Corporate applicants
          (OPC, Private Limited, LLP, Partnership, Proprietorship) must apply through an authorized signatory.
        </p>
      </SectionCard>

      <SectionCard title="3. Nature of Franchise Services">
        <p>
          {config.legalName} provides commercial business franchise packages enabling authorized partners to market and
          facilitate approved professional, digital, travel, real estate, education, and corporate services fulfilled by
          {config.legalName}. Franchisees operate as independent business entities and are not employees, legal agents,
          or partners of {config.legalName}.
        </p>
      </SectionCard>

      <SectionCard title="4. No Income, Profit, or Return Guarantee">
        <p>
          <strong>Explicit Disclaimer:</strong> Any commission percentages, package illustrations, or calculator examples
          shown on this website are strictly illustrative. {config.legalName} does <strong>not</strong> guarantee fixed
          monthly earnings, minimum client volume, return on investment (ROI), or passive income. Commercial performance
          depends solely on the franchisee&apos;s effort, market conditions, and service compliance.
        </p>
      </SectionCard>

      <SectionCard title="5. Pricing, Fees & Applicable Taxes">
        <p>
          All franchise package fees are published transparently in Indian Rupees (INR) on our{' '}
          <button type="button" onClick={() => onNavigate('pricing')} className="text-indigo-600 dark:text-indigo-400 underline font-semibold cursor-pointer">
            Pricing and Franchise Packages
          </button>{' '}
          page. Applicable Goods and Services Tax (GST) or statutory taxes are disclosed separately prior to payment.
          {config.legalName} reserves the right to revise package pricing for future applicants; confirmed quotes or
          executed agreements remain unaffected.
        </p>
      </SectionCard>

      <SectionCard title="6. Payment Terms & Verification">
        <p>
          Payments are accepted only through officially designated corporate banking channels or authorized payment
          gateways enabled on this website. Offline bank transfers (NEFT/IMPS/RTGS/UPI) remain in{' '}
          <em>Pending Verification</em> status until funds are reconciled in the official corporate account of{' '}
          {config.legalName}. Never transfer funds to personal accounts or unauthorized third parties.
        </p>
      </SectionCard>

      <SectionCard title="7. Application Review & Discretion of Approval">
        <p>
          Submission of an online application, uploading of KYC documents, or automated completeness checks do{' '}
          <strong>not</strong> guarantee franchise approval. {config.legalName} retains sole discretion to verify
          credentials, request additional documentation, or decline any application that does not meet compliance,
          territory, or onboarding standards.
        </p>
      </SectionCard>

      <SectionCard title="8. Cancellation & Refund Reference">
        <p>
          All cancellation and refund requests are governed by our published{' '}
          <button type="button" onClick={() => onNavigate('cancellation')} className="text-indigo-600 dark:text-indigo-400 underline font-semibold cursor-pointer">
            Cancellation Policy
          </button>{' '}
          and{' '}
          <button type="button" onClick={() => onNavigate('refund')} className="text-indigo-600 dark:text-indigo-400 underline font-semibold cursor-pointer">
            Refund Policy
          </button>
          . Approved refunds are processed strictly to the original payment source within {config.refundProcessingTimeline}.
        </p>
      </SectionCard>

      <SectionCard title="9. Intellectual Property">
        <p>
          All trademarks, logos, brand names, portal software, marketing assets, and documentation on this website are
          the exclusive intellectual property of {config.legalName}. Unauthorized reproduction, resale, or brand
          impersonation is strictly prohibited.
        </p>
      </SectionCard>

      <SectionCard title="10. Prohibited Misuse & Restricted Activities">
        <p>
          Users and franchise partners shall not use this portal or the {config.brandName} brand for unlawful activities,
          fraudulent KYC submissions, spamming, unauthorized data scraping, cryptocurrency/MLM/gambling promotions, or
          misrepresenting guaranteed returns to end-clients.
        </p>
      </SectionCard>

      <SectionCard title="11. Limitation of Liability">
        <p>
          To the maximum extent permitted by applicable law, {config.legalName} shall not be liable for indirect,
          incidental, or consequential commercial losses arising from business operations, third-party outages, or
          market fluctuations. Aggregate liability for any verified claim relating to a paid franchise fee shall not
          exceed the actual fee paid by the applicant to {config.legalName}.
        </p>
      </SectionCard>

      <SectionCard title="12. Governing Law & Jurisdiction">
        <p>
          These Terms and Conditions are governed by the laws of India. Any disputes that cannot be resolved amicably
          through our{' '}
          <button type="button" onClick={() => onNavigate('grievance')} className="text-indigo-600 dark:text-indigo-400 underline font-semibold cursor-pointer">
            Grievance Redressal
          </button>{' '}
          process shall be subject to the exclusive jurisdiction of the competent courts in{' '}
          <strong>{config.jurisdictionCity}</strong>.
        </p>
      </SectionCard>

      <SectionCard title="13. Contact Information">
        <p>
          For questions regarding these Terms and Conditions, email{' '}
          <a href={`mailto:${config.officialEmail}`} className="text-indigo-600 dark:text-indigo-400 underline font-semibold">{config.officialEmail}</a>{' '}
          or call <span className="font-mono font-bold">{config.supportPhone}</span> during business hours ({config.supportHours}).
        </p>
      </SectionCard>
    </LegalPageShell>
  );
}

/* -------------------------------------------------------------------------- */
/* 3. PRIVACY POLICY PAGE                                                     */
/* -------------------------------------------------------------------------- */
export function PrivacyPolicyPage({ onNavigate }: LegalPageProps) {
  const config = FranchiseStorageService.getComplianceConfig();

  return (
    <LegalPageShell
      badge="Data Protection · DPDP Act 2023 Compliant"
      icon={Shield}
      title="Privacy Policy"
      subtitle={`How ${config.legalName} collects, uses, secures, retains, and protects personal and business information submitted on ${config.franchisePortalUrl}.`}
      lastUpdated={config.lastUpdatedAt}
      onNavigate={onNavigate}
    >
      <SectionCard title="1. Personal Data We Collect">
        <p>When you browse, inquire, or apply for a franchise on our portal, we may collect:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Identity & Contact Information:</strong> Full name, email address, phone number, residential/business city, state, postal code, and entity details.</li>
          <li><strong>Application & KYC Documents:</strong> Government-issued ID proof, PAN/business registration certificates, financial capability declarations, and optional live webcam identity verification photo submitted voluntarily during application.</li>
          <li><strong>Payment Reference Information:</strong> Payment method type, UTR/bank reference code, billing name, and transaction timestamps. We do <strong>not</strong> store raw debit/credit card numbers or CVV codes on our servers.</li>
          <li><strong>Technical & Security Logs:</strong> Session authentication identifiers, IP address (for rate limiting and abuse prevention), and audit timestamps.</li>
        </ul>
      </SectionCard>

      <SectionCard title="2. Purpose & Lawful Basis of Processing">
        <p>
          In accordance with the Digital Personal Data Protection Act, 2023 (India), we process personal data strictly
          for lawful purposes with your explicit consent:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Evaluating franchise applications, conducting KYC/compliance verification, and executing Franchise Agreements.</li>
          <li>Responding to contact inquiries, billing/refund requests, and customer grievances.</li>
          <li>Reconciling payments, issuing tax invoices/receipts, and maintaining statutory accounting records.</li>
          <li>Preventing fraud, duplicate spam submissions, and unauthorized account access.</li>
        </ul>
      </SectionCard>

      <SectionCard title="3. Data Storage, Security & Encryption">
        <p>
          We implement administrative, technical, and cryptographic safeguards including HTTPS/TLS encryption in transit,
          AES-GCM-256 client-side encryption checksums for uploaded compliance documents, server-side secret isolation,
          and role-based access controls restricting applicant records to authorized compliance personnel.
        </p>
      </SectionCard>

      <SectionCard title="4. Third-Party Service Providers">
        <p>
          We do not sell your personal data. We share data only with essential infrastructure processors bound by
          confidentiality and security controls:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Google Firebase:</strong> User authentication (Google Sign-In) and secure cloud database storage.</li>
          <li><strong>TRUEDEAL GLOBAL CRM & Transactional Email (SendGrid):</strong> Lead inquiry management and status notifications.</li>
          <li><strong>Authorized Payment Gateway (Razorpay — upon activation):</strong> PCI-DSS compliant payment processing when live online checkout is enabled.</li>
        </ul>
      </SectionCard>

      <SectionCard title="5. Cookies & Local Storage">
        <p>
          We use essential browser storage and cookies to preserve your dark/light theme preference, language selection
          (English/Hindi), currency display preference, authentication session, and draft application save-and-resume state.
        </p>
      </SectionCard>

      <SectionCard title="6. Data Retention">
        <p>
          Application records, contracts, and billing/payment records are retained for the duration of the franchise
          relationship and for statutory audit/tax retention periods required under Indian corporate and tax laws
          (typically up to 8 years). Non-converted inquiries may be deleted earlier upon verified user request.
        </p>
      </SectionCard>

      <SectionCard title="7. Your Rights & Consent Withdrawal">
        <p>Under the Indian DPDP Act, 2023, you have the right to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Request access to a summary of personal data processed about you.</li>
          <li>Request correction or updating of inaccurate personal details.</li>
          <li>Withdraw consent or request erasure of non-statutory personal data (note: withdrawal may prevent continuation of an active franchise application).</li>
          <li>Escalate privacy complaints via our Grievance Redressal channel.</li>
        </ul>
        <p className="pt-1">
          To exercise any right, email{' '}
          <a href={`mailto:${config.officialEmail}`} className="text-indigo-600 dark:text-indigo-400 underline font-semibold">{config.officialEmail}</a>{' '}
          or visit our{' '}
          <button type="button" onClick={() => onNavigate('grievance')} className="text-indigo-600 dark:text-indigo-400 underline font-semibold cursor-pointer">
            Grievance Redressal Page
          </button>
          .
        </p>
      </SectionCard>
    </LegalPageShell>
  );
}

/* -------------------------------------------------------------------------- */
/* 4. REFUND POLICY PAGE                                                      */
/* -------------------------------------------------------------------------- */
export function RefundPolicyPage({ onNavigate }: LegalPageProps) {
  const config = FranchiseStorageService.getComplianceConfig();

  return (
    <LegalPageShell
      badge="Payment & Merchant Compliance"
      icon={RefreshCw}
      title="Refund Policy"
      subtitle={`Clear, fair, and transparent refund rules governing franchise payments made to ${config.legalName}.`}
      lastUpdated={config.lastUpdatedAt}
      onNavigate={onNavigate}
    >
      <SectionCard title="1. Fee Categories & Refund Applicability">
        <p>We distinguish clearly between each payment category so applicants understand their rights before paying:</p>
        <div className="overflow-x-auto pt-2">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
                <th className="py-2.5 px-3 font-bold">Fee Type</th>
                <th className="py-2.5 px-3 font-bold">Refund Eligibility</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              <tr>
                <td className="py-2.5 px-3 font-semibold">Online Application Fee (Currently ₹{config.applicationFeeINR})</td>
                <td className="py-2.5 px-3">No application fee is charged to submit the online form. If any administrative verification fee is ever introduced and paid in duplicate or error, 100% of the erroneous payment is refunded.</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold">Application Declined by {config.legalName}</td>
                <td className="py-2.5 px-3">If an applicant has paid any booking/advance/franchise fee and {config.legalName} declines the application during KYC or territory review, <strong>100% of the paid franchise/booking fee is refunded</strong>.</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold">Pre-Activation Franchise / Booking Fee</td>
                <td className="py-2.5 px-3">Eligible for refund review if a written cancellation request is submitted within <strong>{config.refundWindowDays} calendar days</strong> of payment AND prior to Franchise Agreement execution, territory lock, and partner portal activation.</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold">Post-Activation Franchise / Onboarding Service Fee</td>
                <td className="py-2.5 px-3">Once the Franchise Agreement is executed, territory allocation is locked, and onboarding credentials/digital deliverables have been provisioned, fees are non-refundable except in cases of verified billing error, duplicate charge, or material non-delivery of contracted onboarding deliverables.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="2. Duplicate, Failed, or Erroneous Transactions">
        <p>
          If an amount is debited from your bank account or payment instrument due to a technical failure, duplicate
          submission, or unconfirmed gateway session without receipt of services, the verified excess amount will be
          refunded in full to the original payment source after bank reconciliation.
        </p>
      </SectionCard>

      <SectionCard title="3. How to Request a Refund">
        <ol className="list-decimal pl-5 space-y-1.5">
          <li>Email <a href={`mailto:${config.officialEmail}`} className="text-indigo-600 dark:text-indigo-400 underline font-semibold">{config.officialEmail}</a> with the subject line <code>Refund Request – [Application ID]</code>, or submit a request via our <button type="button" onClick={() => onNavigate('contact')} className="text-indigo-600 dark:text-indigo-400 underline font-semibold cursor-pointer">Contact Us</button> page.</li>
          <li>Include your Full Name, Application ID, Payment Reference / UTR / Transaction ID, payment date, amount paid, and reason for the refund request.</li>
          <li>Our billing and compliance team will acknowledge receipt within <strong>{config.grievanceResponseHours} business hours</strong> and communicate a written decision within 5 business days.</li>
        </ol>
      </SectionCard>

      <SectionCard title="4. Refund Processing Timeline & Mode">
        <p>
          Approved refunds are processed within <strong>{config.refundProcessingTimeline}</strong>. Refunds are issued
          strictly back to the <strong>original payment source</strong> (original bank account, UPI ID, or payment
          gateway instrument used for the transaction). Cash refunds are not issued. Any verifiable bank/gateway charges
          or statutory taxes already remitted to government authorities, if applicable, will be disclosed transparently
          in the refund credit note.
        </p>
      </SectionCard>

      <SectionCard title="5. Disputes & Escalation">
        <p>
          If you disagree with a refund decision or experience a delay beyond 10 business days after approval, please
          escalate the matter through our{' '}
          <button type="button" onClick={() => onNavigate('grievance')} className="text-indigo-600 dark:text-indigo-400 underline font-semibold cursor-pointer">
            Grievance Redressal
          </button>{' '}
          mechanism before initiating a payment chargeback so we can resolve it promptly.
        </p>
      </SectionCard>
    </LegalPageShell>
  );
}

/* -------------------------------------------------------------------------- */
/* 5. CANCELLATION POLICY PAGE                                                */
/* -------------------------------------------------------------------------- */
export function CancellationPolicyPage({ onNavigate }: LegalPageProps) {
  const config = FranchiseStorageService.getComplianceConfig();

  return (
    <LegalPageShell
      badge="Application & Order Cancellation"
      icon={XCircle}
      title="Cancellation Policy"
      subtitle={`Clear procedure and timelines for cancelling a franchise application or franchise onboarding order with ${config.legalName}.`}
      lastUpdated={config.lastUpdatedAt}
      onNavigate={onNavigate}
    >
      <SectionCard title="1. Cancelling an Unpaid Application">
        <p>
          Applicants may withdraw or cancel an unpaid franchise application at any time at zero cost by emailing{' '}
          <a href={`mailto:${config.officialEmail}`} className="text-indigo-600 dark:text-indigo-400 underline font-semibold">{config.officialEmail}</a>{' '}
          with their Application ID. No cancellation fee applies.
        </p>
      </SectionCard>

      <SectionCard title="2. Cancelling a Paid Booking Before Activation">
        <p>
          If a franchise or booking payment has been submitted and the applicant wishes to cancel <strong>before</strong>{' '}
          countersignature of the Franchise Agreement and portal activation:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Submit a written cancellation request within <strong>{config.refundWindowDays} calendar days</strong> of payment to {config.officialEmail}.</li>
          <li>Upon verification that onboarding credentials, brand kit delivery, and territory allocation have not been activated, the cancellation will be confirmed in writing.</li>
          <li>Any eligible refund will be initiated under our{' '}
            <button type="button" onClick={() => onNavigate('refund')} className="text-indigo-600 dark:text-indigo-400 underline font-semibold cursor-pointer">
              Refund Policy
            </button>{' '}
            within {config.refundProcessingTimeline}.
          </li>
        </ul>
      </SectionCard>

      <SectionCard title="3. Cancellation After Agreement Execution & Onboarding Activation">
        <p>
          Once the Franchise Agreement has been executed by both parties and onboarding activation (portal credentials,
          territory reservation, and digital partner onboarding kit) has been delivered, termination or cancellation of
          the franchise relationship is governed by the termination clauses of the signed Franchise Agreement.
        </p>
      </SectionCard>

      <SectionCard title="4. Cancellation by TRUEDEAL GLOBAL">
        <p>
          {config.legalName} reserves the right to cancel an application or booking if KYC verification fails,
          submitted documents are found to be forged/inaccurate, or the requested territory is unavailable. In cases
          where {config.legalName} cancels due to territory unavailability or non-approval (without applicant fraud),
          100% of any paid franchise fee is refunded to the original payment source.
        </p>
      </SectionCard>
    </LegalPageShell>
  );
}

/* -------------------------------------------------------------------------- */
/* 6. FRANCHISE AGREEMENT / FRANCHISE TERMS PAGE                              */
/* -------------------------------------------------------------------------- */
export function FranchiseTermsPage({ onNavigate }: LegalPageProps) {
  const config = FranchiseStorageService.getComplianceConfig();

  return (
    <LegalPageShell
      badge="Commercial Partnership Disclosures"
      icon={Scale}
      title="Franchise Agreement & Franchise Terms"
      subtitle={`Summary of commercial rights, partner obligations, compliance standards, and onboarding governance for ${config.legalName} franchise packages.`}
      lastUpdated={config.lastUpdatedAt}
      onNavigate={onNavigate}
    >
      <SectionCard title="1. Binding Execution Requirement">
        <p>
          This page summarizes the key commercial terms of our franchise program for pre-application transparency.
          Formal franchise rights become effective <strong>only</strong> after manual KYC verification, payment
          reconciliation, and written execution of the official Franchise Agreement between the applicant and{' '}
          {config.legalName}.
        </p>
      </SectionCard>

      <SectionCard title="2. Rights Granted to Approved Franchisees">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Non-transferable authorization to represent approved {config.brandName} service verticals within the agreed territory scope.</li>
          <li>Access to centralized backend project delivery, commercial rate sheets, client proposal templates, and partner support desk.</li>
          <li>Transparent commission accounting on verified, fully paid client projects originated by the franchisee as specified in their tier schedule.</li>
          <li>Zero recurring annual royalty charges (subject to compliance with brand quality and lawful conduct standards).</li>
        </ul>
      </SectionCard>

      <SectionCard title="3. Franchisee Obligations">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Represent {config.brandName} services honestly without making false income promises, unverified rankings, or unauthorized legal commitments.</li>
          <li>Maintain valid local business registrations, tax compliance (including GST/income tax on earned commissions as applicable), and ethical client practices.</li>
          <li>Route client orders through official {config.legalName} invoicing and delivery workflows so service quality and consumer rights are protected.</li>
          <li>Refrain from promoting prohibited or restricted categories (including cryptocurrency trading, MLM schemes, gambling, unauthorized financial tips, or unlawful services).</li>
        </ul>
      </SectionCard>

      <SectionCard title="4. Independent Commercial Relationship & Risk Disclosure">
        <p>
          Every franchisee operates as an independent commercial business. {config.legalName} provides centralized
          backend service execution and onboarding support, but does not guarantee client acquisition volume, profit
          margins, or fixed monthly income. Prospective partners should independently evaluate package fees, local
          demand, and working capital needs before committing.
        </p>
      </SectionCard>

      <SectionCard title="5. Review & Questions Prior to Signing">
        <p>
          Prospective applicants may request a sample Franchise Agreement review copy after submitting an initial
          application or by emailing{' '}
          <a href={`mailto:${config.officialEmail}`} className="text-indigo-600 dark:text-indigo-400 underline font-semibold">{config.officialEmail}</a>.
        </p>
      </SectionCard>
    </LegalPageShell>
  );
}

/* -------------------------------------------------------------------------- */
/* 7. GRIEVANCE REDRESSAL PAGE                                                */
/* -------------------------------------------------------------------------- */
export function GrievanceRedressalPage({ onNavigate }: LegalPageProps) {
  const config = FranchiseStorageService.getComplianceConfig();
  const displayAddress = getDisplayRegisteredAddress(config);

  return (
    <LegalPageShell
      badge="Consumer Protection & Escalation Desk"
      icon={AlertTriangle}
      title="Grievance Redressal Policy"
      subtitle={`Dedicated escalation and resolution mechanism for applicants, franchise partners, and customers of ${config.legalName}.`}
      lastUpdated={config.lastUpdatedAt}
      onNavigate={onNavigate}
    >
      <SectionCard title="1. Level 1 — Customer Support Desk">
        <p>
          For initial questions regarding applications, invoices, onboarding timelines, cancellations, or refunds, please
          contact our Support Desk first:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Email:</strong> <a href={`mailto:${config.officialEmail}`} className="text-indigo-600 dark:text-indigo-400 underline font-semibold">{config.officialEmail}</a></li>
          <li><strong>Phone:</strong> <span className="font-mono font-bold">{config.supportPhone}</span></li>
          <li><strong>Support Hours:</strong> {config.supportHours}</li>
          <li><strong>Online Form:</strong> <button type="button" onClick={() => onNavigate('contact')} className="text-indigo-600 dark:text-indigo-400 underline font-semibold cursor-pointer">Submit Support / Grievance Ticket</button></li>
        </ul>
      </SectionCard>

      <SectionCard title="2. Level 2 — Grievance Officer Escalation">
        <p>
          If your issue is not resolved satisfactorily at Level 1, or relates to data privacy (DPDP Act 2023), billing
          disputes, or payment reconciliation, escalate directly to our Grievance Redressal Officer:
        </p>
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <span className="text-slate-400 block font-semibold">Grievance Officer Name</span>
              <span className="font-bold text-slate-900 dark:text-white">
                {config.grievanceOfficerName || 'Pending official appointment & corporate confirmation (Managed by Director’s Office)'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block font-semibold">Designation</span>
              <span className="font-bold text-slate-900 dark:text-white">
                {config.grievanceOfficerDesignation || 'Grievance Redressal Desk (Pending formal designation update)'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block font-semibold">Official Grievance Email</span>
              <a href={`mailto:${config.grievanceEmail}`} className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                {config.grievanceEmail}
              </a>
            </div>
            <div>
              <span className="text-slate-400 block font-semibold">Grievance Helpline</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">{config.grievancePhone}</span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
            <span className="text-slate-400 block font-semibold">Company Address</span>
            <span className="text-slate-700 dark:text-slate-300">{displayAddress}</span>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="3. Turnaround Time (SLA)">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60">
            <div className="flex items-center gap-2 font-bold text-indigo-900 dark:text-indigo-200">
              <Clock className="w-4 h-4" />
              <span>Acknowledgement SLA</span>
            </div>
            <p className="text-xs text-indigo-800 dark:text-indigo-300 mt-1">
              Within <strong>{config.grievanceResponseHours} hours</strong> of receiving a written grievance, with a unique tracking ticket number.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60">
            <div className="flex items-center gap-2 font-bold text-emerald-900 dark:text-emerald-200">
              <CheckCircle2 className="w-4 h-4" />
              <span>Resolution SLA</span>
            </div>
            <p className="text-xs text-emerald-800 dark:text-emerald-300 mt-1">
              Target resolution within <strong>{config.grievanceResolutionDays} business days</strong> (and no later than 30 days for complex billing/contract investigations).
            </p>
          </div>
        </div>
      </SectionCard>
    </LegalPageShell>
  );
}

/* -------------------------------------------------------------------------- */
/* 8. SHIPPING AND DELIVERY POLICY (SERVICE ONBOARDING DELIVERY)              */
/* -------------------------------------------------------------------------- */
export function DeliveryPolicyPage({ onNavigate }: LegalPageProps) {
  const config = FranchiseStorageService.getComplianceConfig();

  return (
    <LegalPageShell
      badge="Service Fulfillment & Activation"
      icon={Truck}
      title="Shipping and Delivery Policy"
      subtitle={`How ${config.legalName} delivers franchise onboarding services, digital credentials, and agreement documentation.`}
      lastUpdated={config.lastUpdatedAt}
      onNavigate={onNavigate}
    >
      <SectionCard title="1. Nature of Delivery (Digital & Service Onboarding)">
        <p>
          Franchise packages offered by <strong>{config.legalName}</strong> on{' '}
          <strong className="font-mono text-xs">{config.franchisePortalUrl}</strong> are commercial business services
          and digital partner onboarding packages. <strong>No physical goods are shipped by courier</strong> as part of
          standard franchise package purchases unless explicitly agreed in a separate written addendum (such as optional
          printed signage or welcome stationery).
        </p>
      </SectionCard>

      <SectionCard title="2. Digital Deliverables Included Upon Approval">
        <p>Following KYC verification, payment reconciliation, and Franchise Agreement execution, approved partners receive delivery via their registered email and portal account:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Countersigned digital Franchise Agreement and official payment receipt/invoice.</li>
          <li>Partner portal activation credentials and Application/Partner ID confirmation.</li>
          <li>Digital service catalog, commercial rate cards, and partner onboarding guidelines.</li>
          <li>Scheduled onboarding orientation session details and assigned coordinator contact.</li>
        </ul>
      </SectionCard>

      <SectionCard title="3. Activation & Delivery Timelines">
        <div className="overflow-x-auto pt-1">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
                <th className="py-2.5 px-3 font-bold">Onboarding Milestone</th>
                <th className="py-2.5 px-3 font-bold">Expected Timeline</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              <tr>
                <td className="py-2.5 px-3 font-semibold">Application Receipt & Tracking ID</td>
                <td className="py-2.5 px-3">Immediate upon online submission</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold">Manual KYC & Eligibility Review</td>
                <td className="py-2.5 px-3">2–4 business days</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold">Payment Verification & Receipt Issuance</td>
                <td className="py-2.5 px-3">1–2 business days after bank reconciliation</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-semibold">Franchise Agreement Execution & Portal Activation</td>
                <td className="py-2.5 px-3">3–7 business days (up to 15 business days for Enterprise/Global custom setups)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="4. Delayed or Undelivered Onboarding">
        <p>
          If you have completed verification and payment reconciliation but have not received your onboarding
          credentials or agreement within the stated timeline, please contact{' '}
          <a href={`mailto:${config.officialEmail}`} className="text-indigo-600 dark:text-indigo-400 underline font-semibold">{config.officialEmail}</a>{' '}
          or call <span className="font-mono font-bold">{config.supportPhone}</span>. Unresolved delivery failures are
          eligible for escalation under our{' '}
          <button type="button" onClick={() => onNavigate('refund')} className="text-indigo-600 dark:text-indigo-400 underline font-semibold cursor-pointer">
            Refund Policy
          </button>
          .
        </p>
      </SectionCard>
    </LegalPageShell>
  );
}
