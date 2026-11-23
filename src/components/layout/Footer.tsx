import {
  ShieldCheck,
  Shield,
  Building,
  Phone,
  Mail,
  ArrowRight,
  Lock,
  FileText,
  Scale,
  Copy,
  Check,
  Globe
} from 'lucide-react';
import { useState } from 'react';
import { Currency } from '../../types/franchise';
import { FranchiseStorageService } from '../../services/storage';
import { getDisplayRegisteredAddress } from '../../config/complianceConfig';
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
  onSelectTab,
  onOpenEmailModal,
  onOpenSyncModal,
  emailsCount,
  syncQueueCount
}: FooterProps) {
  const { language } = useLanguage();
  const [copiedBank, setCopiedBank] = useState<string | null>(null);
  const config = FranchiseStorageService.getComplianceConfig();
  const plans = FranchiseStorageService.getPlans();
  const displayAddress = getDisplayRegisteredAddress(config);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedBank(key);
    setTimeout(() => setCopiedBank(null), 2500);
  };

  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 mt-20 transition-colors">
      {/* 1. Transparent Franchise Onboarding Callout Banner */}
      <div className="bg-slate-950 text-white py-10 px-4 sm:px-6 lg:px-8 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center lg:text-left max-w-2xl">
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
              <span>{config.legalName} · Official Franchise Portal</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
              {language === 'hi'
                ? 'पारदर्शी फ़्रैंचाइज़ी साझेदारी एवं ऑनलाइन पंजीकरण'
                : 'Transparent Business Franchise Partnerships'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Review complete INR package pricing, inclusions, refund and cancellation policies, and franchise agreement
              terms before applying. All applications undergo manual compliance review prior to onboarding.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onSelectTab('pricing')}
              className="px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-white/10 hover:bg-white/20 border border-white/20 transition-all cursor-pointer"
            >
              View Full INR Pricing
            </button>
            <button
              type="button"
              onClick={() => onSelectTab('apply')}
              className="px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-slate-950 bg-amber-400 hover:bg-amber-300 transition-all flex items-center gap-2 cursor-pointer"
            >
              <span>Apply Online</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Verified Statutory Registrations Strip (No Unverified Claims) */}
      <div className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 py-5 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Verified Corporate Registrations:</span>
          </div>
          <div className="flex flex-wrap items-center gap-5 font-semibold text-slate-600 dark:text-slate-400">
            <span>MCA Registered OPC Pvt Ltd (Govt. of India)</span>
            <span>·</span>
            <span>DPIIT Startup India Recognized</span>
            <span>·</span>
            <span>Udyam MSME Registered</span>
            <span>·</span>
            <span>Bank of Baroda Corporate Current A/C</span>
          </div>
        </div>
      </div>

      {/* 3. Comprehensive 5-Column Directory */}
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8">
          {/* Column 1: Legal & Compliance Policies (All 10 Public Pages Linked) */}
          <div className="space-y-3.5">
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
              <Scale className="w-4 h-4 text-indigo-500" />
              <span>Policies & Legal</span>
            </h3>
            <ul className="space-y-2 text-xs">
              {[
                { id: 'about', label: 'About Us' },
                { id: 'contact', label: 'Contact Us' },
                { id: 'pricing', label: 'Pricing & Packages (INR)' },
                { id: 'terms', label: 'Terms and Conditions' },
                { id: 'privacy', label: 'Privacy Policy' },
                { id: 'refund', label: 'Refund Policy' },
                { id: 'cancellation', label: 'Cancellation Policy' },
                { id: 'franchise-terms', label: 'Franchise Agreement Terms' },
                { id: 'delivery', label: 'Shipping & Delivery Policy' },
                { id: 'grievance', label: 'Grievance Redressal' }
              ].map((link) => (
                <li key={link.id}>
                  <button
                    type="button"
                    onClick={() => onSelectTab(link.id)}
                    className="hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline transition-colors text-left cursor-pointer"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 2: Official Franchise Packages */}
          <div className="space-y-3.5">
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-amber-500" />
              <span>Franchise Packages</span>
            </h3>
            <ul className="space-y-2 text-xs">
              {plans.map((plan) => (
                <li key={plan.id}>
                  <button
                    type="button"
                    onClick={() => onSelectTab('pricing')}
                    className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-left flex items-center justify-between w-full group cursor-pointer"
                  >
                    <span className="group-hover:underline font-medium text-slate-800 dark:text-slate-200 truncate pr-2">
                      {plan.title}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono shrink-0">
                      ₹{plan.priceINR.toLocaleString('en-IN')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Official Corporate Bank Details */}
          <div className="space-y-3.5">
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
              <Building className="w-4 h-4 text-orange-500" />
              <span>Corporate Bank Account</span>
            </h3>
            <div className="p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold">Beneficiary:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{config.bankDetails.beneficiaryName}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold">Bank & Type:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {config.bankDetails.bankName} ({config.bankDetails.accountType})
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold">Account Number:</span>
                <div className="flex items-center justify-between font-mono font-bold text-slate-900 dark:text-slate-100">
                  <span>{config.bankDetails.accountNumber}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(config.bankDetails.accountNumber, 'ac')}
                    className="text-indigo-600 hover:text-indigo-700 cursor-pointer"
                    title="Copy Account Number"
                  >
                    {copiedBank === 'ac' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold">IFSC Code:</span>
                <div className="flex items-center justify-between font-mono font-bold text-slate-900 dark:text-slate-100">
                  <span>{config.bankDetails.ifscCode}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(config.bankDetails.ifscCode, 'ifsc')}
                    className="text-indigo-600 hover:text-indigo-700 cursor-pointer"
                    title="Copy IFSC Code"
                  >
                    {copiedBank === 'ifsc' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <span className="text-[10px] text-slate-500 block mt-0.5">{config.bankDetails.branchName}</span>
              </div>
            </div>
          </div>

          {/* Column 4: Official Contact Details */}
          <div className="space-y-3.5">
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-emerald-500" />
              <span>Corporate Contact</span>
            </h3>
            <ul className="space-y-2.5 text-xs">
              <li>
                <span className="text-[10px] text-slate-400 block font-semibold">Registered / Operating Location:</span>
                <span className="text-slate-700 dark:text-slate-300 leading-relaxed">{displayAddress}</span>
              </li>
              <li>
                <span className="text-[10px] text-slate-400 block font-semibold">Official Email:</span>
                <a
                  href={`mailto:${config.officialEmail}`}
                  className="text-slate-900 dark:text-slate-100 font-semibold hover:text-indigo-600 flex items-center gap-1.5"
                >
                  <Mail className="w-3.5 h-3.5 text-indigo-500" />
                  <span>{config.officialEmail}</span>
                </a>
              </li>
              <li>
                <span className="text-[10px] text-slate-400 block font-semibold">Support Phone:</span>
                <a
                  href={`tel:${config.supportPhone.replace(/[^+\d]/g, '')}`}
                  className="text-slate-900 dark:text-slate-100 font-mono font-bold hover:text-indigo-600 flex items-center gap-1.5"
                >
                  <Phone className="w-3.5 h-3.5 text-amber-500" />
                  <span>{config.supportPhone}</span>
                </a>
              </li>
              <li>
                <span className="text-[10px] text-slate-400 block font-semibold">WhatsApp Helpdesk:</span>
                <a
                  href={`https://wa.me/${config.whatsappNumber.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-600 dark:text-emerald-400 font-mono font-bold hover:underline flex items-center gap-1.5"
                >
                  <WhatsAppIcon className="w-3.5 h-3.5 text-emerald-500" />
                  <span>{config.whatsappNumber}</span>
                </a>
              </li>
              <li>
                <span className="text-[10px] text-slate-400 block font-semibold">Main Corporate Website:</span>
                <a
                  href={config.mainWebsite}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                >
                  {config.mainWebsite}
                </a>
              </li>
            </ul>
          </div>

          {/* Column 5: Portal Navigation & Authorized Staff */}
          <div className="space-y-3.5">
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-indigo-500" />
              <span>Portal Tools</span>
            </h3>
            <ul className="space-y-2.5 text-xs">
              <li>
                <button
                  type="button"
                  onClick={() => onSelectTab('referral')}
                  className="font-semibold text-emerald-700 dark:text-emerald-400 hover:underline transition-colors cursor-pointer"
                >
                  Refer &amp; Earn (10% Commission)
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onSelectTab('apply')}
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                >
                  Apply Online
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onSelectTab('tracker')}
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                >
                  Application Status Tracker
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onSelectTab('admin')}
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                >
                  Authorized Staff Admin Console
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onSelectTab('api')}
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <span>Integration & API Specs</span>
                </button>
              </li>
              <li className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <button
                  type="button"
                  onClick={onOpenEmailModal}
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>Dispatched Notices ({emailsCount})</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenSyncModal}
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Sync Monitor ({syncQueueCount} queued)</span>
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* 4. Corporate Copyright & Statutory Notice Bar */}
      <div className="border-t border-slate-200 dark:border-slate-800 py-6 px-4 sm:px-6 lg:px-8 bg-slate-50 dark:bg-slate-950 text-[11px] text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-center md:text-left">
            <span className="font-bold text-slate-900 dark:text-slate-200">{config.legalName}</span>
            <span className="mx-1.5">·</span>
            <span>Registered under Companies Act, 2013 (MCA, Govt. of India).</span>
            {config.cin && <span className="ml-2 font-mono">CIN: {config.cin}</span>}
            {config.gstin && <span className="ml-2 font-mono">GSTIN: {config.gstin}</span>}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <button type="button" onClick={() => onSelectTab('referral')} className="hover:text-slate-900 dark:hover:text-slate-200 font-semibold cursor-pointer">
              Refer &amp; Earn
            </button>
            <button type="button" onClick={() => onSelectTab('terms')} className="hover:text-slate-900 dark:hover:text-slate-200 cursor-pointer">
              Terms
            </button>
            <button type="button" onClick={() => onSelectTab('privacy')} className="hover:text-slate-900 dark:hover:text-slate-200 cursor-pointer">
              Privacy
            </button>
            <button type="button" onClick={() => onSelectTab('refund')} className="hover:text-slate-900 dark:hover:text-slate-200 cursor-pointer">
              Refunds
            </button>
            <button type="button" onClick={() => onSelectTab('cancellation')} className="hover:text-slate-900 dark:hover:text-slate-200 cursor-pointer">
              Cancellations
            </button>
            <button type="button" onClick={() => onSelectTab('grievance')} className="hover:text-slate-900 dark:hover:text-slate-200 cursor-pointer">
              Grievance
            </button>
            <span>© {new Date().getFullYear()} {config.legalName}. All rights reserved.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
