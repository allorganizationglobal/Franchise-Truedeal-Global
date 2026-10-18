import { useState } from 'react';
import {
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  CreditCard,
  ShieldCheck,
  ChevronRight,
  UserCheck,
  Building2,
  Send,
  Eye,
  Columns3,
  Table as TableIcon,
  Zap,
  Lock,
  ArrowUpDown
} from 'lucide-react';
import { FranchiseApplication, UserRole, DocumentUpload } from '../../types/franchise';
import { FRANCHISE_PLANS, FranchiseStorageService, getPlanById } from '../../services/storage';
import { NotificationService } from '../../services/notificationService';
import { BiometricPromptModal } from '../common/BiometricPromptModal';
import { DocumentViewerModal } from '../common/DocumentViewerModal';
import { playApprovalSuccessSound } from '../../utils/audio';
import confetti from 'canvas-confetti';

import { User as FirebaseUser } from 'firebase/auth';
import { isUserAdmin } from '../../services/firebase';

interface AdminDashboardProps {
  userRole: UserRole;
  currentUser?: FirebaseUser | null;
  onSignInGoogle?: () => void;
  onRefresh: () => void;
  onSelectApplication: (id: string) => void;
}

export function AdminDashboard({
  userRole,
  currentUser,
  onSignInGoogle,
  onRefresh,
  onSelectApplication
}: AdminDashboardProps) {
  const [applications, setApplications] = useState<FranchiseApplication[]>(
    FranchiseStorageService.getApplications()
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('kanban');

  // Inspection Drawer
  const [selectedApp, setSelectedApp] = useState<FranchiseApplication | null>(null);
  const [newOfficerNote, setNewOfficerNote] = useState('');

  // Biometric challenge for director approval
  const [pendingApproveId, setPendingApproveId] = useState<string | null>(null);
  const [showBiometricModal, setShowBiometricModal] = useState(false);

  // Document viewer modal
  const [inspectingDoc, setInspectingDoc] = useState<{
    doc: DocumentUpload;
    applicantName: string;
  } | null>(null);

  const refreshData = () => {
    const fresh = FranchiseStorageService.getApplications();
    setApplications(fresh);
    if (selectedApp) {
      setSelectedApp(fresh.find(a => a.id === selectedApp.id) || null);
    }
    onRefresh();
  };

  // Filter applications
  const filteredApps = applications.filter(app => {
    const matchesSearch =
      app.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.applicant.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (app.applicant.companyName && app.applicant.companyName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      app.territoryRequested.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || app.status === statusFilter;
    const matchesTier = tierFilter === 'all' || app.planId.includes(tierFilter);

    return matchesSearch && matchesStatus && matchesTier;
  });

  // Approval with Biometric Authorization
  const triggerBiometricApproval = (appId: string) => {
    setPendingApproveId(appId);
    setShowBiometricModal(true);
  };

  const handleBiometricApprovalSuccess = () => {
    if (!pendingApproveId) return;

    setShowBiometricModal(false);
    const updated = FranchiseStorageService.updateApplicationStatus(
      pendingApproveId,
      'approved',
      'director@truedealglobal.com',
      userRole,
      'Executive director approval granted with cryptographic biometric verification.',
      true
    );

    if (updated) {
      NotificationService.sendAutomatedEmail(updated, 'official_approval');
      NotificationService.addNotification(
        'Executive Approval Issued',
        `Application ${updated.id} for ${updated.applicant.fullName} approved with biometric signature.`,
        'success',
        updated.id
      );

      try {
        confetti({ particleCount: 75, spread: 60, origin: { y: 0.6 } });
      } catch {}

      playApprovalSuccessSound();
      refreshData();
    }
    setPendingApproveId(null);
  };

  // Add review note
  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp || !newOfficerNote.trim()) return;

    FranchiseStorageService.updateApplicationStatus(
      selectedApp.id,
      selectedApp.status,
      userRole + '@truedealglobal.com',
      userRole,
      newOfficerNote.trim()
    );

    setNewOfficerNote('');
    refreshData();
  };

  // Kanban column definitions
  const kanbanColumns = [
    { id: 'submitted', title: 'Under Automated Review', statuses: ['submitted', 'draft'] },
    { id: 'automated_verified', title: 'Automated Scoring Passed', statuses: ['automated_verified'] },
    { id: 'compliance_review', title: 'Compliance & Legal Audit', statuses: ['compliance_review'] },
    { id: 'approved', title: 'Director Approved & LOI', statuses: ['approved'] },
    { id: 'active', title: 'Agreement Executed & Onboarded', statuses: ['contract_issued', 'deposit_paid', 'onboarded'] },
  ];

  // Executive Authentication & Authorization Gate
  const isAdminAuthorized = currentUser && isUserAdmin(currentUser.email);

  if (!isAdminAuthorized) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center mx-auto text-indigo-600 dark:text-indigo-400 shadow-md">
          <Lock className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Administrative Access Restricted
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            The Franchise Application Pipeline and Oversight Console require authenticated director credentials.
          </p>
        </div>

        {currentUser ? (
          <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl text-xs text-amber-800 dark:text-amber-300 max-w-md mx-auto space-y-1">
            <p className="font-semibold">Signed in as: {currentUser.email}</p>
            <p>This account does not possess Director or Executive authorization. Please sign in with an authorized TrueDeal administrator email.</p>
          </div>
        ) : (
          <div className="pt-2">
            <button
              type="button"
              onClick={onSignInGoogle}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              <span>Sign In with Corporate Account</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Top Console Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span>Administrative Command</span>
            <span aria-hidden="true">·</span>
            <span>Role: {userRole.replace('_', ' ').toUpperCase()}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Franchise Application Pipeline & Oversight
          </h1>
        </div>

        {/* View Mode & Count */}
        <div className="flex items-center gap-2">
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'kanban'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
              title="Kanban Board View"
            >
              <Columns3 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
              title="Table View"
            >
              <TableIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
        {/* Search Input */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search applicant, territory, ID..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="all">All Pipeline Stages</option>
            <option value="submitted">Submitted</option>
            <option value="automated_verified">Automated Verified</option>
            <option value="compliance_review">Compliance Review</option>
            <option value="approved">Approved</option>
            <option value="contract_issued">Contract Issued</option>
            <option value="deposit_paid">Deposit Paid</option>
          </select>

          <select
            value={tierFilter}
            onChange={e => setTierFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="all">All 8 Franchise Plans</option>
            <option value="basic">Basic Plan (₹2.5k)</option>
            <option value="standard">Standard Plan (₹4.9k)</option>
            <option value="corporate">Corporate Plan (₹14.9k)</option>
            <option value="platinum">Platinum Plan (₹49.9k)</option>
            <option value="entrepreneur">Entrepreneur Plan (₹99.9k)</option>
            <option value="retirement">Retirement Plan (₹149.9k)</option>
            <option value="enterprise">Enterprise Plan (₹499.9k)</option>
            <option value="global">Global Plan (₹999.9k)</option>
          </select>
        </div>
      </div>

      {/* KANBAN BOARD VIEW */}
      {viewMode === 'kanban' && (
        <div className="overflow-x-auto pb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 min-w-full lg:min-w-[1050px]">
          {kanbanColumns.map(col => {
            const colApps = filteredApps.filter(a => col.statuses.includes(a.status));
            return (
              <div
                key={col.id}
                className="flex flex-col bg-slate-100/70 dark:bg-slate-900/60 rounded-2xl p-3 border border-slate-200 dark:border-slate-800 min-h-[500px]"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200 dark:border-slate-800">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                    {col.title}
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-500 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                    {colApps.length}
                  </span>
                </div>

                {/* Cards List */}
                <div className="space-y-3 flex-1 overflow-y-auto">
                  {colApps.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-xs">
                      No applications
                    </div>
                  ) : (
                    colApps.map(app => (
                      <div
                        key={app.id}
                        className="p-3.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:border-indigo-400 dark:hover:border-indigo-500 transition-all space-y-2.5"
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-mono text-slate-400">{app.id}</span>
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {app.automatedEvaluation.score}/100
                          </span>
                        </div>

                        <div>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight">
                            {app.applicant.fullName}
                          </h4>
                          <span className="text-[11px] text-slate-500 truncate block">
                            {app.applicant.companyName || 'Individual Entity'}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-600 dark:text-slate-400">
                          <span className="block truncate">{app.territoryRequested}</span>
                          <span className="font-mono text-[10px] text-slate-400 block pt-1">
                            Liquid: ${app.financials.liquidCapital.toLocaleString()} USD
                          </span>
                        </div>

                        {/* Card Footer Actions */}
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between gap-1">
                          <button
                            type="button"
                            onClick={() => setSelectedApp(app)}
                            className="px-2 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/60 hover:bg-slate-100 rounded transition-colors"
                          >
                            Inspect
                          </button>

                          {(app.status === 'submitted' || app.status === 'automated_verified' || app.status === 'compliance_review') &&
                            (userRole === 'director' || userRole === 'super_admin') && (
                              <button
                                type="button"
                                onClick={() => triggerBiometricApproval(app.id)}
                                className="px-2 py-1 text-[11px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded transition-colors flex items-center gap-1"
                              >
                                <ShieldCheck className="w-3 h-3" />
                                <span>Approve</span>
                              </button>
                            )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
          </div>
        </div>
      )}

      {/* DATA TABLE VIEW */}
      {viewMode === 'table' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 font-semibold text-slate-700 dark:text-slate-300">
                  <th className="p-3.5">Ref ID</th>
                  <th className="p-3.5">Applicant & Entity</th>
                  <th className="p-3.5">Plan Tier</th>
                  <th className="p-3.5">Territory</th>
                  <th className="p-3.5">Liquid Assets</th>
                  <th className="p-3.5">Auto Score</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-600 dark:text-slate-300">
                {filteredApps.map(app => (
                  <tr key={app.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="p-3.5 font-mono text-slate-500">{app.id}</td>
                    <td className="p-3.5">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{app.applicant.fullName}</div>
                      <div className="text-[11px] text-slate-400">{app.applicant.companyName || 'Individual'}</div>
                    </td>
                    <td className="p-3.5 text-[11px] font-semibold text-slate-900 dark:text-slate-100">
                      {getPlanById(app.planId)?.title || app.planId.replace('plan_', '').replace(/_/g, ' ').toUpperCase()}
                    </td>
                    <td className="p-3.5 truncate max-w-[160px]">{app.territoryRequested}</td>
                    <td className="p-3.5 font-mono tabular-nums">${app.financials.liquidCapital.toLocaleString()}</td>
                    <td className="p-3.5 font-mono font-bold text-emerald-600">{app.automatedEvaluation.score}/100</td>
                    <td className="p-3.5">
                      <span className="capitalize px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                        {app.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="p-3.5 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setSelectedApp(app)}
                        className="py-1 px-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 rounded font-medium text-[11px]"
                      >
                        Inspect
                      </button>
                      {(app.status === 'submitted' || app.status === 'automated_verified' || app.status === 'compliance_review') &&
                        (userRole === 'director' || userRole === 'super_admin') && (
                          <button
                            type="button"
                            onClick={() => triggerBiometricApproval(app.id)}
                            className="py-1 px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium text-[11px]"
                          >
                            Approve
                          </button>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* INSPECTION DRAWER / MODAL */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-xl h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl p-6 overflow-y-auto space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-xs font-mono text-slate-400">Application File {selectedApp.id}</span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {selectedApp.applicant.fullName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedApp(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm"
              >
                Close
              </button>
            </div>

            {/* Status & Automated Score Bar */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 block">Automated Rule Score</span>
                <span className="text-xl font-bold font-mono text-emerald-600">
                  {selectedApp.automatedEvaluation.score}/100 ({selectedApp.automatedEvaluation.preliminaryVerdict.replace(/_/g, ' ')})
                </span>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 capitalize">
                {selectedApp.status.replace(/_/g, ' ')}
              </span>
            </div>

            {/* Applicant Financial Metrics */}
            <div className="space-y-2 text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300 block">Financial & Entity Profile</span>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl space-y-2 border border-slate-200 dark:border-slate-800">
                <div className="flex justify-between">
                  <span className="text-slate-400">Company / Entity:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{selectedApp.applicant.companyName || 'Individual'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Territory Requested:</span>
                  <span className="text-slate-900 dark:text-slate-100">{selectedApp.territoryRequested}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Liquid Capital:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100">${selectedApp.financials.liquidCapital.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Net Worth:</span>
                  <span className="font-mono text-slate-900 dark:text-slate-100">${selectedApp.financials.netWorth.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Credit Score Tier:</span>
                  <span className="text-slate-900 dark:text-slate-100">{selectedApp.financials.creditScoreTier}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Experience:</span>
                  <span className="text-slate-900 dark:text-slate-100">{selectedApp.operationalExperienceYears} Years</span>
                </div>
              </div>
            </div>

            {/* Encrypted Documents List */}
            <div className="space-y-2 text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300 block">
                Submitted Encrypted Documents ({selectedApp.documents.length})
              </span>
              {selectedApp.documents.length === 0 ? (
                <p className="text-slate-400 text-xs py-2">No documents attached.</p>
              ) : (
                <div className="space-y-2">
                  {selectedApp.documents.map(doc => (
                    <div
                      key={doc.id}
                      className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <Lock className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[180px]">
                          {doc.name}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setInspectingDoc({ doc, applicantName: selectedApp.applicant.fullName })}
                        className="text-xs text-indigo-600 hover:underline"
                      >
                        Inspect Decrypted
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Payments & Financial Verification Ledger */}
            <div className="space-y-2 text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300 block">
                Payment Transactions &amp; Receipts ({selectedApp.payments.length})
              </span>
              {selectedApp.payments.length === 0 ? (
                <p className="text-slate-400 text-xs py-2">No payment transactions recorded.</p>
              ) : (
                <div className="space-y-2">
                  {selectedApp.payments.map(p => (
                    <div
                      key={p.id}
                      className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-slate-100">
                          <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
                          <span>{p.currency === 'INR' ? '₹' : '$'}{p.amount.toLocaleString()} {p.currency}</span>
                          <span className="text-[10px] text-slate-400 uppercase font-mono">({p.type.replace('_', ' ')})</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${
                          p.status === 'completed'
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                            : p.status === 'processing'
                            ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                            : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'
                        }`}>
                          {p.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        Ref: {p.referenceCode} · {new Date(p.timestamp).toLocaleDateString()}
                      </div>
                      {p.status === 'processing' && (
                        <div className="pt-1 flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              FranchiseStorageService.updatePaymentStatus(
                                selectedApp.id,
                                p.id,
                                'completed',
                                currentUser?.email || 'director@truedealglobal.com'
                              );
                              NotificationService.addNotification(
                                'Payment Verified',
                                `Payment ${p.referenceCode} confirmed & cleared.`,
                                'success',
                                selectedApp.id
                              );
                              playApprovalSuccessSound();
                              refreshData();
                            }}
                            className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-xs cursor-pointer flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Verify &amp; Clear Bank Funds</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Direct Applicant Communications */}
            <div className="space-y-2 text-xs pt-1">
              <span className="font-semibold text-slate-700 dark:text-slate-300 block">
                Direct Applicant Communication
              </span>
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={`https://wa.me/${selectedApp.applicant.phone.replace(/[^0-9]/g, '')}?text=Hello%20${encodeURIComponent(selectedApp.applicant.fullName)},%20this%20is%20TrueDeal%20Global%20Franchise%20Executive%20Operations%20regarding%20Application%20%23${selectedApp.id}.`}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800 font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-center"
                >
                  <span>WhatsApp Applicant</span>
                </a>
                <a
                  href={`mailto:${selectedApp.applicant.email}?subject=TRUEDEAL%20GLOBAL%20Franchise%20Application%20Status%20Update%20%23${selectedApp.id}&body=Dear%20${encodeURIComponent(selectedApp.applicant.fullName)},%0D%0A%0D%0ARegarding%20your%20franchise%20application%20${selectedApp.id}...`}
                  className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 hover:bg-indigo-100 border border-indigo-200 dark:border-indigo-800 font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-center"
                >
                  <span>Send Direct Email</span>
                </a>
              </div>
            </div>

            {/* Officer Notes & Review Trail */}
            <div className="space-y-2 text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300 block">Director Audit Trail</span>
              <div className="max-h-40 overflow-y-auto space-y-2">
                {selectedApp.reviewNotes.map(n => (
                  <div key={n.id} className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-lg text-xs space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>{n.authorName} ({n.authorRole})</span>
                      <span>{new Date(n.timestamp).toLocaleDateString()}</span>
                    </div>
                    <p className="text-slate-700 dark:text-slate-300">{n.text}</p>
                  </div>
                ))}
              </div>

              {/* Add Note Form */}
              <form onSubmit={handleAddNote} className="flex gap-2 pt-2">
                <input
                  type="text"
                  placeholder="Add administrative review note..."
                  value={newOfficerNote}
                  onChange={e => setNewOfficerNote(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!newOfficerNote.trim()}
                  className="py-1.5 px-3 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50"
                >
                  Post Note
                </button>
              </form>
            </div>

            {/* Director Actions */}
            {(userRole === 'director' || userRole === 'super_admin') && (
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    FranchiseStorageService.updateApplicationStatus(
                      selectedApp.id,
                      'revision_requested',
                      'director@truedealglobal.com',
                      userRole,
                      'Requested revision of proof of funds and business model.'
                    );
                    refreshData();
                  }}
                  className="flex-1 py-2 px-3 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 hover:bg-amber-100 rounded-xl text-xs font-semibold"
                >
                  Request Revision
                </button>
                <button
                  type="button"
                  onClick={() => triggerBiometricApproval(selectedApp.id)}
                  className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Biometric Approval</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Biometric Prompt Modal */}
      {showBiometricModal && (
        <BiometricPromptModal
          isOpen={showBiometricModal}
          onClose={() => setShowBiometricModal(false)}
          onSuccess={handleBiometricApprovalSuccess}
          title="Executive Franchise Board Approval"
          description="Biometric authorization required to grant exclusive territorial franchise license."
        />
      )}

      {/* Document Viewer Modal */}
      {inspectingDoc && (
        <DocumentViewerModal
          isOpen={!!inspectingDoc}
          onClose={() => setInspectingDoc(null)}
          document={inspectingDoc.doc}
          applicantName={inspectingDoc.applicantName}
          userRole={userRole}
          onUpdateStatus={() => refreshData()}
        />
      )}
    </div>
  );
}
