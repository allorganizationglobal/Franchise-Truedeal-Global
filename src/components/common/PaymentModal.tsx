import { useState } from 'react';
import {
  CreditCard,
  Building2,
  ShieldCheck,
  CheckCircle2,
  Download,
  Printer,
  X,
  Lock,
  QrCode,
  Smartphone,
  Globe,
  Copy,
  Check,
  ExternalLink,
  Coins
} from 'lucide-react';
import { FranchiseApplication, PaymentRecord, Currency } from '../../types/franchise';
import { FranchiseStorageService } from '../../services/storage';
import { NotificationService } from '../../services/notificationService';
import { playApprovalSuccessSound } from '../../utils/audio';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  application: FranchiseApplication;
  paymentType: 'application_fee' | 'franchise_deposit';
  amount: number;
  currency?: Currency;
  onPaymentSuccess?: (payment: PaymentRecord) => void;
}

export function PaymentModal({
  isOpen,
  onClose,
  application,
  paymentType,
  amount,
  currency = 'INR',
  onPaymentSuccess
}: PaymentModalProps) {
  // Methods: If INR -> upi, card, netbanking; If USD -> card, ach, escrow_wire
  const [method, setMethod] = useState<'upi' | 'card' | 'netbanking' | 'ach' | 'escrow_wire'>(
    currency === 'INR' ? 'upi' : 'card'
  );

  // QR Code Tab Selector: Bank of Baroda (Primary) / IDBI / Binance Crypto
  const [selectedQrTab, setSelectedQrTab] = useState<'bob' | 'idbi' | 'binance'>('bob');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [utrNumber, setUtrNumber] = useState<string>('');

  // Form states
  const [upiId, setUpiId] = useState('truedeal.partner@barodampay');
  const [cardNumber, setCardNumber] = useState('4242 8891 0023 9102');
  const [cardExpiry, setCardExpiry] = useState('09/29');
  const [cardCvc, setCardCvc] = useState('883');
  const [billingName, setBillingName] = useState(application.applicant.fullName);
  const [bankRouting, setBankRouting] = useState('021000021');
  const [bankAccount, setBankAccount] = useState('98120491823');
  const [selectedBank, setSelectedBank] = useState('Bank of Baroda');
  const [processing, setProcessing] = useState(false);
  const [completedPayment, setCompletedPayment] = useState<PaymentRecord | null>(null);

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2500);
  };

  if (!isOpen) return null;

  const displayCurrency = currency;
  const currencySymbol = currency === 'INR' ? '₹' : '$';

  const handlePay = (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);

    const isOfflineBankTransfer = method === 'upi' || method === 'netbanking' || method === 'escrow_wire';
    const paymentStatus: 'completed' | 'processing' = isOfflineBankTransfer ? 'processing' : 'completed';
    const effectiveRef = utrNumber.trim()
      ? utrNumber.trim().toUpperCase()
      : `TDG-${paymentType === 'application_fee' ? 'FEE' : 'PLAN'}-${application.id.replace('TDG-2026-', '')}`;

    setTimeout(() => {
      setProcessing(false);
      const newPayment: PaymentRecord = {
        id: 'pay_' + Math.random().toString(36).substring(2, 9),
        applicationId: application.id,
        type: paymentType,
        amount,
        currency,
        method: (method === 'upi' || method === 'netbanking') ? 'ach' : method,
        status: paymentStatus,
        transactionHash: 'tx_0x' + Array.from(crypto.getRandomValues(new Uint8Array(12))).map(b => b.toString(16).padStart(2, '0')).join(''),
        referenceCode: effectiveRef,
        timestamp: new Date().toISOString(),
        receiptNumber: 'REC-2026-' + Math.floor(1000 + Math.random() * 9000),
        cardLast4: method === 'card' ? cardNumber.slice(-4) : undefined,
        billingName: billingName || application.applicant.fullName
      };

      FranchiseStorageService.addPayment(application.id, newPayment);

      if (paymentType === 'franchise_deposit') {
        if (paymentStatus === 'completed') {
          FranchiseStorageService.updateApplicationStatus(
            application.id,
            'deposit_paid',
            application.applicant.email,
            'applicant',
            `Franchise joining fee ${currencySymbol}${amount.toLocaleString()} cleared successfully.`
          );
        } else {
          FranchiseStorageService.updateApplicationStatus(
            application.id,
            application.status,
            application.applicant.email,
            'applicant',
            `Offline Bank Transfer / UTR reference "${effectiveRef}" submitted for joining fee of ${currencySymbol}${amount.toLocaleString()}. Pending administrative bank statement reconciliation.`
          );
        }
      }

      if (paymentStatus === 'completed') {
        NotificationService.sendAutomatedEmail(application, 'payment_confirmed');
        NotificationService.addNotification(
          `Payment Cleared (${currencySymbol}${amount.toLocaleString()} ${currency})`,
          `Payment reference ${newPayment.referenceCode} confirmed for ${application.applicant.fullName}`,
          'success',
          application.id
        );
      } else {
        NotificationService.addNotification(
          `Payment Submitted for Verification (${currencySymbol}${amount.toLocaleString()} ${currency})`,
          `Bank reference ${newPayment.referenceCode} received. An administrator will verify the funds within 2-4 business hours.`,
          'info',
          application.id
        );
      }

      playApprovalSuccessSound();
      setCompletedPayment(newPayment);
      onPaymentSuccess?.(newPayment);
    }, 1400);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-7 max-h-[92vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {!completedPayment ? (
          <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {paymentType === 'application_fee' ? 'Franchise Registration Deposit' : 'Franchise Plan Joining Fee'}
                </h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  App #{application.id} · {application.territoryRequested}
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500 dark:text-slate-400 block">Total Due ({currency})</span>
                <span className="text-2xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                  {currencySymbol}{amount.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Currency Context Notice */}
            {currency === 'USD' && (
              <div className="mb-4 p-2.5 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-800 dark:text-indigo-300 flex items-center gap-2">
                <Globe className="w-4 h-4 shrink-0" />
                <span>
                  USD International Billing: Standard +10% cross-border licensing rate included.
                </span>
              </div>
            )}

            {/* Payment Method Selector */}
            <div className="grid grid-cols-3 gap-2 mb-5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              {currency === 'INR' ? (
                <>
                  <button
                    type="button"
                    onClick={() => setMethod('upi')}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                      method === 'upi'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>UPI / QR</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMethod('card')}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                      method === 'card'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Card / RuPay</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMethod('netbanking')}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                      method === 'netbanking'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>NetBanking</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setMethod('card')}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                      method === 'card'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Global Card</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMethod('ach')}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                      method === 'ach'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>ACH / Bank</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMethod('escrow_wire')}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                      method === 'escrow_wire'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>SWIFT Wire</span>
                  </button>
                </>
              )}
            </div>

            {/* Form */}
            <form onSubmit={handlePay} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Applicant / Billing Name
                </label>
                <input
                  type="text"
                  required
                  value={billingName}
                  onChange={e => setBillingName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {method === 'upi' && (
                <div className="space-y-4">
                  {/* QR Selector Switch */}
                  <div className="flex items-center justify-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl gap-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setSelectedQrTab('bob')}
                      className={`flex-1 py-1.5 px-3 rounded-lg font-semibold transition-all ${
                        selectedQrTab === 'bob'
                          ? 'bg-orange-500 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      Bank of Baroda UPI
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedQrTab('idbi')}
                      className={`flex-1 py-1.5 px-3 rounded-lg font-semibold transition-all ${
                        selectedQrTab === 'idbi'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      IDBI Bank UPI
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedQrTab('binance')}
                      className={`flex-1 py-1.5 px-3 rounded-lg font-semibold transition-all ${
                        selectedQrTab === 'binance'
                          ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      Binance Pay QR
                    </button>
                  </div>

                  {/* Selected QR Code Display */}
                  <div className="text-center p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <div className="relative inline-block mx-auto mb-3">
                      <img
                        src={
                          selectedQrTab === 'bob'
                            ? '/assets/bank_of_baroda_qr.png'
                            : selectedQrTab === 'idbi'
                            ? '/assets/idbi_qr.png'
                            : '/assets/binance_qr.png'
                        }
                        alt={
                          selectedQrTab === 'bob'
                            ? 'Bank of Baroda QR Code'
                            : selectedQrTab === 'idbi'
                            ? 'IDBI Bank QR Code'
                            : 'Binance Pay QR'
                        }
                        className="w-48 h-48 object-contain rounded-xl bg-white p-2 shadow-md border-2 border-slate-200 dark:border-slate-700"
                      />
                      <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-sm flex items-center gap-1 whitespace-nowrap">
                        <ShieldCheck className="w-3 h-3" />
                        <span>Official Verified Corporate A/C</span>
                      </div>
                    </div>

                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-3">
                      {selectedQrTab === 'bob'
                        ? 'Scan with Google Pay, PhonePe, Paytm, BHIM, Cred or Bank App'
                        : selectedQrTab === 'idbi'
                        ? 'Scan to Pay via IDBI Bank Merchant Gateway'
                        : 'Scan with Binance App (USDT / BUSD Multi-Chain)'}
                    </p>
                  </div>

                  {/* Official Beneficiary & Bank Details Box */}
                  <div className="p-4 bg-orange-50/70 dark:bg-orange-950/40 rounded-xl border border-orange-200 dark:border-orange-800/60 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between pb-1.5 border-b border-orange-200/80 dark:border-orange-800/50">
                      <span className="font-bold text-orange-950 dark:text-orange-200 flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                        Official Beneficiary & Corporate Bank Details
                      </span>
                      <span className="text-[10px] bg-orange-200/80 dark:bg-orange-900/60 text-orange-900 dark:text-orange-200 px-2 py-0.5 rounded font-mono font-bold">
                        CURRENT A/C
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-slate-800 dark:text-slate-200">
                      <div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Billing Name / Beneficiary:</span>
                        <div className="flex items-center gap-1 font-bold text-slate-950 dark:text-slate-50 text-xs">
                          <span>TRUEDEAL GLOBAL OPC PVT LTD</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard('TRUEDEAL GLOBAL OPC PVT LTD', 'name')}
                            className="text-orange-600 hover:text-orange-700 p-0.5"
                            title="Copy Beneficiary Name"
                          >
                            {copiedField === 'name' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Bank Name:</span>
                        <span className="font-bold text-slate-950 dark:text-slate-50">BANK OF BARODA</span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Current Account Number:</span>
                        <div className="flex items-center gap-1 font-mono font-bold text-slate-950 dark:text-slate-50 text-sm">
                          <span>26290200001514</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard('26290200001514', 'ac')}
                            className="text-orange-600 hover:text-orange-700 p-0.5"
                            title="Copy Account Number"
                          >
                            {copiedField === 'ac' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block">IFSC Code:</span>
                        <div className="flex items-center gap-1 font-mono font-bold text-slate-950 dark:text-slate-50">
                          <span>BARB0NOIDAX</span>
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-sans font-semibold">(5th Letter is Zero)</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard('BARB0NOIDAX', 'ifsc')}
                            className="text-orange-600 hover:text-orange-700 p-0.5"
                            title="Copy IFSC Code"
                          >
                            {copiedField === 'ifsc' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* UTR / Transaction Reference Input */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      UPI UTR / Bank Reference No (After Scanning)
                    </label>
                    <input
                      type="text"
                      required
                      value={utrNumber}
                      onChange={e => setUtrNumber(e.target.value)}
                      placeholder="e.g. 429182049102 or UPI Transaction ID"
                      className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      Enter the 12-digit UTR from Google Pay / PhonePe / Paytm / Bank app for immediate verification
                    </span>
                  </div>
                </div>
              )}

              {method === 'card' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Card Number
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={cardNumber}
                        onChange={e => setCardNumber(e.target.value)}
                        placeholder="4242 4242 4242 4242"
                        className="w-full pl-3 pr-10 py-2 text-sm font-mono tabular-nums bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <CreditCard className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Expiry Date
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="MM/YY"
                        value={cardExpiry}
                        onChange={e => setCardExpiry(e.target.value)}
                        className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        CVV
                      </label>
                      <input
                        type="password"
                        required
                        maxLength={4}
                        placeholder="123"
                        value={cardCvc}
                        onChange={e => setCardCvc(e.target.value)}
                        className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </>
              )}

              {method === 'netbanking' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Select Your Bank
                  </label>
                  <select
                    value={selectedBank}
                    onChange={e => setSelectedBank(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="HDFC Bank">HDFC Bank</option>
                    <option value="ICICI Bank">ICICI Bank</option>
                    <option value="State Bank of India">State Bank of India (SBI)</option>
                    <option value="Axis Bank">Axis Bank</option>
                    <option value="Kotak Mahindra Bank">Kotak Mahindra Bank</option>
                    <option value="Punjab National Bank">Punjab National Bank</option>
                  </select>
                </div>
              )}

              {method === 'ach' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Bank Routing Number
                    </label>
                    <input
                      type="text"
                      required
                      value={bankRouting}
                      onChange={e => setBankRouting(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Checking Account Number
                    </label>
                    <input
                      type="text"
                      required
                      value={bankAccount}
                      onChange={e => setBankAccount(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </>
              )}

              {method === 'escrow_wire' && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                  <span className="font-semibold text-slate-900 dark:text-slate-100 block">TrueDeal Global Escrow Account:</span>
                  <p className="text-slate-600 dark:text-slate-400 font-mono">SWIFT / BIC: TRUEDEALINBB</p>
                  <p className="text-slate-600 dark:text-slate-400 font-mono">Beneficiary: TrueDeal Global Holdings Private Limited</p>
                </div>
              )}

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Direct encrypted connection to TrueDeal Global gateway. Lifetime franchise agreement guarantee.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={processing}
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {processing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Verifying & Processing Payment...</span>
                    </>
                  ) : (
                    <span>Pay {currencySymbol}{amount.toLocaleString()} {currency}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* Receipt Screen */
          <div className="py-2 text-center space-y-5 animate-fade-in">
            <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Payment Received & Confirmed
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Receipt #{completedPayment.receiptNumber} · Official TrueDeal Global Franchise Fee
              </p>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5 text-xs text-left">
              <div className="flex justify-between">
                <span className="text-slate-500">Beneficiary / Billing Entity</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">TRUEDEAL GLOBAL OPC PVT LTD</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Corporate Bank</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">BANK OF BARODA · A/C 26290200001514</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Amount Paid</span>
                <span className="font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 text-sm">
                  {currencySymbol}{completedPayment.amount.toLocaleString()} {completedPayment.currency}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Reference Code</span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{completedPayment.referenceCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Channel / Rail</span>
                <span className="text-slate-900 dark:text-slate-100 capitalize">{completedPayment.method.replace('_', ' ')} (Bank Verified)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Transaction Hash</span>
                <span className="font-mono text-slate-600 dark:text-slate-400 truncate max-w-[200px]">
                  {completedPayment.transactionHash}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Timestamp</span>
                <span className="text-slate-900 dark:text-slate-100">
                  {new Date(completedPayment.timestamp).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="flex-1 py-2.5 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Official Receipt</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-colors"
              >
                Return to Portal
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
