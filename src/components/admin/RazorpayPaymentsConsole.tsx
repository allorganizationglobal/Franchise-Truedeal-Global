import { useMemo, useState } from 'react';
import {
  Search,
  RefreshCw,
  Download,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  MessageSquarePlus,
  X
} from 'lucide-react';
import { NotificationService } from '../../services/notificationService';
import { getFirebaseIdToken } from '../../services/firebase';

export interface AdminRazorpayStats {
  totalTransactions: number;
  capturedCount: number;
  pendingCount: number;
  failedCount: number;
  refundInitiatedCount: number;
  refundedCount: number;
  totalCapturedCollectionsINR: number;
  gatewayConfig?: {
    mode: 'test' | 'live';
    configured: boolean;
    publicKeyId: string | null;
    webhookSecretPresent: boolean;
    keyModeMismatch?: boolean;
  };
}

export interface AdminRazorpayPayment {
  paymentRecordId: string;
  applicationId: string;
  userId: string;
  applicantName: string;
  email: string;
  phone: string;
  planId: string;
  planTitle: string;
  paymentPurpose: string;
  baseAmountINR: number;
  gstRatePercent: number;
  gstAmountINR: number;
  finalAmountINR: number;
  amountPaise: number;
  currency: string;
  gstMode: string;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  signatureVerified: boolean;
  captureStatus: string;
  paymentStatus: string;
  paymentMethod?: string;
  paymentMethodDetails?: string;
  refundStatus: string;
  refundId?: string;
  refundAmountPaise?: number;
  refundedAt?: string;
  orderReceipt: string;
  receiptNumber?: string;
  paymentTimestamp?: string;
  verifiedAt?: string;
  failureReason?: string;
  attemptHistory?: Array<{
    timestamp: string;
    event: string;
    status: string;
    razorpayPaymentId?: string;
    details: string;
    source: string;
  }>;
  internalNotes?: Array<{
    id: string;
    authorEmail: string;
    text: string;
    createdAt: string;
  }>;
  mode: 'test' | 'live';
  createdAt: string;
  updatedAt: string;
}

export interface AdminRazorpayWebhookEvent {
  eventId: string;
  eventType: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpayRefundId?: string;
  applicationId?: string;
  amountPaise?: number;
  status: string;
  signatureValid: boolean;
  duplicate: boolean;
  receivedAt: string;
  summary: string;
}

interface RazorpayPaymentsConsoleProps {
  stats: AdminRazorpayStats | null;
  payments: AdminRazorpayPayment[];
  webhooks: AdminRazorpayWebhookEvent[];
  loading: boolean;
  onRefresh: () => Promise<void>;
}

/**
 * Neutralizes CSV spreadsheet formula injection (=, +, -, @, tab, CR)
 */
function csvSafeCell(value: unknown): string {
  const str = String(value ?? '');
  const sanitized = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  return `"${sanitized.replace(/"/g, '""')}"`;
}

