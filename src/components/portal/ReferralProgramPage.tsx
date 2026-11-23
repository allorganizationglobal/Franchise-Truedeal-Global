import { useState, useMemo, useRef } from 'react';
import {
  Gift,
  Link2,
  Share2,
  Wallet,
  Calculator,
  Copy,
  Check,
  Search,
  ShieldCheck,
  ArrowRight,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  IndianRupee,
  TrendingUp,
  BadgeCheck,
  FileCheck2
} from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import { FranchiseStorageService } from '../../services/storage';
import {
  REFERRAL_COMMISSION_PERCENT,
  calculateReferralCommissionINR,
  buildReferralLink,
  buildWhatsAppReferralShareUrl,
  normalizeReferralCodeClient
} from '../../utils/referralTracking';
import { ReferralPartner, ReferralAttributionRecord, ReferralPayoutStatus } from '../../types/franchise';
import { WhatsAppIcon } from '../common/WhatsAppSupportWidget';

interface ReferralProgramPageProps {
  currentUser?: FirebaseUser | null;
  onNavigate?: (tab: string) => void;
}

interface LookupSummary {
  totalReferrals: number;
  pendingSignups: number;
  verifiedSignups: number;
  blockedSelfReferrals: number;
  totalCommissionEarnedINR: number;
  pendingCommissionINR: number;
  approvedCommissionINR: number;
  paidCommissionINR: number;
}

interface LookupReferralRow {
  referralId: string;
  applicantDisplayName: string;
  planTitle: string;
  orderAmountINR: number;
  commissionAmountINR: number;
  paymentStatus: 'PENDING' | 'CAPTURED' | 'REFUNDED' | 'FAILED';
  payoutStatus: ReferralPayoutStatus;
  payoutUtr?: string;
  selfReferralBlocked: boolean;
  createdAt: string;
}

interface LookupState {
  partner: {
    referralCode: string;
    name: string;
    shareUrl: string;
    payoutHandleMasked: string;
    createdAt: string;
  };
  summary: LookupSummary;
  referrals: LookupReferralRow[];
}

function maskHandleLocal(value: string): string {
  const trimmed = String(value || '').trim();
  if (!trimmed) return 'On file';
  if (trimmed.includes('@')) {
    const [u, b] = trimmed.split('@');
    return `${u.slice(0, 2)}***@${b}`;
  }
  if (trimmed.length <= 6) return '***' + trimmed.slice(-2);
  return `${trimmed.slice(0, 3)}••••${trimmed.slice(-4)}`;
}

