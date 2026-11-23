import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Gift,
  Search,
  Download,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertCircle,
  Copy,
  Check,
  Loader2,
  ShieldCheck,
  X
} from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import {
  ReferralAttributionRecord,
  ReferralPartner,
  ReferralPayoutStatus
} from '../../types/franchise';
import { FranchiseStorageService } from '../../services/storage';
import {
  getFirebaseIdToken,
  isUserAdmin,
  fetchAllReferralsFromFirestore,
  fetchAllReferralPartnersFromFirestore
} from '../../services/firebase';
import { NotificationService } from '../../services/notificationService';

interface AdminReferralPayoutsProps {
  currentUser?: FirebaseUser | null;
  onRefresh?: () => void;
}

function escapeCsvCell(value: unknown): string {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function AdminReferralPayouts({ currentUser, onRefresh }: AdminReferralPayoutsProps) {
  const [records, setRecords] = useState<ReferralAttributionRecord[]>([]);
  const [partnersCount, setPartnersCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | ReferralPayoutStatus>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Mark as Paid modal / inline confirmation state (optional UTR/Transaction Reference)
  const [payingRecord, setPayingRecord] = useState<ReferralAttributionRecord | null>(null);
  const [utrInput, setUtrInput] = useState<string>('');

  const loadReferralLedger = useCallback(async () => {
    setLoading(true);
    try {
      const mergedRecords = new Map<string, ReferralAttributionRecord>();
      const mergedPartners = new Map<string, ReferralPartner>();

      // 1. Local cache baseline
      FranchiseStorageService.getReferralPartners().forEach((p) => mergedPartners.set(p.referralCode, p));
      FranchiseStorageService.getReferralRecords().forEach((r) => mergedRecords.set(r.referralId, r));

      // 2. Cloud Firestore records (persisted across serverless cold starts)
      if (currentUser && isUserAdmin(currentUser.email)) {
        const [fsReferrals, fsPartners] = await Promise.all([
          fetchAllReferralsFromFirestore().catch(() => [] as ReferralAttributionRecord[]),
          fetchAllReferralPartnersFromFirestore().catch(() => [] as ReferralPartner[])
        ]);
        fsPartners.forEach((p) => mergedPartners.set(p.referralCode, p));
        fsReferrals.forEach((r) => mergedRecords.set(r.referralId, r));

        // 3. Authoritative server API ledger
        const idToken = await getFirebaseIdToken();
        if (idToken) {
          const res = await fetch('/api/admin/referrals', {
            headers: { Authorization: `Bearer ${idToken}` }
          });
          if (res.ok) {
            const data = await res.json().catch(() => null);
            if (data?.ok) {
              if (Array.isArray(data.partners)) {
                (data.partners as ReferralPartner[]).forEach((p) => mergedPartners.set(p.referralCode, p));
              }
              if (Array.isArray(data.referrals)) {
                (data.referrals as ReferralAttributionRecord[]).forEach((r) => {
                  const existing = mergedRecords.get(r.referralId);
                  if (!existing || (r.updatedAt || '') >= (existing.updatedAt || '')) {
                    mergedRecords.set(r.referralId, r);
                  }
                });
              }
            }
          }
        }
      }

      // Enrich missing partner payout handles from merged partner map
      const finalList = Array.from(mergedRecords.values())
        .map((rec) => {
          const partner = mergedPartners.get(rec.referralCode);
          if (!partner) return rec;
          return {
            ...rec,
            referrerName: rec.referrerName || partner.name,
            referrerPhone: rec.referrerPhone || partner.phone,
            referrerEmail: rec.referrerEmail || partner.email,
            referrerUpiOrBank: rec.referrerUpiOrBank || partner.upiOrBankDetails
          };
        })
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

      setRecords(finalList);
      setPartnersCount(mergedPartners.size);
    } catch {
      // Preserve existing rows
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    loadReferralLedger();
  }, [loadReferralLedger]);

  const stats = useMemo(() => {
    const validVerified = records.filter(
      (r) => r.paymentStatus === 'CAPTURED' && !r.selfReferralBlocked && r.payoutStatus !== 'Rejected'
    );
    return {
      totalReferrals: records.length,
      verifiedCount: validVerified.length,
      blockedCount: records.filter((r) => r.selfReferralBlocked).length,
      totalCommissionINR: validVerified.reduce((s, r) => s + r.commissionAmountINR, 0),
      pendingOrApprovedINR: validVerified
        .filter((r) => r.payoutStatus === 'Pending' || r.payoutStatus === 'Approved')
        .reduce((s, r) => s + r.commissionAmountINR, 0),
      paidINR: validVerified
        .filter((r) => r.payoutStatus === 'Paid')
        .reduce((s, r) => s + r.commissionAmountINR, 0)
    };
  }, [records]);

  const filteredRecords = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return records.filter((r) => {
      if (statusFilter !== 'all' && r.payoutStatus !== statusFilter) return false;
      if (!q) return true;
      return (
        r.referralCode.toLowerCase().includes(q) ||
        r.referrerName.toLowerCase().includes(q) ||
        r.referrerPhone.toLowerCase().includes(q) ||
        r.referrerUpiOrBank.toLowerCase().includes(q) ||
        r.applicantName.toLowerCase().includes(q) ||
        r.applicationId.toLowerCase().includes(q) ||
        r.planTitle.toLowerCase().includes(q) ||
        (r.razorpayPaymentId || '').toLowerCase().includes(q) ||
        (r.payoutUtr || '').toLowerCase().includes(q)
      );
    });
  }, [records, searchTerm, statusFilter]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleUpdatePayoutStatus = async (
    record: ReferralAttributionRecord,
    nextStatus: ReferralPayoutStatus,
    payoutUtr?: string
  ) => {
    setActionBusyId(record.referralId);
    setActionMessage(null);
    const actorEmail = currentUser?.email || 'director@truedealglobal.com';
    const cleanUtr = payoutUtr?.trim() || undefined;

    try {
      // 1. Attempt server-side update
      const idToken = await getFirebaseIdToken();
      if (idToken) {
        const res = await fetch('/api/admin/referrals', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`
          },
          body: JSON.stringify({
            referralId: record.referralId,
            payoutStatus: nextStatus,
            payoutUtr: cleanUtr
          })
        });
        if (!res.ok && res.status !== 404) {
          const errData = await res.json().catch(() => null);
          setActionMessage({
            type: 'error',
            text: errData?.message || 'Unable to update referral payout status on server.'
          });
          setActionBusyId(null);
          return;
        }
      }

      // 2. Persist updated record locally + sync directly to Firestore `referrals/{referralId}`
      const nowIso = new Date().toISOString();
      const updatedRecord: ReferralAttributionRecord = {
        ...record,
        payoutStatus: nextStatus,
        payoutUtr: cleanUtr || record.payoutUtr,
        approvedAt: nextStatus === 'Approved' ? nowIso : record.approvedAt,
        paidAt: nextStatus === 'Paid' ? nowIso : record.paidAt,
        updatedBy: actorEmail,
        updatedAt: nowIso
      };
      FranchiseStorageService.saveReferralRecord(updatedRecord, true);
      FranchiseStorageService.updateReferralPayoutStatusLocal(
        record.referralId,
        nextStatus,
        cleanUtr,
        actorEmail
      );

      setRecords((prev) => prev.map((r) => (r.referralId === record.referralId ? updatedRecord : r)));
      setPayingRecord(null);
      setUtrInput('');
      setActionMessage({
        type: 'success',
        text: `Referral ${record.referralCode} (₹${record.commissionAmountINR.toLocaleString('en-IN')}) marked as ${nextStatus}${
          cleanUtr ? ` · UTR: ${cleanUtr}` : ''
        }.`
      });
      NotificationService.addNotification(
        `Referral Payout ${nextStatus}`,
        `${record.referrerName} (${record.referralCode}) — ₹${record.commissionAmountINR.toLocaleString('en-IN')} marked ${nextStatus}.`,
        'success',
        record.applicationId
      );
      onRefresh?.();
    } catch {
      setActionMessage({
        type: 'error',
        text: 'Unexpected error while updating payout status. Please retry.'
      });
    } finally {
      setActionBusyId(null);
    }
  };

  const handleExportCsv = () => {
    const headers = [
      'Referral ID',
      'Referrer Name',
      'Referral Code',
      'Referrer Mobile',
      'Referrer Email',
      'UPI / Bank Details',
      'Referred Applicant Name',
      'Application ID',
      'Plan Purchased',
      'Order Amount (INR)',
      'Base Amount (INR)',
      'Commission Rate (%)',
      'Commission Earned (INR)',
      'Razorpay Order ID',
      'Razorpay Payment ID',
      'Payment Status',
      'Payout Status',
      'UTR / Transaction Reference',
      'Self Referral Blocked',
      'Paid At',
      'Created At'
    ];

    const rows = filteredRecords.map((r) =>
      [
        r.referralId,
        r.referrerName,
        r.referralCode,
        r.referrerPhone,
        r.referrerEmail,
        r.referrerUpiOrBank,
        r.applicantName,
        r.applicationId,
        r.planTitle,
        r.orderAmountINR,
        r.baseAmountINR,
        r.commissionRatePercent,
        r.commissionAmountINR,
        r.razorpayOrderId,
        r.razorpayPaymentId || '',
        r.paymentStatus,
        r.payoutStatus,
        r.payoutUtr || '',
        r.selfReferralBlocked ? 'YES' : 'NO',
        r.paidAt || '',
        r.createdAt
      ]
        .map(escapeCsvCell)
        .join(',')
    );

    const csv = [headers.map(escapeCsvCell).join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `truedeal_referral_payouts_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    NotificationService.addNotification(
      'Referral Payouts CSV Exported',
      `Exported ${filteredRecords.length} referral payout ledger entries for accounting.`,
      'success'
    );
  };

  return (
    <div className="space-y-6">
      {/* Header & KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs text-slate-500 font-medium block">Tracked Referrals</span>
          <span className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1 block">
            {stats.totalReferrals}
          </span>
          <span className="text-[11px] text-slate-500 mt-0.5 block">
            {partnersCount} registered partner{partnersCount === 1 ? '' : 's'} · {stats.verifiedCount} verified paid
          </span>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs text-slate-500 font-medium block">Total 10% Commissions</span>
          <span className="text-2xl font-bold font-mono tabular-nums text-indigo-600 dark:text-indigo-400 mt-1 block">
            ₹{stats.totalCommissionINR.toLocaleString('en-IN')}
          </span>
          <span className="text-[11px] text-slate-500 mt-0.5 block">
            {stats.blockedCount > 0 ? `${stats.blockedCount} self-referral blocked` : 'Verified Razorpay captures'}
          </span>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs text-slate-500 font-medium block">Pending / Approved Due</span>
          <span className="text-2xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-1 block">
            ₹{stats.pendingOrApprovedINR.toLocaleString('en-IN')}
          </span>
          <span className="text-[11px] text-slate-500 mt-0.5 block">
            Target payout SLA: 48–72 hours
          </span>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs text-slate-500 font-medium block">Total Disbursed (Paid)</span>
          <span className="text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1 block">
            ₹{stats.paidINR.toLocaleString('en-IN')}
          </span>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5 block">
            UPI / NEFT Settled
          </span>
        </div>
      </div>

      {/* Main Payout Table Container */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Gift className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Franchise Referral Payout Ledger (10% Commission)
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Review server-verified Razorpay referrals, approve commissions, record UPI/NEFT UTR references, and export
              accounting CSV reports.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search code, referrer, applicant, payment ID..."
                className="pl-8 pr-3 py-1.5 w-64 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | ReferralPayoutStatus)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200"
            >
              <option value="all">All Payout Statuses ({records.length})</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Paid">Paid</option>
              <option value="Rejected">Rejected / Blocked</option>
            </select>

            <button
              type="button"
              onClick={loadReferralLedger}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {actionMessage && (
          <div
            className={`mx-5 mt-4 p-3 rounded-xl border text-xs flex items-center justify-between gap-2 ${
              actionMessage.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {actionMessage.type === 'success' ? (
                <ShieldCheck className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{actionMessage.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionMessage(null)}
              className="text-current opacity-70 hover:opacity-100 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="overflow-x-auto mt-2">
          {loading && records.length === 0 ? (
            <div className="py-12 flex items-center justify-center gap-2 text-xs text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Loading referral payout ledger...</span>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="py-14 px-4 text-center space-y-2">
              <Gift className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                No referral payout entries match the current filter.
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Whenever an applicant completes a Razorpay franchise registration using a partner referral link
                (<span className="font-mono">?ref=TD-CODE</span>), the attributed commission automatically appears here.
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800/70 border-y border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Referrer</th>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">UPI / Bank Details</th>
                  <th className="py-3 px-4">Referred Applicant</th>
                  <th className="py-3 px-4">Plan Purchased</th>
                  <th className="py-3 px-4 text-right">Order Amount</th>
                  <th className="py-3 px-4 text-right">Commission (10%)</th>
                  <th className="py-3 px-4">Razorpay Payment ID</th>
                  <th className="py-3 px-4">Payout Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {filteredRecords.map((rec) => {
                  const isEligibleForPayout =
                    rec.paymentStatus === 'CAPTURED' && !rec.selfReferralBlocked && rec.payoutStatus !== 'Rejected';
                  const isBusy = actionBusyId === rec.referralId;

                  return (
                    <tr key={rec.referralId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 align-top">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 dark:text-white">{rec.referrerName}</div>
                        <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          {rec.referrerPhone || '—'}
                        </div>
                        {rec.referrerEmail && (
                          <div className="text-[10px] text-slate-400 truncate max-w-[160px]">{rec.referrerEmail}</div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                        {rec.referralCode}
                      </td>

                      <td className="py-3.5 px-4">
                        {rec.referrerUpiOrBank ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[11px] text-slate-800 dark:text-slate-200 max-w-[160px] truncate">
                              {rec.referrerUpiOrBank}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy(rec.referrerUpiOrBank, rec.referralId)}
                              className="text-slate-400 hover:text-indigo-600 cursor-pointer shrink-0"
                              title="Copy UPI / Bank Details"
                            >
                              {copiedId === rec.referralId ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Not provided</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">{rec.applicantName}</div>
                        <div className="text-[10px] font-mono text-slate-500">{rec.applicationId}</div>
                        {rec.selfReferralBlocked && (
                          <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 block mt-0.5">
                            Blocked: Self-referral
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap">
                        {rec.planTitle}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        ₹{rec.orderAmountINR.toLocaleString('en-IN')}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-black tabular-nums text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                        ₹{rec.commissionAmountINR.toLocaleString('en-IN')}
                      </td>

                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        <div>{rec.razorpayPaymentId || 'Pending Capture'}</div>
                        <div
                          className={`text-[10px] font-bold ${
                            rec.paymentStatus === 'CAPTURED'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : rec.paymentStatus === 'REFUNDED'
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {rec.paymentStatus}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1 font-bold">
                          {rec.payoutStatus === 'Paid' ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          ) : rec.payoutStatus === 'Rejected' ? (
                            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                          ) : (
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                          )}
                          <span
                            className={
                              rec.payoutStatus === 'Paid'
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : rec.payoutStatus === 'Approved'
                                ? 'text-indigo-700 dark:text-indigo-400'
                                : rec.payoutStatus === 'Rejected'
                                ? 'text-rose-700 dark:text-rose-400'
                                : 'text-amber-700 dark:text-amber-400'
                            }
                          >
                            {rec.payoutStatus}
                          </span>
                        </div>
                        {rec.payoutUtr && (
                          <div className="text-[10px] font-mono text-slate-500 mt-0.5">UTR: {rec.payoutUtr}</div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {isEligibleForPayout && rec.payoutStatus !== 'Paid' ? (
                          <div className="inline-flex items-center gap-1.5">
                            {rec.payoutStatus === 'Pending' && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleUpdatePayoutStatus(rec, 'Approved')}
                                className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 font-bold text-[11px] cursor-pointer disabled:opacity-50"
                              >
                                Approve
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => {
                                setPayingRecord(rec);
                                setUtrInput(rec.payoutUtr || '');
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer disabled:opacity-50"
                            >
                              Mark as Paid
                            </button>
                          </div>
                        ) : rec.payoutStatus === 'Paid' ? (
                          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                            Settled
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">
                            {rec.selfReferralBlocked
                              ? 'Excluded'
                              : rec.paymentStatus === 'REFUNDED'
                              ? 'Refunded'
                              : 'Awaiting Capture'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Mark as Paid Confirmation Modal with Optional UTR / Transaction Reference */}
      {payingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white">
                  Confirm Referral Commission Payout
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Mark payout to <strong>{payingRecord.referrerName}</strong> ({payingRecord.referralCode}) as Paid.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPayingRecord(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Commission Amount (10%)</span>
                <span className="font-mono font-black tabular-nums text-emerald-700 dark:text-emerald-400">
                  ₹{payingRecord.commissionAmountINR.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">UPI / Bank Details</span>
                <span className="font-mono font-semibold text-slate-900 dark:text-white truncate max-w-[200px]">
                  {payingRecord.referrerUpiOrBank || 'On file'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Razorpay Payment ID</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">
                  {payingRecord.razorpayPaymentId || '—'}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                UTR / UPI / NEFT Transaction Reference (Optional)
              </label>
              <input
                type="text"
                value={utrInput}
                onChange={(e) => setUtrInput(e.target.value)}
                placeholder="e.g., UTR432198765432 or UPI Ref No."
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPayingRecord(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionBusyId === payingRecord.referralId}
                onClick={() => handleUpdatePayoutStatus(payingRecord, 'Paid', utrInput)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                {actionBusyId === payingRecord.referralId ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                <span>Confirm Mark as Paid</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
