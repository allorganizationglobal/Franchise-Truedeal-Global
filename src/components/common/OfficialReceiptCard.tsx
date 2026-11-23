import { useState } from 'react';
import {
  CheckCircle2,
  Printer,
  Download,
  Copy,
  Check,
  Info,
  ShieldCheck,
  ArrowRight
} from 'lucide-react';
import { FranchiseStorageService, getPlanById } from '../../services/storage';
import { calculateFeeBreakdownINR } from '../../config/complianceConfig';

export interface OfficialReceiptData {
  receiptNumber: string;
  applicationId: string;
  applicantName: string;
  applicantEmail?: string;
  applicantPhone?: string;
  planId: string;
  planTitle?: string;
  amountINR: number;
  baseAmountINR?: number;
  gstAmountINR?: number;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  referenceCode?: string;
  paymentMethodDetails?: string;
  timestamp: string;
  signatureVerified?: boolean;
  gateway?: string;
}

interface OfficialReceiptCardProps {
  receipt: OfficialReceiptData;
  onClose?: () => void;
  closeLabel?: string;
  onOpenTracker?: () => void;
}

export function OfficialReceiptCard({
  receipt,
  onClose,
  closeLabel = 'Return to Portal',
  onOpenTracker
}: OfficialReceiptCardProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const config = FranchiseStorageService.getComplianceConfig();
  const plan = getPlanById(receipt.planId);
  const fallbackBreakdown = calculateFeeBreakdownINR(receipt.amountINR, config);

  const baseINR =
    typeof receipt.baseAmountINR === 'number' && receipt.baseAmountINR > 0
      ? receipt.baseAmountINR
      : fallbackBreakdown.baseFeeINR;
  const gstINR =
    typeof receipt.gstAmountINR === 'number'
      ? receipt.gstAmountINR
      : fallbackBreakdown.gstAmountINR;
  const formattedDate = (() => {
    try {
      return new Date(receipt.timestamp).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short'
      });
    } catch {
      return receipt.timestamp;
    }
  })();

  const copyValue = (key: string, val?: string) => {
    if (!val) return;
    navigator.clipboard?.writeText(val);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleDownloadTextReceipt = () => {
    const lines = [
      '====================================================================',
      `                 ${config.legalName}`,
      '                 OFFICIAL PAYMENT RECEIPT',
      '====================================================================',
      `Website        : ${config.franchisePortalUrl}`,
      `Support Email  : ${config.officialEmail}`,
      `Office / Region: ${config.registeredOfficeAddress || config.operatingCityRegion}`,
      '--------------------------------------------------------------------',
      `Receipt Number : ${receipt.receiptNumber}`,
      `Payment Status : CAPTURED (Server Verified)`,
      `Verified At    : ${formattedDate}`,
      '--------------------------------------------------------------------',
      `Application ID : ${receipt.applicationId}`,
      `Applicant Name : ${receipt.applicantName}`,
      receipt.applicantEmail ? `Applicant Email: ${receipt.applicantEmail}` : '',
      receipt.applicantPhone ? `Applicant Phone: ${receipt.applicantPhone}` : '',
      `Franchise Plan : ${receipt.planTitle || plan?.title || receipt.planId}`,
      plan?.validity ? `License Term   : ${plan.validity}` : '',
      '--------------------------------------------------------------------',
      `Base Fee (INR) : INR ${baseINR.toLocaleString('en-IN')}`,
      `GST / Tax      : ${gstINR > 0 ? `INR ${gstINR.toLocaleString('en-IN')}` : fallbackBreakdown.gstLabel}`,
      `Total Paid     : INR ${receipt.amountINR.toLocaleString('en-IN')}`,
      '--------------------------------------------------------------------',
      receipt.razorpayPaymentId ? `Razorpay Pay ID: ${receipt.razorpayPaymentId}` : '',
      receipt.razorpayOrderId ? `Razorpay Ord ID: ${receipt.razorpayOrderId}` : '',
      !receipt.razorpayPaymentId && receipt.referenceCode ? `Reference Code : ${receipt.referenceCode}` : '',
      receipt.paymentMethodDetails ? `Payment Method : ${receipt.paymentMethodDetails}` : '',
      `Verification   : ${receipt.signatureVerified !== false ? 'HMAC-SHA256 + Razorpay Capture Confirmed' : 'Reconciled by Accounts'}`,
      '====================================================================',
      'IMPORTANT COMPLIANCE NOTICE:',
      'Payment confirmation is separate from franchise approval. Your',
      'application remains subject to administrative KYC verification',
      'and formal Franchise Agreement execution.',
      '===================================================================='
    ]
      .filter(Boolean)
      .join('\n');

    const blob = new Blob([lines], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeNo = receipt.receiptNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
    a.href = url;
    a.download = `TRUEDEAL-Receipt-${safeNo}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="official-receipt-printable py-2 space-y-5">
      {/* Receipt Header */}
      <div className="text-center space-y-2">
        <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <div>
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold uppercase tracking-wider">
            <ShieldCheck className="w-3 h-3" />
            <span>
              {receipt.signatureVerified !== false
                ? 'CAPTURED · HMAC-SHA256 Verified'
                : 'Verified Payment Receipt'}
            </span>
          </span>
          <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 mt-2">
            Payment Successful
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Official Receipt #{receipt.receiptNumber} · {formattedDate}
          </p>
        </div>
      </div>

      {/* Formal Receipt Ledger Box */}
      <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3 text-xs text-left">
        {/* Merchant Identity */}
        <div className="pb-2.5 border-b border-slate-200 dark:border-slate-700 flex items-start justify-between gap-3">
          <div>
            <div className="font-black text-slate-900 dark:text-white text-sm">
              {config.legalName}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              businessfranchise.truedealglobal.com · {config.officialEmail}
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 block">
              Verified Paid
            </span>
            <span className="text-lg font-black font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
              ₹{receipt.amountINR.toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        {/* Receipt & Application Metadata */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-500">Official Receipt No</span>
            <span className="flex items-center gap-1.5 font-mono font-bold text-slate-900 dark:text-slate-100">
              <span>{receipt.receiptNumber}</span>
              <button
                type="button"
                onClick={() => copyValue('receipt', receipt.receiptNumber)}
                className="no-print text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 cursor-pointer"
                title="Copy Receipt Number"
              >
                {copiedKey === 'receipt' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-500">Application Reference</span>
            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
              {receipt.applicationId}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-500">Applicant Name</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {receipt.applicantName}
            </span>
          </div>

          {receipt.applicantEmail && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500">Applicant Email</span>
              <span className="text-slate-700 dark:text-slate-300 break-all text-right">
                {receipt.applicantEmail}
              </span>
            </div>
          )}

          {receipt.applicantPhone && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500">Mobile Number</span>
              <span className="font-mono text-slate-700 dark:text-slate-300">
                {receipt.applicantPhone}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-500">Franchise Package</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100 text-right">
              {receipt.planTitle || plan?.title || receipt.planId}
            </span>
          </div>

          {plan?.validity && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500">License Validity</span>
              <span className="text-slate-700 dark:text-slate-300">{plan.validity}</span>
            </div>
          )}
        </div>

        {/* Gateway References */}
        <div className="pt-2.5 border-t border-slate-200 dark:border-slate-700 space-y-2">
          {receipt.razorpayPaymentId && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500">Razorpay Payment ID</span>
              <span className="flex items-center gap-1.5 font-mono font-bold text-slate-900 dark:text-slate-100">
                <span>{receipt.razorpayPaymentId}</span>
                <button
                  type="button"
                  onClick={() => copyValue('payId', receipt.razorpayPaymentId)}
                  className="no-print text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 cursor-pointer"
                  title="Copy Razorpay Payment ID"
                >
                  {copiedKey === 'payId' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </span>
            </div>
          )}

          {receipt.razorpayOrderId && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500">Razorpay Order ID</span>
              <span className="flex items-center gap-1.5 font-mono text-slate-700 dark:text-slate-300">
                <span>{receipt.razorpayOrderId}</span>
                <button
                  type="button"
                  onClick={() => copyValue('orderId', receipt.razorpayOrderId)}
                  className="no-print text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 cursor-pointer"
                  title="Copy Razorpay Order ID"
                >
                  {copiedKey === 'orderId' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </span>
            </div>
          )}

          {!receipt.razorpayPaymentId && receipt.referenceCode && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500">Transaction Reference</span>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                {receipt.referenceCode}
              </span>
            </div>
          )}

          {receipt.paymentMethodDetails && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500">Payment Method</span>
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {receipt.paymentMethodDetails}
              </span>
            </div>
          )}
        </div>

        {/* Fee Breakdown */}
        <div className="pt-2.5 border-t border-slate-200 dark:border-slate-700 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-500">Base Franchise Fee</span>
            <span className="font-mono text-slate-800 dark:text-slate-200">
              ₹{baseINR.toLocaleString('en-IN')} INR
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-500">Tax / GST</span>
            <span className="text-slate-700 dark:text-slate-300 text-right">
              {gstINR > 0 ? `₹${gstINR.toLocaleString('en-IN')} INR` : fallbackBreakdown.gstLabel}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-dashed border-slate-300 dark:border-slate-600 font-bold text-slate-900 dark:text-white">
            <span>Total Paid (INR)</span>
            <span className="font-mono text-emerald-700 dark:text-emerald-400">
              ₹{receipt.amountINR.toLocaleString('en-IN')} INR
            </span>
          </div>
        </div>
      </div>

      {/* Compliance Notice */}
      <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 text-[11px] text-indigo-900 dark:text-indigo-200 text-left flex items-start gap-2">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-indigo-600 dark:text-indigo-400" />
        <span>
          <strong>Important:</strong> Payment confirmation is separate from franchise approval. Your application
          remains queued for administrative compliance verification and Franchise Agreement execution.
        </span>
      </div>

      {/* Action Buttons (Hidden in Print Output) */}
      <div className="no-print flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => window.print()}
          className="flex-1 min-w-[130px] py-2.5 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Print Receipt</span>
        </button>

        <button
          type="button"
          onClick={handleDownloadTextReceipt}
          className="flex-1 min-w-[130px] py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download Receipt</span>
        </button>

        {onOpenTracker && (
          <button
            type="button"
            onClick={onOpenTracker}
            className="flex-1 min-w-[150px] py-2.5 px-3 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Open Tracker</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-w-[130px] py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl cursor-pointer"
          >
            {closeLabel}
          </button>
        )}
      </div>
    </div>
  );
}
