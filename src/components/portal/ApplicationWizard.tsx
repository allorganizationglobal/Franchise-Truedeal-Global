import { useState, useRef, useEffect } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Upload,
  FileText,
  Lock,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  CreditCard,
  DollarSign,
  Building,
  User,
  Sparkles,
  Zap,
  Clock,
  Fingerprint,
  ScanFace,
  QrCode
} from 'lucide-react';
import {
  FranchisePlan,
  FranchiseApplication,
  DocumentUpload,
  PaymentRecord,
  AutomatedScoringResult,
  BiometricEnrollmentData,
  Currency
} from '../../types/franchise';
import { FRANCHISE_PLANS, evaluateFranchiseApplication, FranchiseStorageService, USD_INR_RATE, USD_SURCHARGE_PCT } from '../../services/storage';
import { encryptFilePayload } from '../../utils/crypto';
import { NotificationService } from '../../services/notificationService';
import { PaymentModal } from '../common/PaymentModal';
import { BiometricSetupModal } from '../common/BiometricSetupModal';
import { playApprovalSuccessSound } from '../../utils/audio';
import confetti from 'canvas-confetti';

interface ApplicationWizardProps {
  initialPlanId?: string;
  currency?: Currency;
  onToggleCurrency?: (c: Currency) => void;
  onApplicationCreated: (app: FranchiseApplication) => void;
  onNavigateToTracker: (appId: string) => void;
}

