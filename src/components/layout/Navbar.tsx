import { useState } from 'react';
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
  Sparkles
} from 'lucide-react';
import { UserRole, AppNotification, Currency } from '../../types/franchise';

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
  onToggleCurrency
}: NavbarProps) {
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
      <div className="bg-slate-950 text-slate-300 border-b border-slate-800 text-[11px] font-medium">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-1.5 flex flex-wrap items-center justify-between gap-3">
          {/* Left: Global & National Ranking Credentials */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="inline-flex items-center gap-1.5 text-amber-400 font-bold tracking-wide">
              <Award className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>#1 Franchise Provider in India</span>
              <span className="text-slate-500">·</span>
              <span className="text-emerald-400">Top 3 Worldwide</span>
            </div>

            <div className="hidden xl:flex items-center gap-2 text-slate-400 border-l border-slate-800 pl-3">
              <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
              <span>MCA Govt. of India Registered · DPIIT Startup India Certified</span>
            </div>
          </div>

          {/* Center: Global Footprint Ticker */}
          <div className="hidden lg:flex items-center gap-2 text-slate-400 text-[10px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Global HQ: Ghaziabad NCR</span>
            <span className="text-slate-600">|</span>
            <span>Regional Desks: Dubai 🇦🇪 · Texas 🇺🇸 · Melbourne 🇦🇺 · Mumbai 🇮🇳</span>
          </div>

          {/* Right: Hotline, Currency Selector, Offline Sync, Dark Mode */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Direct Corporate Hotline */}
            <a
              href="tel:+911204000800"
              className="hidden sm:inline-flex items-center gap-1 text-slate-300 hover:text-white transition-colors"
            >
              <Phone className="w-3 h-3 text-amber-400" />
              <span className="font-mono">+91 120 4000 800</span>
            </a>

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
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-6 h-18">
            {/* Zone 1: Prestige Brand Emblem & Corporate Identification */}
            <button
              type="button"
              onClick={() => handleNavClick('plans')}
              className="flex items-center gap-3 text-left shrink-0 group focus:outline-none"
            >
              <div className="relative">
                <img
                  src="/assets/truedeal_logo.png"
                  alt="TrueDeal Global Logo"
                  className="h-10 sm:h-12 w-auto object-contain transition-transform group-hover:scale-105 drop-shadow-xs"
                />
              </div>

              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-lg sm:text-xl font-black tracking-tight text-slate-950 dark:text-white leading-none">
                    TRUEDEAL GLOBAL
                  </span>
                  <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500 text-slate-950">
                    INDIA #1
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  <span>OPC PVT LTD</span>
                  <span>·</span>
                  <span className="text-indigo-600 dark:text-indigo-400">Ranked Top 3 Worldwide</span>
                </div>
              </div>
            </button>

            {/* Zone 2: World-Class Text-First Navigation */}
            <nav className="hidden lg:flex items-center gap-6 xl:gap-8 text-sm font-semibold text-slate-600 dark:text-slate-300">
              <button
                type="button"
                onClick={() => handleNavClick('plans')}
                className={`hover:text-slate-950 dark:hover:text-white transition-colors relative py-1 ${
                  currentTab === 'plans' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : ''
                }`}
              >
                <span>Franchise Plans</span>
                {currentTab === 'plans' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                )}
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('plans', 'success-stories')}
                className="hover:text-slate-950 dark:hover:text-white transition-colors flex items-center gap-1.5 py-1"
              >
                <span>Success Stories</span>
                <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                  +310%
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('apply')}
                className={`hover:text-slate-950 dark:hover:text-white transition-colors py-1 ${
                  currentTab === 'apply' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : ''
                }`}
              >
                <span>Apply Online</span>
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('tracker')}
                className={`hover:text-slate-950 dark:hover:text-white transition-colors py-1 ${
                  currentTab === 'tracker' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : ''
                }`}
              >
                <span>Application Tracker</span>
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('admin')}
                className={`hover:text-slate-950 dark:hover:text-white transition-colors py-1 ${
                  currentTab === 'admin' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : ''
                }`}
              >
                <span>Admin Pipeline</span>
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('analytics')}
                className={`hover:text-slate-950 dark:hover:text-white transition-colors py-1 ${
                  currentTab === 'analytics' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : ''
                }`}
              >
                <span>Analytics & Audit</span>
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('api')}
                className={`hover:text-slate-950 dark:hover:text-white transition-colors py-1 ${
                  currentTab === 'api' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : ''
                }`}
              >
                <span>API Docs</span>
              </button>
            </nav>

            {/* Zone 3: Executive Controls & Primary Action Button */}
            <div className="flex items-center gap-2.5 sm:gap-3.5 shrink-0">
              {/* Notifications Alert Bell */}
              <button
                type="button"
                onClick={onOpenNotifications}
                className="relative p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                )}
              </button>

              {/* RBAC Role Selector Dropdown */}
              <div className="relative hidden md:block">
                <button
                  type="button"
                  onClick={() => setRoleMenuOpen(!roleMenuOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 text-xs font-semibold hover:border-slate-300 dark:hover:border-slate-600 transition-colors shadow-2xs"
                >
                  <currentRoleObj.icon className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span className="whitespace-nowrap">{currentRoleObj.label}</span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>

                {roleMenuOpen && (
                  <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-2 z-50 animate-fade-in">
                    <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                      Switch Role View (RBAC)
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
                          className={`w-full flex items-center gap-3 px-3 py-2 text-xs rounded-xl text-left transition-colors ${
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
                className="relative group overflow-hidden px-5 py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-indigo-600 via-indigo-700 to-slate-900 dark:from-indigo-500 dark:via-indigo-600 dark:to-indigo-800 hover:brightness-110 active:scale-[0.98] transition-all shadow-md flex items-center gap-1.5"
              >
                <span>{userRole === 'applicant' ? 'Apply for Franchise' : 'Open Pipeline'}</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>

              {/* Mobile Drawer Hamburger Button */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
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
            <div className="grid grid-cols-1 gap-1 text-sm font-semibold">
              <button
                type="button"
                onClick={() => handleNavClick('plans')}
                className="px-3 py-2 rounded-lg text-left hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                Franchise Plans
              </button>
              <button
                type="button"
                onClick={() => handleNavClick('plans', 'success-stories')}
                className="px-3 py-2 rounded-lg text-left hover:bg-slate-100 dark:hover:bg-slate-800 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-between"
              >
                <span>Success Stories</span>
                <span className="text-xs bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded-full">+310%</span>
              </button>
              <button
                type="button"
                onClick={() => handleNavClick('apply')}
                className="px-3 py-2 rounded-lg text-left hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                Apply Online
              </button>
              <button
                type="button"
                onClick={() => handleNavClick('tracker')}
                className="px-3 py-2 rounded-lg text-left hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                Application Tracker
              </button>
              <button
                type="button"
                onClick={() => handleNavClick('admin')}
                className="px-3 py-2 rounded-lg text-left hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                Admin Pipeline
              </button>
              <button
                type="button"
                onClick={() => handleNavClick('analytics')}
                className="px-3 py-2 rounded-lg text-left hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                Analytics & Audit
              </button>
              <button
                type="button"
                onClick={() => handleNavClick('api')}
                className="px-3 py-2 rounded-lg text-left hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                API Documentation
              </button>
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
