import {
  Award,
  ShieldCheck,
  Shield,
  Building,
  Globe,
  Phone,
  Mail,
  MapPin,
  ArrowRight,
  CheckCircle2,
  Lock,
  FileText,
  DollarSign,
  TrendingUp,
  Sparkles,
  ExternalLink,
  QrCode,
  Copy,
  Check
} from 'lucide-react';
import { useState } from 'react';
import { Currency } from '../../types/franchise';
import { FRANCHISE_PLANS } from '../../services/storage';
import { WhatsAppIcon } from '../common/WhatsAppSupportWidget';
import { useLanguage } from '../../context/LanguageContext';

interface FooterProps {
  currency: Currency;
  onSelectTab: (tab: string) => void;
  onOpenEmailModal: () => void;
  onOpenSyncModal: () => void;
  emailsCount: number;
  syncQueueCount: number;
}

export function Footer({
  currency,
  onSelectTab,
  onOpenEmailModal,
  onOpenSyncModal,
  emailsCount,
  syncQueueCount
}: FooterProps) {
  const { language, t } = useLanguage();
  const [copiedBank, setCopiedBank] = useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedBank(key);
    setTimeout(() => setCopiedBank(null), 2500);
  };

  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 mt-20 transition-colors">
      {/* 1. Global Leadership Callout Banner: Top 1 in India & Top 3 in the World */}
      <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-950 text-white py-12 px-4 sm:px-6 lg:px-8 border-b border-indigo-900/50 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-8 relative z-10">
          <div className="space-y-3 text-center lg:text-left max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-bold tracking-wide">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {language === 'hi'
                  ? 'भारत में रैंक #1 · दुनिया भर में शीर्ष 3'
                  : 'Ranked #1 in India · Ranked Top 3 Worldwide'}
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight leading-tight">
              {language === 'hi'
                ? 'भारत का प्रमुख बहु-उद्योग फ़्रैंचाइज़ी समूह'
                : "India's Premier Multi-Industry Franchise Conglomerate"}
            </h2>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {language === 'hi'
                ? 'भारत, संयुक्त राज्य अमेरिका, संयुक्त अरब अमीरात, ऑस्ट्रेलिया और यूरोप में 240+ से अधिक भागीदारों को 20+ मुद्रीकरण योग्य व्यावसायिक क्षेत्रों, आजीवन वैधता और द्वि-साप्ताहिक कमीशन वितरण के साथ सशक्त बनाना।'
                : 'Empowering over 240+ franchise partners across India, the United States, UAE, Australia, and Europe with 20+ monetizable business verticals, lifetime validity, and guaranteed twice-weekly commission disbursements.'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 shrink-0">
            <button
              type="button"
              onClick={() => onSelectTab('apply')}
              className="px-6 py-3 rounded-xl font-bold text-xs sm:text-sm text-slate-950 bg-amber-400 hover:bg-amber-300 transition-all shadow-lg hover:shadow-amber-400/20 flex items-center gap-2 font-mono uppercase tracking-wider cursor-pointer"
            >
              <span>{language === 'hi' ? 'फ़्रैंचाइज़ी हेतु आवेदन करें' : 'Apply for Franchise'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => onSelectTab('plans')}
              className="px-6 py-3 rounded-xl font-bold text-xs sm:text-sm text-white bg-white/10 hover:bg-white/20 border border-white/20 transition-all backdrop-blur-sm cursor-pointer"
            >
              {language === 'hi' ? '8 आधिकारिक योजनाएं देखें' : 'Explore 8 Official Plans'}
            </button>
          </div>
        </div>
      </div>

      {/* 2. Official Statutory Certifications & Government Badges Strip */}
      <div className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Government Registrations & Corporate Compliance:</span>
          </div>

          <div className="flex flex-wrap items-center gap-6 sm:gap-8 text-xs font-semibold text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <span className="text-base">🇮🇳</span>
              <span>MCA Ministry of Corporate Affairs (Govt. of India)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-base">🏛️</span>
              <span>DPIIT Startup India Certified</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-base">🏢</span>
              <span>Udyam MSME Registered Enterprise</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-base">🏦</span>
              <span>Bank of Baroda Verified Corporate Current A/C</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Comprehensive 5-Column World-Class Mega Footer Directory */}
      <div className="max-w-7xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
          {/* Column 1: Official Franchise Plans */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-500" />
              <span>Franchise Plans</span>
            </h3>
            <ul className="space-y-2 text-xs">
              {FRANCHISE_PLANS.map((plan) => (
                <li key={plan.id}>
                  <button
                    type="button"
                    onClick={() => onSelectTab('plans')}
                    className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-left flex items-center justify-between w-full group py-0.5"
                  >
                    <span className="group-hover:underline font-medium text-slate-800 dark:text-slate-200">
                      {plan.title}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono ml-1 shrink-0">
                      (₹{plan.priceINR.toLocaleString('en-IN')} / ${plan.priceUSD.toLocaleString('en-US')})
                    </span>
                  </button>
                </li>
              ))}
              <li className="pt-2 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold border-t border-slate-200/60 dark:border-slate-800/60 flex items-center gap-1">
                <span>✓ Lifetime Validity & Zero Annual Royalties</span>
              </li>
            </ul>
          </div>

          {/* Column 2: 20+ Monetizable Verticals */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-indigo-500" />
              <span>20+ Business Verticals</span>
            </h3>
            <ul className="space-y-2.5 text-xs">
              <li>
                <span className="hover:text-slate-900 dark:hover:text-slate-200">
                  Custom Web & Mobile App Development
                </span>
              </li>
              <li>
                <span className="hover:text-slate-900 dark:hover:text-slate-200">
                  Digital Marketing, SEO & PR Media
                </span>
              </li>
              <li>
                <span className="hover:text-slate-900 dark:hover:text-slate-200">
                  Worldwide Visas & Immigration Services
                </span>
              </li>
              <li>
                <span className="hover:text-slate-900 dark:hover:text-slate-200">
                  Domestic & International Luxury Tours
                </span>
              </li>
              <li>
                <span className="hover:text-slate-900 dark:hover:text-slate-200">
                  Commercial & Residential Real Estate
                </span>
              </li>
              <li>
                <span className="hover:text-slate-900 dark:hover:text-slate-200">
                  Media, Music Recording & Video Production
                </span>
              </li>
              <li>
                <span className="hover:text-slate-900 dark:hover:text-slate-200">
                  Higher Education & University Admissions
                </span>
              </li>
            </ul>
          </div>

          {/* Column 3: Corporate Banking & MCA Credentials */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
              <Building className="w-4 h-4 text-orange-500" />
              <span>Corporate Banking Details</span>
            </h3>
            <div className="p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold">Official Billing Entity:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                  TRUEDEAL GLOBAL OPC PVT LTD
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 block font-semibold">Bank Name:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">BANK OF BARODA</span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 block font-semibold">Current Account Number:</span>
                <div className="flex items-center justify-between font-mono font-bold text-slate-900 dark:text-slate-100 text-xs">
                  <span>26290200001514</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard('26290200001514', 'ac')}
                    className="text-orange-600 hover:text-orange-700 ml-1"
                    title="Copy Account Number"
                  >
                    {copiedBank === 'ac' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 block font-semibold">IFSC Code:</span>
                <div className="flex items-center justify-between font-mono font-bold text-slate-900 dark:text-slate-100 text-xs">
                  <span>BARB0NOIDAX</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard('BARB0NOIDAX', 'ifsc')}
                    className="text-orange-600 hover:text-orange-700 ml-1"
                    title="Copy IFSC Code"
                  >
                    {copiedBank === 'ifsc' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <span className="text-[9px] text-amber-600 dark:text-amber-400 block mt-0.5">
                  (5th Letter is Zero) · Noida Main Branch
                </span>
              </div>
            </div>
          </div>

          {/* Column 4: Worldwide Presence & Offices */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-emerald-500" />
              <span>Worldwide Presence</span>
            </h3>
            <ul className="space-y-2.5 text-xs">
              <li className="flex items-start gap-2">
                <span className="text-sm">🇮🇳</span>
                <div>
                  <strong className="text-slate-900 dark:text-slate-200 block">Global Corporate HQ</strong>
                  <span className="text-[11px]">Ghaziabad & Noida Tech Zone, UP, India</span>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-sm">🇦🇪</span>
                <div>
                  <strong className="text-slate-900 dark:text-slate-200 block">Middle East Hub</strong>
                  <span className="text-[11px]">Downtown Dubai, United Arab Emirates</span>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-sm">🇺🇸</span>
                <div>
                  <strong className="text-slate-900 dark:text-slate-200 block">North America Operations</strong>
                  <span className="text-[11px]">Austin & Dallas Metro, Texas, USA</span>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-sm">🇦🇺</span>
                <div>
                  <strong className="text-slate-900 dark:text-slate-200 block">Asia-Pacific Desk</strong>
                  <span className="text-[11px]">Melbourne Regional Hub, Australia</span>
                </div>
              </li>
            </ul>
          </div>

          {/* Column 5: Governance, Tools & Directorate Contacts */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-indigo-500" />
              <span>Portal Operations & Support</span>
            </h3>
            <ul className="space-y-2.5 text-xs">
              <li>
                <button
                  type="button"
                  onClick={onOpenEmailModal}
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-1.5"
                >
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>Dispatched Notices ({emailsCount})</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onOpenSyncModal}
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Sync Monitor ({syncQueueCount} queued)</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onSelectTab('api')}
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <span>REST API & Webhook Specs</span>
                </button>
              </li>
              <li className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 block font-semibold">Direct Corporate Line:</span>
                <a
                  href="tel:+919317194033"
                  className="text-slate-900 dark:text-slate-100 font-mono font-bold hover:text-amber-500 flex items-center gap-1.5 transition-colors"
                >
                  <Phone className="w-3.5 h-3.5 text-amber-500" />
                  <span>+91-9317194033</span>
                </a>
              </li>
              <li className="space-y-1">
                <span className="text-[10px] text-slate-400 block font-semibold">Official WhatsApp Desk:</span>
                <a
                  href="https://wa.me/918091667890?text=Hello%20TrueDeal%20Global%20Team,%20I%20am%20interested%20in%20a%20franchise%20partnership.%20Please%20guide%20me."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-600 dark:text-emerald-400 font-mono font-bold hover:underline flex items-center gap-1.5 transition-colors"
                >
                  <WhatsAppIcon className="w-3.5 h-3.5 text-emerald-500" />
                  <span>+91-8091667890 (Chat Instant)</span>
                </a>
              </li>
              <li className="space-y-1">
                <span className="text-[10px] text-slate-400 block font-semibold">Franchise Directorate Email:</span>
                <a
                  href="mailto:info@truedealglobal.com"
                  className="text-slate-900 dark:text-slate-100 font-medium hover:text-indigo-600 flex items-center gap-1.5 transition-colors"
                >
                  <Mail className="w-3.5 h-3.5 text-indigo-500" />
                  <span>info@truedealglobal.com</span>
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* 4. Official Ranking Proclamation Box */}
      <div className="bg-slate-100 dark:bg-slate-900 border-t border-b border-slate-200 dark:border-slate-800 py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left text-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Award className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <span className="font-extrabold text-slate-900 dark:text-slate-100 block">
                Ranked #1 Franchise Provider in India · Top 3 Globally
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Recognized for highest portfolio diversity, twice-weekly commission settlement speed, and zero franchisee royalty model.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0 text-xs text-slate-500 dark:text-slate-400">
            <span>Twice-Weekly IMPS/SWIFT Settlement</span>
            <span>·</span>
            <span>20% Direct Referral Bonus</span>
            <span>·</span>
            <span>Lifetime Partner Covenant</span>
          </div>
        </div>
      </div>

      {/* 5. Corporate Copyright & Statutory Notice Bar */}
      <div className="py-8 px-4 sm:px-6 lg:px-8 bg-white dark:bg-slate-950 text-[11px] text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-2 text-center sm:text-left">
            <span className="font-bold text-slate-900 dark:text-slate-200">
              TRUEDEAL GLOBAL OPC PVT LTD
            </span>
            <span className="hidden sm:inline" aria-hidden="true">·</span>
            <span>Registered under Companies Act 2013, Ministry of Corporate Affairs, Govt. of India.</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-5 text-slate-500 dark:text-slate-400">
            <button type="button" onClick={() => onSelectTab('plans')} className="hover:text-slate-900 dark:hover:text-slate-200">
              Franchise Terms
            </button>
            <button type="button" onClick={() => onSelectTab('tracker')} className="hover:text-slate-900 dark:hover:text-slate-200">
              Status Tracker
            </button>
            <button type="button" onClick={() => onSelectTab('api')} className="hover:text-slate-900 dark:hover:text-slate-200">
              API Security
            </button>
            <span>© {new Date().getFullYear()} TrueDeal Global. All rights reserved.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
