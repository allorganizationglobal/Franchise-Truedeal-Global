import { useState } from 'react';
import {
  TrendingUp,
  Star,
  ShieldCheck,
  Award,
  ArrowRight,
  Building,
  Globe,
  DollarSign,
  Sparkles,
  ChevronRight,
  Quote,
  CheckCircle2,
  Users,
  Briefcase
} from 'lucide-react';
import { Currency } from '../../types/franchise';

interface SuccessStoriesSectionProps {
  currency: Currency;
  onSelectPlan: (planId: string) => void;
}

interface Testimonial {
  id: string;
  name: string;
  role: string;
  tier: string;
  tierBadgeColor: string;
  location: string;
  countryFlag: string;
  category: 'it' | 'global' | 'referral';
  growthHighlight: string;
  growthPct: string;
  quote: string;
  stats: {
    label: string;
    valueINR: string;
    valueUSD: string;
  }[];
  avatarBg: string;
  initials: string;
  joinedYear: string;
  milestones: string[];
}

export function SuccessStoriesSection({ currency, onSelectPlan }: SuccessStoriesSectionProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'it' | 'global' | 'referral'>('all');
  const [selectedStory, setSelectedStory] = useState<string>('rajesh');

  const testimonials: Testimonial[] = [
    {
      id: 'rajesh',
      name: 'Rajesh V. Sharma',
      role: 'Managing Director, NCR Regional Desk',
      tier: 'Platinum Partner',
      tierBadgeColor: 'bg-indigo-600 text-white',
      location: 'Noida & Delhi NCR, India',
      countryFlag: '🇮🇳',
      category: 'it',
      growthHighlight: 'Scaled from ₹45,000/mo to ₹4.2 Lakhs/mo within 7 months',
      growthPct: '+340% YoY',
      quote:
        'Before TrueDeal Global, delivering full-stack web applications and mobile platforms was impossible as a solo consultant. With TrueDeal’s centralized engineering division taking care of all design, coding, and deployments, I closed 18 high-ticket corporate contracts in 90 days. The twice-weekly payouts directly to my Bank of Baroda account are completely reliable and stress-free.',
      stats: [
        { label: 'Annual Commission Volume', valueINR: '₹38.6 Lakhs', valueUSD: '$44,200 USD' },
        { label: 'Client Deals Fulfilled', valueINR: '42+ Contracts', valueUSD: '42+ Contracts' },
        { label: 'Sub-Franchise Referrals', valueINR: '5 Partners', valueUSD: '5 Partners' }
      ],
      avatarBg: 'from-amber-600 to-indigo-700',
      initials: 'RS',
      joinedYear: 'Partner since 2024',
      milestones: [
        'Promoted from Standard to Platinum Plan',
        'Top IT fulfillment volume award Q3',
        'Territory exclusivity in Central Noida'
      ]
    },
    {
      id: 'sarah',
      name: 'Sarah M. Jenkins',
      role: 'North America Business Director',
      tier: 'Corporate Global Partner',
      tierBadgeColor: 'bg-emerald-600 text-white',
      location: 'Austin & Dallas, Texas, USA',
      countryFlag: '🇺🇸',
      category: 'global',
      growthHighlight: 'Grew North American portfolio to $42,500/mo net deal flow',
      growthPct: '+280% Net',
      quote:
        'Operating a TrueDeal franchise from Texas gives me the distinct competitive edge of world-class technical fulfillment at unmatched pricing. The seamless USD multi-currency switch and ACH wire payouts make cross-border accounting effortless. Our US clients receive top-tier mobile apps and SEO rankings while we pocket high commission margins.',
      stats: [
        { label: 'Quarterly Gross Revenue', valueINR: '₹1.1 Crores', valueUSD: '$128,000 USD' },
        { label: 'Client Retention Rate', valueINR: '94% Repeat', valueUSD: '94% Repeat' },
        { label: 'Territory Coverage', valueINR: '2 Metro Areas', valueUSD: '2 Metro Areas' }
      ],
      avatarBg: 'from-blue-600 to-teal-700',
      initials: 'SJ',
      joinedYear: 'Partner since 2024',
      milestones: [
        'North American fastest scaling partner',
        'Dual-territory Texas license locked',
        'Cross-border corporate contract leader'
      ]
    },
    {
      id: 'tariq',
      name: 'Tariq Al-Mansoor',
      role: 'Gulf Regional Representative',
      tier: 'Global Master Franchise',
      tierBadgeColor: 'bg-amber-600 text-white',
      location: 'Dubai & Abu Dhabi, UAE',
      countryFlag: '🇦🇪',
      category: 'global',
      growthHighlight: 'Generated AED 180,000 in quarterly commissions with 85% ceiling',
      growthPct: '+410% Surge',
      quote:
        'The Master Franchise plan gives complete operational authority and the highest commission bracket in the industry. We handle high-net-worth client relationships in Dubai and Abu Dhabi for luxury tours, visa processing, and enterprise ERP systems. TrueDeal’s back office executes documentation and software deliverables flawlessly.',
      stats: [
        { label: 'Commission Bracket', valueINR: '85% Max Tier', valueUSD: '85% Max Tier' },
        { label: 'Corporate Relocations', valueINR: '35+ Packages', valueUSD: '35+ Packages' },
        { label: 'Turnaround Time', valueINR: '< 48 Hours', valueUSD: '< 48 Hours' }
      ],
      avatarBg: 'from-orange-600 to-amber-700',
      initials: 'TA',
      joinedYear: 'Partner since 2023',
      milestones: [
        'Global Master License for UAE & GCC',
        'Official TrueDeal UAE representation desk',
        'Highest single-quarter commission record'
      ]
    },
    {
      id: 'priya',
      name: 'Priya R. Patel',
      role: 'Western India Operations Lead',
      tier: 'Entrepreneur Franchise Partner',
      tierBadgeColor: 'bg-purple-600 text-white',
      location: 'Ahmedabad & Mumbai, India',
      countryFlag: '🇮🇳',
      category: 'referral',
      growthHighlight: 'Built 12-member sub-franchise syndicate with ₹2.8L monthly passive royalties',
      growthPct: '+215% Passive',
      quote:
        'The 20% direct referral bonus combined with lifetime validity transformed my franchise into an asset that continuously compounds. I now generate dual income streams: direct advisory commissions from education and tour packages, plus substantial recurring referral royalties from sub-franchisees across Gujarat and Maharashtra.',
      stats: [
        { label: 'Network Royalty Earnings', valueINR: '₹14.5 Lakhs', valueUSD: '$16,600 USD' },
        { label: 'Active Sub-Franchisees', valueINR: '12 Partners', valueUSD: '12 Partners' },
        { label: 'Satisfaction Rating', valueINR: '5.0 / 5.0 Stars', valueUSD: '5.0 / 5.0 Stars' }
      ],
      avatarBg: 'from-fuchsia-600 to-pink-700',
      initials: 'PP',
      joinedYear: 'Partner since 2024',
      milestones: [
        'Top network builder in Western Region',
        '100% on-time bi-weekly payout record',
        'Specialist in education counseling'
      ]
    }
  ];

  const filtered = testimonials.filter(t => {
    if (activeTab === 'all') return true;
    return t.category === activeTab;
  });

  const activeStoryData = testimonials.find(t => t.id === selectedStory) || testimonials[0];

  return (
    <section className="space-y-12 py-10" id="success-stories">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-700 dark:text-emerald-300 shadow-xs">
          <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>Real Partner Results · Documented Franchise Growth</span>
        </div>

        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
          Franchise{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-teal-500 to-indigo-600">
            Success Stories
          </span>
        </h2>

        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
          See how entrepreneurs and corporate directors in India, the US, and the UAE turned TrueDeal Global’s 20+ multi-industry verticals into thriving businesses with bi-weekly commission payouts.
        </p>

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          {[
            { id: 'all', label: 'All Growth Stories' },
            { id: 'it', label: 'IT & Digital Media' },
            { id: 'global', label: 'International & Cross-Border' },
            { id: 'referral', label: 'Network & Syndicates' }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                activeTab === tab.id
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 border border-slate-200 dark:border-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Network Benchmark KPI Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-6 bg-slate-900 text-white rounded-3xl border border-slate-800 shadow-xl">
        <div className="p-4 border-r border-slate-800/80 last:border-none">
          <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider block mb-1">
            Average Growth (Yr 1)
          </span>
          <span className="text-2xl sm:text-3xl font-black font-mono text-white block">
            +310%
          </span>
          <span className="text-[11px] text-slate-400 mt-0.5 block">
            Average revenue surge across partners
          </span>
        </div>

        <div className="p-4 border-r border-slate-800/80 last:border-none">
          <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider block mb-1">
            Commissions Disbursed
          </span>
          <span className="text-2xl sm:text-3xl font-black font-mono text-white block">
            {currency === 'INR' ? '₹4.8+ Cr' : '$550K+ USD'}
          </span>
          <span className="text-[11px] text-slate-400 mt-0.5 block">
            Paid bi-weekly via Bank of Baroda & wire
          </span>
        </div>

        <div className="p-4 border-r border-slate-800/80 last:border-none">
          <span className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider block mb-1">
            Active Territories
          </span>
          <span className="text-2xl sm:text-3xl font-black font-mono text-white block">
            240+
          </span>
          <span className="text-[11px] text-slate-400 mt-0.5 block">
            Across 6 countries & 40+ Indian cities
          </span>
        </div>

        <div className="p-4">
          <span className="text-[11px] font-semibold text-teal-400 uppercase tracking-wider block mb-1">
            Partner Retention
          </span>
          <span className="text-2xl sm:text-3xl font-black font-mono text-white block">
            98.4%
          </span>
          <span className="text-[11px] text-slate-400 mt-0.5 block">
            Lifetime validity with zero annual fees
          </span>
        </div>
      </div>

      {/* Featured Testimonial Deep-Dive + Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Side: Spotlight Interactive Card */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

          {/* Header of Active Story */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-4">
              {/* Professional Avatar with Graphic Portrait */}
              <div className="relative shrink-0">
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${activeStoryData.avatarBg} flex items-center justify-center text-white font-extrabold text-xl shadow-lg ring-4 ring-white dark:ring-slate-800`}>
                  {activeStoryData.initials}
                </div>
                <span className="absolute -bottom-1 -right-1 text-lg shadow-sm" title={activeStoryData.location}>
                  {activeStoryData.countryFlag}
                </span>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    {activeStoryData.name}
                  </h3>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300">
                    <ShieldCheck className="w-3 h-3" />
                    Verified Partner
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {activeStoryData.role} · {activeStoryData.location}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-md ${activeStoryData.tierBadgeColor}`}>
                    {activeStoryData.tier}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {activeStoryData.joinedYear}
                  </span>
                </div>
              </div>
            </div>

            {/* Growth Surge Badge */}
            <div className="sm:text-right shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Growth Trajectory
              </span>
              <span className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 block">
                {activeStoryData.growthPct}
              </span>
            </div>
          </div>

          {/* Direct Testimonial Quote */}
          <div className="relative bg-slate-50 dark:bg-slate-950/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-800/80">
            <Quote className="w-8 h-8 text-indigo-400/30 absolute top-4 right-4 pointer-events-none" />
            <div className="flex items-center gap-1 text-amber-500 mb-3">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-amber-500" />
              ))}
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 ml-2">5.0 / 5.0 Rating</span>
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed italic">
              "{activeStoryData.quote}"
            </p>
          </div>

          {/* Highlight Banner */}
          <div className="p-3.5 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div className="text-xs">
              <span className="font-bold text-emerald-800 dark:text-emerald-300">Verified Milestone: </span>
              <span className="text-slate-700 dark:text-slate-300">{activeStoryData.growthHighlight}</span>
            </div>
          </div>

          {/* Hard Key Metrics for Active Story */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {activeStoryData.stats.map((st, idx) => (
              <div key={idx} className="p-3.5 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">
                  {st.label}
                </span>
                <span className="text-base font-bold font-mono text-slate-900 dark:text-slate-100 mt-1 block">
                  {currency === 'INR' ? st.valueINR : st.valueUSD}
                </span>
              </div>
            ))}
          </div>

          {/* Milestones Checklist */}
          <div className="pt-2 space-y-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Official Verification & Status:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {activeStoryData.milestones.map((m, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span className="leading-tight">{m}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Action CTA */}
          <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
            <span className="text-xs text-slate-500">
              Explore how this plan can fit your local market
            </span>
            <button
              type="button"
              onClick={() => onSelectPlan('plan_standard')}
              className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-sm"
            >
              <span>Apply for Franchise</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right Side: Selectable Testimonial Cards List */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Select Franchise Story
            </h3>
            <span className="text-xs text-slate-500">
              Showing {filtered.length} verified franchisees
            </span>
          </div>

          <div className="space-y-3">
            {filtered.map(t => {
              const isSelected = selectedStory === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() => setSelectedStory(t.id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-4 ${
                    isSelected
                      ? 'bg-white dark:bg-slate-900 border-emerald-500 dark:border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
                      : 'bg-white/80 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-xs'
                  }`}
                >
                  {/* Portrait Avatar */}
                  <div className="relative shrink-0 mt-0.5">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${t.avatarBg} flex items-center justify-center text-white font-bold text-sm shadow-sm`}>
                      {t.initials}
                    </div>
                    <span className="absolute -bottom-1 -right-1 text-xs">
                      {t.countryFlag}
                    </span>
                  </div>

                  {/* Body Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                        {t.name}
                      </h4>
                      <span className="text-xs font-extrabold font-mono text-emerald-600 dark:text-emerald-400 shrink-0">
                        {t.growthPct}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      <span>{t.location}</span>
                      <span>·</span>
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400">{t.tier}</span>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 line-clamp-2 leading-relaxed">
                      "{t.quote}"
                    </p>

                    <div className="mt-2.5 flex items-center justify-between text-[11px]">
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold truncate max-w-[200px]">
                        {t.growthHighlight}
                      </span>
                      <span className="text-slate-400 flex items-center gap-0.5 font-medium">
                        <span>Details</span>
                        <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick FAQ / Safety guarantee box */}
          <div className="p-4 bg-slate-100 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
              <Award className="w-4 h-4 text-amber-500" />
              <span>Full Operational Support Guarantee</span>
            </div>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
              Every TrueDeal Global franchisee receives dedicated relationship managers, marketing toolkits, and guaranteed bi-weekly payouts under MCA-registered corporate governance.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
