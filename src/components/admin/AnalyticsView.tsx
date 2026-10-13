import { useState } from 'react';
import {
  TrendingUp,
  DollarSign,
  Users,
  Clock,
  ShieldCheck,
  Zap,
  Download,
  FileSpreadsheet,
  FileText,
  Search,
  Filter
} from 'lucide-react';
import { FranchiseStorageService, getPlanById } from '../../services/storage';
import { FranchiseApplication, AuditLogEntry } from '../../types/franchise';

export function AnalyticsView() {
  const applications = FranchiseStorageService.getApplications();
  const [activeSubTab, setActiveSubTab] = useState<'kpis' | 'audit_log'>('kpis');
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(FranchiseStorageService.getAuditLogs());
  const [auditSearch, setAuditSearch] = useState('');

  // Key KPI Calculations
  const totalPipelineValue = applications.reduce((acc, app) => {
    const plan = getPlanById(app.planId);
    return acc + (plan ? plan.priceINR : 4999);
  }, 0);

  const collectedFees = applications.reduce((acc, app) => {
    return acc + app.payments.reduce((pAcc, p) => pAcc + p.amount, 0);
  }, 0);

  const autoPassedCount = applications.filter(a => a.automatedEvaluation.score >= 70).length;
  const autoRate = Math.round((autoPassedCount / Math.max(1, applications.length)) * 100);

  const funnelStages = [
    { name: 'Submitted', count: applications.length, pct: '100%' },
    { name: 'Automated Passed', count: applications.filter(a => a.status !== 'draft').length, pct: '92%' },
    { name: 'Compliance Cleared', count: applications.filter(a => ['compliance_review', 'approved', 'contract_issued', 'deposit_paid', 'onboarded'].includes(a.status)).length, pct: '75%' },
    { name: 'Director Approved', count: applications.filter(a => ['approved', 'contract_issued', 'deposit_paid', 'onboarded'].includes(a.status)).length, pct: '58%' },
    { name: 'Capital Funded', count: applications.filter(a => ['deposit_paid', 'onboarded'].includes(a.status)).length, pct: '33%' }
  ];

  // Tier counts matching official plans
  const tierBreakdown = {
    starter: applications.filter(a => a.planId === 'plan_basic' || a.planId === 'plan_standard').length,
    growth: applications.filter(a => a.planId === 'plan_corporate' || a.planId === 'plan_platinum').length,
    authority: applications.filter(a => a.planId === 'plan_entrepreneur' || a.planId === 'plan_retirement').length,
    master: applications.filter(a => a.planId === 'plan_enterprise' || a.planId === 'plan_global' || a.planId === 'plan_global_enterprise').length,
  };

  // Export audit logs handlers
  const handleDownloadCsv = () => {
    const csvContent = FranchiseStorageService.exportAuditLogsCsv();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `truedeal_audit_logs_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadJson = () => {
    const jsonContent = FranchiseStorageService.exportAuditLogsJson();
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `truedeal_audit_logs_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const filteredLogs = auditLogs.filter(log =>
    log.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
    log.userEmail.toLowerCase().includes(auditSearch.toLowerCase()) ||
    log.resourceId.toLowerCase().includes(auditSearch.toLowerCase()) ||
    log.details.toLowerCase().includes(auditSearch.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
      {/* View Switcher Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span>Enterprise Intelligence</span>
            <span aria-hidden="true">·</span>
            <span>Real-Time Metrics & Compliance Trail</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Analytics & Cryptographic Audit Ledger
          </h1>
        </div>

        {/* Sub-tab pills */}
        <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setActiveSubTab('kpis')}
            className={`py-1.5 px-3 text-xs font-semibold rounded-lg transition-all ${
              activeSubTab === 'kpis'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Engagement & Conversion
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('audit_log')}
            className={`py-1.5 px-3 text-xs font-semibold rounded-lg transition-all ${
              activeSubTab === 'audit_log'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Audit Log & Sync History
          </button>
        </div>
      </div>

      {activeSubTab === 'kpis' ? (
        <div className="space-y-8">
          {/* 4 Metric Counter Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
              <span className="text-xs text-slate-400 font-medium">Pipeline Capital Value</span>
              <span className="text-2xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-slate-100 block">
                ${totalPipelineValue.toLocaleString()}
              </span>
              <span className="text-[11px] text-emerald-600 font-medium">
                Active applicant deployment capacity
              </span>
            </div>

            <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
              <span className="text-xs text-slate-400 font-medium">Franchise Escrow Paid</span>
              <span className="text-2xl font-extrabold font-mono tabular-nums text-emerald-600 block">
                ${collectedFees.toLocaleString()}
              </span>
              <span className="text-[11px] text-slate-500">
                Verified fees & deposits collected
              </span>
            </div>

            <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
              <span className="text-xs text-slate-400 font-medium">Automated Rule Pass Rate</span>
              <span className="text-2xl font-extrabold font-mono tabular-nums text-indigo-600 dark:text-indigo-400 block">
                {autoRate}%
              </span>
              <span className="text-[11px] text-slate-500">
                Instant preliminary qualification
              </span>
            </div>

            <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
              <span className="text-xs text-slate-400 font-medium">Average Approval Speed</span>
              <span className="text-2xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-slate-100 block">
                1.8 Days
              </span>
              <span className="text-[11px] text-emerald-600 font-medium">
                -85% vs traditional franchise legal review
              </span>
            </div>
          </div>

          {/* Conversion Funnel & Plan Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Conversion Funnel */}
            <div className="lg:col-span-7 p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Application Conversion Funnel
                  </h3>
                  <p className="text-xs text-slate-500">
                    Velocity from first inquiry to active franchise launch
                  </p>
                </div>
                <span className="text-xs font-mono text-indigo-600 font-semibold">
                  33% Net Conversion
                </span>
              </div>

              <div className="space-y-3 pt-2">
                {funnelStages.map((stage, idx) => (
                  <div key={stage.name} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-slate-700 dark:text-slate-300">{stage.name}</span>
                      <span className="font-mono text-slate-500">{stage.count} applicants ({stage.pct})</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 rounded-full transition-all"
                        style={{ width: stage.pct }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Plan Tier Distribution */}
            <div className="lg:col-span-5 p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Franchise Plan Demand Share
                </h3>
                <p className="text-xs text-slate-500">
                  Distribution across investment categories
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-900 dark:text-slate-100 block">Global & Enterprise Authority</span>
                    <span className="text-slate-400 text-[11px]">₹499k - ₹999k Tier ($6.2k - $12.5k USD)</span>
                  </div>
                  <span className="text-base font-mono font-bold text-amber-500">{tierBreakdown.master}</span>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-900 dark:text-slate-100 block">Entrepreneur & Retirement</span>
                    <span className="text-slate-400 text-[11px]">₹99.9k - ₹149.9k Tier ($1.2k - $1.8k USD)</span>
                  </div>
                  <span className="text-base font-mono font-bold text-emerald-600">{tierBreakdown.authority}</span>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-900 dark:text-slate-100 block">Corporate & Platinum Partner</span>
                    <span className="text-slate-400 text-[11px]">₹14.9k - ₹49.9k Tier ($189 - $629 USD)</span>
                  </div>
                  <span className="text-base font-mono font-bold text-indigo-600">{tierBreakdown.growth}</span>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-900 dark:text-slate-100 block">Basic & Standard Plans</span>
                    <span className="text-slate-400 text-[11px]">₹2,500 - ₹4,999 Tier ($31 - $63 USD)</span>
                  </div>
                  <span className="text-base font-mono font-bold text-blue-600">{tierBreakdown.starter}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* AUDIT LOG & SYNC HISTORY VIEW */
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search action, email, checksum..."
                value={auditSearch}
                onChange={e => setAuditSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDownloadCsv}
                className="py-1.5 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadJson}
                className="py-1.5 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Export JSON</span>
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 font-semibold text-slate-700 dark:text-slate-300">
                    <th className="p-3.5">Timestamp</th>
                    <th className="p-3.5">Action Code</th>
                    <th className="p-3.5">Authorized Principal</th>
                    <th className="p-3.5">Resource ID</th>
                    <th className="p-3.5">Audit Narrative</th>
                    <th className="p-3.5">Sync Status</th>
                    <th className="p-3.5">SHA-256 Checksum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-600 dark:text-slate-300">
                  {filteredLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="p-3.5 font-mono text-slate-400 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="p-3.5 font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                        {log.action}
                      </td>
                      <td className="p-3.5 whitespace-nowrap">{log.userEmail}</td>
                      <td className="p-3.5 font-mono text-slate-500">{log.resourceId}</td>
                      <td className="p-3.5 max-w-xs truncate" title={log.details}>{log.details}</td>
                      <td className="p-3.5">
                        <span className="capitalize px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                          {log.syncStatus}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono text-[10px] text-slate-400 max-w-[120px] truncate" title={log.checksum}>
                        {log.checksum}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
