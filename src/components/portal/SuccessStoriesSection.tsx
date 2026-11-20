import {
  FileCheck,
  ShieldCheck,
  Handshake,
  Laptop,
  ArrowRight,
  CheckCircle2,
  Scale,
  Clock,
  Info
} from 'lucide-react';
import { Currency } from '../../types/franchise';

interface SuccessStoriesSectionProps {
  currency: Currency;
  onSelectPlan: (planId: string) => void;
  onNavigate?: (tab: string) => void;
}

export function SuccessStoriesSection({ onSelectPlan, onNavigate }: SuccessStoriesSectionProps) {
  const steps = [
    {
      step: '01',
      title: 'Review Packages & Legal Terms',
      icon: Scale,
      timeline: 'Self-Paced',
      desc: 'Compare all 8 INR franchise packages, inclusions, exclusions, Refund Policy, Cancellation Policy, and Franchise Terms before committing.'
    },
    {
      step: '02',
      title: 'Online Application & KYC Upload',
      icon: FileCheck,
      timeline: '10–15 Minutes',
      desc: 'Submit your personal or entity profile, territory preference, and verification documents through the guided application portal.'
    },
    {
      step: '03',
      title: 'Manual Compliance Review',
      icon: ShieldCheck,
      timeline: '2–4 Business Days',
      desc: 'Our compliance officers manually review your KYC records and territory availability. Submitting an application does not guarantee automatic approval.'
    },
    {
      step: '04',
      title: 'Fee Reconciliation & Agreement Execution',
      icon: Handshake,
      timeline: '1–3 Business Days',
      desc: 'Upon package confirmation, reconcile the applicable franchise fee through verified corporate channels and execute the written Franchise Agreement.'
    },
    {
      step: '05',
      title: 'Digital Onboarding & Support Desk',
      icon: Laptop,
      timeline: '3–7 Business Days',
      desc: 'Receive your countersigned agreement, partner credentials, digital rate cards, service catalog, and dedicated operational coordinator contact.'
    }
  ];

  const operationalStandards = [
    'Centralized backend fulfillment by TRUEDEAL GLOBAL teams for approved IT, digital marketing, travel, visa assistance, real estate, and corporate services.',
    'Transparent INR fee schedule with zero recurring annual royalties — all applicable taxes and third-party costs disclosed upfront.',
    'Written Franchise Agreement required before any territory reservation or partner activation.',
    'Dedicated customer support and Grievance Redressal desk with documented acknowledgement and resolution timelines.'
  ];

  return (
    <section className="space-y-10 py-10" id="success-stories">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
          <Clock className="w-3.5 h-3.5" />
          <span>Transparent Onboarding Lifecycle · No Automatic Approval Claims</span>
        </div>

        <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
          How Franchise Onboarding Works
        </h2>

        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
          Every TRUEDEAL GLOBAL OPC PVT LTD franchise partnership follows a documented 5-stage compliance, verification,
          agreement, and digital onboarding workflow.
        </p>
      </div>

      {/* 5-Stage Onboarding Stepper Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {steps.map((item) => (
          <div
            key={item.step}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-2xs"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-lg">
                  STEP {item.step}
                </span>
                <item.icon className="w-4 h-4 text-slate-400" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                {item.title}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {item.desc}
              </p>
            </div>
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Typical Timeline: <span className="text-slate-800 dark:text-slate-200">{item.timeline}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Commercial Governance & Disclosure Box */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            What Approved Franchise Partners Receive
          </h3>
          <ul className="space-y-3 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
            {operationalStandards.map((point, idx) => (
              <li key={idx} className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:col-span-5 bg-slate-900 text-white border border-slate-800 rounded-2xl p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
              <Info className="w-4 h-4" />
              <span>Honest Commercial Disclosure</span>
            </div>
            <h3 className="text-lg font-bold text-white">
              No Fabricated Testimonials or Guaranteed Earnings
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              TRUEDEAL GLOBAL OPC PVT LTD does not publish fabricated partner reviews or guarantee monthly income,
              returns, or passive payouts. Franchisees operate as independent commercial entities whose results depend
              on local client demand and active business effort.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => onSelectPlan('plan_standard')}
              className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Start Application</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('franchise-terms')}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Read Franchise Terms
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
