import { CompanyComplianceConfig, FranchisePlan } from '../types/franchise';

export const DEFAULT_COMPLIANCE_CONFIG: CompanyComplianceConfig = {
  legalName: 'TRUEDEAL GLOBAL OPC PVT LTD',
  brandName: 'TRUEDEAL GLOBAL',
  mainWebsite: 'https://truedealglobal.com/',
  franchisePortalUrl: 'https://businessfranchise.truedealglobal.com/',
  officialEmail: 'info@truedealglobal.com',
  supportPhone: '+91-9317194033',
  whatsappNumber: '+91-8091667890',
  supportHours: 'Monday to Saturday, 10:00 AM – 6:30 PM IST (Excluding National Holidays)',
  operatingCityRegion: 'Ghaziabad & Noida, Uttar Pradesh, India',
  // Pending owner confirmation — NEVER fabricated. Configurable via Admin Compliance Settings.
  registeredOfficeAddress: '',
  cin: '',
  gstin: '',
  gstStatus: 'pending_confirmation',
  gstRatePercent: 18,
  applicationFeeINR: 0,
  grievanceOfficerName: '',
  grievanceOfficerDesignation: '',
  grievanceEmail: 'info@truedealglobal.com',
  grievancePhone: '+91-9317194033',
  grievanceResponseHours: 48,
  grievanceResolutionDays: 15,
  refundWindowDays: 7,
  refundProcessingTimeline: '7–10 business days to the original payment source upon written approval',
  jurisdictionCity: 'Ghaziabad / Uttar Pradesh, India',
  razorpayStatus: 'pending_verification',
  bankDetails: {
    beneficiaryName: 'TRUEDEAL GLOBAL OPC PVT LTD',
    bankName: 'BANK OF BARODA',
    accountType: 'Current Account',
    accountNumber: '26290200001514',
    ifscCode: 'BARB0NOIDAX',
    branchName: 'Noida Main Branch'
  },
  lastUpdatedAt: '2026-04-20T00:00:00.000Z'
};

export interface FeeBreakdown {
  baseFeeINR: number;
  gstRatePercent: number;
  gstAmountINR: number;
  totalPayableINR: number;
  gstLabel: string;
  isGstPendingConfirmation: boolean;
}

/**
 * Calculates transparent INR fee and GST breakdown based on company GST configuration.
 * Never fabricates tax numbers when GST registration is marked pending confirmation.
 */
export function calculateFeeBreakdownINR(
  baseFeeINR: number,
  config: CompanyComplianceConfig = DEFAULT_COMPLIANCE_CONFIG
): FeeBreakdown {
  const safeBase = Math.max(0, Math.round(baseFeeINR));

  if (config.gstStatus === 'excluded') {
    const gstAmountINR = Math.round((safeBase * config.gstRatePercent) / 100);
    return {
      baseFeeINR: safeBase,
      gstRatePercent: config.gstRatePercent,
      gstAmountINR,
      totalPayableINR: safeBase + gstAmountINR,
      gstLabel: `+ ${config.gstRatePercent}% GST extra`,
      isGstPendingConfirmation: false
    };
  }

  if (config.gstStatus === 'included') {
    const taxableBase = Math.round(safeBase / (1 + config.gstRatePercent / 100));
    const gstAmountINR = safeBase - taxableBase;
    return {
      baseFeeINR: taxableBase,
      gstRatePercent: config.gstRatePercent,
      gstAmountINR,
      totalPayableINR: safeBase,
      gstLabel: `Inclusive of ${config.gstRatePercent}% GST`,
      isGstPendingConfirmation: false
    };
  }

  if (config.gstStatus === 'not_applicable') {
    return {
      baseFeeINR: safeBase,
      gstRatePercent: 0,
      gstAmountINR: 0,
      totalPayableINR: safeBase,
      gstLabel: 'GST Not Applicable',
      isGstPendingConfirmation: false
    };
  }

  // pending_confirmation
  return {
    baseFeeINR: safeBase,
    gstRatePercent: 0,
    gstAmountINR: 0,
    totalPayableINR: safeBase,
    gstLabel: 'GST applicability & tax invoice treatment confirmed prior to payment activation',
    isGstPendingConfirmation: true
  };
}

export function getDisplayRegisteredAddress(config: CompanyComplianceConfig): string {
  if (config.registeredOfficeAddress && config.registeredOfficeAddress.trim().length > 5) {
    return config.registeredOfficeAddress.trim();
  }
  return `${config.operatingCityRegion} (Full registered street address as per MCA Master Data pending final corporate update)`;
}

export function getPlanTransparencyDefaults(plan: FranchisePlan) {
  return {
    applicationFeeINR: plan.applicationFeeINR ?? 0,
    registrationFeeINR: plan.registrationFeeINR ?? 0,
    franchiseFeeINR: plan.priceINR,
    servicesExcluded: plan.servicesExcluded || [
      'Physical office lease, local municipal licenses, staff salaries, and local utility bills',
      'Third-party advertising spend paid directly to ad networks (Google/Meta)',
      'Regulated financial, investment, or restricted advisory services'
    ],
    franchiseRights: plan.franchiseRights || [
      'Authorized use of TRUEDEAL GLOBAL franchise partner branding per signed agreement',
      'Access to approved service catalog and centralized backend fulfillment workflow',
      'Dedicated partner onboarding guide, commercial proposals, and territory alignment'
    ],
    additionalChargesNote:
      plan.additionalChargesNote ||
      'No recurring annual royalty fee. Optional custom hardware, local marketing spend, or third-party government/statutory fees for end-clients are billed separately at actuals.',
    paymentSchedule:
      plan.paymentSchedule ||
      'One-time franchise onboarding fee payable only after application eligibility review and prior to final Franchise Agreement execution & portal activation.',
    refundEligibility:
      plan.refundEligibility ||
      'Eligible for review under the published Refund Policy if the application is declined by TRUEDEAL GLOBAL or cancelled in writing prior to franchise portal activation and agreement execution.',
    cancellationConditions:
      plan.cancellationConditions ||
      'Applicants may submit a written cancellation request to info@truedealglobal.com prior to onboarding activation. Once digital credentials, territory lock, and legal execution are completed, cancellation is governed by the signed Franchise Agreement.',
    activationTimeline:
      plan.activationTimeline ||
      '3–7 business days following document verification, payment reconciliation, and countersignature of the Franchise Agreement.'
  };
}
