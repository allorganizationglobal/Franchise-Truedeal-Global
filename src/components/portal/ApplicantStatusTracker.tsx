import { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  CreditCard,
  ShieldCheck,
  Download,
  Upload,
  Lock,
  ArrowRight,
  ExternalLink,
  PenTool,
  Printer,
  Sparkles
} from 'lucide-react';
import { FranchiseApplication, DocumentUpload, PaymentRecord } from '../../types/franchise';
import { FRANCHISE_PLANS, getPlanById, FranchiseStorageService } from '../../services/storage';
import { NotificationService } from '../../services/notificationService';
import { BiometricPromptModal } from '../common/BiometricPromptModal';
import { PaymentModal } from '../common/PaymentModal';
import { DocumentViewerModal } from '../common/DocumentViewerModal';
import { playApprovalSuccessSound } from '../../utils/audio';
import confetti from 'canvas-confetti';

interface ApplicantStatusTrackerProps {
  applicationId: string;
  onRefresh: () => void;
  onSelectApplication: (id: string) => void;
}

export function ApplicantStatusTracker({
  applicationId,
  onRefresh,
  onSelectApplication
}: ApplicantStatusTrackerProps) {
  const applications = FranchiseStorageService.getApplications();
  const currentApp = applications.find(a => a.id === applicationId) || applications[0];

  const [activeTab, setActiveTab] = useState<'timeline' | 'documents' | 'contract' | 'payments'>('timeline');
  const [showBiometricModal, setShowBiometricModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedDocForView, setSelectedDocForView] = useState<DocumentUpload | null>(null);
  const [signingContract, setSigningContract] = useState(false);

  if (!currentApp) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 text-center">
        <p className="text-sm text-slate-500">No active applications found. Please submit an application.</p>
      </div>
    );
  }

  const plan = getPlanById(currentApp.planId) || FRANCHISE_PLANS.find(p => p.id === currentApp.planId) || FRANCHISE_PLANS[0];
  const appCurrency = currentApp.currency || 'INR';
  const depositAmount = appCurrency === 'USD' ? plan.priceUSD : plan.priceINR;
  const currencySymbol = appCurrency === 'USD' ? '$' : '₹';

  // Milestone Stages
  const stages = [
    { key: 'submitted', label: 'Application Filed', desc: 'Received & Queued' },
    { key: 'automated_verified', label: 'Automated Scoring', desc: `${currentApp.automatedEvaluation.score}/100 Score` },
    { key: 'compliance_review', label: 'Compliance & Background', desc: 'AML / KYC Audit' },
    { key: 'approved', label: 'Executive Approval', desc: 'Board LOI Granted' },
    { key: 'contract_issued', label: 'Contract Sign-Off', desc: 'FDD Agreement' },
    { key: 'deposit_paid', label: 'License Escrow', desc: 'Deposit Cleared' },
    { key: 'onboarded', label: 'Active Partner', desc: 'Turnkey Launch' },
  ];

  const getStageIndex = (status: FranchiseApplication['status']) => {
    switch (status) {
      case 'draft': return -1;
      case 'submitted': return 0;
      case 'automated_verified': return 1;
      case 'compliance_review': return 2;
      case 'approved': return 3;
      case 'contract_issued': return 4;
      case 'deposit_paid': return 5;
      case 'onboarded': return 6;
      default: return 1;
    }
  };

  const currentStageIdx = getStageIndex(currentApp.status);

  // Digital Sign Contract with Biometric verification
  const handleSignContract = () => {
    setShowBiometricModal(true);
  };

  const handleBiometricSuccess = () => {
    setShowBiometricModal(false);
    setSigningContract(true);

    setTimeout(() => {
      setSigningContract(false);
      FranchiseStorageService.updateApplicationStatus(
        currentApp.id,
        'contract_issued',
        currentApp.applicant.email,
        'applicant',
        'Franchise Disclosure Document & Agreement electronically countersigned with biometric authorization.',
        true
      );
      NotificationService.addNotification(
        'Franchise Agreement Signed',
        `Contract for ${currentApp.territoryRequested} signed with biometric authorization.`,
        'success',
        currentApp.id
      );
      playApprovalSuccessSound();
      try {
        confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      } catch {}
      onRefresh();
    }, 800);
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 space-y-8">
      {/* Top Application Switcher Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span className="font-semibold text-indigo-600 dark:text-indigo-400">Portal Tracking</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">{currentApp.id}</span>
            <span aria-hidden="true">·</span>
            <span>{currentApp.territoryRequested}</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {currentApp.applicant.fullName} · {plan.title}
          </h1>
        </div>

        {/* Switch Application selector */}
        {applications.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Switch Application:</span>
            <select
              value={currentApp.id}
              onChange={e => onSelectApplication(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none"
            >
              {applications.map(app => (
                <option key={app.id} value={app.id}>
                  {app.id} - {app.applicant.fullName} ({app.status})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Multi-Stage Visual Onboarding Pipeline */}
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Onboarding Lifecycle Status
          </h3>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 capitalize">
            Current Stage: {currentApp.status.replace(/_/g, ' ')}
          </span>
        </div>

        <div className="overflow-x-auto pb-2">
          <div className="flex items-center justify-between min-w-[650px] relative">
            {/* Background connecting bar */}
            <div className="absolute top-4 left-6 right-6 h-0.5 bg-slate-200 dark:bg-slate-800 -z-0" />
            <div
              className="absolute top-4 left-6 h-0.5 bg-emerald-500 transition-all duration-500 -z-0"
              style={{ width: `${Math.max(0, (currentStageIdx / (stages.length - 1)) * 100)}%` }}
            />

            {stages.map((st, idx) => {
              const isPast = idx < currentStageIdx;
              const isCurrent = idx === currentStageIdx;
              return (
                <div key={st.key} className="flex flex-col items-center text-center relative z-10 w-24">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      isPast
                        ? 'bg-emerald-500 text-white shadow-sm'
                        : isCurrent
                        ? 'bg-indigo-600 text-white ring-4 ring-indigo-100 dark:ring-indigo-950/60'
                        : 'bg-white dark:bg-slate-800 text-slate-400 border-2 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {isPast ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                  </div>
                  <span className={`text-[11px] font-semibold mt-2 whitespace-nowrap ${
                    isCurrent ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300'
                  }`}>
                    {st.label}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[90px]">
                    {st.desc}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6 text-sm font-medium">
        <button
          type="button"
          onClick={() => setActiveTab('timeline')}
          className={`pb-3 border-b-2 transition-colors ${
            activeTab === 'timeline'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Overview & Audit Notes
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('documents')}
          className={`pb-3 border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'documents'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <span>Encrypted Document Vault</span>
          <span className="text-[11px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            {currentApp.documents.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('contract')}
          className={`pb-3 border-b-2 transition-colors ${
            activeTab === 'contract'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Franchise Agreement & LOI
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('payments')}
          className={`pb-3 border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'payments'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <span>Payment Ledger & Deposit</span>
          <span className="text-[11px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            {currentApp.payments.length}
          </span>
        </button>
      </div>

      {/* TAB CONTENT: Overview */}
      {activeTab === 'timeline' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-6">
            {/* Automated Evaluation Summary Card */}
            <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Automated Rule Engine Scorecard
                </h3>
                <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {currentApp.automatedEvaluation.score}/100
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                  <span className="text-slate-400 block text-[11px]">Liquidity</span>
                  <span className="font-semibold text-emerald-600 capitalize">
                    {currentApp.automatedEvaluation.liquidityStatus}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                  <span className="text-slate-400 block text-[11px]">Net Worth</span>
                  <span className="font-semibold text-emerald-600 capitalize">
                    {currentApp.automatedEvaluation.netWorthStatus}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                  <span className="text-slate-400 block text-[11px]">Territory Conflict</span>
                  <span className="font-semibold text-emerald-600">None (Clear)</span>
                </div>
              </div>

              <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 pt-2 border-t border-slate-100 dark:border-slate-800">
                {currentApp.automatedEvaluation.reasons.map((r, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Director Review Notes */}
            <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Franchise Director & Legal Audit Feed
              </h3>

              {currentApp.reviewNotes.length === 0 ? (
                <p className="text-xs text-slate-400 py-3">No officer review notes recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {currentApp.reviewNotes.map(note => (
                    <div
                      key={note.id}
                      className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {note.authorName} ({note.authorRole.toUpperCase()})
                        </span>
                        <span className="text-slate-400">
                          {new Date(note.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{note.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions & Next Steps */}
          <div className="lg:col-span-5 space-y-6">
            <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Recommended Next Actions
              </h3>

              {/* Action 1: Sign Contract */}
              {currentApp.status === 'approved' && !currentApp.contractSignedAt && (
                <div className="p-4 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl border border-indigo-200 dark:border-indigo-800 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <PenTool className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200 block">
                        Sign Franchise Agreement
                      </span>
                      <span className="text-[11px] text-indigo-800 dark:text-indigo-300 leading-tight block">
                        Executive committee approved your application. Countersign with biometric passkey.
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('contract')}
                    className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    Review & Countersign Agreement
                  </button>
                </div>
              )}

              {/* Action 2: Fund Escrow Deposit */}
              {(currentApp.status === 'contract_issued' || currentApp.status === 'approved') &&
                !currentApp.payments.some(p => p.type === 'franchise_deposit') && (
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 space-y-3">
                    <div className="flex items-start gap-2.5">
                      <CreditCard className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                      <div>
                        <span className="text-xs font-bold text-emerald-950 dark:text-emerald-200 block">
                          Fund Initial Franchise License Joining Fee
                        </span>
                        <span className="text-[11px] text-emerald-800 dark:text-emerald-300 leading-tight block">
                          Joining fee: {currencySymbol}{depositAmount.toLocaleString()} {appCurrency} ({appCurrency === 'USD' ? 'USD +10% International Licensing' : 'UPI QR / Bank of Baroda IMPS'}).
                        </span>
                      </div>
                    </div>

                    <div className="p-2.5 bg-white/80 dark:bg-slate-900/80 rounded-lg border border-emerald-200/60 dark:border-emerald-800/60 text-[11px] space-y-1">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        Beneficiary: TRUEDEAL GLOBAL OPC PVT LTD
                      </div>
                      <div className="text-slate-600 dark:text-slate-400 font-mono text-[10px]">
                        BANK OF BARODA · A/C: 26290200001514 · IFSC: BARB0NOIDAX
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowPaymentModal(true)}
                        className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors font-medium"
                      >
                        Pay License Fee ({currencySymbol}{depositAmount.toLocaleString()} {appCurrency})
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowPaymentModal(true)}
                        className="py-2 px-3 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-lg transition-colors"
                      >
                        Bank QR
                      </button>
                    </div>
                  </div>
                )}

              {/* Application Details Summary */}
              <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex justify-between">
                  <span>Liquid Capital:</span>
                  <span className="font-mono text-slate-900 dark:text-slate-100">${currentApp.financials.liquidCapital.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Target Start:</span>
                  <span className="text-slate-900 dark:text-slate-100">{currentApp.preferredStartDate}</span>
                </div>
                <div className="flex justify-between">
                  <span>Biometric Verified:</span>
                  <span className={`font-semibold ${currentApp.biometricApprovalVerified ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {currentApp.biometricApprovalVerified ? 'Yes (Passkey Verified)' : 'Pending signature'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: Documents */}
      {activeTab === 'documents' && (
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Submitted Encrypted Document Vault
              </h3>
              <p className="text-xs text-slate-500">
                Protected by client-side AES-GCM-256 and SHA-256 cryptographic checksums.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {currentApp.documents.map(doc => (
              <div
                key={doc.id}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate max-w-[180px]">
                        {doc.name}
                      </h4>
                      <span className="text-[10px] text-slate-400 capitalize">{doc.type.replace('_', ' ')}</span>
                    </div>
                  </div>

                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded capitalize ${
                    doc.status === 'verified'
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                      : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                  }`}>
                    {doc.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="font-mono text-[10px] text-slate-500 dark:text-slate-400 truncate">
                  SHA-256: {doc.cipherChecksum}
                </div>

                <div className="flex gap-2 pt-1 border-t border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setSelectedDocForView(doc)}
                    className="flex-1 py-1.5 text-xs font-semibold bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded border border-slate-200 dark:border-slate-600 hover:bg-slate-50 text-center"
                  >
                    Decrypt & Inspect
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB CONTENT: Contract */}
      {activeTab === 'contract' && (
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Official TrueDeal Global Franchise Agreement & FDD
              </h3>
              <p className="text-xs text-slate-500">
                Legal franchise rights contract for {currentApp.territoryRequested}
              </p>
            </div>
            {currentApp.contractSignedAt && (
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Signed on {new Date(currentApp.contractSignedAt).toLocaleDateString()}
              </span>
            )}
          </div>

          {/* Legal Agreement Document Container */}
          <div className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4 text-xs text-slate-700 dark:text-slate-300 max-h-96 overflow-y-auto leading-relaxed">
            <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 text-center pb-2 border-b border-slate-200 dark:border-slate-700">
              TRUEDEAL GLOBAL FRANCHISE OPERATING AGREEMENT
            </h4>
            <p>
              This Master/Unit Franchise Agreement (the "Agreement") is executed between <strong>TrueDeal Global Holdings</strong> ("Franchisor") and <strong>{currentApp.applicant.fullName}</strong> representing <strong>{currentApp.applicant.companyName || 'Individual Entity'}</strong> ("Franchisee").
            </p>
            <p>
              <strong>1. GRANT OF FRANCHISE & TERRITORY:</strong> Franchisor grants Franchisee the exclusive rights to operate and develop TrueDeal Global retail and digital franchise operations within the designated territory of <strong>{currentApp.territoryRequested}</strong>.
            </p>
            <p>
              <strong>2. TERM & VALIDITY:</strong> The primary term of this license shall be <strong>{plan.validity}</strong>, granting operational franchise authority subject to standard compliance standards.
            </p>
            <p>
              <strong>3. COMMISSIONS & REFERRAL BONUSES:</strong> Franchisee shall receive continuing payouts of <strong>{plan.commissionRate}</strong> on gross fulfilled service revenues and a direct bonus of <strong>{plan.referralBonus}</strong>.
            </p>
            <p>
              <strong>4. DISCLOSURE RECEIPT & ESCROW:</strong> Both parties acknowledge receipt of the Franchise Disclosure Document (FDD) in compliance with international commercial regulations and franchise operating guidelines.
            </p>
          </div>

          {/* Signature Action */}
          {!currentApp.contractSignedAt ? (
            <div className="p-4 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl border border-indigo-200 dark:border-indigo-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200 block">
                  Biometric Countersignature Required
                </span>
                <span className="text-[11px] text-indigo-800 dark:text-indigo-300">
                  Authenticate via Touch ID / Face ID / Passkey to seal this agreement.
                </span>
              </div>
              <button
                type="button"
                onClick={handleSignContract}
                className="py-2.5 px-5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-all shadow-sm whitespace-nowrap flex items-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Countersign with Biometrics</span>
              </button>
            </div>
          ) : (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 flex items-center justify-between">
              <div>
                <span className="font-bold block">Agreement Electronically Sealed & Executed</span>
                <span className="text-[11px] text-emerald-700 dark:text-emerald-300">
                  Biometric Passkey Validation Timestamp: {new Date(currentApp.contractSignedAt).toLocaleString()}
                </span>
              </div>
              <span className="text-xs font-mono font-bold">LEGAL STATUS: ACTIVE</span>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: Payments */}
      {activeTab === 'payments' && (
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Payment History & Escrow Deposits
              </h3>
              <p className="text-xs text-slate-500">
                Verified financial transactions recorded to the tamper-evident audit ledger.
              </p>
            </div>
            {!currentApp.payments.some(p => p.type === 'franchise_deposit') && (
              <button
                type="button"
                onClick={() => setShowPaymentModal(true)}
                className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Pay Franchise License Deposit</span>
              </button>
            )}
          </div>

          <div className="space-y-3">
            {currentApp.payments.map(pay => (
              <div
                key={pay.id}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span className="capitalize">{pay.type.replace('_', ' ')}</span>
                    <span className="text-[10px] text-emerald-600 font-mono">CONFIRMED</span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Receipt: {pay.receiptNumber} · Ref: {pay.referenceCode} · {new Date(pay.timestamp).toLocaleDateString()}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-base font-bold font-mono text-slate-900 dark:text-slate-100 block">
                    ${pay.amount.toLocaleString()} USD
                  </span>
                  <span className="text-[11px] text-slate-400 capitalize">{pay.method.replace('_', ' ')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Biometric Prompt Modal */}
      {showBiometricModal && (
        <BiometricPromptModal
          isOpen={showBiometricModal}
          onClose={() => setShowBiometricModal(false)}
          onSuccess={handleBiometricSuccess}
          title="Sign TrueDeal Franchise Agreement"
          description="Use your device Touch ID, Face ID, or Passkey to electronically execute and seal the franchise operating agreement."
        />
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          application={currentApp}
          paymentType="franchise_deposit"
          amount={depositAmount}
          currency={appCurrency}
          onPaymentSuccess={() => {
            setShowPaymentModal(false);
            onRefresh();
          }}
        />
      )}

      {/* Document Viewer Modal */}
      {selectedDocForView && (
        <DocumentViewerModal
          isOpen={!!selectedDocForView}
          onClose={() => setSelectedDocForView(null)}
          document={selectedDocForView}
          applicantName={currentApp.applicant.fullName}
          userRole="applicant"
        />
      )}
    </div>
  );
}