export function ApplicationWizard({
  initialPlanId = 'plan_standard',
  currency = 'INR',
  onToggleCurrency,
  onApplicationCreated,
  onNavigateToTracker
}: ApplicationWizardProps) {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [selectedPlanId, setSelectedPlanId] = useState<string>(initialPlanId);
  const [currentCurrency, setCurrentCurrency] = useState<Currency>(currency);

  useEffect(() => {
    setCurrentCurrency(currency);
  }, [currency]);

  const [territoryRequested, setTerritoryRequested] = useState('Noida / Delhi-NCR Metro, India');
  const [preferredStartDate, setPreferredStartDate] = useState('2026-07-01');

  // Applicant Profile
  const [fullName, setFullName] = useState('Chandan Kumar');
  const [email, setEmail] = useState('applicant@truedealpartner.com');
  const [phone, setPhone] = useState('+91 98765 43210');
  const [companyName, setCompanyName] = useState('');
  const [entityType, setEntityType] = useState<FranchiseApplication['applicant']['entityType']>('individual');
  const [country, setCountry] = useState('India');
  const [stateProvince, setStateProvince] = useState('Uttar Pradesh / Delhi-NCR');
  const [city, setCity] = useState('Noida');
  const [postalCode, setPostalCode] = useState('201301');

  // Biometric Enrollment State
  const [showBiometricSetupModal, setShowBiometricSetupModal] = useState<boolean>(false);
  const [applicantBiometrics, setApplicantBiometrics] = useState<BiometricEnrollmentData | null>(null);

  // Financials
  const [liquidCapital, setLiquidCapital] = useState<number>(150000);
  const [netWorth, setNetWorth] = useState<number>(550000);
  const [creditScoreTier, setCreditScoreTier] = useState<FranchiseApplication['financials']['creditScoreTier']>('750_plus');
  const [fundingSource, setFundingSource] = useState<FranchiseApplication['financials']['fundingSource']>('cash_savings');
  const [operationalExperienceYears, setOperationalExperienceYears] = useState<number>(8);
  const [businessBackgroundSummary, setBusinessBackgroundSummary] = useState(
    '10+ years scaling regional specialty commercial outlets, executive logistics, and customer retention programs.'
  );

  // Documents
  const [documents, setDocuments] = useState<DocumentUpload[]>([]);
  const [encryptingDoc, setEncryptingDoc] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedDocType, setSelectedDocType] = useState<DocumentUpload['type']>('gov_id');

  // Payment
  const [paymentCompleted, setPaymentCompleted] = useState<boolean>(false);
  const [paymentRecord, setPaymentRecord] = useState<PaymentRecord | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);

  // Automated scoring & Submission
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<FranchiseApplication | null>(null);

  const selectedPlan = FRANCHISE_PLANS.find(p => p.id === selectedPlanId) || FRANCHISE_PLANS[0];

  // Document upload with client-side WebCrypto AES-GCM-256 encryption
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setEncryptingDoc(true);
    try {
      const buffer = await file.arrayBuffer();
      const encryptionResult = await encryptFilePayload(buffer, file.name);

      const newDoc: DocumentUpload = {
        id: 'doc_' + Math.random().toString(36).substring(2, 9),
        type: selectedDocType,
        name: file.name + '.enc',
        sizeBytes: file.size,
        mimeType: file.type || 'application/octet-stream',
        uploadedAt: new Date().toISOString(),
        status: 'pending_audit',
        isEncrypted: true,
        encryptionAlgorithm: 'AES-GCM-256',
        cipherChecksum: encryptionResult.cipherChecksum,
        ivHex: encryptionResult.ivHex,
      };

      setDocuments(prev => [...prev, newDoc]);
      NotificationService.addNotification(
        'Document Encrypted & Vaulted',
        `File ${file.name} encrypted with AES-GCM-256 (Checksum: ${encryptionResult.cipherChecksum.substring(0, 10)}...)`,
        'success'
      );
    } catch (err) {
      console.error('Encryption failed:', err);
    } finally {
      setEncryptingDoc(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Automated Scoring Preview
  const previewScore = evaluateFranchiseApplication(
    selectedPlan,
    { liquidCapital, netWorth, creditScoreTier, fundingSource },
    operationalExperienceYears
  );

  // Final Submit
  const handleFinalSubmit = async () => {
    setIsSubmitting(true);

    const applicationId = 'TDG-2026-' + Math.floor(100 + Math.random() * 900);
    const finalScore = evaluateFranchiseApplication(
      selectedPlan,
      { liquidCapital, netWorth, creditScoreTier, fundingSource },
      operationalExperienceYears
    );

    const newApp: FranchiseApplication = {
      id: applicationId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      applicant: {
        fullName,
        email,
        phone,
        companyName,
        country,
        stateProvince,
        city,
        postalCode,
        entityType
      },
      financials: {
        liquidCapital,
        netWorth,
        creditScoreTier,
        fundingSource
      },
      planId: selectedPlanId,
      currency: currentCurrency,
      territoryRequested,
      preferredStartDate,
      operationalExperienceYears,
      businessBackgroundSummary,
      status: finalScore.preliminaryVerdict === 'auto_approved' ? 'automated_verified' : 'submitted',
      automatedEvaluation: finalScore,
      documents,
      payments: paymentRecord ? [paymentRecord] : [],
      reviewNotes: [],
      applicantBiometricEnrollment: applicantBiometrics || undefined
    };

    setTimeout(() => {
      FranchiseStorageService.saveApplication(newApp);
      NotificationService.sendAutomatedEmail(newApp, 'application_submitted');
      if (finalScore.preliminaryVerdict === 'auto_approved') {
        NotificationService.sendAutomatedEmail(newApp, 'automated_passed');
      }

      setIsSubmitting(false);
      setSubmissionResult(newApp);
      onApplicationCreated(newApp);

      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch {}

      playApprovalSuccessSound();
    }, 1200);
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      {/* Wizard Progress Steps Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <span>Step {currentStep} of 6</span>
          <span className="text-slate-900 dark:text-slate-100">
            {currentStep === 1 && '1. Plan & Territory Selection'}
            {currentStep === 2 && '2. Applicant & Legal Entity'}
            {currentStep === 3 && '3. Financial Qualifications'}
            {currentStep === 4 && '4. Secure Document Vault'}
            {currentStep === 5 && '5. Processing & Due Diligence'}
            {currentStep === 6 && '6. Automated Rule Evaluation'}
          </span>
        </div>
        <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-600 transition-all duration-300"
            style={{ width: `${(currentStep / 6) * 100}%` }}
          />
        </div>
      </div>

      {!submissionResult ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-6 sm:p-8">
          {/* STEP 1: Plan & Territory */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">
                    Select Franchise Plan & Territory Scope
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Choose the official franchise tier matching your business ambitions and investment capacity.
                  </p>
                </div>

                {/* Inline Currency Switcher */}
                <div className="inline-flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentCurrency('INR');
                      onToggleCurrency?.('INR');
                    }}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                      currentCurrency === 'INR'
                        ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    <span>🇮🇳 INR (₹)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentCurrency('USD');
                      onToggleCurrency?.('USD');
                    }}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                      currentCurrency === 'USD'
                        ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    <span>🌐 USD ($)</span>
                    <span className="text-[10px] bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 px-1 rounded font-normal">
                      +10%
                    </span>
                  </button>
                </div>
              </div>

              {currentCurrency === 'USD' && (
                <div className="p-3 bg-indigo-50/80 dark:bg-indigo-950/40 rounded-xl border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>
                    USD pricing applies 1 USD ≈ ₹{USD_INR_RATE.toFixed(2)} with standard +{USD_SURCHARGE_PCT}% international cross-border processing rate.
                  </span>
                </div>
              )}

              {/* All 8 Plan Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {FRANCHISE_PLANS.map(plan => {
                  const isSelected = selectedPlanId === plan.id;
                  const priceFormatted = currentCurrency === 'INR'
                    ? '₹' + plan.priceINR.toLocaleString('en-IN')
                    : '$' + plan.priceUSD.toLocaleString('en-US') + ' USD';

                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => setSelectedPlanId(plan.id)}
                      className={`p-4 rounded-xl border-t-4 text-left transition-all relative ${
                        plan.color || 'border-indigo-600'
                      } ${
                        isSelected
                          ? 'border-x-indigo-600 border-b-indigo-600 dark:border-x-indigo-500 dark:border-b-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/30 ring-2 ring-indigo-500/20 shadow-sm'
                          : 'border-x-slate-200 border-b-slate-200 dark:border-x-slate-800 dark:border-b-slate-800 bg-white dark:bg-slate-800/40 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-extrabold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                          {plan.badge}
                        </span>
                        <span className="text-sm font-black font-mono text-slate-900 dark:text-slate-100">
                          {priceFormatted}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{plan.title}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                        {plan.subtitle}
                      </p>
                      <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">{plan.commissionRate}</span>
                        <span className="text-slate-400">{plan.validity}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="sm:col-span-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      Requested Territory or Metro Area
                    </label>
                    <span className="text-[11px] text-slate-400">
                      Global & Indian territories available · Change anytime
                    </span>
                  </div>
                  <input
                    type="text"
                    required
                    value={territoryRequested}
                    onChange={e => setTerritoryRequested(e.target.value)}
                    placeholder="e.g. Noida / Delhi-NCR, Mumbai, Bengaluru, Dubai, London, Dallas"
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                  {/* Quick Select Territory Chips */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mr-1">
                      Quick Pick:
                    </span>
                    {[
                      'Noida / Delhi-NCR Metro, India',
                      'Mumbai Metro, India',
                      'Bengaluru Urban, India',
                      'Hyderabad Metro, India',
                      'Pune, India',
                      'Kolkata, India',
                      'Dubai & GCC, UAE',
                      'Dallas-Fort Worth, USA',
                      'London & South East, UK'
                    ].map(cityPreset => (
                      <button
                        key={cityPreset}
                        type="button"
                        onClick={() => setTerritoryRequested(cityPreset)}
                        className={`text-[11px] px-2 py-0.5 rounded-md border transition-all ${
                          territoryRequested === cityPreset
                            ? 'bg-indigo-600 text-white border-indigo-600 font-semibold shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                        }`}
                      >
                        {cityPreset.split(',')[0]}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Target Launch Date
                  </label>
                  <input
                    type="date"
                    required
                    value={preferredStartDate}
                    onChange={e => setPreferredStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Applicant Profile & Legal Entity */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">
                  Applicant Profile & Corporate Structure
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Provide primary franchisee details. All personal data is encrypted in compliance with GDPR & US Privacy standards.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Primary Applicant Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Email Address (For Status Updates)
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Direct Phone Number
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Entity Type
                  </label>
                  <select
                    value={entityType}
                    onChange={e => {
                      const val = e.target.value as any;
                      setEntityType(val);
                      if (val === 'individual') {
                        setCompanyName('');
                      }
                    }}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    <option value="individual">Individual</option>
                    <option value="opc">One Person Company (OPC Pvt Ltd)</option>
                    <option value="pvt_ltd">Private Limited Company (Pvt Ltd)</option>
                    <option value="llc">Limited Liability Company (LLP / LLC)</option>
                    <option value="corporation">Corporation (C-Corp / S-Corp)</option>
                    <option value="partnership">Partnership Firm</option>
                  </select>
                </div>
                {entityType !== 'individual' && (
                  <div className="sm:col-span-2 animate-fade-in">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Registered Company / Operating Entity Name
                    </label>
                    <input
                      type="text"
                      required
                      value={companyName}
                      onChange={e => setCompanyName(e.target.value)}
                      placeholder="e.g. Apex Frontier Partners LLC or Global Zonal Ventures Pvt Ltd"
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    City & State
                  </label>
                  <input
                    type="text"
                    value={`${city}, ${stateProvince}`}
                    onChange={e => {
                      const parts = e.target.value.split(',');
                      setCity(parts[0]?.trim() || '');
                      setStateProvince(parts[1]?.trim() || '');
                    }}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Country
                  </label>
                  <input
                    type="text"
                    value={country}
                    onChange={e => setCountry(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Enhanced Platform Security & Biometric Enclave Enrollment */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                        {applicantBiometrics?.modality === 'face_id' ? (
                          <ScanFace className="w-5 h-5" />
                        ) : (
                          <Fingerprint className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                            Biometric Authentication Enrollment
                          </h4>
                          {applicantBiometrics?.enrolled ? (
                            <span className="text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded">
                              Enrolled Active
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded">
                              Recommended
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 max-w-md">
                          {applicantBiometrics?.enrolled
                            ? `Secured via ${applicantBiometrics.modality === 'face_id' ? 'Face ID / Facial Recognition' : 'Touch ID / Fingerprint'}. Credential: ${applicantBiometrics.credentialId.slice(0, 18)}...`
                            : 'Enroll your fingerprint or face data to securely sign franchise contracts, approve capital deposits, and prevent identity spoofing.'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowBiometricSetupModal(true)}
                      className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap shadow-sm shrink-0 ${
                        applicantBiometrics?.enrolled
                          ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-300'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      }`}
                    >
                      <Fingerprint className="w-3.5 h-3.5" />
                      <span>{applicantBiometrics?.enrolled ? 'Re-enroll / Change' : 'Enroll Biometrics'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Financial Qualifications */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">
                  Financial Qualifications & Liquidity Profile
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Required by TrueDeal Global compliance to calculate preliminary automated approval score.
                </p>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-500 block">Selected Tier Minimums:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    Joining Fee: {currentCurrency === 'INR' ? '₹' + selectedPlan.priceINR.toLocaleString('en-IN') : '$' + selectedPlan.priceUSD.toLocaleString('en-US') + ' USD'} · Payout Rate: {selectedPlan.commissionRate}
                  </span>
                </div>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                  Rule Engine Ready
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Liquid Capital Available (Cash / Savings / Marketable Securities)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-400 text-sm">$</span>
                    <input
                      type="number"
                      required
                      value={liquidCapital}
                      onChange={e => setLiquidCapital(Number(e.target.value))}
                      className="w-full pl-7 pr-3 py-2 text-sm font-mono tabular-nums bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Total Estimated Net Worth
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-400 text-sm">$</span>
                    <input
                      type="number"
                      required
                      value={netWorth}
                      onChange={e => setNetWorth(Number(e.target.value))}
                      className="w-full pl-7 pr-3 py-2 text-sm font-mono tabular-nums bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Credit Rating Tier
                  </label>
                  <select
                    value={creditScoreTier}
                    onChange={e => setCreditScoreTier(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="750_plus">Tier 1 Prime (750+ FICO Score)</option>
                    <option value="700_749">Tier 2 Good (700 - 749 FICO Score)</option>
                    <option value="650_699">Tier 3 Fair (650 - 699 FICO Score)</option>
                    <option value="below_650">Sub-Prime (&lt; 650 FICO Score)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Years of Business / Retail Experience
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={operationalExperienceYears}
                    onChange={e => setOperationalExperienceYears(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Business Background & Management Summary
                  </label>
                  <textarea
                    rows={3}
                    value={businessBackgroundSummary}
                    onChange={e => setBusinessBackgroundSummary(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Secure Document Uploading */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">
                  Secure Document Vault (Client-Side AES-GCM Encrypted)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Documents are encrypted in memory on your device before transfer. Checksums ensure complete tamper-evident auditability.
                </p>
              </div>

              {/* Upload trigger panel */}
              <div className="p-6 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl bg-slate-50/50 dark:bg-slate-800/30 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileUpload}
                  className="hidden"
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                />

                <div className="max-w-md mx-auto space-y-3">
                  <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
                    <Lock className="w-6 h-6" />
                  </div>

                  <div>
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                      Select Document Category to Encrypt:
                    </span>
                    <select
                      value={selectedDocType}
                      onChange={e => setSelectedDocType(e.target.value as any)}
                      className="px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-3"
                    >
                      <option value="gov_id">Government Photo ID / Passport</option>
                      <option value="proof_of_funds">Proof of Funds / Bank Statement</option>
                      <option value="tax_returns">Corporate / Personal Tax Returns</option>
                      <option value="business_plan">Executive Business Plan</option>
                      <option value="fdd_signed">Signed FDD Acknowledgment</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    disabled={encryptingDoc}
                    onClick={() => fileInputRef.current?.click()}
                    className="py-2.5 px-5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 mx-auto disabled:opacity-50"
                  >
                    {encryptingDoc ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Encrypting File (AES-GCM-256)...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        <span>Select File to Encrypt & Upload</span>
                      </>
                    )}
                  </button>
                  <p className="text-[11px] text-slate-400">
                    Supports PDF, PNG, JPG (up to 25MB). Auto-generates SHA-256 cryptographic proof.
                  </p>
                </div>
              </div>

              {/* Uploaded Documents List */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                  Encrypted Vault Payloads ({documents.length})
                </span>

                {documents.length === 0 ? (
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
                    No documents uploaded yet. You may upload now or add them later in your applicant portal.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {documents.map(doc => (
                      <div
                        key={doc.id}
                        className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                              <span>{doc.name}</span>
                              <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.2 rounded font-mono">
                                AES-GCM
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-400 font-mono truncate block max-w-xs">
                              SHA-256: {doc.cipherChecksum.substring(0, 24)}...
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium block">
                            Vault Encrypted
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {(doc.sizeBytes / 1024).toFixed(0)} KB
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 5: Integrated Payment Processing */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">
                  Due Diligence & Territory Reservation Fee
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {currentCurrency === 'INR'
                    ? 'A nominal ₹2,500 application filing fee is required to reserve your requested territory and trigger automated AML/KYC background clearance.'
                    : `A nominal $${Math.round((2500 / USD_INR_RATE) * 1.1)} USD application filing fee is required to reserve your requested territory (includes +10% international cross-border processing).`}
                </p>
              </div>

              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-700">
                  <div>
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100 block">
                      Territory Lock & Due Diligence Filing
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Refundable within 14 days if territory allocation cannot be completed
                    </span>
                  </div>
                  <span className="text-2xl font-extrabold font-mono text-slate-900 dark:text-slate-100">
                    {currentCurrency === 'INR' ? '₹2,500' : `$${Math.round((2500 / USD_INR_RATE) * 1.1)}`}{' '}
                    <span className="text-xs font-normal text-slate-500">{currentCurrency}</span>
                  </span>
                </div>

                {/* Official Corporate Banking Card */}
                <div className="p-4 bg-orange-50/70 dark:bg-orange-950/30 rounded-xl border border-orange-200 dark:border-orange-800/60 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-orange-200/80 dark:border-orange-800/50">
                    <div className="flex items-center gap-2">
                      <img src="/assets/truedeal_logo.png" alt="TrueDeal Global" className="h-6 w-auto object-contain" />
                      <span className="text-xs font-bold text-orange-950 dark:text-orange-200">
                        Official Corporate Banking Verification
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded">
                      Bank of Baroda Verified
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Billing Name / Beneficiary:</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">TRUEDEAL GLOBAL OPC PVT LTD</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Bank Name:</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">BANK OF BARODA</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Current Account Number:</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100">26290200001514</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block">IFSC Code:</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                        BARB0NOIDAX <span className="font-sans font-normal text-amber-600 dark:text-amber-400 text-[10px]">(5th is Zero)</span>
                      </span>
                    </div>
                  </div>
                </div>

                {!paymentCompleted ? (
                  <div className="space-y-3 pt-2">
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      Payment rails: {currentCurrency === 'INR' ? 'UPI QR, Bank of Baroda NetBanking, Domestic Cards' : 'International Card, ACH, or SWIFT Wire'}. Instant automated digital receipt and cryptographic transaction hash generated upon authorization.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setShowPaymentModal(true)}
                        className="w-full sm:w-auto py-3 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
                      >
                        <CreditCard className="w-4 h-4" />
                        <span>
                          Process {currentCurrency === 'INR' ? '₹2,500' : `$${Math.round((2500 / USD_INR_RATE) * 1.1)}`} Application Fee
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowPaymentModal(true)}
                        className="w-full sm:w-auto py-3 px-4 bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
                      >
                        <QrCode className="w-4 h-4" />
                        <span>View Bank of Baroda QR Code</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      <div>
                        <span className="font-semibold block">Application Fee Paid & Confirmed</span>
                        <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-300">
                          Ref: {paymentRecord?.referenceCode} · Receipt: {paymentRecord?.receiptNumber}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold">
                      {currentCurrency === 'INR' ? '₹2,500' : `$${Math.round((2500 / USD_INR_RATE) * 1.1)}`} {currentCurrency}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 6: Automated Scoring & Submission */}
          {currentStep === 6 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">
                  Automated Rule Engine Score & Submission
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Our automated algorithm calculates eligibility across liquidity, credit rating, and territory conflicts.
                </p>
              </div>

              {/* Scorecard Display */}
              <div className="p-6 bg-slate-900 text-white rounded-2xl shadow-lg border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-400" />
                    <span className="text-sm font-bold uppercase tracking-wider text-slate-300">
                      TrueDeal Automated Scoring Index
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-3xl font-extrabold font-mono tabular-nums text-white">
                      {previewScore.score}<span className="text-base text-slate-400">/100</span>
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-800 text-xs">
                  <div className="p-3 bg-slate-800/80 rounded-xl">
                    <span className="text-slate-400 block text-[11px]">Liquidity Check</span>
                    <span className={`font-semibold capitalize ${
                      previewScore.liquidityStatus === 'pass' ? 'text-emerald-400' : 'text-amber-400'
                    }`}>
                      {previewScore.liquidityStatus.toUpperCase()}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-800/80 rounded-xl">
                    <span className="text-slate-400 block text-[11px]">Net Worth Multiplier</span>
                    <span className={`font-semibold capitalize ${
                      previewScore.netWorthStatus === 'pass' ? 'text-emerald-400' : 'text-amber-400'
                    }`}>
                      {previewScore.netWorthStatus.toUpperCase()}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-800/80 rounded-xl">
                    <span className="text-slate-400 block text-[11px]">Preliminary Verdict</span>
                    <span className="font-semibold text-indigo-300 capitalize">
                      {previewScore.preliminaryVerdict.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 pt-2">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Automated Verification Notes:
                  </span>
                  <ul className="space-y-1 text-xs text-slate-300">
                    {previewScore.reasons.map((r, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Applicant Review Summary */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Applicant:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{fullName} ({companyName})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Selected Plan:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{selectedPlan.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Requested Territory:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{territoryRequested}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Encrypted Documents:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{documents.length} Files Uploaded</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Biometric Enclave:</span>
                  <span className={`font-semibold ${applicantBiometrics?.enrolled ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                    {applicantBiometrics?.enrolled
                      ? `Enrolled (${applicantBiometrics.modality === 'face_id' ? 'Face ID' : 'Touch ID'})`
                      : 'Not enrolled'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Wizard Controls */}
          <div className="flex items-center justify-between pt-6 mt-6 border-t border-slate-100 dark:border-slate-800">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={() => setCurrentStep(prev => prev - 1)}
                className="py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            ) : <div />}

            {currentStep < 6 ? (
              <button
                type="button"
                onClick={() => setCurrentStep(prev => prev + 1)}
                className="py-2.5 px-5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-all shadow-sm flex items-center gap-1.5"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleFinalSubmit}
                className="py-2.5 px-6 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Submitting Application...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Submit Franchise Application</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Submission Success Screen */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-8 text-center space-y-6 animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
              Franchise Application Registered Successfully!
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Your application has been logged into the TrueDeal Global Franchise Registry with reference code{' '}
              <strong className="font-mono text-slate-800 dark:text-slate-200">{submissionResult.id}</strong>.
            </p>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 max-w-lg mx-auto text-xs text-left space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Applicant:</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{submissionResult.applicant.fullName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Territory:</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{submissionResult.territoryRequested}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Automated Score:</span>
              <span className="font-mono font-bold text-emerald-600">{submissionResult.automatedEvaluation.score}/100</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Initial Verdict:</span>
              <span className="capitalize font-semibold text-indigo-600 dark:text-indigo-400">
                {submissionResult.automatedEvaluation.preliminaryVerdict.replace(/_/g, ' ')}
              </span>
            </div>
          </div>

          <div className="flex gap-3 justify-center pt-2">
            <button
              type="button"
              onClick={() => onNavigateToTracker(submissionResult.id)}
              className="py-2.5 px-6 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-all shadow-md flex items-center gap-2"
            >
              <span>Go to Real-Time Application Tracker</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Embedded Payment Modal for Application Fee */}
      {showPaymentModal && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          application={{
            id: 'PENDING',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            applicant: { fullName, email, phone, companyName, country, stateProvince, city, postalCode, entityType },
            financials: { liquidCapital, netWorth, creditScoreTier, fundingSource },
            planId: selectedPlanId,
            territoryRequested,
            preferredStartDate,
            operationalExperienceYears,
            businessBackgroundSummary,
            status: 'draft',
            automatedEvaluation: previewScore,
            documents: [],
            payments: [],
            reviewNotes: []
          }}
          paymentType="application_fee"
          amount={currentCurrency === 'INR' ? 2500 : Math.round((2500 / USD_INR_RATE) * 1.1)}
          currency={currentCurrency}
          onPaymentSuccess={(rec) => {
            setPaymentCompleted(true);
            setPaymentRecord(rec);
            setShowPaymentModal(false);
          }}
        />
      )}

      {/* Biometric Setup & Enrollment Modal */}
      {showBiometricSetupModal && (
        <BiometricSetupModal
          isOpen={showBiometricSetupModal}
          onClose={() => setShowBiometricSetupModal(false)}
          applicantName={fullName}
          allowSkip={true}
          onComplete={(data) => {
            setApplicantBiometrics(data);
            setShowBiometricSetupModal(false);
            NotificationService.addNotification(
              'Biometrics Enrolled Successfully',
              `Enrolled ${data.modality === 'face_id' ? 'Face ID / Facial Recognition' : 'Touch ID / Fingerprint'} passkey for ${fullName}`,
              'success'
            );
          }}
        />
      )}
    </div>
  );
}
