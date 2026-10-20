export type UserRole =
  | 'super_admin'
  | 'franchise_manager'
  | 'reviewer'
  | 'support_staff'
  | 'applicant'
  | 'director'
  | 'compliance'
  | 'territory_manager';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  territory?: string;
  phone?: string;
  avatarInitials: string;
}

export type Currency = 'INR' | 'USD';

export type FranchisePlanTier =
  | 'basic'
  | 'standard'
  | 'corporate'
  | 'platinum'
  | 'entrepreneur'
  | 'retirement'
  | 'enterprise'
  | 'global'
  | 'global_enterprise';

export interface FranchisePlan {
  id: string;
  tier: FranchisePlanTier;
  title: string;
  badge: string;
  subtitle: string;
  priceINR: number;
  priceUSD: number;
  commissionRate: string;
  referralBonus: string;
  payoutFrequency: string;
  validity: string;
  servicesCovered: string;
  territoryScope: string;
  features: string[];
  idealCandidate: string;
  popular?: boolean;
  label?: string;
  labelColor?: string;
  color?: string;
  btnColor?: string;
}

export type ApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'documents_required'
  | 'due_diligence'
  | 'approved'
  | 'rejected'
  | 'agreement_pending'
  | 'onboarding'
  | 'onboarded'
  | 'automated_verified'
  | 'compliance_review'
  | 'contract_issued'
  | 'deposit_paid'
  | 'revision_requested'
  | 'declined';

export interface AutomatedScoringResult {
  score: number; // 0-100
  liquidityStatus: 'pass' | 'warning' | 'fail';
  netWorthStatus: 'pass' | 'warning' | 'fail';
  creditStatus: 'pass' | 'warning' | 'fail';
  territoryAvailable: boolean;
  backgroundCheckPassed: boolean;
  preliminaryVerdict: 'auto_approved' | 'conditional_fast_track' | 'manual_review_required' | 'waitlist';
  reasons: string[];
  calculatedAt: string;
}

export type DocumentType =
  | 'gov_id'
  | 'proof_of_funds'
  | 'tax_returns'
  | 'business_plan'
  | 'fdd_signed'
  | 'corporate_charter';

export type DocumentStatus =
  | 'pending_audit'
  | 'verified'
  | 'rejected'
  | 'resubmission_required';

export interface DocumentUpload {
  id: string;
  type: DocumentType;
  name: string;
  sizeBytes: number;
  mimeType: string;
  uploadedAt: string;
  status: DocumentStatus;
  isEncrypted: boolean;
  encryptionAlgorithm: 'AES-GCM-256';
  cipherChecksum: string;
  ivHex: string;
  previewDataUrl?: string;
  auditNotes?: string;
}

export interface PaymentRecord {
  id: string;
  applicationId: string;
  type: 'application_fee' | 'franchise_deposit';
  amount: number;
  currency: string;
  method: 'card' | 'ach' | 'escrow_wire';
  status: 'completed' | 'processing' | 'failed';
  transactionHash: string;
  referenceCode: string;
  timestamp: string;
  receiptNumber: string;
  cardLast4?: string;
  billingName: string;
}

export interface ReviewNote {
  id: string;
  authorRole: UserRole;
  authorName: string;
  text: string;
  timestamp: string;
}

export interface StatusHistoryEntry {
  id: string;
  fromStatus: ApplicationStatus;
  toStatus: ApplicationStatus;
  timestamp: string;
  changedByEmail: string;
  changedByRole: UserRole;
  reason?: string;
}

export interface DocumentChecklistItem {
  docType: DocumentType;
  label: string;
  required: boolean;
  verified: boolean;
  notes?: string;
  verifiedAt?: string;
}

export interface FranchiseApplication {
  id: string; // e.g. "TDG-2026-104"
  createdAt: string;
  updatedAt: string;
  concurrencyVersion?: number;
  applicant: {
    fullName: string;
    email: string;
    phone: string;
    companyName?: string;
    country: string;
    stateProvince: string;
    city: string;
    postalCode: string;
    entityType: 'individual' | 'opc' | 'pvt_ltd' | 'llc' | 'corporation' | 'partnership';
  };
  financials: {
    liquidCapital: number;
    netWorth: number;
    creditScoreTier: '750_plus' | '700_749' | '650_699' | 'below_650';
    fundingSource: 'cash_savings' | 'sba_loan' | 'investor_group' | 'commercial_line';
  };
  planId: string;
  currency?: Currency;
  territoryRequested: string;
  preferredStartDate: string;
  operationalExperienceYears: number;
  businessBackgroundSummary: string;
  status: ApplicationStatus;
  statusHistory?: StatusHistoryEntry[];
  automatedEvaluation: AutomatedScoringResult;
  documents: DocumentUpload[];
  documentChecklist?: DocumentChecklistItem[];
  payments: PaymentRecord[];
  reviewNotes: ReviewNote[];
  assignedReviewer?: string;
  assignedReviewerEmail?: string;
  decisionReason?: string;
  rejectionReason?: string;
  contractSignedAt?: string;
  biometricApprovalVerified?: boolean;
  biometricApprovalTimestamp?: string;
  assignedOfficer?: string;
  applicantBiometricEnrollment?: BiometricEnrollmentData;
}

export interface BiometricEnrollmentData {
  enrolled: boolean;
  modality: 'fingerprint' | 'face_id';
  credentialId: string;
  enrolledAt: string;
  deviceLabel: string;
  backupPinConfigured: boolean;
  securityProofHash: string;
  facePhotoUrl?: string;
  biometricScore?: number;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userEmail: string;
  userRole: string;
  action: string;
  resourceId: string;
  details: string;
  ipOrClient: string;
  syncStatus: 'synced' | 'queued_offline' | 'conflict_resolved';
  checksum: string;
}

export interface EmailNotification {
  id: string;
  to: string;
  recipientName: string;
  subject: string;
  previewText: string;
  template:
    | 'application_submitted'
    | 'automated_passed'
    | 'revision_required'
    | 'official_approval'
    | 'payment_confirmed'
    | 'onboarding_welcome';
  sentAt: string;
  read: boolean;
  htmlBody: string;
}

export interface SyncQueueItem {
  id: string;
  operation:
    | 'create_application'
    | 'update_status'
    | 'add_review_note'
    | 'upload_document'
    | 'process_payment';
  payload: any;
  queuedAt: string;
  retryCount: number;
  status: 'pending' | 'syncing' | 'failed' | 'synced';
  error?: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: 'info' | 'success' | 'warning' | 'error';
  applicationId?: string;
}
