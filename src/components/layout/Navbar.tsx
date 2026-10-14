import { useState, useRef, useEffect } from 'react';
import {
  Moon,
  Sun,
  Bell,
  Wifi,
  WifiOff,
  ChevronDown,
  UserCheck,
  Shield,
  FileCheck,
  Building,
  User,
  Award,
  Globe,
  Phone,
  Mail,
  ShieldCheck,
  Menu,
  X,
  ArrowRight,
  TrendingUp,
  Sparkles,
  Check,
  LogOut
} from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import { UserRole, AppNotification, Currency } from '../../types/franchise';
import { WhatsAppIcon } from '../common/WhatsAppSupportWidget';
import { useLanguage } from '../../context/LanguageContext';

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  userRole: UserRole;
  onChangeRole: (role: UserRole) => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  isOffline: boolean;
  pendingSyncCount: number;
  onOpenSyncModal: () => void;
  onOpenEmailModal: () => void;
  notifications: AppNotification[];
  onOpenNotifications: () => void;
  unreadCount: number;
  currency: Currency;
  onToggleCurrency: (c: Currency) => void;
  currentUser?: FirebaseUser | null;
  onSignInGoogle?: () => void;
  onSignOut?: () => void;
}

export function Navbar({
  currentTab,
  onSelectTab,
  userRole,
  onChangeRole,
  darkMode,
  onToggleDarkMode,
  isOffline,
  pendingSyncCount,
  onOpenSyncModal,
  onOpenEmailModal,
  notifications,
  onOpenNotifications,
  unreadCount,
  currency,
  onToggleCurrency,
  currentUser,
  onSignInGoogle,
  onSignOut
}: NavbarProps) {
  const { language, setLanguage, t } = useLanguage();
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [topLangMenuOpen, setTopLangMenuOpen] = useState(false);
  const [desktopLangOpen, setDesktopLangOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const topLangRef = useRef<HTMLDivElement>(null);
  const desktopLangRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (topLangRef.current && !topLangRef.current.contains(e.target as Node)) {
        setTopLangMenuOpen(false);
      }
      if (desktopLangRef.current && !desktopLangRef.current.contains(e.target as Node)) {
        setDesktopLangOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const roles: { id: UserRole; label: string; desc: string; icon: any }[] = [
    { id: 'super_admin', label: 'Super Admin', desc: 'Full System, Security & Root Access', icon: Shield },
    { id: 'director', label: 'Franchise Director', desc: 'Territory Approval & Executive Governance', icon: UserCheck },
    { id: 'compliance', label: 'Compliance Officer', desc: 'MCA Legal Audits & Document Inspection', icon: FileCheck },
    { id: 'territory_manager', label: 'Territory Manager', desc: 'Regional Partner Coordinator', icon: Building },
    { id: 'applicant', label: 'Franchise Applicant', desc: 'Self-Service Onboarding & Biometrics', icon: User }
  ];

  const currentRoleObj = roles.find(r => r.id === userRole) || roles[0];

  const handleNavClick = (tab: string, scrollTarget?: string) => {
    onSelectTab(tab);
    setMobileMenuOpen(false);
    if (scrollTarget) {
      setTimeout(() => {
        const el = document.getElementById(scrollTarget);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 120);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full shadow-xs">
      {/* Top 3 Global Executive Utility & Ranking Ribbon */}
      <div className="bg-slate-950 text-slate-300 border-b border-slate-800 text-[11px] font-medium w-full">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-1.5 flex items-center justify-between gap-2 text-[10px] sm:text-[11px]">
          {/* Left: Global & National Ranking Credentials */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="inline-flex items-center gap-1.5 text-amber-400 font-bold tracking-wide">
              <Award className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="hidden sm:inline">{t('topBar.rankIndia')}</span>
              <span className="sm:hidden font-bold">{language === 'hi' ? '#1 भारत में' : '#1 in India'}</span>
              <span className="text-slate-500">·</span>
              <span className="text-emerald-400">{t('topBar.rankWorld')}</span>
            </div>

            <div className="hidden xl:flex items-center gap-2 text-slate-400 border-l border-slate-800 pl-3">
              <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
              <span>{t('topBar.credentials')}</span>
            </div>
          </div>

          {/* Center: Global Footprint Ticker */}
          <div className="hidden 2xl:flex items-center gap-2 text-slate-400 text-[10px] shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>{t('topBar.globalHq')}</span>
            <span className="text-slate-600">|</span>
            <span>{t('topBar.regionalDesks')}</span>
          </div>

          {/* Right: Hotline, Currency Selector, Offline Sync, Dark Mode */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {/* Direct Corporate Phone Hotline */}
            <a
              href="tel:+919317194033"
              className="hidden md:inline-flex items-center gap-1.5 text-slate-300 hover:text-amber-400 transition-colors py-0.5 text-[11px]"
              title="Call TrueDeal Global: +91-9317194033"
            >
              <Phone className="w-3 h-3 text-amber-400 shrink-0" />
              <span className="font-mono font-medium">+91-9317194033</span>
            </a>

            <span className="text-slate-700 hidden md:inline">|</span>

            {/* Direct WhatsApp Instant Connect */}
            <a
              href="https://wa.me/918091667890?text=Hello%20TrueDeal%20Global%20Team,%20I%20am%20interested%20in%20a%20franchise%20partnership.%20Please%20guide%20me."
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 hover:bg-emerald-500/30 hover:text-emerald-100 transition-all text-[11px] font-semibold shadow-xs"
              title="Connect instantly on WhatsApp: +91-8091667890"
            >
              <WhatsAppIcon className="w-3 h-3 text-emerald-400 shrink-0" />
              <span className="hidden xl:inline">WhatsApp:</span>
              <span className="font-mono">+91-8091667890</span>
            </a>

            <span className="text-slate-700 hidden sm:inline">|</span>

            {/* Direct Directorate Email */}
            <a
              href="mailto:info@truedealglobal.com"
              className="hidden 2xl:inline-flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors py-0.5 text-[11px]"
              title="Email: info@truedealglobal.com"
            >
              <Mail className="w-3 h-3 text-indigo-400 shrink-0" />
              <span>info@truedealglobal.com</span>
            </a>

            <span className="text-slate-700 hidden sm:inline">|</span>

            {/* Language Switcher Dropdown (English / हिन्दी) */}
            <div className="relative" ref={topLangRef}>
              <button
                type="button"
                onClick={() => {
                  setTopLangMenuOpen(!topLangMenuOpen);
                  setDesktopLangOpen(false);
                  setRoleMenuOpen(false);
                }}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700/80 text-[10px] font-semibold text-slate-200 hover:text-white hover:border-slate-500 transition-all shadow-xs cursor-pointer"
                title={language === 'hi' ? 'भाषा बदलें (वर्तमान: हिन्दी)' : 'Change Language (Current: English)'}
              >
                <Globe className="w-3 h-3 text-amber-400 shrink-0" />
                <span className="font-medium">{language === 'hi' ? '🇮🇳 हिन्दी' : '🇬🇧 EN'}</span>
                <ChevronDown className={`w-2.5 h-2.5 text-slate-400 transition-transform ${topLangMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {topLangMenuOpen && (
                <div className="absolute right-0 mt-1.5 w-60 bg-slate-950/98 backdrop-blur-md border border-slate-800 rounded-xl shadow-2xl p-1.5 z-50 animate-fade-in text-xs">
                  <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 flex items-center justify-between">
                    <span>{t('nav.selectLanguage')}</span>
                    <span className="text-emerald-400 text-[9px] font-mono">Live</span>
                  </div>
                  <div className="space-y-1 mt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setLanguage('en');
                        setTopLangMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                        language === 'en'
                          ? 'bg-indigo-950/80 border border-indigo-700/70 text-indigo-200 font-bold'
                          : 'text-slate-300 hover:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">🇬🇧</span>
                        <div>
                          <div className="font-semibold text-slate-200 text-xs">English</div>
                          <div className="text-[10px] text-slate-400">{t('nav.englishDesc')}</div>
                        </div>
                      </div>
                      {language === 'en' && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setLanguage('hi');
                        setTopLangMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                        language === 'hi'
                          ? 'bg-indigo-950/80 border border-indigo-700/70 text-indigo-200 font-bold'
                          : 'text-slate-300 hover:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">🇮🇳</span>
                        <div>
                          <div className="font-semibold text-slate-200 text-xs">हिन्दी (Hindi)</div>
                          <div className="text-[10px] text-slate-400">{t('nav.hindiDesc')}</div>
                        </div>
                      </div>
                      {language === 'hi' && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <span className="text-slate-700 hidden sm:inline">|</span>

            {/* Currency Switcher (INR / USD) */}
            <div className="inline-flex items-center bg-slate-900 border border-slate-700/80 rounded-md p-0.5 text-[10px]">
              <button
                type="button"
                onClick={() => onToggleCurrency('INR')}
                className={`px-2 py-0.5 rounded transition-all font-semibold flex items-center gap-1 ${
                  currency === 'INR'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Indian Rupees (Standard domestic fee structure)"
              >
                <span>🇮🇳</span>
                <span>INR ₹</span>
              </button>
              <button
                type="button"
                onClick={() => onToggleCurrency('USD')}
                className={`px-2 py-0.5 rounded transition-all font-semibold flex items-center gap-1 ${
                  currency === 'USD'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="US Dollars (+10% international forex rate applied)"
              >
                <span>🌐</span>
                <span>USD $</span>
                <span className="text-[9px] font-normal opacity-90 hidden md:inline">(+10%)</span>
              </button>
            </div>

            {/* Sync & Offline Status Indicator */}
            <button
              type="button"
              onClick={onOpenSyncModal}
              title={isOffline ? 'Offline Mode Active' : 'All systems synced'}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] transition-colors ${
                isOffline
                  ? 'bg-amber-950/80 text-amber-300 border border-amber-800'
                  : 'text-slate-400 hover:text-emerald-400'
              }`}
            >
              {isOffline ? (
                <>
                  <WifiOff className="w-3 h-3 text-amber-400" />
                  <span className="hidden md:inline">Offline</span>
                </>
              ) : (
                <>
                  <Wifi className="w-3 h-3 text-emerald-400" />
                  <span className="hidden md:inline">Online</span>
                </>
              )}
              {pendingSyncCount > 0 && (
                <span className="bg-indigo-500 text-white px-1 rounded-full font-mono text-[9px]">
                  {pendingSyncCount}
                </span>
              )}
            </button>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={onToggleDarkMode}
              className="p-1 text-slate-400 hover:text-white transition-colors"
              title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {darkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Main Luxury Corporate Navigation Bar */}
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 w-full">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-2 sm:gap-3 lg:gap-5 min-h-[4rem] py-2">
            {/* Zone 1: Prestige Brand Emblem & Corporate Identification */}
            <button
              type="button"
              onClick={() => handleNavClick('plans')}
              className="flex items-center gap-2 sm:gap-2.5 text-left shrink-0 group focus:outline-none cursor-pointer"
            >
              <div className="relative">
                <img
                  src="/assets/truedeal_logo.png"
                  alt="TrueDeal Global Logo"
                  className="h-8 sm:h-10 md:h-11 w-auto object-contain transition-transform group-hover:scale-105 drop-shadow-xs"
                />
              </div>

              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm sm:text-base lg:text-lg font-black tracking-tight text-slate-950 dark:text-white leading-none">
                    {t('brand.name')}
                  </span>
                  <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500 text-slate-950">
                    {t('brand.badge')}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 text-[8.5px] sm:text-[9.5px] font-bold text-slate-500 dark:text-slate-400">
                  <span>{t('brand.type')}</span>
                  <span>·</span>
                  <span className="text-indigo-600 dark:text-indigo-400">{t('brand.sub')}</span>
                </div>
              </div>
            </button>

            {/* Zone 2: World-Class Text-First Navigation */}
            <nav className="hidden lg:flex items-center gap-1.5 xl:gap-3 2xl:gap-5 text-xs xl:text-sm font-semibold text-slate-600 dark:text-slate-300">
              <button
                type="button"
                onClick={() => handleNavClick('plans')}
                className={`hover:text-slate-950 dark:hover:text-white transition-colors relative py-1 px-1 cursor-pointer whitespace-nowrap ${
                  currentTab === 'plans' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : ''
                }`}
              >
                <span>{t('nav.plans')}</span>
                {currentTab === 'plans' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                )}
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('plans', 'success-stories')}
                className="hover:text-slate-950 dark:hover:text-white transition-colors flex items-center gap-1 py-1 px-1 cursor-pointer whitespace-nowrap"
              >
                <span>{t('nav.successStories')}</span>
                <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                  +310%
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('apply')}
                className={`hover:text-slate-950 dark:hover:text-white transition-colors py-1 px-1 cursor-pointer whitespace-nowrap ${
                  currentTab === 'apply' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : ''
                }`}
              >
                <span>{t('nav.apply')}</span>
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('tracker')}
                className={`hover:text-slate-950 dark:hover:text-white transition-colors py-1 px-1 cursor-pointer whitespace-nowrap ${
                  currentTab === 'tracker' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : ''
                }`}
              >
                <span>{t('nav.tracker')}</span>
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('admin')}
                className={`hover:text-slate-950 dark:hover:text-white transition-colors py-1 px-1 cursor-pointer whitespace-nowrap ${
                  currentTab === 'admin' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : ''
                }`}
              >
                <span>{t('nav.admin')}</span>
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('analytics')}
                className={`hover:text-slate-950 dark:hover:text-white transition-colors py-1 px-1 cursor-pointer whitespace-nowrap ${
                  currentTab === 'analytics' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : ''
                }`}
              >
                <span>{t('nav.analytics')}</span>
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('api')}
                className={`hover:text-slate-950 dark:hover:text-white transition-colors py-1 px-1 cursor-pointer whitespace-nowrap ${
                  currentTab === 'api' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : ''
                }`}
              >
                <span>{t('nav.api')}</span>
              </button>
            </nav>

            {/* Zone 3: Executive Controls & Primary Action Button */}
            <div className="flex items-center gap-1.5 sm:gap-2.5 lg:gap-3 shrink-0">
              {/* Google Sign In / Firebase Authenticated Profile */}
              {currentUser ? (
                <div className="relative" ref={userMenuRef}>
                  <button
                    type="button"
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-1.5 p-1 sm:px-2.5 sm:py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 text-xs font-semibold hover:bg-emerald-500/20 transition-all cursor-pointer"
                    title={currentUser.email || currentUser.displayName || 'Authorized Partner'}
                  >
                    {currentUser.photoURL ? (
                      <img
                        src={currentUser.photoURL}
                        alt=""
                        className="w-6 h-6 rounded-full object-cover ring-1 ring-emerald-500 shrink-0"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                        {currentUser.displayName ? currentUser.displayName[0] : 'U'}
                      </div>
                    )}
                    <span className="max-w-[70px] sm:max-w-[100px] truncate hidden md:inline font-medium text-xs">
                      {currentUser.displayName?.split(' ')[0] || 'Partner'}
                    </span>
                    <ChevronDown className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  </button>

                  {userMenuOpen && (
                    <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-2 z-50 animate-fade-in text-xs">
                      <div className="p-2.5 border-b border-slate-100 dark:border-slate-800 space-y-0.5">
                        <div className="font-bold text-slate-900 dark:text-slate-100 truncate">
                          {currentUser.displayName || 'TrueDeal Partner'}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
                          {currentUser.email}
                        </div>
                        <div className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                          <ShieldCheck className="w-3 h-3" />
                          <span>Google Verified Identity</span>
                        </div>
                      </div>
                      <div className="pt-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            onSignOut?.();
                            setUserMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-2 p-2 rounded-xl text-left text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer font-semibold"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onSignInGoogle}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs font-semibold hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-xs transition-all cursor-pointer shrink-0"
                  title="Sign In with Google via Firebase Auth"
                >
                  <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span className="hidden sm:inline">Google Sign In</span>
                </button>
              )}

              {/* Notifications Alert Bell */}
              <button
                type="button"
                onClick={onOpenNotifications}
                className="relative p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                )}
              </button>

              {/* Language Switcher Dropdown in Navigation Bar */}
              <div className="relative hidden md:block shrink-0" ref={desktopLangRef}>
                <button
                  type="button"
                  onClick={() => {
                    setDesktopLangOpen(!desktopLangOpen);
                    setRoleMenuOpen(false);
                    setTopLangMenuOpen(false);
                  }}
                  className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 text-xs font-semibold hover:border-slate-300 dark:hover:border-slate-600 transition-colors shadow-2xs cursor-pointer"
                  title="Select Language / भाषा चुनें"
                >
                  <Globe className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span className="whitespace-nowrap font-medium">{language === 'hi' ? '🇮🇳 हिन्दी' : '🇬🇧 EN'}</span>
                  <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${desktopLangOpen ? 'rotate-180' : ''}`} />
                </button>

                {desktopLangOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-2 z-50 animate-fade-in text-xs">
                    <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <span>{t('nav.selectLanguage')}</span>
                      <span className="text-indigo-600 dark:text-indigo-400 text-[9px] font-mono">EN / HI</span>
                    </div>
                    <div className="space-y-1 mt-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setLanguage('en');
                          setDesktopLangOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                          language === 'en'
                            ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800/80'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-lg">🇬🇧</span>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-slate-100 text-xs">English</div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">{t('nav.englishDesc')}</div>
                          </div>
                        </div>
                        {language === 'en' && <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setLanguage('hi');
                          setDesktopLangOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                          language === 'hi'
                            ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800/80'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-lg">🇮🇳</span>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-slate-100 text-xs">हिन्दी (Hindi)</div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">{t('nav.hindiDesc')}</div>
                          </div>
                        </div>
                        {language === 'hi' && <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* RBAC Role Selector Dropdown */}
              <div className="relative hidden xl:block shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setRoleMenuOpen(!roleMenuOpen);
                    setDesktopLangOpen(false);
                    setTopLangMenuOpen(false);
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 text-xs font-semibold hover:border-slate-300 dark:hover:border-slate-600 transition-colors shadow-2xs cursor-pointer"
                >
                  <currentRoleObj.icon className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span className="whitespace-nowrap">{currentRoleObj.label}</span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>

                {roleMenuOpen && (
                  <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-2 z-50 animate-fade-in">
                    <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                      {t('nav.switchRole')}
                    </div>
                    <div className="space-y-1 mt-1">
                      {roles.map(r => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => {
                            onChangeRole(r.id);
                            setRoleMenuOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2 text-xs rounded-xl text-left transition-colors cursor-pointer ${
                            userRole === r.id
                              ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <r.icon className="w-4 h-4 shrink-0 text-indigo-500" />
                          <div>
                            <div className="font-bold text-slate-900 dark:text-slate-100">{r.label}</div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">{r.desc}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Primary High-Impact Executive CTA Button */}
              <button
                type="button"
                onClick={() => onSelectTab(userRole === 'applicant' ? 'apply' : 'admin')}
                className="relative group overflow-hidden px-3 sm:px-4 xl:px-4.5 py-1.5 sm:py-2 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-indigo-600 via-indigo-700 to-slate-900 dark:from-indigo-500 dark:via-indigo-600 dark:to-indigo-800 hover:brightness-110 active:scale-[0.98] transition-all shadow-md flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <span className="whitespace-nowrap hidden sm:inline">{userRole === 'applicant' ? t('nav.ctaApplicant') : t('nav.ctaDirector')}</span>
                <span className="whitespace-nowrap sm:hidden">{userRole === 'applicant' ? (language === 'hi' ? 'आवेदन करें' : 'Apply') : (language === 'hi' ? 'व्यवस्थापक' : 'Admin')}</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>

              {/* Mobile Drawer Hamburger Button */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                title="Toggle Menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 pt-2 pb-6 space-y-3">
            {/* Google Auth Status on Mobile */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              {currentUser ? (
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2.5">
                    {currentUser.photoURL ? (
                      <img src={currentUser.photoURL} alt="" className="w-8 h-8 rounded-full object-cover ring-1 ring-emerald-500" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">
                        {currentUser.displayName ? currentUser.displayName[0] : 'U'}
                      </div>
                    )}
                    <div>
                      <div className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate max-w-[140px]">
                        {currentUser.displayName || 'TrueDeal Partner'}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate max-w-[140px]">
                        {currentUser.email}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onSignOut}
                    className="px-2.5 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between w-full">
                  <div className="text-xs text-slate-600 dark:text-slate-300 font-semibold">
                    Google Partner Account
                  </div>
                  <button
                    type="button"
                    onClick={onSignInGoogle}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors cursor-pointer shadow-xs"
                  >
                    <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                      <path fill="#ffffff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#ffffff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#ffffff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#ffffff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>Google Sign In</span>
                  </button>
                </div>
              )}
            </div>
            {/* Mobile Language Switcher Dropdown / Pills */}
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-200 font-bold">
                <Globe className="w-4 h-4 text-indigo-500 shrink-0" />
                <span>{t('topBar.language')}:</span>
              </div>
              <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-200/60 dark:bg-slate-900">
                <button
                  type="button"
                  onClick={() => setLanguage('en')}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                    language === 'en'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>🇬🇧</span>
                  <span>English</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage('hi')}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                    language === 'hi'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>🇮🇳</span>
                  <span>हिन्दी</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-1 text-sm font-semibold">
              <button
                type="button"
                onClick={() => handleNavClick('plans')}
                className="px-3 py-2 rounded-lg text-left hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                {t('nav.plans')}
              </button>
              <button
                type="button"
                onClick={() => handleNavClick('plans', 'success-stories')}
                className="px-3 py-2 rounded-lg text-left hover:bg-slate-100 dark:hover:bg-slate-800 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-between"
              >
                <span>{t('nav.successStories')}</span>
                <span className="text-xs bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded-full">+310%</span>
              </button>
              <button
                type="button"
                onClick={() => handleNavClick('apply')}
                className="px-3 py-2 rounded-lg text-left hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                {t('nav.apply')}
              </button>
              <button
                type="button"
                onClick={() => handleNavClick('tracker')}
                className="px-3 py-2 rounded-lg text-left hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                {t('nav.tracker')}
              </button>
              <button
                type="button"
                onClick={() => handleNavClick('admin')}
                className="px-3 py-2 rounded-lg text-left hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                {t('nav.admin')}
              </button>
              <button
                type="button"
                onClick={() => handleNavClick('analytics')}
                className="px-3 py-2 rounded-lg text-left hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                {t('nav.analytics')}
              </button>
              <button
                type="button"
                onClick={() => handleNavClick('api')}
                className="px-3 py-2 rounded-lg text-left hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                {t('nav.api')}
              </button>
            </div>

            {/* Mobile Contact Quick Actions */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Direct Helplines</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <a
                  href="https://wa.me/918091667890?text=Hello%20TrueDeal%20Global%20Team,%20I%20am%20interested%20in%20a%20franchise%20partnership.%20Please%20guide%20me."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-semibold"
                >
                  <WhatsAppIcon className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>WhatsApp: +91-8091667890</span>
                </a>
                <a
                  href="tel:+919317194033"
                  className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 font-semibold"
                >
                  <Phone className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>Call: +91-9317194033</span>
                </a>
                <a
                  href="mailto:info@truedealglobal.com"
                  className="flex items-center gap-2 p-2 rounded-lg bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/30 font-semibold sm:col-span-2"
                >
                  <Mail className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span>Email: info@truedealglobal.com</span>
                </a>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-500">Corporate Role:</span>
              <select
                value={userRole}
                onChange={e => onChangeRole(e.target.value as UserRole)}
                className="text-xs font-semibold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200"
              >
                {roles.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
