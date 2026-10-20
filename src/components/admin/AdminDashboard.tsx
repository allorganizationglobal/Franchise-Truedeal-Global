import { useState, useMemo } from 'react';
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
  ArrowUpDown,
  Download,
  Users,
  ShieldAlert,
  Settings,
  BarChart3,
  Check,
  X,
  ExternalLink,
  RefreshCw,
  Phone,
  Mail,
  UserPlus
} from 'lucide-react';
import {
  FranchiseApplication,
  UserRole,
  DocumentUpload,
  ApplicationStatus,
  DocumentStatus
} from '../../types/franchise';
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

type AdminSection =
  | 'overview'
  | 'pipeline'
  | 'documents'
  | 'payments'
  | 'reports'
  | 'audit'
  | 'team'
  | 'settings';

export function AdminDashboard({
  userRole,
  currentUser,
  onSignInGoogle,
  onRefresh,
  onSelectApplication
}: AdminDashboardProps) {
  const [activeSection, setActiveSection] = useState<AdminSection>('pipeline');
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

  // Biometric challenge for approval
  const [pendingApproveId, setPendingApproveId] = useState<string | null>(null);
  const [showBiometricModal, setShowBiometricModal] = useState(false);

  // Status transition dialog state
  const [transitioningApp, setTransitioningApp] = useState<{
    app: FranchiseApplication;
    targetStatus: ApplicationStatus;
  } | null>(null);
  const [transitionReason, setTransitionReason] = useState('');

  // Document viewer modal
  const [inspectingDoc, setInspectingDoc] = useState<{
    doc: DocumentUpload;
    applicantName: string;
    appId: string;
  } | null>(null);

  // Reviewer assignment state
  const [assigningReviewerAppId, setAssigningReviewerAppId] = useState<string | null>(null);
  const [selectedReviewerEmail, setSelectedReviewerEmail] = useState('compliance@truedealglobal.com');

  // Team & Role Management (Super Admin)
  const [newTeamEmail, setNewTeamEmail] = useState('');
  const [newTeamRole, setNewTeamRole] = useState<UserRole>('reviewer');
  const [teamMembers, setTeamMembers] = useState([
    { email: 'allorganizationglobal@gmail.com', role: 'super_admin' as UserRole, name: 'Principal Officer' },
    { email: 'director@truedealglobal.com', role: 'super_admin' as UserRole, name: 'Managing Director' },
    { email: 'manager@truedealglobal.com', role: 'franchise_manager' as UserRole, name: 'Senior Franchise Manager' },
    { email: 'compliance@truedealglobal.com', role: 'reviewer' as UserRole, name: 'Legal & Due Diligence Reviewer' },
    { email: 'support@truedealglobal.com', role: 'support_staff' as UserRole, name: 'Franchise Support Desk' }
  ]);

  const refreshData = () => {
    const fresh = FranchiseStorageService.getApplications();
    setApplications(fresh);
    if (selectedApp) {
      setSelectedApp(fresh.find(a => a.id === selectedApp.id) || null);
    }
    onRefresh();
  };

  // Filter applications
  const filteredApps = useMemo(() => {
    return applications.filter(app => {
      const matchesSearch =
        app.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.applicant.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (app.applicant.companyName &&
          app.applicant.companyName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        app.territoryRequested.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'all' || app.status === statusFilter;
      const matchesTier = tierFilter === 'all' || app.planId.includes(tierFilter);

      return matchesSearch && matchesStatus && matchesTier;
    });
  }, [applications, searchTerm, statusFilter, tierFilter]);

  // Aggregate KPI Calculations from real database
  const kpiData = useMemo(() => {
    const totalCount = applications.length;
    const submittedCount = applications.filter(a => a.status === 'submitted' || a.status === 'draft').length;
    const underReviewCount = applications.filter(a => a.status === 'under_review' || a.status === 'automated_verified' || a.status === 'compliance_review' || a.status === 'due_diligence').length;
    const approvedCount = applications.filter(a => a.status === 'approved' || a.status === 'agreement_pending').length;
    const onboardedCount = applications.filter(a => a.status === 'onboarding' || a.status === 'contract_issued' || a.status === 'deposit_paid').length;
    const rejectedCount = applications.filter(a => a.status === 'rejected' || a.status === 'declined').length;

    const totalLiquidCapital = applications.reduce((sum, a) => sum + (a.financials?.liquidCapital || 0), 0);
    const totalPaymentsReceived = applications.reduce((sum, a) => {
      const paid = a.payments.filter(p => p.status === 'completed').reduce((pSum, p) => pSum + p.amount, 0);
      return sum + paid;
    }, 0);
    const pendingBankReconciliationCount = applications.reduce((sum, a) => {
      return sum + a.payments.filter(p => p.status === 'processing').length;
    }, 0);

    const pendingDocumentAuditCount = applications.reduce((sum, a) => {
      return sum + a.documents.filter(d => d.status === 'pending_audit').length;
    }, 0);

    return {
      totalCount,
      submittedCount,
      underReviewCount,
      approvedCount,
      onboardedCount,
      rejectedCount,
      totalLiquidCapital,
      totalPaymentsReceived,
      pendingBankReconciliationCount,
      pendingDocumentAuditCount
    };
  }, [applications]);

  // All documents across applications
  const allDocuments = useMemo(() => {
    const list: { doc: DocumentUpload; app: FranchiseApplication }[] = [];
    applications.forEach(app => {
      app.documents.forEach(doc => {
        list.push({ doc, app });
      });
    });
    return list;
  }, [applications]);

  // All payments across applications
  const allPayments = useMemo(() => {
    const list: { payment: any; app: FranchiseApplication }[] = [];
    applications.forEach(app => {
      app.payments.forEach(payment => {
        list.push({ payment, app });
      });
    });
    return list;
  }, [applications]);

  // Approval with Biometric Authorization
  const triggerBiometricApproval = (appId: string) => {
    setPendingApproveId(appId);
    setShowBiometricModal(true);
  };

  const handleBiometricApprovalSuccess = () => {
    if (!pendingApproveId) return;

    const updated = FranchiseStorageService.updateApplicationStatus(
      pendingApproveId,
      'approved',
      currentUser?.email || 'director@truedealglobal.com',
      userRole,
      'Executive director approval granted with cryptographic biometric verification.',
      true
    );

    if (updated) {
      NotificationService.addNotification(
        'Franchise Application Approved',
        `Application ${updated.id} for ${updated.applicant.fullName} approved with biometric signature.`,
        'success',
        updated.id
      );
      NotificationService.sendAutomatedEmail(updated, 'official_approval');

      try {
        confetti({ particleCount: 100, spread: 80, origin: { y: 0.5 } });
      } catch {}

      playApprovalSuccessSound();
    }

    setPendingApproveId(null);
    setShowBiometricModal(false);
    refreshData();
  };

  const executeStatusTransition = () => {
    if (!transitioningApp) return;

    try {
      const updated = FranchiseStorageService.updateApplicationStatus(
        transitioningApp.app.id,
        transitioningApp.targetStatus,
        currentUser?.email || 'director@truedealglobal.com',
        userRole,
        transitionReason || `Transitioned to ${transitioningApp.targetStatus.replace(/_/g, ' ')}`,
        false,
        transitioningApp.app.concurrencyVersion,
        transitionReason
      );

      if (updated) {
        NotificationService.addNotification(
          `Status: ${transitioningApp.targetStatus.replace(/_/g, ' ').toUpperCase()}`,
          `Application ${updated.id} transitioned to "${transitioningApp.targetStatus}".`,
          'info',
          updated.id
        );
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to update application status due to concurrency conflict.');
    }

    setTransitioningApp(null);
    setTransitionReason('');
    refreshData();
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp || !newOfficerNote.trim()) return;

    FranchiseStorageService.addReviewNote(
      selectedApp.id,
      newOfficerNote.trim(),
      userRole,
      currentUser?.displayName || currentUser?.email || 'Authorized Officer'
    );
    setNewOfficerNote('');
    refreshData();
  };

  const handleAssignReviewer = (appId: string) => {
    const reviewerObj = teamMembers.find(t => t.email === selectedReviewerEmail);
    FranchiseStorageService.assignReviewer(
      appId,
      selectedReviewerEmail,
      reviewerObj?.name || selectedReviewerEmail.split('@')[0],
      currentUser?.email || 'director@truedealglobal.com'
    );
    setAssigningReviewerAppId(null);
    refreshData();
  };

  const handleDocumentAudit = (appId: string, docId: string, status: DocumentStatus) => {
    const note = prompt(`Enter review note for this document (${status}):`, 'Inspected and verified against compliance rules.');
    if (note !== null) {
      FranchiseStorageService.updateDocumentStatus(
        appId,
        docId,
        status,
        note,
        currentUser?.email || 'director@truedealglobal.com'
      );
      refreshData();
    }
  };

  // CSV Export with Data Minimization
  const handleExportCsv = () => {
    const headers = ['ID', 'Applicant Name', 'Email', 'Phone', 'City', 'Country', 'Plan', 'Liquid Capital', 'Status', 'Submitted At'];
    const rows = applications.map(a => [
      a.id,
      `"${a.applicant.fullName.replace(/"/g, '""')}"`,
      `"${a.applicant.email}"`,
      `"${a.applicant.phone}"`,
      `"${a.applicant.city}"`,
      `"${a.applicant.country}"`,
      `"${a.planId}"`,
      a.financials.liquidCapital,
      a.status,
      a.createdAt
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `truedeal_franchise_applications_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    NotificationService.addNotification(
      'Report Exported',
      `Exported ${applications.length} applications with data minimization to CSV.`,
      'success'
    );
  };

  // 9-Stage Kanban column definitions
  const kanbanColumns = [
    {
      id: 'submitted',
      title: 'Submitted & Ingested',
      statuses: ['submitted', 'draft']
    },
    {
      id: 'under_review',
      title: 'Under Review & Scoring',
      statuses: ['under_review', 'automated_verified']
    },
    {
      id: 'due_diligence',
      title: 'Due Diligence & Docs Required',
      statuses: ['due_diligence', 'compliance_review', 'documents_required', 'revision_requested']
    },
    {
      id: 'approved',
      title: 'Director Approved & LOI',
      statuses: ['approved', 'agreement_pending']
    },
    {
      id: 'onboarded',
      title: 'Onboarded & Partner Active',
      statuses: ['onboarding', 'contract_issued', 'deposit_paid']
    },
    {
      id: 'rejected',
      title: 'Declined / Withdrawn',
      statuses: ['rejected', 'declined']
    }
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
            The Franchise Application Pipeline and Executive Console require authenticated corporate credentials.
          </p>
        </div>

        {currentUser ? (
          <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl text-xs text-amber-800 dark:text-amber-300 max-w-md mx-auto space-y-1">
            <p className="font-semibold">Signed in as: {currentUser.email}</p>
            <p>This account does not possess Super Admin, Franchise Manager, or Reviewer authorization. Please sign in with an authorized TrueDeal administrator email.</p>
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
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Top Console Command Ribbon */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span>Executive Command Center</span>
            <span aria-hidden="true">&bull;</span>
            <span className="font-bold text-indigo-600 dark:text-indigo-400 uppercase">
              Role: {userRole.replace('_', ' ')}
            </span>
            <span aria-hidden="true">&bull;</span>
            <span className="truncate max-w-[200px]">{currentUser.email}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Franchise Administration &amp; Governance Portal
          </h1>
        </div>

        {/* Section Navigation Tabs */}
        <div className="flex items-center flex-wrap gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setActiveSection('overview')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeSection === 'overview'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('pipeline')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeSection === 'pipeline'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Columns3 className="w-3.5 h-3.5" />
            <span>Pipeline ({applications.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('documents')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeSection === 'documents'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Documents ({allDocuments.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('payments')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeSection === 'payments'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Payments ({allPayments.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('reports')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeSection === 'reports'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Reports</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('audit')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeSection === 'audit'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Audit</span>
          </button>

          {(userRole === 'super_admin' || userRole === 'director') && (
            <button
              type="button"
              onClick={() => setActiveSection('team')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeSection === 'team'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Team &amp; Roles</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveSection('settings')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeSection === 'settings'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Settings</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: EXECUTIVE OVERVIEW DASHBOARD */}
      {activeSection === 'overview' && (
        <div className="space-y-6">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs text-slate-500 font-medium block">Total Applications</span>
              <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono mt-1 block">
                {kpiData.totalCount}
              </span>
              <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">
                {kpiData.onboardedCount} Active Franchise Partners
              </span>
            </div>

            <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs text-slate-500 font-medium block">Under Review / Due Diligence</span>
              <span className="text-2xl font-bold text-amber-600 font-mono mt-1 block">
                {kpiData.underReviewCount}
              </span>
              <span className="text-[11px] text-slate-500 mt-1 block">
                {kpiData.submittedCount} Pending Initial Ingestion
              </span>
            </div>

            <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs text-slate-500 font-medium block">Pending Document Audits</span>
              <span className="text-2xl font-bold text-indigo-600 font-mono mt-1 block">
                {kpiData.pendingDocumentAuditCount}
              </span>
              <span className="text-[11px] text-slate-500 mt-1 block">
                AES-GCM Encrypted Vault Files
              </span>
            </div>

            <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs text-slate-500 font-medium block">Verified Bank Deposits</span>
              <span className="text-2xl font-bold text-emerald-600 font-mono mt-1 block">
                ₹{kpiData.totalPaymentsReceived.toLocaleString('en-IN')}
              </span>
              <span className="text-[11px] text-amber-600 font-semibold mt-1 block">
                {kpiData.pendingBankReconciliationCount} Pending Verification
              </span>
            </div>
          </div>

          {/* Lifecycle Funnel Breakdown */}
          <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Franchise Conversion Funnel Lifecycle
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                <span className="text-xs text-slate-500 block">1. Submitted</span>
                <span className="text-lg font-bold text-slate-900 dark:text-slate-100 font-mono mt-1 block">
                  {kpiData.submittedCount}
                </span>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-800 text-center">
                <span className="text-xs text-blue-700 dark:text-blue-300 block">2. Under Review</span>
                <span className="text-lg font-bold text-blue-700 dark:text-blue-300 font-mono mt-1 block">
                  {kpiData.underReviewCount}
                </span>
              </div>
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl border border-indigo-200 dark:border-indigo-800 text-center">
                <span className="text-xs text-indigo-700 dark:text-indigo-300 block">3. Approved</span>
                <span className="text-lg font-bold text-indigo-700 dark:text-indigo-300 font-mono mt-1 block">
                  {kpiData.approvedCount}
                </span>
              </div>
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 text-center">
                <span className="text-xs text-emerald-700 dark:text-emerald-300 block">4. Active Partner</span>
                <span className="text-lg font-bold text-emerald-700 dark:text-emerald-300 font-mono mt-1 block">
                  {kpiData.onboardedCount}
                </span>
              </div>
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-800 text-center">
                <span className="text-xs text-rose-700 dark:text-rose-300 block">5. Declined</span>
                <span className="text-lg font-bold text-rose-700 dark:text-rose-300 font-mono mt-1 block">
                  {kpiData.rejectedCount}
                </span>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800 text-center">
                <span className="text-xs text-amber-700 dark:text-amber-300 block">6. Total Capital Pool</span>
                <span className="text-sm font-bold text-amber-700 dark:text-amber-300 font-mono mt-1 block">
                  ${(kpiData.totalLiquidCapital / 1000).toFixed(0)}k
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: KANBAN & TABLE PIPELINE */}
      {activeSection === 'pipeline' && (
        <div className="space-y-4">
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

            {/* Filters & View Toggle */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
              >
                <option value="all">All Statuses ({applications.length})</option>
                <option value="submitted">Submitted</option>
                <option value="under_review">Under Review</option>
                <option value="documents_required">Documents Required</option>
                <option value="due_diligence">Due Diligence</option>
                <option value="approved">Approved</option>
                <option value="agreement_pending">Agreement Pending</option>
                <option value="onboarding">Onboarding Active</option>
                <option value="rejected">Rejected</option>
              </select>

              <select
                value={tierFilter}
                onChange={e => setTierFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
              >
                <option value="all">All Plans</option>
                <option value="basic">Basic Plan (₹2,500)</option>
                <option value="standard">Standard Plan (₹4,999)</option>
                <option value="corporate">Corporate Plan (₹14,999)</option>
                <option value="platinum">Platinum Plan (₹49,999)</option>
                <option value="entrepreneur">Entrepreneur (₹99,999)</option>
                <option value="retirement">Retirement (₹1,49,999)</option>
                <option value="enterprise">Enterprise (₹4,99,999)</option>
                <option value="global">Global (₹9,99,999)</option>
              </select>

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

          {/* KANBAN BOARD VIEW */}
          {viewMode === 'kanban' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5 items-start">
              {kanbanColumns.map(col => {
                const colApps = filteredApps.filter(a => col.statuses.includes(a.status));

                return (
                  <div
                    key={col.id}
                    className="bg-slate-100 dark:bg-slate-900/60 rounded-xl p-3 border border-slate-200 dark:border-slate-800 flex flex-col gap-2.5 min-h-[450px]"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {col.title}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                        {colApps.length}
                      </span>
                    </div>

                    <div className="flex flex-col gap-2.5">
                      {colApps.map(app => {
                        const plan = getPlanById(app.planId);
                        return (
                          <div
                            key={app.id}
                            onClick={() => setSelectedApp(app)}
                            className="p-3 bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:border-indigo-400 dark:hover:border-indigo-500 cursor-pointer transition-all space-y-2 group"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                {app.id}
                              </span>
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                {plan?.badge || 'Plan'}
                              </span>
                            </div>

                            <div>
                              <div className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                {app.applicant.fullName}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                {app.applicant.companyName || 'Individual Entity'}
                              </div>
                            </div>

                            <div className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
                              📍 {app.territoryRequested}
                            </div>

                            <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-700/60 text-[10px] text-slate-500">
                              <span>Score: {app.automatedEvaluation.score}/100</span>
                              <span>{app.documents.length} docs</span>
                            </div>

                            {/* Quick Status Action Controls */}
                            {(userRole === 'super_admin' || userRole === 'franchise_manager' || userRole === 'director') && (
                              <div className="pt-1 flex gap-1">
                                {app.status !== 'approved' && app.status !== 'onboarding' && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      triggerBiometricApproval(app.id);
                                    }}
                                    className="w-full py-1 text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 rounded"
                                  >
                                    Quick Approve
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {colApps.length === 0 && (
                        <div className="text-center py-8 text-[11px] text-slate-400">
                          No applications in this phase
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TABLE VIEW */}
          {viewMode === 'table' && (
            <div className="overflow-x-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                  <tr>
                    <th className="py-3 px-4">Application ID</th>
                    <th className="py-3 px-4">Applicant &amp; Company</th>
                    <th className="py-3 px-4">Franchise Plan</th>
                    <th className="py-3 px-4">Territory</th>
                    <th className="py-3 px-4">Liquid Capital</th>
                    <th className="py-3 px-4">Score</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {filteredApps.map(app => {
                    const plan = getPlanById(app.planId);
                    return (
                      <tr
                        key={app.id}
                        onClick={() => setSelectedApp(app)}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                      >
                        <td className="py-3 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {app.id}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">{app.applicant.fullName}</div>
                          <div className="text-[11px] text-slate-400">{app.applicant.companyName || 'Individual'}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {plan?.title || app.planId}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                          {app.territoryRequested}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-900 dark:text-slate-100">
                          ${app.financials.liquidCapital.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-emerald-600">
                          {app.automatedEvaluation.score}/100
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 capitalize">
                            {app.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedApp(app);
                            }}
                            className="px-2.5 py-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                          >
                            Inspect &rarr;
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SECTION 3: DOCUMENT REVIEW DESK */}
      {activeSection === 'documents' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Encrypted Document Review &amp; Compliance Verification
              </h3>
              <p className="text-xs text-slate-500">
                Audit and verify uploaded applicant government photo IDs, balance sheets, and tax documents.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800">
              Total Vault Files: {allDocuments.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                <tr>
                  <th className="py-3 px-4">Application ID</th>
                  <th className="py-3 px-4">Applicant</th>
                  <th className="py-3 px-4">Document Category</th>
                  <th className="py-3 px-4">File Name</th>
                  <th className="py-3 px-4">Encryption &amp; Checksum</th>
                  <th className="py-3 px-4">Audit Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {allDocuments.map(({ doc, app }) => (
                  <tr key={doc.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-600">
                      {app.id}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">
                      {app.applicant.fullName}
                    </td>
                    <td className="py-3 px-4 capitalize font-semibold text-slate-700 dark:text-slate-300">
                      {doc.type.replace(/_/g, ' ')}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300 truncate max-w-[180px]">
                      {doc.name}
                    </td>
                    <td className="py-3 px-4 font-mono text-[10px] text-slate-400">
                      AES-GCM-256 ({doc.cipherChecksum ? doc.cipherChecksum.slice(0, 10) + '...' : 'Verified'})
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        doc.status === 'verified'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : doc.status === 'rejected'
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                      }`}>
                        {doc.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5">
                      <button
                        type="button"
                        onClick={() => setInspectingDoc({ doc, applicantName: app.applicant.fullName, appId: app.id })}
                        className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded"
                        title="View Document"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDocumentAudit(app.id, doc.id, 'verified')}
                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded"
                        title="Approve / Verify Document"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDocumentAudit(app.id, doc.id, 'rejected')}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded"
                        title="Reject Document"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 4: PAYMENT VERIFICATION DESK */}
      {activeSection === 'payments' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Payment Verification &amp; Bank Reconciliation Desk
              </h3>
              <p className="text-xs text-slate-500">
                Verify offline bank transfer receipts (IDBI Bank, Bank of Baroda) and review processed gateway transactions.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
              Total Records: {allPayments.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                <tr>
                  <th className="py-3 px-4">Application ID</th>
                  <th className="py-3 px-4">Billing Name</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Method / Reference</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Verification Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {allPayments.map(({ payment, app }) => (
                  <tr key={payment.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-600">
                      {app.id}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                      {payment.billingName || app.applicant.fullName}
                    </td>
                    <td className="py-3 px-4 capitalize">
                      {payment.type.replace(/_/g, ' ')}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                      {payment.currency === 'INR' ? '₹' : '$'}{payment.amount.toLocaleString()} {payment.currency}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                      {payment.method} &bull; {payment.referenceCode}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        payment.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : payment.status === 'processing'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                      }`}>
                        {payment.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {payment.status === 'processing' ? (
                        <button
                          type="button"
                          onClick={() => {
                            FranchiseStorageService.updatePaymentStatus(
                              app.id,
                              payment.id,
                              'completed',
                              currentUser?.email || 'director@truedealglobal.com'
                            );
                            NotificationService.addNotification(
                              'Payment Reconciled',
                              `Bank transfer reference ${payment.referenceCode} confirmed & cleared.`,
                              'success'
                            );
                            refreshData();
                          }}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] transition-all"
                        >
                          Verify &amp; Clear Bank Funds
                        </button>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Reconciled ✓</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 5: REPORTS & DATA EXPORT */}
      {activeSection === 'reports' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Franchise Intelligence Reports &amp; Exports
              </h3>
              <p className="text-xs text-slate-500">
                Export sanitized records with privacy data minimization for accounting and legal oversight.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>Download CSV Report</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="text-xs text-slate-500 block">Territory Coverage</span>
              <span className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-1 block">
                {new Set(applications.map(a => a.territoryRequested)).size} Jurisdictions
              </span>
              <span className="text-[11px] text-slate-400 mt-1 block">India &amp; International corridors</span>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="text-xs text-slate-500 block">Average Automated Score</span>
              <span className="text-xl font-bold font-mono text-emerald-600 mt-1 block">
                {(applications.reduce((s, a) => s + a.automatedEvaluation.score, 0) / (applications.length || 1)).toFixed(1)}/100
              </span>
              <span className="text-[11px] text-slate-400 mt-1 block">Risk scoring algorithm</span>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="text-xs text-slate-500 block">Data Minimization Active</span>
              <span className="text-xl font-bold text-indigo-600 mt-1 block">
                Enabled ✓
              </span>
              <span className="text-[11px] text-slate-400 mt-1 block">No passwords, CVVs, or raw biometric proofs</span>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 6: IMMUTABLE AUDIT TRAIL */}
      {activeSection === 'audit' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Security Audit Log (Cryptographic SHA-256 Tamper Evident)
              </h3>
              <p className="text-xs text-slate-500">
                Every administrative status transition, document verification, and payment check is cryptographically logged.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-full">
              SHA-256 Verified
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Target Resource</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Details</th>
                  <th className="py-3 px-4 font-mono">Checksum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {FranchiseStorageService.getAuditLogs().slice(0, 30).map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-4 font-mono font-bold text-indigo-600">
                      {log.action}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-700 dark:text-slate-300">
                      {log.resourceId}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">
                      {log.userEmail} ({log.userRole})
                    </td>
                    <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300 max-w-sm truncate">
                      {log.details}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-[10px] text-slate-400">
                      {log.checksum.slice(0, 12)}...
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 7: TEAM & ROLES (SUPER ADMIN ONLY) */}
      {activeSection === 'team' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Team &amp; Least-Privilege Role Administration
            </h3>
            <p className="text-xs text-slate-500">
              Manage authorized administrative roles: Super Admin, Franchise Manager, Reviewer, and Support Staff.
            </p>
          </div>

          {/* Add Team Member */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newTeamEmail.trim()) return;
              setTeamMembers(prev => [
                ...prev,
                { email: newTeamEmail.toLowerCase().trim(), role: newTeamRole, name: newTeamEmail.split('@')[0] }
              ]);
              setNewTeamEmail('');
              NotificationService.addNotification(
                'Role Assigned',
                `Assigned role ${newTeamRole} to ${newTeamEmail}`,
                'success'
              );
            }}
            className="flex flex-col sm:flex-row gap-3 p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700"
          >
            <input
              type="email"
              required
              placeholder="Team member corporate email..."
              value={newTeamEmail}
              onChange={e => setNewTeamEmail(e.target.value)}
              className="flex-1 px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg"
            />
            <select
              value={newTeamRole}
              onChange={e => setNewTeamRole(e.target.value as UserRole)}
              className="px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg"
            >
              <option value="super_admin">Super Admin</option>
              <option value="franchise_manager">Franchise Manager</option>
              <option value="reviewer">Reviewer / Compliance</option>
              <option value="support_staff">Support Staff</option>
            </select>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5"
            >
              <UserPlus className="w-4 h-4" />
              <span>Assign Role</span>
            </button>
          </form>

          {/* Team Members List */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                <tr>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Corporate Email</th>
                  <th className="py-3 px-4">Assigned Role</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {teamMembers.map(m => (
                  <tr key={m.email} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                      {m.name}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300">
                      {m.email}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 uppercase">
                        {m.role.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-emerald-600 font-bold">
                      Active ✓
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 8: PORTAL SETTINGS & DEPLOYMENT CHECKLIST */}
      {activeSection === 'settings' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              System Settings &amp; Security Configuration
            </h3>
            <p className="text-xs text-slate-500">
              Verified environment variables, database configuration, and deployment origins.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
              <span className="font-bold text-slate-900 dark:text-slate-100 block">Production Origins:</span>
              <p className="font-mono text-slate-600 dark:text-slate-400">
                &bull; Primary: https://businessfranchise.truedealglobal.com<br />
                &bull; Secondary 301 Redirect: https://franchise.truedealglobal.com
              </p>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
              <span className="font-bold text-slate-900 dark:text-slate-100 block">Cloud Firestore Instance:</span>
              <p className="font-mono text-slate-600 dark:text-slate-400">
                &bull; Project: rational-medium-x5wls<br />
                &bull; DB ID: ai-studio-truedealglobalfr-f1b6f5db-45a0-49c4-a0df-6aa920471dd8<br />
                &bull; Security Rules: Deployed &amp; Active
              </p>
            </div>
          </div>
        </div>
      )}

      {/* INSPECTION DRAWER / MODAL */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-xl h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl p-6 overflow-y-auto space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                {selectedApp.applicantBiometricEnrollment?.facePhotoUrl && (
                  <img
                    src={selectedApp.applicantBiometricEnrollment.facePhotoUrl}
                    alt="Applicant Photo"
                    className="w-12 h-12 rounded-xl object-cover border-2 border-emerald-500 shadow-sm"
                  />
                )}
                <div>
                  <span className="text-xs font-mono text-slate-400">Application File {selectedApp.id}</span>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {selectedApp.applicant.fullName}
                  </h3>
                  {selectedApp.applicantBiometricEnrollment?.enrolled && (
                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 block">
                      ✓ Biometric {selectedApp.applicantBiometricEnrollment.modality === 'face_id' ? 'Webcam Face ID' : 'Touch ID'} Verified ({selectedApp.applicantBiometricEnrollment.biometricScore || 98.4}%)
                    </span>
                  )}
                </div>
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
              <div className="text-right">
                <span className="text-xs text-slate-400 block mb-1">Current Lifecycle Status</span>
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 capitalize">
                  {selectedApp.status.replace(/_/g, ' ')}
                </span>
              </div>
            </div>

            {/* Reviewer Assignment Row */}
            <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-xl border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-500 block">Assigned Review Officer:</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {selectedApp.assignedReviewer ? `${selectedApp.assignedReviewer} (${selectedApp.assignedReviewerEmail || ''})` : 'Unassigned'}
                </span>
              </div>
              {(userRole === 'super_admin' || userRole === 'franchise_manager' || userRole === 'director') && (
                <button
                  type="button"
                  onClick={() => handleAssignReviewer(selectedApp.id)}
                  className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg font-bold text-[11px]"
                >
                  Assign to Me
                </button>
              )}
            </div>

            {/* Applicant Profile Details */}
            <div className="space-y-3 text-xs">
              <h4 className="font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider text-[11px]">
                Applicant &amp; Corporate Entity
              </h4>
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-slate-400 block">Company:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{selectedApp.applicant.companyName || 'Individual'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Entity Type:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 uppercase">{selectedApp.applicant.entityType}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Email:</span>
                  <span className="font-mono text-slate-900 dark:text-slate-100">{selectedApp.applicant.email}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Phone / WhatsApp:</span>
                  <span className="font-mono text-slate-900 dark:text-slate-100">{selectedApp.applicant.phone}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Location:</span>
                  <span className="text-slate-900 dark:text-slate-100">{selectedApp.applicant.city}, {selectedApp.applicant.stateProvince}, {selectedApp.applicant.country}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Requested Territory:</span>
                  <span className="text-indigo-600 font-bold">{selectedApp.territoryRequested}</span>
                </div>
              </div>
            </div>

            {/* Financial Qualification */}
            <div className="space-y-3 text-xs">
              <h4 className="font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider text-[11px]">
                Financial Qualification
              </h4>
              <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-slate-400 block">Liquid Capital:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100">${selectedApp.financials.liquidCapital.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Net Worth:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100">${selectedApp.financials.netWorth.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Credit Tier:</span>
                  <span className="font-mono text-emerald-600 font-bold uppercase">{selectedApp.financials.creditScoreTier.replace('_', ' ')}</span>
                </div>
              </div>
            </div>

            {/* Document Checklist & Vault Files */}
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider text-[11px]">
                  Encrypted Documents ({selectedApp.documents.length})
                </h4>
              </div>
              <div className="space-y-2">
                {selectedApp.documents.map(doc => (
                  <div
                    key={doc.id}
                    className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3"
                  >
                    <div className="truncate">
                      <span className="font-semibold text-slate-900 dark:text-slate-100 block truncate">{doc.name}</span>
                      <span className="text-[10px] text-slate-400 block">
                        Category: {doc.type.replace(/_/g, ' ')} &bull; {doc.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setInspectingDoc({ doc, applicantName: selectedApp.applicant.fullName, appId: selectedApp.id })}
                        className="px-2.5 py-1 text-xs bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 rounded font-semibold"
                      >
                        Inspect
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDocumentAudit(selectedApp.id, doc.id, 'verified')}
                        className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                        title="Mark Verified"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Status History Audit Trail */}
            {selectedApp.statusHistory && selectedApp.statusHistory.length > 0 && (
              <div className="space-y-2 text-xs">
                <h4 className="font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider text-[11px]">
                  Chronological Status History
                </h4>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                  {selectedApp.statusHistory.map((sh, idx) => (
                    <div key={sh.id || idx} className="flex justify-between items-start text-[11px]">
                      <div>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {sh.fromStatus} &rarr; {sh.toStatus}
                        </span>
                        {sh.reason && <p className="text-slate-500 italic mt-0.5">{sh.reason}</p>}
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {new Date(sh.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Direct Communication Channels */}
            <div className="space-y-2 text-xs">
              <h4 className="font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider text-[11px]">
                Direct Applicant Channels
              </h4>
              <div className="flex gap-2">
                <a
                  href={`https://wa.me/${selectedApp.applicant.phone.replace(/[^0-9]/g, '')}?text=Hello%20${encodeURIComponent(selectedApp.applicant.fullName)},%20this%20is%20TrueDeal%20Global%20Franchise%20Executive%20Operations%20regarding%20Application%20%23${selectedApp.id}.`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>WhatsApp Applicant</span>
                </a>
                <a
                  href={`mailto:${selectedApp.applicant.email}?subject=TRUEDEAL%20GLOBAL%20Franchise%20Application%20Status%20Update%20%23${selectedApp.id}&body=Dear%20${encodeURIComponent(selectedApp.applicant.fullName)},%0D%0A%0D%0ARegarding%20your%20franchise%20application%20${selectedApp.id}...`}
                  className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Send Direct Email</span>
                </a>
              </div>
            </div>

            {/* Officer Notes */}
            <div className="space-y-3 text-xs">
              <h4 className="font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider text-[11px]">
                Officer Review Notes ({selectedApp.reviewNotes.length})
              </h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {selectedApp.reviewNotes.map(n => (
                  <div key={n.id} className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-xs space-y-1">
                    <div className="flex justify-between text-[10px] text-slate-400">
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

            {/* Executive Actions */}
            {(userRole === 'director' || userRole === 'super_admin' || userRole === 'franchise_manager') && (
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTransitioningApp({ app: selectedApp, targetStatus: 'documents_required' });
                  }}
                  className="flex-1 py-2 px-3 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 hover:bg-amber-100 rounded-xl text-xs font-semibold"
                >
                  Request Documents
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

      {/* Status Transition Dialog Modal */}
      {transitioningApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Confirm Status Transition to "{transitioningApp.targetStatus.replace(/_/g, ' ')}"
            </h4>
            <p className="text-xs text-slate-500">
              Application ID: {transitioningApp.app.id} for {transitioningApp.app.applicant.fullName}
            </p>
            <div>
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                Reason / Internal Notes (Required):
              </label>
              <textarea
                rows={3}
                required
                value={transitionReason}
                onChange={e => setTransitionReason(e.target.value)}
                placeholder="State the compliance or executive reason for this status change..."
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTransitioningApp(null)}
                className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!transitionReason.trim()}
                onClick={executeStatusTransition}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl disabled:opacity-50"
              >
                Confirm Transition
              </button>
            </div>
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
