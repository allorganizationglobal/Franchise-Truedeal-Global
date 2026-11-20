import {
  IndianRupee,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  ArrowRight,
  Info,
  ShieldCheck
} from 'lucide-react';
import { FranchiseStorageService } from '../../services/storage';
import { calculateFeeBreakdownINR, getPlanTransparencyDefaults } from '../../config/complianceConfig';

interface PricingTransparencyPageProps {
  onSelectPlan: (planId: string) => void;
  onNavigate: (tab: string) => void;
}

export function PricingTransparencyPage({ onSelectPlan, onNavigate }: PricingTransparencyPageProps) {
  const config = FranchiseStorageService.getComplianceConfig();
  const plans = FranchiseStorageService.getPlans();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      {/* Header */}
      <div className="space-y-3 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
          <IndianRupee className="w-4 h-4" />
          <span>Official INR Schedule of Fees & Package Disclosures</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
          Pricing and Franchise Packages
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-4xl leading-relaxed">
          Complete, transparent fee schedule published by <strong className="text-slate-900 dark:text-slate-200">{config.legalName}</strong>.
          All amounts below are listed in Indian Rupees (INR). Submitting an online franchise application does not
          automatically approve a franchise or guarantee business earnings; every onboarding requires manual compliance
          verification and execution of a written Franchise Agreement.
        </p>
      </div>

      {/* Fee Structure & Tax Disclosure Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5">
          <div className="text-xs font-bold uppercase text-slate-400">Application Filing Fee</div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            ₹{config.applicationFeeINR.toLocaleString('en-IN')}
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Online application submission and initial eligibility review carry no separate application fee unless explicitly stated on a written invoice.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5">
          <div className="text-xs font-bold uppercase text-slate-400">GST & Tax Treatment</div>
          <div className="text-sm font-bold text-slate-900 dark:text-white">
            {config.gstStatus === 'excluded' && `${config.gstRatePercent}% GST Extra (Shown separately at checkout)`}
            {config.gstStatus === 'included' && `Prices Inclusive of ${config.gstRatePercent}% GST`}
            {config.gstStatus === 'not_applicable' && 'GST Not Applicable'}
            {config.gstStatus === 'pending_confirmation' && 'GST Treatment Pending Confirmation'}
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {config.gstin ? `GSTIN: ${config.gstin}` : 'GSTIN and tax invoice format will be confirmed by company management before live online gateway activation.'}
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5">
          <div className="text-xs font-bold uppercase text-slate-400">Payment Gateway Status</div>
          <div className="text-sm font-bold text-amber-700 dark:text-amber-400">
            Online Gateway Verification Pending
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Live Razorpay online checkout is currently disabled pending merchant onboarding approval. Verified corporate bank transfer references are reconciled manually.
          </p>
        </div>
      </div>

      {/* Summary Fee Comparison Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            INR Package Fee Summary
          </h2>
          <div className="text-xs text-slate-500">
            All fees are one-time franchise onboarding fees · Zero recurring annual royalty
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs uppercase">
                <th className="py-3.5 px-4 font-bold">Franchise Package</th>
                <th className="py-3.5 px-4 font-bold">Application Fee</th>
                <th className="py-3.5 px-4 font-bold">Franchise Fee (INR)</th>
                <th className="py-3.5 px-4 font-bold">GST / Total Payable</th>
                <th className="py-3.5 px-4 font-bold">Territory Scope</th>
                <th className="py-3.5 px-4 font-bold">Activation Timeline</th>
                <th className="py-3.5 px-4 font-bold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {plans.map((plan) => {
                const breakdown = calculateFeeBreakdownINR(plan.priceINR, config);
                const defaults = getPlanTransparencyDefaults(plan);
                return (
                  <tr key={plan.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="py-4 px-4">
                      <div className="font-bold text-slate-900 dark:text-white">{plan.title}</div>
                      <div className="text-xs text-slate-500">{plan.subtitle}</div>
                    </td>
                    <td className="py-4 px-4 font-mono text-slate-700 dark:text-slate-300">
                      ₹{defaults.applicationFeeINR.toLocaleString('en-IN')}
                    </td>
                    <td className="py-4 px-4 font-mono font-bold text-slate-900 dark:text-white">
                      ₹{plan.priceINR.toLocaleString('en-IN')}
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        ₹{breakdown.totalPayableINR.toLocaleString('en-IN')}
                      </div>
                      <div className="text-[11px] text-slate-500">{breakdown.gstLabel}</div>
                    </td>
                    <td className="py-4 px-4 text-xs text-slate-700 dark:text-slate-300">
                      {plan.territoryScope}
                    </td>
                    <td className="py-4 px-4 text-xs text-slate-600 dark:text-slate-400 max-w-[200px]">
                      {defaults.activationTimeline}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => onSelectPlan(plan.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors cursor-pointer"
                      >
                        <span>Apply</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed Disclosure Cards for Every Package */}
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          Detailed Package Inclusions, Exclusions & Terms
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {plans.map((plan) => {
            const breakdown = calculateFeeBreakdownINR(plan.priceINR, config);
            const defaults = getPlanTransparencyDefaults(plan);

            return (
              <div
                key={plan.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5 flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                        {plan.badge}
                      </span>
                      <h3 className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                        {plan.title}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">{plan.servicesCovered}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xl font-black font-mono text-slate-900 dark:text-white">
                        ₹{breakdown.totalPayableINR.toLocaleString('en-IN')}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {breakdown.isGstPendingConfirmation
                          ? 'Base INR (GST TBC)'
                          : breakdown.gstLabel}
                      </div>
                    </div>
                  </div>

                  {/* Services Included */}
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Included Services & Deliverables</span>
                    </div>
                    <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                      {plan.features.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-emerald-500 font-bold">•</span>
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Services Excluded */}
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <XCircle className="w-3.5 h-3.5 text-rose-500" />
                      <span>Not Included (Excluded Costs)</span>
                    </div>
                    <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
                      {defaults.servicesExcluded.map((ex, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-rose-500 font-bold">•</span>
                          <span>{ex}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Rights, Schedule, Refund, Timeline */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/50 space-y-1">
                      <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Activation Timeline</span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{defaults.activationTimeline}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/50 space-y-1">
                      <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Refund & Cancellation</span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{defaults.refundEligibility}</p>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    <strong>Additional Charges Note:</strong> {defaults.additionalChargesNote}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-3 text-xs">
                    <button
                      type="button"
                      onClick={() => onNavigate('refund')}
                      className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium cursor-pointer"
                    >
                      Refund Policy
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigate('franchise-terms')}
                      className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium cursor-pointer"
                    >
                      Franchise Terms
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectPlan(plan.id)}
                    className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>Select & Apply</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Important Commercial Disclaimer */}
      <div className="p-6 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 space-y-2 text-xs text-amber-900 dark:text-amber-200">
        <div className="font-bold flex items-center gap-2 text-sm">
          <Info className="w-4 h-4 shrink-0" />
          <span>Commercial & No-Guarantee Disclosure</span>
        </div>
        <p className="leading-relaxed">
          Commission percentages listed in package tiers apply strictly to verified, realized client service invoices
          billed and collected through {config.legalName} under a signed Franchise Agreement. Franchisees are independent
          commercial partners; actual revenue depends on client acquisition effort, local market demand, and compliance
          with service terms. No fixed salary, guaranteed return, or passive income is promised or implied.
        </p>
        <div className="pt-2 flex flex-wrap gap-4 font-semibold">
          <button type="button" onClick={() => onNavigate('terms')} className="underline cursor-pointer flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" /> Terms & Conditions
          </button>
          <button type="button" onClick={() => onNavigate('cancellation')} className="underline cursor-pointer">
            Cancellation Policy
          </button>
          <button type="button" onClick={() => onNavigate('delivery')} className="underline cursor-pointer">
            Service Delivery Policy
          </button>
        </div>
      </div>
    </div>
  );
}