function maskNameLocal(name: string): string {
  const parts = String(name || 'Applicant').trim().split(/\s+/);
  if (parts.length === 1) return parts[0].length > 2 ? `${parts[0].slice(0, 2)}***` : parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

export function ReferralProgramPage({ currentUser, onNavigate }: ReferralProgramPageProps) {
  const plans = useMemo(() => FranchiseStorageService.getPlans(), []);

  // Section refs for smooth scroll jumps
  const generatorRef = useRef<HTMLDivElement>(null);
  const calculatorRef = useRef<HTMLDivElement>(null);
  const lookupRef = useRef<HTMLDivElement>(null);

  // Interactive Earnings Calculator state
  const [calcPlanId, setCalcPlanId] = useState<string>(() => plans[1]?.id || plans[0]?.id || 'plan_standard');
  const [monthlyReferrals, setMonthlyReferrals] = useState<number>(5);

  const selectedCalcPlan = useMemo(
    () => plans.find((p) => p.id === calcPlanId) || plans[0],
    [plans, calcPlanId]
  );
  const calcPerReferralINR = useMemo(
    () => calculateReferralCommissionINR(selectedCalcPlan?.priceINR || 0),
    [selectedCalcPlan]
  );
  const calcMonthlyINR = calcPerReferralINR * monthlyReferrals;
  const calcAnnualINR = calcMonthlyINR * 12;

  // Instant Referral Link Generator state
  const [partnerName, setPartnerName] = useState<string>(currentUser?.displayName || '');
  const [partnerPhone, setPartnerPhone] = useState<string>('');
  const [partnerEmail, setPartnerEmail] = useState<string>(currentUser?.email || '');
  const [partnerUpiOrBank, setPartnerUpiOrBank] = useState<string>('');
  const [genBusy, setGenBusy] = useState<boolean>(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [generatedPartner, setGeneratedPartner] = useState<{
    partner: ReferralPartner;
    shareUrl: string;
    reused: boolean;
  } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Partner Status Lookup state
  const [lookupQuery, setLookupQuery] = useState<string>('');
  const [lookupBusy, setLookupBusy] = useState<boolean>(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupResult, setLookupResult] = useState<LookupState | null>(null);

  const scrollToRef = (ref: React.RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2200);
  };

  const handleSelectPlanInCalculator = (planId: string) => {
    setCalcPlanId(planId);
    scrollToRef(calculatorRef);
  };

  const handleGenerateReferralLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenError(null);

    const cleanName = partnerName.trim();
    const phone10 = partnerPhone.replace(/\D/g, '').slice(-10);
    const cleanEmail = partnerEmail.trim().toLowerCase();
    const cleanUpi = partnerUpiOrBank.trim();

    if (cleanName.length < 2) {
      setGenError('Please enter your full name (at least 2 characters).');
      return;
    }
    if (!/^[6-9]\d{9}$/.test(phone10)) {
      setGenError('Please enter a valid 10-digit Indian WhatsApp mobile number.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setGenError('Please enter a valid email address for commission alerts.');
      return;
    }
    if (cleanUpi.length < 4) {
      setGenError('Please enter your UPI ID (e.g., name@upi) or Bank Account + IFSC for payouts.');
      return;
    }

    setGenBusy(true);
    try {
      const res = await fetch('/api/referrals/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cleanName,
          phone: phone10,
          email: cleanEmail,
          upiOrBankDetails: cleanUpi,
          userId: currentUser?.uid
        })
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok || !data?.partner?.referralCode) {
        setGenError(data?.message || 'Unable to generate referral link right now. Please verify your details and retry.');
        return;
      }

      const partner: ReferralPartner = {
        referralCode: data.partner.referralCode,
        name: data.partner.name,
        phone: data.partner.phone,
        email: data.partner.email,
        upiOrBankDetails: data.partner.upiOrBankDetails,
        userId: data.partner.userId || currentUser?.uid,
        createdAt: data.partner.createdAt,
        updatedAt: data.partner.updatedAt
      };

      FranchiseStorageService.saveReferralPartner(partner, true);
      setGeneratedPartner({
        partner,
        shareUrl: data.shareUrl || buildReferralLink(partner.referralCode),
        reused: Boolean(data.reused)
      });
      setLookupQuery(partner.referralCode);
    } catch {
      setGenError('Network error while connecting to the referral registration service. Please retry.');
    } finally {
      setGenBusy(false);
    }
  };

  const buildLocalLookupFallback = (rawQuery: string): LookupState | null => {
    const trimmed = rawQuery.trim();
    const normCode = normalizeReferralCodeClient(trimmed);
    const digits10 = trimmed.replace(/\D/g, '').slice(-10);

    const localPartners = FranchiseStorageService.getReferralPartners();
    const localRecords = FranchiseStorageService.getReferralRecords();

    const matchedPartner = localPartners.find(
      (p) =>
        (normCode && p.referralCode === normCode) ||
        (digits10.length === 10 && p.phone.replace(/\D/g, '').slice(-10) === digits10)
    );

    const targetCode = matchedPartner?.referralCode || normCode;
    const matchedRecords: ReferralAttributionRecord[] = targetCode
      ? localRecords.filter((r) => r.referralCode === targetCode)
      : [];

    if (!matchedPartner && matchedRecords.length === 0) return null;

    const validVerified = matchedRecords.filter(
      (r) => r.paymentStatus === 'CAPTURED' && !r.selfReferralBlocked && r.payoutStatus !== 'Rejected'
    );
    const effectiveCode = matchedPartner?.referralCode || targetCode;

    return {
      partner: {
        referralCode: effectiveCode,
        name: matchedPartner?.name || matchedRecords[0]?.referrerName || 'Registered Referral Partner',
        shareUrl: buildReferralLink(effectiveCode),
        payoutHandleMasked: maskHandleLocal(
          matchedPartner?.upiOrBankDetails || matchedRecords[0]?.referrerUpiOrBank || ''
        ),
        createdAt: matchedPartner?.createdAt || matchedRecords[0]?.createdAt || new Date().toISOString()
      },
      summary: {
        totalReferrals: matchedRecords.length,
        pendingSignups: matchedRecords.filter((r) => r.paymentStatus === 'PENDING').length,
        verifiedSignups: validVerified.length,
        blockedSelfReferrals: matchedRecords.filter((r) => r.selfReferralBlocked).length,
        totalCommissionEarnedINR: validVerified.reduce((s, r) => s + r.commissionAmountINR, 0),
        pendingCommissionINR: validVerified
          .filter((r) => r.payoutStatus === 'Pending')
          .reduce((s, r) => s + r.commissionAmountINR, 0),
        approvedCommissionINR: validVerified
          .filter((r) => r.payoutStatus === 'Approved')
          .reduce((s, r) => s + r.commissionAmountINR, 0),
        paidCommissionINR: validVerified
          .filter((r) => r.payoutStatus === 'Paid')
          .reduce((s, r) => s + r.commissionAmountINR, 0)
      },
      referrals: matchedRecords.map((r) => ({
        referralId: r.referralId,
        applicantDisplayName: maskNameLocal(r.applicantName),
        planTitle: r.planTitle,
        orderAmountINR: r.orderAmountINR,
        commissionAmountINR: r.selfReferralBlocked || r.paymentStatus !== 'CAPTURED' ? 0 : r.commissionAmountINR,
        paymentStatus: r.paymentStatus,
        payoutStatus: r.payoutStatus,
        payoutUtr: r.payoutUtr,
        selfReferralBlocked: r.selfReferralBlocked,
        createdAt: r.createdAt
      }))
    };
  };

  const runPartnerStatusLookup = async (queryValue: string) => {
    const trimmed = queryValue.trim();
    setLookupError(null);
    if (trimmed.length < 4) {
      setLookupError('Enter your Referral Code (e.g., TD-RAHUL1234) or 10-digit registered Mobile Number.');
      return;
    }

    setLookupBusy(true);
    try {
      const res = await fetch(`/api/referrals/status?query=${encodeURIComponent(trimmed)}`);
      const data = await res.json().catch(() => null);

      const localFallback = buildLocalLookupFallback(trimmed);

      if (res.ok && data?.ok && data?.partner && data?.summary) {
        // Merge any locally persisted verified records not yet in this serverless instance memory
        const serverRows: LookupReferralRow[] = Array.isArray(data.referrals) ? data.referrals : [];
        const mergedMap = new Map<string, LookupReferralRow>();
        (localFallback?.referrals || []).forEach((r) => mergedMap.set(r.referralId, r));
        serverRows.forEach((r) => mergedMap.set(r.referralId, r));
        const mergedRows = Array.from(mergedMap.values()).sort((a, b) =>
          b.createdAt.localeCompare(a.createdAt)
        );

        const validVerified = mergedRows.filter(
          (r) => r.paymentStatus === 'CAPTURED' && !r.selfReferralBlocked && r.payoutStatus !== 'Rejected'
        );

        setLookupResult({
          partner: data.partner,
          summary: {
            totalReferrals: mergedRows.length,
            pendingSignups: mergedRows.filter((r) => r.paymentStatus === 'PENDING').length,
            verifiedSignups: validVerified.length,
            blockedSelfReferrals: mergedRows.filter((r) => r.selfReferralBlocked).length,
            totalCommissionEarnedINR: validVerified.reduce((s, r) => s + r.commissionAmountINR, 0),
            pendingCommissionINR: validVerified
              .filter((r) => r.payoutStatus === 'Pending')
              .reduce((s, r) => s + r.commissionAmountINR, 0),
            approvedCommissionINR: validVerified
              .filter((r) => r.payoutStatus === 'Approved')
              .reduce((s, r) => s + r.commissionAmountINR, 0),
            paidCommissionINR: validVerified
              .filter((r) => r.payoutStatus === 'Paid')
              .reduce((s, r) => s + r.commissionAmountINR, 0)
          },
          referrals: mergedRows
        });
      } else if (localFallback) {
        setLookupResult(localFallback);
      } else {
        setLookupResult(null);
        setLookupError(
          data?.message || 'No referral partner or tracked referrals found for that Code or Mobile Number.'
        );
      }
    } catch {
      const localFallback = buildLocalLookupFallback(trimmed);
      if (localFallback) {
        setLookupResult(localFallback);
      } else {
        setLookupError('Could not reach the referral status service. Please retry.');
      }
    } finally {
      setLookupBusy(false);
    }
  };

  const handleLookupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runPartnerStatusLookup(lookupQuery);
  };

  const maxPlan = plans[plans.length - 1];
  const minPlan = plans[0];
  const maxCommissionINR = calculateReferralCommissionINR(maxPlan?.priceINR || 999999);
  const minCommissionINR = calculateReferralCommissionINR(minPlan?.priceINR || 2500);

  return (
    <div className="w-full">
      {/* 1. HERO SECTION */}
      <section className="relative bg-slate-950 text-white border-b border-slate-800 overflow-hidden">
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at 18% 20%, rgba(99, 102, 241, 0.45), transparent 45%), radial-gradient(circle at 82% 80%, rgba(16, 185, 129, 0.35), transparent 48%)'
          }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16 lg:py-20">
          <div className="max-w-3xl space-y-5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-400">
              <Gift className="w-4 h-4 shrink-0" />
              <span>TRUEDEAL GLOBAL OPC PVT LTD · Official Franchise Referral Program</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-[1.1] text-white">
              Refer &amp; Earn {REFERRAL_COMMISSION_PERCENT}% Instant Commission on Every Franchise Registration
            </h1>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
              Invite entrepreneurs, business owners, and franchise partners to join TRUEDEAL GLOBAL across all 8
              official franchise tiers. Earn{' '}
              <span className="font-bold text-white tabular-nums">
                ₹{minCommissionINR.toLocaleString('en-IN')} to ₹{maxCommissionINR.toLocaleString('en-IN')}
              </span>{' '}
              per verified Razorpay registration — credited directly to your UPI or Bank Account within 48–72 hours.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => scrollToRef(generatorRef)}
                className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/20 transition-all inline-flex items-center gap-2 cursor-pointer"
              >
                <Link2 className="w-4 h-4" />
                <span>Generate My Referral Link</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollToRef(calculatorRef)}
                className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-semibold text-sm transition-all inline-flex items-center gap-2 cursor-pointer"
              >
                <Calculator className="w-4 h-4 text-amber-400" />
                <span>Income Calculator</span>
              </button>
              <button
                type="button"
                onClick={() => scrollToRef(lookupRef)}
                className="px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-slate-700 text-slate-200 font-semibold text-sm transition-all inline-flex items-center gap-2 cursor-pointer"
              >
                <Search className="w-4 h-4 text-emerald-400" />
                <span>Track My Payouts</span>
              </button>
            </div>
          </div>

          {/* 3-Step Visual Guide */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
            {[
              {
                step: '01',
                icon: Link2,
                iconBg: 'bg-indigo-500/20 text-indigo-300 border-indigo-400/30',
                title: '1. Generate Your Unique Referral Link',
                desc: 'Enter your Name, WhatsApp Mobile, Email, and UPI/Bank details to get your verified TD-CODE and personal franchise link instantly.'
              },
              {
                step: '02',
                icon: Share2,
                iconBg: 'bg-amber-500/20 text-amber-300 border-amber-400/30',
                title: '2. Share via WhatsApp / Social',
                desc: 'Send your link via WhatsApp, LinkedIn, or email. Anyone visiting within 30 days automatically gets your referral code pre-applied.'
              },
              {
                step: '03',
                icon: Wallet,
                iconBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
                title: '3. Earn Direct Bank / UPI Payout on Verified Razorpay Payment',
                desc: 'As soon as your referral completes server-verified Razorpay payment capture, your 10% commission is queued for UPI/NEFT payout in 48–72 hours.'
              }
            ].map((item) => (
              <div
                key={item.step}
                className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${item.iconBg}`}>
                    <item.icon className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-500">STEP {item.step}</span>
                </div>
                <h2 className="text-sm sm:text-base font-bold text-white leading-snug">{item.title}</h2>
                <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-14">
        {/* 2. INTERACTIVE 8-PLAN REFERRAL COMMISSION TABLE */}
        <section className="space-y-5">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Transparent 10% Commission Schedule
              </span>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                Referral Payout Across All {plans.length} Franchise Plans
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
                Every official TRUEDEAL GLOBAL franchise package qualifies for a flat 10% referral commission rounded
                to the nearest whole rupee — from ₹250 on the Basic Plan up to ₹1,00,000 on the Global Plan.
              </p>
            </div>
            <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 shrink-0">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Calculated strictly on server-verified base franchise fee</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    <th className="py-3.5 px-4 sm:px-6">Franchise Plan</th>
                    <th className="py-3.5 px-4 text-right">Franchise Fee (INR)</th>
                    <th className="py-3.5 px-4 text-center">Commission Rate</th>
                    <th className="py-3.5 px-4 text-right">Earnings Per Referral</th>
                    <th className="py-3.5 px-4 sm:px-6 text-right">Estimate Income</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs sm:text-sm">
                  {plans.map((plan) => {
                    const payoutINR = calculateReferralCommissionINR(plan.priceINR);
                    const isGlobal = plan.id === 'plan_global';
                    const isSelectedInCalc = calcPlanId === plan.id;

                    return (
                      <tr
                        key={plan.id}
                        className={`transition-colors ${
                          isGlobal
                            ? 'bg-emerald-50/70 dark:bg-emerald-950/25'
                            : isSelectedInCalc
                            ? 'bg-indigo-50/50 dark:bg-indigo-950/20'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="py-3.5 px-4 sm:px-6">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 dark:text-white">{plan.title}</span>
                            {isGlobal && (
                              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                                Highest Payout
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                            {plan.territoryScope}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-semibold tabular-nums text-slate-800 dark:text-slate-200 whitespace-nowrap">
                          ₹{plan.priceINR.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {REFERRAL_COMMISSION_PERCENT}%
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-black tabular-nums text-emerald-700 dark:text-emerald-400 whitespace-nowrap text-sm sm:text-base">
                          ₹{payoutINR.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3.5 px-4 sm:px-6 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleSelectPlanInCalculator(plan.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                              isSelectedInCalc
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:text-indigo-700 dark:hover:text-indigo-300'
                            }`}
                          >
                            {isSelectedInCalc ? 'Selected' : 'Calculate'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* 3. INTERACTIVE EARNINGS CALCULATOR + INSTANT LINK GENERATOR (2-Column Grid on Desktop) */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Interactive Earnings Calculator */}
          <div
            ref={calculatorRef}
            className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 sm:p-7 space-y-6 scroll-mt-24"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                <Calculator className="w-4 h-4" />
                <span>Interactive Earnings Calculator</span>
              </div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">
                Project Your Monthly &amp; Annual Referral Income
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Choose any franchise plan and adjust monthly referrals (1 to 50) to preview your 10% payout potential.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="calc-plan-select"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Select Franchise Plan
                </label>
                <select
                  id="calc-plan-select"
                  value={calcPlanId}
                  onChange={(e) => setCalcPlanId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} — Fee ₹{p.priceINR.toLocaleString('en-IN')} (₹
                      {calculateReferralCommissionINR(p.priceINR).toLocaleString('en-IN')} / referral)
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="calc-monthly-slider"
                    className="text-xs font-bold text-slate-700 dark:text-slate-300"
                  >
                    Monthly Verified Referrals
                  </label>
                  <span className="text-lg font-black font-mono tabular-nums text-indigo-600 dark:text-indigo-400">
                    {monthlyReferrals} / month
                  </span>
                </div>
                <input
                  id="calc-monthly-slider"
                  type="range"
                  min={1}
                  max={50}
                  step={1}
                  value={monthlyReferrals}
                  onChange={(e) => setMonthlyReferrals(Number(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer h-2 rounded-lg bg-slate-200 dark:bg-slate-700"
                />
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400">
                  {[1, 5, 10, 25, 50].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setMonthlyReferrals(preset)}
                      className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                        monthlyReferrals === preset
                          ? 'bg-indigo-600 text-white font-bold'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Live Computed Output Cards */}
            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                    10% Payout Per Referral
                  </span>
                  <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                    {selectedCalcPlan?.title}
                  </span>
                </div>
                <span className="text-lg font-black font-mono tabular-nums text-slate-900 dark:text-white">
                  ₹{calcPerReferralINR.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                    <IndianRupee className="w-3.5 h-3.5" />
                    <span>Monthly Income</span>
                  </div>
                  <div className="text-2xl font-black font-mono tabular-nums text-indigo-950 dark:text-white mt-1.5">
                    ₹{calcMonthlyINR.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[11px] text-indigo-700/80 dark:text-indigo-300/80 mt-0.5">
                    {monthlyReferrals} verified signup{monthlyReferrals > 1 ? 's' : ''} / mo
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>Annual Income</span>
                  </div>
                  <div className="text-2xl font-black font-mono tabular-nums text-emerald-950 dark:text-white mt-1.5">
                    ₹{calcAnnualINR.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80 mt-0.5">
                    {monthlyReferrals * 12} verified signups / yr
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Illustrative projection based on 10% commission on base franchise package fee. Actual payouts depend on
                server-verified Razorpay payment capture of non-refunded, eligible third-party registrations.
              </p>
            </div>
          </div>

          {/* Instant Referral Link Generator Card */}
          <div
            ref={generatorRef}
            className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 sm:p-7 space-y-6 scroll-mt-24"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                <Link2 className="w-4 h-4" />
                <span>Instant Referral Link Generator</span>
              </div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">
                Create Your Unique Partner Referral Code &amp; Link
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Open to registered TRUEDEAL GLOBAL franchise partners and individual referrers. Generate your link in
                under 30 seconds — no sign-up fee required.
              </p>
            </div>

            <form onSubmit={handleGenerateReferralLink} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={partnerName}
                    onChange={(e) => setPartnerName(e.target.value)}
                    placeholder="e.g., Rahul Sharma"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    10-Digit WhatsApp Mobile Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={partnerPhone}
                    onChange={(e) => setPartnerPhone(e.target.value)}
                    placeholder="e.g., 9876543210"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Email Address (For Commission Alerts) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={partnerEmail}
                    onChange={(e) => setPartnerEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    UPI ID or Bank Account + IFSC <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={partnerUpiOrBank}
                    onChange={(e) => setPartnerUpiOrBank(e.target.value)}
                    placeholder="rahul@upi or A/C 1234567890 / BARB0..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {genError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{genError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={genBusy}
                className="w-full py-3 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {genBusy ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Generating Verified Referral Link...</span>
                  </>
                ) : (
                  <>
                    <Gift className="w-4 h-4" />
                    <span>Generate My 10% Referral Link</span>
                  </>
                )}
              </button>
            </form>

            {/* Generated Referral Link Result Card */}
            {generatedPartner && (
              <div className="p-5 rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
                    <BadgeCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>
                      {generatedPartner.reused
                        ? 'Your Existing Referral Code Retrieved & Updated'
                        : 'Your Unique Referral Link Is Ready!'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Code:</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(generatedPartner.partner.referralCode, 'code')}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 font-mono font-black text-xs text-slate-900 dark:text-white cursor-pointer"
                    >
                      <span>{generatedPartner.partner.referralCode}</span>
                      {copiedKey === 'code' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block">
                    Shareable Partner Link (30-Day Automatic Tracking)
                  </span>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <div className="flex-1 px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-emerald-200 dark:border-emerald-800 font-mono text-xs text-slate-800 dark:text-slate-200 break-all">
                      {generatedPartner.shareUrl}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(generatedPartner.shareUrl, 'link')}
                      className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs inline-flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity shrink-0 cursor-pointer"
                    >
                      {copiedKey === 'link' ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
                          <span>Link Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>Copy Link</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <a
                    href={buildWhatsAppReferralShareUrl(
                      generatedPartner.partner.referralCode,
                      generatedPartner.partner.name
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs inline-flex items-center gap-2 transition-colors"
                  >
                    <WhatsAppIcon className="w-4 h-4" />
                    <span>Share on WhatsApp</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => {
                      setLookupQuery(generatedPartner.partner.referralCode);
                      runPartnerStatusLookup(generatedPartner.partner.referralCode);
                      scrollToRef(lookupRef);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-indigo-400 font-semibold text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Search className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>View My Referral Dashboard</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* 4. REFERRAL PARTNER DASHBOARD / STATUS LOOKUP WIDGET */}
        <section
          ref={lookupRef}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 sm:p-8 space-y-6 scroll-mt-24"
        >
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                <Users className="w-4 h-4" />
                <span>Referral Partner Dashboard &amp; Payout Status</span>
              </div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                Check Your Referrals &amp; Commission Payouts
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Enter your Referral Code (e.g., <span className="font-mono font-semibold">TD-RAHUL3210</span>) or
                registered 10-digit Mobile Number to track pending signups, verified Razorpay payments, and payout UTRs.
              </p>
            </div>
          </div>

          <form onSubmit={handleLookupSubmit} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={lookupQuery}
                onChange={(e) => setLookupQuery(e.target.value)}
                placeholder="Enter Referral Code (TD-XXXX) or 10-digit Mobile Number"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              type="submit"
              disabled={lookupBusy}
              className="px-6 py-3 rounded-xl bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-500 disabled:opacity-60 text-white font-bold text-sm inline-flex items-center justify-center gap-2 transition-colors shrink-0 cursor-pointer"
            >
              {lookupBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              <span>Check Status</span>
            </button>
          </form>

          {lookupError && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>{lookupError}</span>
            </div>
          )}

          {lookupResult && (
            <div className="space-y-6 pt-2">
              {/* Partner Summary Header */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      {lookupResult.partner.name}
                    </span>
                    <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                      {lookupResult.partner.referralCode}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Payout Destination:{' '}
                    <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                      {lookupResult.partner.payoutHandleMasked}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopy(lookupResult.partner.shareUrl, 'lookup-link')}
                    className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedKey === 'lookup-link' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                    )}
                    <span>{copiedKey === 'lookup-link' ? 'Copied' : 'Copy Referral Link'}</span>
                  </button>
                  <a
                    href={buildWhatsAppReferralShareUrl(
                      lookupResult.partner.referralCode,
                      lookupResult.partner.name
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    <WhatsAppIcon className="w-3.5 h-3.5" />
                    <span>Share</span>
                  </a>
                </div>
              </div>

              {/* 4 KPI Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                    Total Referrals
                  </span>
                  <span className="text-2xl font-black font-mono tabular-nums text-slate-900 dark:text-white mt-1 block">
                    {lookupResult.summary.totalReferrals}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 block">
                    {lookupResult.summary.pendingSignups} pending checkout
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                    Verified Razorpay Signups
                  </span>
                  <span className="text-2xl font-black font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1 block">
                    {lookupResult.summary.verifiedSignups}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 block">
                    {lookupResult.summary.blockedSelfReferrals > 0
                      ? `${lookupResult.summary.blockedSelfReferrals} self-referral excluded`
                      : 'Cryptographically verified'}
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                    Total Commission Earned
                  </span>
                  <span className="text-2xl font-black font-mono tabular-nums text-indigo-600 dark:text-indigo-400 mt-1 block">
                    ₹{lookupResult.summary.totalCommissionEarnedINR.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 block">
                    10% of verified base fees
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                    Paid vs. Pending Payout
                  </span>
                  <span className="text-2xl font-black font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-1 block">
                    ₹{lookupResult.summary.paidCommissionINR.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold mt-0.5 block tabular-nums">
                    ₹
                    {(
                      lookupResult.summary.pendingCommissionINR + lookupResult.summary.approvedCommissionINR
                    ).toLocaleString('en-IN')}{' '}
                    pending / approved
                  </span>
                </div>
              </div>

              {/* Referral Ledger Table */}
              {lookupResult.referrals.length === 0 ? (
                <div className="p-8 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center space-y-2">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    No franchise registrations tracked under {lookupResult.partner.referralCode} yet.
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                    Share your unique referral link via WhatsApp or email. Once a referred applicant initiates and
                    completes Razorpay payment, their record and your 10% commission appear here automatically.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Referred Applicant</th>
                        <th className="py-3 px-4">Plan</th>
                        <th className="py-3 px-4 text-right">Order Fee</th>
                        <th className="py-3 px-4 text-right">10% Commission</th>
                        <th className="py-3 px-4">Razorpay Status</th>
                        <th className="py-3 px-4">Payout Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {lookupResult.referrals.map((row) => (
                        <tr key={row.referralId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                          <td className="py-3 px-4 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {new Date(row.createdAt).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                            {row.applicantDisplayName}
                            {row.selfReferralBlocked && (
                              <span className="block text-[10px] text-rose-600 dark:text-rose-400 font-semibold">
                                Self-referral excluded
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-700 dark:text-slate-300">{row.planTitle}</td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                            ₹{row.orderAmountINR.toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                            ₹{row.commissionAmountINR.toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`font-bold text-[11px] ${
                                row.paymentStatus === 'CAPTURED'
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : row.paymentStatus === 'REFUNDED' || row.paymentStatus === 'FAILED'
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : 'text-amber-600 dark:text-amber-400'
                              }`}
                            >
                              {row.paymentStatus === 'CAPTURED'
                                ? 'Verified Paid'
                                : row.paymentStatus === 'PENDING'
                                ? 'Awaiting Payment'
                                : row.paymentStatus}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5 font-bold">
                              {row.payoutStatus === 'Paid' ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              ) : row.payoutStatus === 'Rejected' ? (
                                <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                              ) : (
                                <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              )}
                              <span
                                className={
                                  row.payoutStatus === 'Paid'
                                    ? 'text-emerald-700 dark:text-emerald-400'
                                    : row.payoutStatus === 'Approved'
                                    ? 'text-indigo-700 dark:text-indigo-400'
                                    : row.payoutStatus === 'Rejected'
                                    ? 'text-rose-700 dark:text-rose-400'
                                    : 'text-amber-700 dark:text-amber-400'
                                }
                              >
                                {row.payoutStatus}
                              </span>
                            </div>
                            {row.payoutUtr && (
                              <span className="block text-[10px] font-mono text-slate-500 mt-0.5">
                                UTR: {row.payoutUtr}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>

        {/* 5. TERMS & COMPLIANCE BOX */}
        <section className="bg-slate-100/80 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
            <FileCheck2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>Franchise Referral Program — Terms, Verification &amp; Payout Compliance</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            <div className="space-y-2">
              <p>
                <strong className="text-slate-900 dark:text-slate-200">1. Verified Razorpay Payment Capture Only:</strong>{' '}
                Referral commissions (10% of the authoritative base franchise package fee, rounded to the nearest whole
                rupee) are credited strictly after successful server-verified Razorpay payment capture (HMAC-SHA256
                signature and Razorpay API confirmation). Unpaid, pending, or abandoned checkouts do not accrue
                commission.
              </p>
              <p>
                <strong className="text-slate-900 dark:text-slate-200">2. Direct UPI / NEFT Payout Timeline:</strong>{' '}
                Verified referral commissions are reconciled by the TRUEDEAL GLOBAL accounts desk and disbursed directly
                to the referrer&apos;s submitted UPI ID or Bank Account via UPI / NEFT / IMPS within{' '}
                <strong className="text-slate-900 dark:text-slate-200">48–72 hours</strong> of payment verification.
              </p>
            </div>

            <div className="space-y-2">
              <p>
                <strong className="text-slate-900 dark:text-slate-200">
                  3. Self-Referrals &amp; Cancelled/Refunded Orders Excluded:
                </strong>{' '}
                Self-referrals are automatically detected and blocked whenever the applicant&apos;s email address or
                10-digit mobile number matches the referrer&apos;s details. Orders that are cancelled, disputed, or
                refunded under our Refund Policy are automatically excluded from referral payouts.
              </p>
              <p>
                <strong className="text-slate-900 dark:text-slate-200">4. 30-Day Referral Link Attribution:</strong>{' '}
                When a visitor opens{' '}
                <span className="font-mono text-slate-800 dark:text-slate-300">
                  businessfranchise.truedealglobal.com/?ref=CODE
                </span>
                , the referral code is stored for 30 days and pre-filled into the Franchise Application and Razorpay
                Checkout forms. Need assistance?{' '}
                {onNavigate ? (
                  <button
                    type="button"
                    onClick={() => onNavigate('contact')}
                    className="text-indigo-600 dark:text-indigo-400 font-semibold underline cursor-pointer"
                  >
                    Contact Official Support
                  </button>
                ) : (
                  <span>Email info@truedealglobal.com</span>
                )}
                .
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