export function RazorpayPaymentsConsole({
  stats,
  payments,
  webhooks,
  loading,
  onRefresh
}: RazorpayPaymentsConsoleProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'captured' | 'pending' | 'failed' | 'refunded'>('all');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [showRefundConfirmOrderId, setShowRefundConfirmOrderId] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState('');

  const filteredPayments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return payments.filter((p) => {
      const matchesStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'captured'
          ? p.paymentStatus === 'CAPTURED'
          : statusFilter === 'pending'
          ? ['CREATED', 'PENDING', 'AUTHORIZED', 'VERIFICATION_REQUIRED'].includes(p.paymentStatus)
          : statusFilter === 'failed'
          ? ['FAILED', 'CANCELLED'].includes(p.paymentStatus)
          : ['REFUND_INITIATED', 'REFUNDED'].includes(p.paymentStatus);

      if (!matchesStatus) return false;
      if (!q) return true;

      return (
        p.applicationId.toLowerCase().includes(q) ||
        p.applicantName.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.razorpayOrderId.toLowerCase().includes(q) ||
        (p.razorpayPaymentId || '').toLowerCase().includes(q) ||
        (p.receiptNumber || '').toLowerCase().includes(q)
      );
    });
  }, [payments, searchQuery, statusFilter]);

  const selectedPayment = useMemo(
    () => payments.find((p) => p.razorpayOrderId === selectedOrderId) || null,
    [payments, selectedOrderId]
  );

  const runAdminAction = async (
    orderId: string,
    payload: { action: 'razorpay_reconcile' | 'razorpay_refund' | 'razorpay_add_note'; reason?: string; note?: string }
  ) => {
    setBusyOrderId(orderId);
    try {
      const idToken = await getFirebaseIdToken();
      if (!idToken) {
        NotificationService.addNotification('Session Expired', 'Please sign in again to run admin payment actions.', 'error');
        return;
      }
      const res = await fetch('/api/admin/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({ orderId, ...payload })
      });
      const data = await res.json().catch(() => null);
      NotificationService.addNotification(
        payload.action === 'razorpay_refund'
          ? data?.ok
            ? 'Razorpay Refund Initiated'
            : 'Razorpay Refund Failed'
          : payload.action === 'razorpay_add_note'
          ? 'Internal Note Saved'
          : 'Razorpay Reconciliation',
        data?.message || (data?.ok ? 'Action completed successfully.' : 'Action failed.'),
        data?.ok ? 'success' : 'warning'
      );
      if (data?.ok) {
        if (payload.action === 'razorpay_refund') {
          setShowRefundConfirmOrderId(null);
          setRefundReason('');
        }
        if (payload.action === 'razorpay_add_note') {
          setNoteInput('');
        }
      }
      await onRefresh();
    } catch {
      NotificationService.addNotification('Network Error', 'Unable to reach /api/admin/payments.', 'error');
    } finally {
      setBusyOrderId(null);
    }
  };

  const handleExportCsv = () => {
    const headers = [
      'Application ID',
      'Customer Name',
      'Email',
      'Package',
      'Base Amount (INR)',
      'GST Amount (INR)',
      'Final Amount (INR)',
      'Currency',
      'Payment Status',
      'Capture Status',
      'Signature Verified',
      'Razorpay Order ID',
      'Razorpay Payment ID',
      'Method Details',
      'Refund Status',
      'Refund ID',
      'Receipt Number',
      'Mode',
      'Payment Timestamp',
      'Created At'
    ];

    const rows = filteredPayments.map((p) => [
      csvSafeCell(p.applicationId),
      csvSafeCell(p.applicantName),
      csvSafeCell(p.email),
      csvSafeCell(p.planTitle),
      csvSafeCell(p.baseAmountINR),
      csvSafeCell(p.gstAmountINR),
      csvSafeCell(p.finalAmountINR),
      csvSafeCell(p.currency),
      csvSafeCell(p.paymentStatus),
      csvSafeCell(p.captureStatus),
      csvSafeCell(p.signatureVerified ? 'YES' : 'NO'),
      csvSafeCell(p.razorpayOrderId),
      csvSafeCell(p.razorpayPaymentId || ''),
      csvSafeCell(p.paymentMethodDetails || p.paymentMethod || ''),
      csvSafeCell(p.refundStatus),
      csvSafeCell(p.refundId || ''),
      csvSafeCell(p.receiptNumber || ''),
      csvSafeCell(p.mode.toUpperCase()),
      csvSafeCell(p.paymentTimestamp || ''),
      csvSafeCell(p.createdAt)
    ]);

    const csv = [headers.map(csvSafeCell).join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', `truedeal_razorpay_payments_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    NotificationService.addNotification(
      'Razorpay Report Exported',
      `Exported ${filteredPayments.length} Razorpay transaction records to CSV.`,
      'success'
    );
  };

  const renderStatusBadge = (status: string) => {
    const cls =
      status === 'CAPTURED'
        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
        : status === 'FAILED' || status === 'CANCELLED'
        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
        : status === 'REFUNDED' || status === 'REFUND_INITIATED'
        ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300';
    return <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${cls}`}>{status}</span>;
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <span>Razorpay Standard Checkout — Payment Management Console</span>
            </h3>
            {stats?.gatewayConfig && (
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                  stats.gatewayConfig.configured
                    ? stats.gatewayConfig.mode === 'live'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-sky-100 text-sky-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {stats.gatewayConfig.configured
                  ? `${stats.gatewayConfig.mode} mode ready`
                  : 'key secret pending'}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Search verified Razorpay orders, inspect signature &amp; capture status, reconcile against Razorpay API,
            trigger real Razorpay refunds, review webhooks, and export CSV reports.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredPayments.length === 0}
            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => onRefresh()}
            className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Summary KPIs */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
            <span className="text-emerald-700 dark:text-emerald-300 block">Captured Collections</span>
            <span className="text-lg font-mono font-bold text-emerald-700 dark:text-emerald-300">
              ₹{stats.totalCapturedCollectionsINR.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <span className="text-slate-500 block">Captured (Paid)</span>
            <span className="text-lg font-mono font-bold text-emerald-600">{stats.capturedCount}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <span className="text-slate-500 block">Pending / Authorized</span>
            <span className="text-lg font-mono font-bold text-amber-600">{stats.pendingCount}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <span className="text-slate-500 block">Failed / Cancelled</span>
            <span className="text-lg font-mono font-bold text-rose-600">{stats.failedCount}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <span className="text-slate-500 block">Refunded / Initiated</span>
            <span className="text-lg font-mono font-bold text-indigo-600">
              {stats.refundedCount + stats.refundInitiatedCount}
            </span>
          </div>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Application ID, Customer Name, Email, Order ID (order_...), or Payment ID (pay_...)"
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-[11px] font-bold">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'captured', label: 'Successful' },
              { id: 'pending', label: 'Pending' },
              { id: 'failed', label: 'Failed' },
              { id: 'refunded', label: 'Refunded' }
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id)}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                statusFilter === f.id
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Transactions Table */}
      {filteredPayments.length === 0 ? (
        <div className="p-6 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 text-xs text-slate-500 text-center">
          {payments.length === 0
            ? 'No Razorpay orders recorded yet on this server instance. Once orders are created via /api/create-order, they appear here with live reconciliation and real Razorpay Refund API controls.'
            : 'No Razorpay transactions match the current search or status filter.'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
              <tr>
                <th className="py-3 px-3">Order / Payment ID</th>
                <th className="py-3 px-3">Application &amp; Customer</th>
                <th className="py-3 px-3">Package &amp; Amount</th>
                <th className="py-3 px-3">Verification</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredPayments.map((p) => (
                <tr
                  key={p.razorpayOrderId}
                  className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${
                    selectedOrderId === p.razorpayOrderId ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''
                  }`}
                >
                  <td className="py-3 px-3 font-mono">
                    <div className="font-bold text-indigo-600 dark:text-indigo-400">{p.razorpayOrderId}</div>
                    {p.razorpayPaymentId && (
                      <div className="text-[10px] text-slate-500">pay: {p.razorpayPaymentId}</div>
                    )}
                    <div className="text-[10px] text-slate-400">
                      {new Date(p.paymentTimestamp || p.createdAt).toLocaleString('en-IN')}
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">{p.applicantName}</div>
                    <div className="text-[11px] text-slate-500">{p.email}</div>
                    <div className="text-[10px] font-mono text-indigo-600">{p.applicationId}</div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-mono font-bold text-slate-900 dark:text-slate-100">
                      ₹{Number(p.finalAmountINR).toLocaleString('en-IN')} {p.currency}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Base ₹{p.baseAmountINR.toLocaleString('en-IN')} + GST ₹{p.gstAmountINR.toLocaleString('en-IN')}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate max-w-[160px]">{p.planTitle}</div>
                  </td>
                  <td className="py-3 px-3 space-y-1">
                    <div className="flex items-center gap-1 text-[10px] font-semibold">
                      {p.signatureVerified ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                      )}
                      <span>Sig: {p.signatureVerified ? 'Verified' : 'Unverified'}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      Capture: {p.captureStatus}
                    </div>
                    {p.paymentMethodDetails && (
                      <div className="text-[10px] text-slate-500">{p.paymentMethodDetails}</div>
                    )}
                  </td>
                  <td className="py-3 px-3 space-y-1">
                    {renderStatusBadge(p.paymentStatus)}
                    {p.receiptNumber && (
                      <div className="text-[10px] font-mono text-emerald-600">{p.receiptNumber}</div>
                    )}
                    {p.refundId && (
                      <div className="text-[10px] font-mono text-indigo-600">Refund: {p.refundId}</div>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedOrderId(selectedOrderId === p.razorpayOrderId ? null : p.razorpayOrderId)
                        }
                        className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-[11px] font-bold cursor-pointer"
                      >
                        {selectedOrderId === p.razorpayOrderId ? 'Hide' : 'Details'}
                      </button>
                      {p.paymentStatus !== 'CAPTURED' && p.paymentStatus !== 'REFUNDED' && (
                        <button
                          type="button"
                          disabled={busyOrderId === p.razorpayOrderId}
                          onClick={() => runAdminAction(p.razorpayOrderId, { action: 'razorpay_reconcile' })}
                          className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold cursor-pointer disabled:opacity-50"
                        >
                          Reconcile
                        </button>
                      )}
                      {p.paymentStatus === 'CAPTURED' && p.razorpayPaymentId && (
                        <button
                          type="button"
                          disabled={busyOrderId === p.razorpayOrderId}
                          onClick={() => {
                            setSelectedOrderId(p.razorpayOrderId);
                            setShowRefundConfirmOrderId(p.razorpayOrderId);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Refund</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Selected Transaction Detailed Inspector */}
      {selectedPayment && (
        <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-indigo-200 dark:border-indigo-800 space-y-4 text-xs">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-700 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-600" />
                <span className="font-bold text-slate-900 dark:text-white text-sm">
                  Transaction Audit Detail — {selectedPayment.razorpayOrderId}
                </span>
                {renderStatusBadge(selectedPayment.paymentStatus)}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Application {selectedPayment.applicationId} · {selectedPayment.applicantName} ({selectedPayment.email}) · Mode: {selectedPayment.mode.toUpperCase()}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedOrderId(null);
                setShowRefundConfirmOrderId(null);
              }}
              className="text-slate-400 hover:text-slate-700 cursor-pointer"
              aria-label="Close transaction detail"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
              <div className="font-bold text-slate-800 dark:text-slate-200">Financial Breakdown</div>
              <div className="flex justify-between"><span className="text-slate-500">Package:</span><span className="font-semibold">{selectedPayment.planTitle}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Base Fee:</span><span className="font-mono">₹{selectedPayment.baseAmountINR.toLocaleString('en-IN')}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">GST ({selectedPayment.gstMode}):</span><span className="font-mono">₹{selectedPayment.gstAmountINR.toLocaleString('en-IN')}</span></div>
              <div className="flex justify-between border-t border-slate-100 dark:border-slate-800 pt-1 font-bold">
                <span>Final Amount:</span>
                <span className="font-mono text-emerald-700 dark:text-emerald-400">₹{selectedPayment.finalAmountINR.toLocaleString('en-IN')} {selectedPayment.currency}</span>
              </div>
            </div>

            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
              <div className="font-bold text-slate-800 dark:text-slate-200">Razorpay Verification Proof</div>
              <div className="flex justify-between"><span className="text-slate-500">Order ID:</span><span className="font-mono">{selectedPayment.razorpayOrderId}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Payment ID:</span><span className="font-mono">{selectedPayment.razorpayPaymentId || 'Not yet paid'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Signature Verified:</span><span className={selectedPayment.signatureVerified ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>{selectedPayment.signatureVerified ? 'YES (HMAC-SHA256)' : 'NO'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Capture Status:</span><span className="font-mono uppercase">{selectedPayment.captureStatus}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Method:</span><span>{selectedPayment.paymentMethodDetails || selectedPayment.paymentMethod || '—'}</span></div>
            </div>

            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
              <div className="font-bold text-slate-800 dark:text-slate-200">Receipt &amp; Refund State</div>
              <div className="flex justify-between"><span className="text-slate-500">Receipt No:</span><span className="font-mono">{selectedPayment.receiptNumber || 'Unissued'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Refund Status:</span><span className="font-mono uppercase">{selectedPayment.refundStatus}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Refund ID:</span><span className="font-mono">{selectedPayment.refundId || '—'}</span></div>
              {selectedPayment.failureReason && (
                <div className="text-[11px] text-rose-600 pt-1 border-t border-slate-100">
                  Reason: {selectedPayment.failureReason}
                </div>
              )}
            </div>
          </div>

          {/* Real Razorpay Refund API Confirmation Box */}
          {showRefundConfirmOrderId === selectedPayment.razorpayOrderId && selectedPayment.paymentStatus === 'CAPTURED' && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 space-y-3">
              <div className="flex items-center gap-2 font-bold text-rose-800 dark:text-rose-200">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Initiate Real Razorpay Refund API Call (₹{selectedPayment.finalAmountINR.toLocaleString('en-IN')} INR)</span>
              </div>
              <p className="text-[11px] text-rose-700 dark:text-rose-300">
                This invokes Razorpay&apos;s live Refund API (<code className="font-mono">payments.refund</code>) for{' '}
                <code className="font-mono">{selectedPayment.razorpayPaymentId}</code>. Refund confirmation will also be
                tracked via <code className="font-mono">refund.processed</code> webhooks.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="Enter mandatory audit reason for refund (e.g. Cancelled prior to activation per Refund Policy)"
                  className="flex-1 px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-700 rounded-lg"
                />
                <button
                  type="button"
                  disabled={busyOrderId === selectedPayment.razorpayOrderId || refundReason.trim().length < 5}
                  onClick={() =>
                    runAdminAction(selectedPayment.razorpayOrderId, {
                      action: 'razorpay_refund',
                      reason: refundReason.trim()
                    })
                  }
                  className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs disabled:opacity-50 cursor-pointer"
                >
                  Confirm Real Razorpay Refund
                </button>
                <button
                  type="button"
                  onClick={() => setShowRefundConfirmOrderId(null)}
                  className="px-3 py-2 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Attempt History & Internal Notes Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="font-bold text-slate-800 dark:text-slate-200">
                Attempt &amp; Verification History ({selectedPayment.attemptHistory?.length || 0})
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1.5">
                {(selectedPayment.attemptHistory || []).map((a, idx) => (
                  <div key={idx} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-[11px] space-y-0.5">
                    <div className="flex items-center justify-between font-mono">
                      <span className="font-bold text-indigo-600">{a.event} ({a.status})</span>
                      <span className="text-[10px] text-slate-400">{new Date(a.timestamp).toLocaleString('en-IN')}</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300">{a.details}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="font-bold text-slate-800 dark:text-slate-200">
                Internal Admin Notes ({selectedPayment.internalNotes?.length || 0})
              </div>
              <div className="max-h-28 overflow-y-auto space-y-1.5">
                {(selectedPayment.internalNotes || []).length === 0 ? (
                  <p className="text-[11px] text-slate-400">No internal notes logged for this transaction.</p>
                ) : (
                  (selectedPayment.internalNotes || []).map((n) => (
                    <div key={n.id} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-[11px]">
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{n.authorEmail}</span>
                        <span>{new Date(n.createdAt).toLocaleString('en-IN')}</span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-200 mt-0.5">{n.text}</p>
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="Add internal reconciliation note..."
                  className="flex-1 px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
                <button
                  type="button"
                  disabled={!noteInput.trim() || busyOrderId === selectedPayment.razorpayOrderId}
                  onClick={() =>
                    runAdminAction(selectedPayment.razorpayOrderId, {
                      action: 'razorpay_add_note',
                      note: noteInput.trim()
                    })
                  }
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                >
                  <MessageSquarePlus className="w-3.5 h-3.5" />
                  <span>Save</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Verified Webhook Event Audit Log */}
      {webhooks.length > 0 && (
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Razorpay Webhook Event History ({webhooks.length})
          </h4>
          <div className="max-h-44 overflow-y-auto space-y-1 text-[11px] font-mono">
            {webhooks.slice(0, 20).map((ev) => (
              <div
                key={`${ev.eventId}_${ev.receivedAt}`}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 px-3 py-1.5 rounded bg-slate-50 dark:bg-slate-800/50"
              >
                <span className="flex items-center gap-1.5">
                  {ev.signatureValid ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                  ) : (
                    <XCircle className="w-3 h-3 text-rose-600 shrink-0" />
                  )}
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">{ev.eventType}</span>
                  <span className="text-slate-600 dark:text-slate-300">
                    · {ev.razorpayOrderId || ev.razorpayPaymentId || ev.eventId} · {ev.status}
                    {ev.duplicate ? ' (DUPLICATE)' : ''}
                  </span>
                </span>
                <span className="text-slate-400 text-[10px]">{new Date(ev.receivedAt).toLocaleString('en-IN')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
