import { useState } from 'react';
import {
  ArrowRight,
  Globe,
  TrendingUp,
  Shield,
  Sparkles,
  Calculator,
  Briefcase,
  Check,
  ChevronDown,
  ChevronUp,
  Star,
  MapPin,
  ExternalLink,
  DollarSign,
  Award,
  Zap,
  Building,
  FileText,
  X,
  ShieldCheck,
  CheckCircle2,
  Copy,
  QrCode
} from 'lucide-react';
import { FRANCHISE_PLANS, USD_INR_RATE, USD_SURCHARGE_PCT, formatPrice } from '../../services/storage';
import { FranchisePlan, Currency } from '../../types/franchise';
import { SuccessStoriesSection } from './SuccessStoriesSection';

interface FranchisePlansViewProps {
  currency: Currency;
  onToggleCurrency: (c: Currency) => void;
  onSelectPlan: (planId: string) => void;
}

export function FranchisePlansView({
  currency,
  onToggleCurrency,
  onSelectPlan
}: FranchisePlansViewProps) {
  const [selectedPlanId, setSelectedPlanId] = useState<string>('plan_standard');
  const [filterCategory, setFilterCategory] = useState<'all' | 'starter' | 'growth' | 'authority' | 'master'>('all');
  
  // Interactive Earnings Calculator
  const [calcMonthlyDeals, setCalcMonthlyDeals] = useState<number>(8);
  const [calcAvgDealINR, setCalcAvgDealINR] = useState<number>(35000);
  const [calcCommissionRate, setCalcCommissionRate] = useState<number>(35); // percentage

  // Legal Document Preview Lightbox
  const [previewDoc, setPreviewDoc] = useState<{ title: string; image: string; desc: string } | null>(null);
  const [copiedBankField, setCopiedBankField] = useState<string | null>(null);

  // FAQ Accordion State
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  // Filter plans based on category
  const filteredPlans = FRANCHISE_PLANS.filter(p => {
    if (filterCategory === 'starter') return p.tier === 'basic' || p.tier === 'standard';
    if (filterCategory === 'growth') return p.tier === 'corporate' || p.tier === 'platinum';
    if (filterCategory === 'authority') return p.tier === 'entrepreneur' || p.tier === 'retirement';
    if (filterCategory === 'master') return p.tier === 'enterprise' || p.tier === 'global';
    return true;
  });

  // Calculate earnings projections
  const monthlyRevenueINR = calcMonthlyDeals * calcAvgDealINR;
  const monthlyEarningsINR = Math.round(monthlyRevenueINR * (calcCommissionRate / 100));
  const yearlyEarningsINR = monthlyEarningsINR * 12;

  const monthlyEarningsUSD = Math.round((monthlyEarningsINR / USD_INR_RATE) * (1 + USD_SURCHARGE_PCT / 100));
  const yearlyEarningsUSD = monthlyEarningsUSD * 12;

  const faqs = [
    {
      q: 'Can anyone join the TrueDeal Global Franchise Plan from outside India?',
      a: 'Absolutely! While TrueDeal Global is proudly headquartered in Ghaziabad, India, our franchise network is truly international. We cater to prospective franchisees and corporate clients in the United States, United Arab Emirates (Dubai), Australia (Melbourne), Canada (Edmonton), Singapore, United Kingdom, and across Europe. Anyone around the world can register and operate a franchise remotely or locally.'
    },
    {
      q: 'Why is there a 10% rate increase when selecting USD currency?',
      a: 'Our base franchise joining fee is denominated in Indian Rupees (INR) for domestic partners. When you select US Dollars (USD), the fee is calculated at the current live forex rate (1 USD ≈ ₹87.5) with an additional 10% international rate. This nominal markup covers multi-currency cross-border banking fees, international KYC/AML regulatory processing, foreign wire settlements, and global territory registration.'
    },
    {
      q: 'What business services can I promote and sell as a TrueDeal Franchisee?',
      a: 'Depending on your chosen plan, you gain rights to over 20 to 50+ multi-industry verticals. These include Custom Web Development & Mobile Apps, Digital Marketing & SEO, Domestic & International Tours, Visa & Immigration Consulting, Real Estate Deals, E-Commerce, MLM & Book Publishing, Media & Music Recording, Astrology & Jyotish, and Education/College Admissions.'
    },
    {
      q: 'Do I need technical skills or domain expertise to run the franchise?',
      a: 'No technical or prior experience is required! TrueDeal Global operates as a turnkey fulfillment partner. You simply generate client inquiries or projects through your localized franchise portal, and our specialized backend engineering, design, legal, and operational divisions fulfill the client deliverables. You receive your commission twice weekly.'
    },
    {
      q: 'How frequently are commissions and referral bonuses disbursed?',
      a: 'All franchise commissions (from 10% up to 85% depending on tier) and 20% direct sub-franchise referral bonuses are paid out twice weekly. Domestic partners receive direct IMPS/NEFT bank transfers, while international partners receive payouts via SWIFT Wire, ACH, or PayPal.'
    }
  ];

  return (
    <div className="space-y-20 py-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Hero Section */}
      <div className="text-center max-w-4xl mx-auto space-y-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold text-indigo-700 dark:text-indigo-300 shadow-xs">
          <Globe className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span>TrueDeal Global · Headquartered in India · Catering Worldwide</span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 dark:text-slate-100 text-balance leading-tight">
          Choose Your Official{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 via-orange-500 to-indigo-600">
            Franchise Plan
          </span>
        </h1>

        <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 leading-relaxed max-w-3xl mx-auto text-balance">
          Access over 20+ multi-industry business services under one umbrella. Low investment, lifetime validity, twice-weekly commission payouts up to 85%, and 20% direct referral bonuses. Anyone can join from anywhere across the globe.
        </p>

        {/* Currency Switcher & Surcharge Transparency Box */}
        <div className="pt-2 flex flex-col items-center gap-3">
          <div className="inline-flex items-center p-1.5 bg-slate-100 dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <button
              type="button"
              onClick={() => onToggleCurrency('INR')}
              className={`py-2 px-5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                currency === 'INR'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-md ring-1 ring-slate-200 dark:ring-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <span className="text-sm">🇮🇳</span>
              <span>Indian Rupees (INR ₹)</span>
              <span className="text-[10px] font-normal opacity-75">Domestic</span>
            </button>
            <button
              type="button"
              onClick={() => onToggleCurrency('USD')}
              className={`py-2 px-5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                currency === 'USD'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-md ring-1 ring-slate-200 dark:ring-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <span className="text-sm">🌐</span>
              <span>US Dollars (USD $)</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                +10% Global Rate
              </span>
            </button>
          </div>

          {currency === 'USD' ? (
            <div className="text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 px-4 py-2 rounded-xl border border-indigo-200 dark:border-indigo-800 flex items-center gap-2 max-w-xl text-left animate-fade-in shadow-xs">
              <Sparkles className="w-4 h-4 shrink-0 text-amber-500" />
              <span>
                <strong>International Currency Selected:</strong> Fees are calculated at 1 USD ≈ ₹{USD_INR_RATE.toFixed(2)} with standard +{USD_SURCHARGE_PCT}% international cross-border processing and global territory licensing markup.
              </span>
            </div>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <span>🇮🇳 Standard Domestic India joining fees. Direct IMPS/NEFT twice-weekly payouts.</span>
            </p>
          )}
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-3">
          {[
            { id: 'all', label: 'All 8 Official Plans' },
            { id: 'starter', label: 'Starter (Basic & Standard)' },
            { id: 'growth', label: 'Corporate & Platinum' },
            { id: 'authority', label: 'Entrepreneur & Retirement' },
            { id: 'master', label: 'Enterprise & Global' },
          ].map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilterCategory(f.id as any)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                filterCategory === f.id
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 bg-slate-100/70 dark:bg-slate-800/50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* 8 Official TrueDeal Global Franchise Plan Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
        {filteredPlans.map((plan) => {
          const isSelected = selectedPlanId === plan.id;
          const displayPrice = currency === 'INR'
            ? '₹' + plan.priceINR.toLocaleString('en-IN')
            : '$' + plan.priceUSD.toLocaleString('en-US');

          const altPrice = currency === 'INR'
            ? `$${plan.priceUSD.toLocaleString('en-US')} USD`
            : `₹${plan.priceINR.toLocaleString('en-IN')}`;

          return (
            <div
              key={plan.id}
              className={`relative flex flex-col justify-between p-6 rounded-2xl border-t-4 ${plan.color || 'border-indigo-600'} bg-white dark:bg-[#002244] border-x border-b border-slate-200 dark:border-white/10 shadow-lg hover:-translate-y-1.5 transition-all duration-300 group`}
            >
              {plan.label && (
                <div className={`absolute -top-3.5 left-1/2 -translate-x-1/2 ${plan.labelColor || 'bg-indigo-600'} text-white text-[10px] font-extrabold uppercase px-3.5 py-1 rounded-full shadow-md whitespace-nowrap tracking-wider`}>
                  {plan.label}
                </div>
              )}

              <div>
                {/* Header */}
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2 mt-1">
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">{plan.badge}</span>
                  <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">{plan.validity}</span>
                </div>

                <h3 className="text-xl font-black text-slate-900 dark:text-white mb-1.5">
                  {plan.title}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mb-4 min-h-[36px] leading-relaxed">
                  {plan.subtitle}
                </p>

                {/* Price Display */}
                <div className="p-3.5 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/10 mb-4 space-y-1">
                  <span className="text-[10px] text-slate-500 dark:text-gray-400 uppercase tracking-wider block font-semibold">
                    Franchise Joining Fee
                  </span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl sm:text-3xl font-black font-mono text-slate-900 dark:text-white">
                      {displayPrice}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-gray-400 font-mono">
                      {altPrice}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-gray-400 flex items-center justify-between pt-1">
                    <span>One-time joining fee</span>
                    {currency === 'USD' && (
                      <span className="text-amber-500 font-semibold font-mono">+10% applied</span>
                    )}
                  </div>
                </div>

                {/* Highlights */}
                <div className="space-y-2 mb-5 text-xs">
                  <div className="p-2.5 bg-slate-100/70 dark:bg-[#001a33] rounded-lg space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-gray-400">Commission:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">{plan.commissionRate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-gray-400">Referral Bonus:</span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-300">{plan.referralBonus}</span>
                    </div>
                  </div>

                  <span className="text-[11px] font-bold text-slate-500 dark:text-gray-300 uppercase tracking-wider block pt-2">
                    Included Features:
                  </span>
                  <ul className="space-y-1.5 text-slate-700 dark:text-slate-200">
                    {plan.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs">
                        <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <span className="leading-tight">{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Apply Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPlanId(plan.id);
                    onSelectPlan(plan.id);
                  }}
                  className={`w-full py-2.5 px-4 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm text-white ${
                    plan.btnColor || 'bg-indigo-600'
                  } hover:brightness-110 active:scale-[0.98]`}
                >
                  <span>Join {plan.title}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive Franchise Commission & ROI Calculator */}
      <div className="p-8 sm:p-10 bg-white dark:bg-[#002244] rounded-3xl border border-slate-200 dark:border-white/10 shadow-xl space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-white/10">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-1">
              <Calculator className="w-4 h-4" />
              <span>Projected Earning Potential</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
              Interactive Franchise Revenue Estimator
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-2xl">
              Simulate your earnings from selling web development, tours, visas, digital marketing, and real estate services. TrueDeal handles backend delivery.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 px-3">
              Currency: {currency === 'INR' ? '₹ INR' : '$ USD (+10%)'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
          {/* Controls */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                <span>Monthly Closed Client Deals:</span>
                <span className="font-mono text-indigo-600 dark:text-indigo-400 text-sm">{calcMonthlyDeals} deals/mo</span>
              </div>
              <input
                type="range"
                min="1"
                max="50"
                value={calcMonthlyDeals}
                onChange={e => setCalcMonthlyDeals(parseInt(e.target.value) || 1)}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>1 deal (Starter)</span>
                <span>25 deals (Growth)</span>
                <span>50 deals (Enterprise)</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                <span>Average Deal Size:</span>
                <span className="font-mono text-indigo-600 dark:text-indigo-400 text-sm">
                  {currency === 'INR'
                    ? '₹' + calcAvgDealINR.toLocaleString('en-IN')
                    : '$' + Math.round((calcAvgDealINR / USD_INR_RATE) * 1.1).toLocaleString('en-US') + ' USD'}
                </span>
              </div>
              <input
                type="range"
                min="10000"
                max="250000"
                step="5000"
                value={calcAvgDealINR}
                onChange={e => setCalcAvgDealINR(parseInt(e.target.value) || 10000)}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>₹10,000 (Small web/graphic deal)</span>
                <span>₹100,000 (Visa/corporate package)</span>
                <span>₹250,000 (Enterprise IT / Real Estate)</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                <span>Plan Commission Ceiling:</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 text-sm">{calcCommissionRate}% commission</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'Basic (15%)', val: 15 },
                  { label: 'Standard (25%)', val: 25 },
                  { label: 'Platinum (45%)', val: 45 },
                  { label: 'Global (85%)', val: 85 }
                ].map(tier => (
                  <button
                    key={tier.val}
                    type="button"
                    onClick={() => setCalcCommissionRate(tier.val)}
                    className={`py-2 px-2 text-xs font-bold rounded-lg border transition-all ${
                      calcCommissionRate === tier.val
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    {tier.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Result Card */}
          <div className="p-6 bg-slate-900 text-white rounded-2xl border border-slate-800 shadow-xl space-y-5 text-center">
            <span className="text-[11px] font-bold text-amber-400 uppercase tracking-widest block">
              Estimated Take-Home Commission
            </span>

            <div>
              <span className="text-[11px] text-slate-400 block mb-1">Monthly Projected Earnings</span>
              <span className="text-3xl sm:text-4xl font-black font-mono text-emerald-400 block">
                {currency === 'INR'
                  ? '₹' + monthlyEarningsINR.toLocaleString('en-IN')
                  : '$' + monthlyEarningsUSD.toLocaleString('en-US')}
              </span>
            </div>

            <div className="pt-3 border-t border-slate-800">
              <span className="text-[11px] text-slate-400 block mb-1">Annualized Potential</span>
              <span className="text-xl sm:text-2xl font-bold font-mono text-white block">
                {currency === 'INR'
                  ? '₹' + yearlyEarningsINR.toLocaleString('en-IN')
                  : '$' + yearlyEarningsUSD.toLocaleString('en-US')}
              </span>
            </div>

            <p className="text-[10px] text-slate-400 leading-tight">
              Paid twice weekly directly to your registered bank account or international wire. Excludes additional 20% direct sub-franchise referral bonuses.
            </p>

            <button
              type="button"
              onClick={() => onSelectPlan('plan_standard')}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5"
            >
              <span>Get Started Now</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 20+ High-Demand Multi-Industry Services */}
      <div className="p-8 sm:p-10 bg-[#001a33] text-white rounded-3xl shadow-xl border border-white/10 space-y-8">
        <div className="max-w-3xl space-y-2">
          <div className="inline-flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
            <Briefcase className="w-4 h-4" />
            <span>Multi-Industry Portfolio</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
            One TrueDeal Franchise · 20+ Business Verticals to Monetize
          </h2>
          <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
            TrueDeal Global franchisees can sell and earn commissions across multiple high-demand industries without needing prior technical expertise. Our backend teams execute the deliverables while you earn twice-weekly payouts.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          {[
            { title: 'Web Development & IT', desc: 'Custom Websites, Mobile Apps & ERP' },
            { title: 'Digital Marketing & SEO', desc: 'Social Media, Ads, Reels & PR' },
            { title: 'Tours, Travel & Visas', desc: 'Domestic & International Packages' },
            { title: 'Real Estate & Properties', desc: 'Commercial & Residential Brokerage' },
            { title: 'Trading & Crypto Advisory', desc: 'Share Market & Digital Assets' },
            { title: 'Education & Admissions', desc: 'School & University Counseling' },
            { title: 'Photography & Shoot', desc: 'Studio Production & Video Editing' },
            { title: 'Music & Film Studio', desc: 'Audio Recording & Entertainment' },
            { title: 'E-Commerce Marketplace', desc: 'Electronics, Fashion & Retail' },
            { title: 'MLM & Book Publishing', desc: 'Author Royalties & Network Tools' },
            { title: 'Astrology & Palmistry', desc: 'Horoscope, Jyotish & Vaastu' },
            { title: 'Job Consultancy & HR', desc: 'Recruitment & Placement Solutions' }
          ].map((srv, idx) => (
            <div key={idx} className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-1 hover:bg-white/10 transition-colors">
              <div className="font-bold text-amber-300 text-xs">{srv.title}</div>
              <div className="text-[11px] text-gray-300 leading-tight">{srv.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Global Offices Presence */}
      <div className="p-8 sm:p-10 bg-slate-100 dark:bg-[#002244] rounded-3xl border border-slate-200 dark:border-white/10 shadow-lg space-y-6">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <div className="inline-flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
            <Building className="w-4 h-4" />
            <span>Worldwide Corporate Footprint</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            Headquartered in India · Operating Across 6 Countries
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
            TrueDeal Global operates physical headquarters and international representation desks to support partners worldwide.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-center">
          {[
            { city: 'Ghaziabad, India', label: 'Global Corporate HQ', flag: '🇮🇳' },
            { city: 'Mumbai & Delhi', label: 'Zonal Regional Desks', flag: '🇮🇳' },
            { city: 'Dubai, UAE', label: 'Middle East Hub', flag: '🇦🇪' },
            { city: 'Melbourne, Australia', label: 'APAC Operations', flag: '🇦🇺' },
            { city: 'Texas, USA', label: 'North America Desk', flag: '🇺🇸' },
            { city: 'Edmonton & Singapore', label: 'Cross-Border Partners', flag: '🇨🇦' }
          ].map((loc, idx) => (
            <div key={idx} className="p-4 bg-white dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-xs space-y-1">
              <span className="text-2xl block">{loc.flag}</span>
              <span className="font-bold text-xs text-slate-900 dark:text-white block">{loc.city}</span>
              <span className="text-[10px] text-slate-500 dark:text-gray-400 block">{loc.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Success Stories & Documented Franchise Growth */}
      <SuccessStoriesSection
        currency={currency}
        onSelectPlan={onSelectPlan}
      />

      {/* Verified Legal Documents, Certificates & Corporate Banking Showcase */}
      <div className="space-y-8">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Official Government Registrations & Verified Compliance</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-slate-100">
            Company Legals, Certificates & Banking Credentials
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            TrueDeal Global operates under full statutory registration with the Ministry of Corporate Affairs (MCA), DPIIT Startup India, and MSME Government of India. Click any document below to inspect in high resolution.
          </p>
        </div>

        {/* Official Bank Account & QR Code Banner */}
        <div className="p-6 sm:p-8 bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-indigo-500/10 dark:from-orange-950/40 dark:via-amber-950/30 dark:to-indigo-950/40 rounded-3xl border border-orange-200 dark:border-orange-800/60 shadow-lg">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
            <div className="space-y-3 max-w-xl text-center lg:text-left">
              <div className="inline-flex items-center gap-2 text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider">
                <Building className="w-4 h-4" />
                <span>Official Corporate Current Account</span>
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100">
                TRUEDEAL GLOBAL OPC PVT LTD
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                All domestic franchise fees and capital deposits are accepted exclusively through our verified Bank of Baroda corporate current account or encrypted gateway rails.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs text-left">
                <div className="p-3 bg-white dark:bg-slate-900/80 rounded-xl border border-orange-200/80 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-medium">Bank Name:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">BANK OF BARODA</span>
                </div>
                <div className="p-3 bg-white dark:bg-slate-900/80 rounded-xl border border-orange-200/80 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-medium">Account Type:</span>
                  <span className="font-bold text-orange-600 dark:text-orange-400 text-sm">CURRENT ACCOUNT</span>
                </div>
                <div className="p-3 bg-white dark:bg-slate-900/80 rounded-xl border border-orange-200/80 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-medium">Account Number:</span>
                  <div className="flex items-center justify-between font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">
                    <span>26290200001514</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText('26290200001514');
                        setCopiedBankField('ac');
                        setTimeout(() => setCopiedBankField(null), 2500);
                      }}
                      className="text-orange-600 hover:text-orange-700"
                      title="Copy Account Number"
                    >
                      {copiedBankField === 'ac' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="p-3 bg-white dark:bg-slate-900/80 rounded-xl border border-orange-200/80 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-medium">IFSC Code:</span>
                  <div className="flex items-center justify-between font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">
                    <span>BARB0NOIDAX</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText('BARB0NOIDAX');
                        setCopiedBankField('ifsc');
                        setTimeout(() => setCopiedBankField(null), 2500);
                      }}
                      className="text-orange-600 hover:text-orange-700"
                      title="Copy IFSC Code"
                    >
                      {copiedBankField === 'ifsc' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-sans block mt-0.5">
                    (5th Letter is Zero) · Noida Main Branch
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center shrink-0">
              <div
                onClick={() =>
                  setPreviewDoc({
                    title: 'Bank of Baroda Corporate UPI QR',
                    image: '/assets/bank_of_baroda_qr.png',
                    desc: 'Official Current Account QR for TRUEDEAL GLOBAL OPC PVT LTD (A/C: 26290200001514, IFSC: BARB0NOIDAX)'
                  })
                }
                className="cursor-pointer group relative p-3 bg-white dark:bg-slate-900 rounded-2xl shadow-md border-2 border-orange-500/40 hover:border-orange-500 transition-all hover:scale-105"
              >
                <img
                  src="/assets/bank_of_baroda_qr.png"
                  alt="Bank of Baroda QR Code"
                  className="w-44 h-44 object-contain rounded-xl"
                />
                <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center text-white text-xs font-bold gap-1.5 backdrop-blur-[2px]">
                  <QrCode className="w-4 h-4" />
                  <span>Click to Zoom QR</span>
                </div>
              </div>
              <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mt-2">
                Bank of Baroda UPI QR
              </span>
            </div>
          </div>
        </div>

        {/* Grid of Legal Certificates & Documents */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              title: 'Startup India Recognition',
              badge: 'DPIIT Certified',
              image: '/assets/cert_startup_india.png',
              desc: 'Official Certificate of Recognition granted by Department for Promotion of Industry and Internal Trade (DPIIT), Govt. of India.'
            },
            {
              title: 'Udyam MSME Registration',
              badge: 'Govt. of India MSME',
              image: '/assets/cert_udyam_msme.png',
              desc: 'Ministry of Micro, Small and Medium Enterprises official Udyam enterprise certificate for TrueDeal Global.'
            },
            {
              title: 'Permanent Account Number (PAN)',
              badge: 'Income Tax Dept.',
              image: '/assets/cert_pan_card.png',
              desc: 'Official Government of India PAN Card registered under corporate entity TRUEDEAL GLOBAL OPC PVT LTD.'
            },
            {
              title: 'e-MOA (Memorandum of Association)',
              badge: 'MCA Registered',
              image: '/assets/cert_e_moa.png',
              desc: 'Official Electronic Memorandum of Association under Companies Act 2013 registered with Registrar of Companies (ROC).'
            },
            {
              title: 'e-AOA (Articles of Association)',
              badge: 'MCA Registered',
              image: '/assets/cert_e_aoa.png',
              desc: 'Articles of Association regulating commercial operations, governance, and franchise authority of the company.'
            },
            {
              title: 'Bank of Baroda Corporate Gateway',
              badge: 'Verified Current A/C',
              image: '/assets/bank_of_baroda_qr.png',
              desc: 'Certified Merchant Banking UPI QR Code for instantaneous onboarding fee clearance and territory locks.'
            }
          ].map((cert, idx) => (
            <div
              key={idx}
              onClick={() => setPreviewDoc(cert)}
              className="group cursor-pointer bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden hover:border-indigo-500 dark:hover:border-indigo-500 shadow-sm hover:shadow-xl transition-all flex flex-col justify-between"
            >
              <div className="relative aspect-[4/3] bg-slate-100 dark:bg-slate-800/60 overflow-hidden flex items-center justify-center p-3">
                <img
                  src={cert.image}
                  alt={cert.title}
                  className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-400/30">
                  {cert.badge}
                </div>
                <div className="absolute inset-0 bg-indigo-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1.5 backdrop-blur-[1px]">
                  <ExternalLink className="w-4 h-4" />
                  <span>Click to View High-Res</span>
                </div>
              </div>

              <div className="p-4 space-y-1.5 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {cert.title}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mt-1">
                    {cert.desc}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                  <span>Verify Document</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Frequently Asked Questions Accordion */}
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="text-center space-y-2 mb-6">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100">
            Frequently Asked Questions
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Everything you need to know about joining TrueDeal Global Franchise worldwide.
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = expandedFaq === idx;
            return (
              <div
                key={idx}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden transition-all shadow-xs"
              >
                <button
                  type="button"
                  onClick={() => setExpandedFaq(isOpen ? null : idx)}
                  className="w-full p-5 text-left flex items-center justify-between gap-4 font-bold text-sm text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  <span>{faq.q}</span>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 shrink-0 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 shrink-0 text-slate-400" />
                  )}
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-slate-800 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Document Preview Lightbox Modal */}
      {previewDoc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
          onClick={() => setPreviewDoc(null)}
        >
          <div
            className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 overflow-hidden max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-500" />
                  <span>{previewDoc.title}</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{previewDoc.desc}</p>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-4 flex-1 overflow-auto rounded-2xl bg-slate-100 dark:bg-slate-950 p-4 flex items-center justify-center">
              <img
                src={previewDoc.image}
                alt={previewDoc.title}
                className="max-h-[65vh] w-auto object-contain rounded-lg shadow-lg"
              />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
              <span className="text-slate-500 font-mono">
                Entity: TRUEDEAL GLOBAL OPC PVT LTD · MCA & Govt. of India Verified
              </span>
              <button
                onClick={() => setPreviewDoc(null)}
                className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
