import {
  FranchisePlan,
  FranchiseApplication,
  AuditLogEntry,
  EmailNotification,
  SyncQueueItem,
  AppNotification,
  AutomatedScoringResult,
  DocumentUpload,
  PaymentRecord,
  ReviewNote,
  UserRole,
  Currency,
  CompanyComplianceConfig,
  ContactInquiry
} from '../types/franchise';
import { DEFAULT_COMPLIANCE_CONFIG } from '../config/complianceConfig';
import { calculateSha256, generateAuditChecksum } from '../utils/crypto';
import { syncApplicationToFirestore, syncAuditLogToFirestore } from './firebase';

// Live Foreign Exchange & Surcharge Configuration
export const USD_INR_RATE = 87.5; // Base market exchange rate (1 USD = 87.5 INR)
export const USD_SURCHARGE_PCT = 10; // Mandatory +10% international onboarding & cross-border license markup

export function calculateUSDPrice(inrAmount: number): number {
  return Math.round((inrAmount / USD_INR_RATE) * (1 + USD_SURCHARGE_PCT / 100));
}

export function formatPrice(inrAmount: number, currency: Currency = 'INR'): string {
  if (currency === 'INR') {
    return '₹' + inrAmount.toLocaleString('en-IN');
  }
  const usd = calculateUSDPrice(inrAmount);
  return '$' + usd.toLocaleString('en-US');
}

// Official TRUEDEAL GLOBAL OPC PVT LTD Franchise Plans Catalog (Razorpay-Compliant Business Verticals)
export const FRANCHISE_PLANS: FranchisePlan[] = [
  {
    id: 'plan_basic',
    tier: 'basic',
    title: 'Basic Plan',
    badge: 'STARTER',
    label: 'STARTER',
    labelColor: 'bg-blue-600',
    color: 'border-blue-600',
    btnColor: 'bg-blue-600',
    subtitle: 'Entry-level partner access to 5+ digital & business service categories with marketing kit and structured partner support.',
    priceINR: 2500,
    priceUSD: calculateUSDPrice(2500),
    applicationFeeINR: 0,
    registrationFeeINR: 0,
    commissionRate: '10-15% Commission',
    referralBonus: '20% Direct Referral Commission',
    payoutFrequency: 'Scheduled Bi-Weekly Bank Settlement (Subject to Invoice Clearance)',
    validity: 'Lifetime Validity (Subject to Agreement Terms)',
    servicesCovered: '5+ Business Services (Web Development, Digital Marketing & Support)',
    territoryScope: 'Remote / Digital Service Territory',
    activationTimeline: '2–5 business days after document verification and agreement execution',
    features: [
      '5+ Business Services Access',
      'Web Development Franchise',
      'Digital Marketing Support',
      'Email Support',
      'Certificate & Partner ID Card',
      'Commission: 10-15% on Verified Deals',
      'Basic Marketing Kit',
      'Zero Annual Royalty Fee'
    ],
    idealCandidate: 'Home-based entrepreneurs, consultants, freelancers, and digital marketers starting out.'
  },
  {
    id: 'plan_standard',
    tier: 'standard',
    title: 'Standard Plan',
    badge: 'Most Popular',
    label: 'Most Popular',
    labelColor: 'bg-orange-500',
    color: 'border-orange-500',
    btnColor: 'bg-orange-500',
    popular: true,
    subtitle: 'Registered franchise license granting commercial partner rights across 20+ verified business service categories, marketing collateral, and onboarding training.',
    priceINR: 4999,
    priceUSD: calculateUSDPrice(4999),
    applicationFeeINR: 0,
    registrationFeeINR: 0,
    commissionRate: '15-25% Commission',
    referralBonus: '20% Direct Referral Commission',
    payoutFrequency: 'Scheduled Bi-Weekly Bank Settlement (Subject to Invoice Clearance)',
    validity: 'Lifetime Registered Franchise License',
    servicesCovered: '20+ Business Service Packages (IT, Real Estate, Education, Visa & Travel)',
    territoryScope: 'District / Digital Territory Rights',
    activationTimeline: '3–5 business days after KYC verification and agreement execution',
    features: [
      '20+ Approved Service Packages',
      'Web & Mobile App Development',
      'Real Estate Consultancy Support',
      'Education & Visa Documentation Assistance',
      'Tour & Travel Packages',
      'Import/Export Documentation Support',
      'Social Media & Brand Promotion',
      'Complete IT Services Fulfillment',
      'Professional Onboarding Training',
      'Marketing Materials & Collateral',
      'Commission: 15-25% on Verified Deals',
      'Phone & Email Support',
      'Business Setup Guidance'
    ],
    idealCandidate: 'Small business owners, travel consultants, and service agencies seeking multi-industry expansion.'
  },
  {
    id: 'plan_corporate',
    tier: 'corporate',
    title: 'Corporate Plan',
    badge: 'High Growth',
    label: 'High Growth',
    labelColor: 'bg-purple-600',
    color: 'border-purple-600',
    btnColor: 'bg-purple-600',
    subtitle: 'Expanded commercial rights with multimedia production, e-commerce enablement, custom website development, and structured business onboarding.',
    priceINR: 14999,
    priceUSD: calculateUSDPrice(14999),
    applicationFeeINR: 0,
    registrationFeeINR: 0,
    commissionRate: '25-35% Commission',
    referralBonus: '20% Direct Referral Commission',
    payoutFrequency: 'Scheduled Bi-Weekly Bank Settlement (Subject to Invoice Clearance)',
    validity: 'Lifetime Corporate License',
    servicesCovered: 'All Standard Plan + Media, Studio Production, E-Commerce & Book Publishing',
    territoryScope: 'Multi-District / Regional Priority',
    activationTimeline: '3–7 business days after KYC verification and agreement execution',
    features: [
      'All Standard Plan Benefits',
      'Photography & Video Production Support',
      'Music & Audio Studio Services',
      'E-Commerce Store Setup & Catalogs',
      'Book Publishing & Editorial Services',
      'Commercial Film Production Support',
      'HR & Recruitment Consultancy',
      'Medical Tourism & Assistance Coordination',
      'Premium Marketing Suite',
      'Advanced Partner Training Program',
      'Commission: 25-35% on Verified Deals',
      'Priority Partner Support',
      'Custom Partner Website Setup',
      'Structured Business Onboarding'
    ],
    idealCandidate: 'Regional agencies, media consultants, corporate executives, and established service businesses.'
  },
  {
    id: 'plan_platinum',
    tier: 'platinum',
    title: 'Platinum Plan',
    badge: 'Master Partner',
    label: 'Master Partner',
    labelColor: 'bg-indigo-600',
    color: 'border-indigo-600',
    btnColor: 'bg-indigo-600',
    subtitle: 'Master partner tier featuring white-label operational support, multi-city territory alignment, dedicated account manager, and expanded service verticals.',
    priceINR: 49999,
    priceUSD: calculateUSDPrice(49999),
    applicationFeeINR: 0,
    registrationFeeINR: 0,
    commissionRate: '35-45% Commission',
    referralBonus: '20% Direct Referral Commission',
    payoutFrequency: 'Scheduled Bi-Weekly Bank Settlement (Subject to Invoice Clearance)',
    validity: 'Lifetime Master License',
    servicesCovered: 'Full Approved Suite + Hospitality, Events, Auto Brokerage, Civil & Interior Design',
    territoryScope: 'Multi-City / Zonal Territory Rights',
    activationTimeline: '5–7 business days after due diligence and legal agreement execution',
    features: [
      'All Corporate Plan Benefits',
      'Hospitality, Events & Catering Support',
      'School & College Admission Counseling',
      'Automobile Dealership & Brokerage Support',
      'Civil Engineering & Construction Leads',
      'Matrimonial Portal Coordination',
      'Apparel & Accessories Design Support',
      'Interior & Exterior Design Services',
      'White-Label Operational Rights',
      'Commission: 35-45% on Verified Deals',
      'Priority Support Desk',
      'Master Training Program',
      'Dedicated Account Manager',
      'Multi-City Territory Allocation'
    ],
    idealCandidate: 'Established entrepreneurs, high-volume service operators, and regional distributors.'
  },
  {
    id: 'plan_entrepreneur',
    tier: 'entrepreneur',
    title: 'Entrepreneur Plan',
    badge: 'State Authority',
    label: 'State Authority',
    labelColor: 'bg-green-600',
    color: 'border-green-600',
    btnColor: 'bg-green-600',
    subtitle: 'State-level franchise authorization with territory coordination, sub-franchise onboarding rights, and CRM workflow integration.',
    priceINR: 99999,
    priceUSD: calculateUSDPrice(99999),
    applicationFeeINR: 0,
    registrationFeeINR: 0,
    commissionRate: '45-55% Commission',
    referralBonus: '20% Direct Referral Commission',
    payoutFrequency: 'Scheduled Bi-Weekly Bank Settlement (Subject to Invoice Clearance)',
    validity: 'Lifetime State Partnership',
    servicesCovered: 'Complete Approved Business Service Portfolio & CRM Enablement',
    territoryScope: 'State-Level Territory Rights',
    activationTimeline: '5–10 business days after due diligence and agreement execution',
    features: [
      'All Platinum Plan Benefits',
      'Complete Approved Service Portfolio',
      'Marketing Workflow Automation',
      'CRM System Integration',
      'Custom Branding Collateral',
      'Sub-Franchise Onboarding Rights',
      'Structured Revenue Sharing Model',
      'Commission: 45-55% on Verified Deals',
      'Executive Support Team',
      'Quarterly Business Reviews',
      'State-Level Territory Alignment',
      'Cross-Border Service Coordination',
      'Master Franchise Administration'
    ],
    idealCandidate: 'Experienced franchise operators, state distributor networks, and corporate entities.'
  },
  {
    id: 'plan_retirement',
    tier: 'retirement',
    title: 'Legacy & Succession Plan',
    badge: 'Succession Tier',
    label: 'Succession Tier',
    labelColor: 'bg-blue-500',
    color: 'border-blue-500',
    btnColor: 'bg-blue-500',
    subtitle: 'Long-term franchise operating license with structured business continuity, family nomination rights, and executive account support.',
    priceINR: 149999,
    priceUSD: calculateUSDPrice(149999),
    applicationFeeINR: 0,
    registrationFeeINR: 0,
    commissionRate: '55-65% Commission',
    referralBonus: '20% Direct Referral Commission',
    payoutFrequency: 'Scheduled Bi-Weekly Bank Settlement (Subject to Invoice Clearance)',
    validity: 'Transferable Family Succession Rights (Per Agreement)',
    servicesCovered: 'Complete Approved Service Portfolio + Business Continuity & Succession Administration',
    territoryScope: 'Premium Territory Rights & Priority Market',
    activationTimeline: '7–10 business days after legal review and agreement execution',
    features: [
      'All Entrepreneur Plan Benefits',
      'Family Nominee & Succession Clause',
      'Managed Fulfillment Coordination',
      'Long-Term Brand Continuity Support',
      'Premium Territory Alignment',
      'Priority Account Operations',
      'Commission: 55-65% on Verified Deals',
      'Senior Executive Support Desk',
      'Ongoing Business Operations Coaching',
      'Transferable License Rights (Per Agreement)',
      'International Service Desk Access'
    ],
    idealCandidate: 'Senior business owners and family enterprises establishing a transferable service franchise.'
  },
  {
    id: 'plan_enterprise',
    tier: 'enterprise',
    title: 'Enterprise Plan',
    badge: 'Enterprise Scale',
    label: 'Enterprise Scale',
    labelColor: 'bg-purple-500',
    color: 'border-purple-500',
    btnColor: 'bg-purple-500',
    subtitle: 'Full enterprise franchise ecosystem with advanced CRM integration, dedicated operations team, and multi-state coordination.',
    priceINR: 499999,
    priceUSD: calculateUSDPrice(499999),
    applicationFeeINR: 0,
    registrationFeeINR: 0,
    commissionRate: '65-75% Commission',
    referralBonus: '20% Direct Referral Commission',
    payoutFrequency: 'Scheduled Bi-Weekly Bank Settlement (Subject to Invoice Clearance)',
    validity: 'Lifetime Enterprise Authority',
    servicesCovered: 'Custom Enterprise Solutions, Multi-State Operations & Full Approved Service Stack',
    territoryScope: 'State-Level / Multi-State Territory Authority',
    activationTimeline: '7–14 business days after legal due diligence and agreement execution',
    features: [
      'Complete Approved Business Ecosystem',
      'Full Marketing Automation Suite',
      'Executive Support Team',
      'Enterprise-Level Staff Training',
      'Multi-State Territory Alignment',
      'Commission: 65-75% on Verified Deals',
      'Custom Enterprise Delivery Workflows',
      'Advanced CRM Integration',
      'Master Franchise Administration',
      'Cross-Border Operations Support'
    ],
    idealCandidate: 'Enterprise groups, corporate agencies, and regional commercial operators.'
  },
  {
    id: 'plan_global',
    tier: 'global',
    title: 'Global Plan',
    badge: 'Exclusive',
    label: 'Exclusive',
    labelColor: 'bg-yellow-600',
    color: 'border-yellow-600',
    btnColor: 'bg-yellow-600',
    popular: true,
    subtitle: 'International master franchise framework supporting cross-border service delivery with up to 85% tier commission schedule and executive governance.',
    priceINR: 999999,
    priceUSD: calculateUSDPrice(999999),
    applicationFeeINR: 0,
    registrationFeeINR: 0,
    commissionRate: '75-85% Commission',
    referralBonus: '20% Direct Referral Commission',
    payoutFrequency: 'Scheduled Bi-Weekly Bank / Wire Settlement (Subject to Compliance)',
    validity: 'Lifetime International Master Agreement',
    servicesCovered: 'International Master Franchise & Full Enterprise Service Delivery Stack',
    territoryScope: 'Multi-Country / International Master Rights (Subject to Local Law)',
    activationTimeline: '10–15 business days after international KYC & agreement execution',
    features: [
      'International Franchise Network Access',
      'Cross-Border Marketing & Proposal Kit',
      'Senior Executive Support Desk',
      'Global Operations Onboarding Training',
      'Multi-Region Territory Alignment',
      'Commission: 75-85% on Verified Deals',
      'Custom Enterprise Service Integrations',
      'Enterprise Technology & CRM Stack',
      'International Master Franchise Agreement',
      'Dedicated Compliance Liaison'
    ],
    idealCandidate: 'International corporate entities and multi-region service operators.'
  }
];

export function getPlanById(id: string): FranchisePlan | undefined {
  const plans = FranchiseStorageService.getPlans();
  if (id === 'plan_global_enterprise') {
    return plans.find(p => p.id === 'plan_global') || plans.find(p => p.id === 'plan_enterprise');
  }
  return plans.find(p => p.id === id);
}

// Initial mock applications
const INITIAL_APPLICATIONS: FranchiseApplication[] = [
  {
    id: 'TDG-2026-104',
    createdAt: '2026-03-28T09:15:00.000Z',
    updatedAt: '2026-04-02T14:30:00.000Z',
    applicant: {
      fullName: 'Marcus Sterling',
      email: 'm.sterling@sterlingholdings.com',
      phone: '+1 (512) 890-4421',
      companyName: 'Sterling Capital Holdings LLC',
      country: 'United States',
      stateProvince: 'Texas',
      city: 'Austin',
      postalCode: '78701',
      entityType: 'llc'
    },
    financials: {
      liquidCapital: 280000,
      netWorth: 950000,
      creditScoreTier: '750_plus',
      fundingSource: 'cash_savings'
    },
    planId: 'plan_global_enterprise',
    currency: 'USD',
    territoryRequested: 'Central Texas & Gulf Region (USA Master Rights)',
    preferredStartDate: '2026-06-01',
    operationalExperienceYears: 12,
    businessBackgroundSummary: 'Operated 6 regional quick-service and specialty retail locations over past decade with proven management team.',
    status: 'approved',
    automatedEvaluation: {
      score: 96,
      liquidityStatus: 'pass',
      netWorthStatus: 'pass',
      creditStatus: 'pass',
      territoryAvailable: true,
      backgroundCheckPassed: true,
      preliminaryVerdict: 'auto_approved',
      reasons: [
        'Liquid capital exceeds tier minimum by 2.3x',
        'Net worth satisfies 2.5x safety multiplier',
        'Tier 1 credit score verified (780+ range)',
        'Zero conflicting master rights in Central Texas corridor'
      ],
      calculatedAt: '2026-03-28T09:16:15.000Z'
    },
    documents: [
      {
        id: 'doc_104_1',
        type: 'gov_id',
        name: 'US_Passport_Marcus_Sterling.enc',
        sizeBytes: 2450000,
        mimeType: 'image/jpeg',
        uploadedAt: '2026-03-28T09:20:00.000Z',
        status: 'verified',
        isEncrypted: true,
        encryptionAlgorithm: 'AES-GCM-256',
        cipherChecksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        ivHex: '4a8f9c112e7b89d0014ef6a2',
        previewDataUrl: ''
      },
      {
        id: 'doc_104_2',
        type: 'proof_of_funds',
        name: 'JPMorgan_Chase_Liquidity_Statement_Q1_2026.enc',
        sizeBytes: 1840000,
        mimeType: 'application/pdf',
        uploadedAt: '2026-03-28T09:22:00.000Z',
        status: 'verified',
        isEncrypted: true,
        encryptionAlgorithm: 'AES-GCM-256',
        cipherChecksum: '7d5a99f603f231d5390171626609193d619b1ecd1667b201aceed7005798a353',
        ivHex: '91bc44ae22019ff88432a1bb',
        previewDataUrl: ''
      },
      {
        id: 'doc_104_3',
        type: 'business_plan',
        name: 'TrueDeal_Texas_Corridor_10Year_Expansion_Plan.enc',
        sizeBytes: 4200000,
        mimeType: 'application/pdf',
        uploadedAt: '2026-03-28T09:25:00.000Z',
        status: 'verified',
        isEncrypted: true,
        encryptionAlgorithm: 'AES-GCM-256',
        cipherChecksum: '3a4f891b2c4e5d6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f',
        ivHex: '1234567890abcdef12345678',
        previewDataUrl: ''
      }
    ],
    payments: [
      {
        id: 'pay_104_fee',
        applicationId: 'TDG-2026-104',
        type: 'application_fee',
        amount: 750,
        currency: 'USD',
        method: 'card',
        status: 'completed',
        transactionHash: 'tx_0x9b8821a8f921d7',
        referenceCode: 'TDG-APPFEE-104',
        timestamp: '2026-03-28T09:28:00.000Z',
        receiptNumber: 'REC-2026-0091',
        cardLast4: '4242',
        billingName: 'Marcus Sterling'
      },
      {
        id: 'pay_104_dep',
        applicationId: 'TDG-2026-104',
        type: 'franchise_deposit',
        amount: 45000,
        currency: 'USD',
        method: 'escrow_wire',
        status: 'completed',
        transactionHash: 'escrow_wire_tx_88320491',
        referenceCode: 'TDG-DEP-104-MASTER',
        timestamp: '2026-04-01T16:00:00.000Z',
        receiptNumber: 'REC-2026-0112',
        billingName: 'Sterling Capital Holdings LLC'
      }
    ],
    reviewNotes: [
      {
        id: 'note_104_1',
        authorRole: 'director',
        authorName: 'Evelyn Vance',
        text: 'Met with Marcus for virtual territory defense. Exceptional retail portfolio and strong local supply relationships.',
        timestamp: '2026-03-30T15:20:00.000Z'
      },
      {
        id: 'note_104_2',
        authorRole: 'compliance',
        authorName: 'David Chen',
        text: 'KYC, background check, and proof of funds audited. Clean regulatory standing.',
        timestamp: '2026-04-01T11:05:00.000Z'
      }
    ],
    contractSignedAt: '2026-04-02T14:15:00.000Z',
    biometricApprovalVerified: true,
    biometricApprovalTimestamp: '2026-04-02T14:28:00.000Z',
    assignedOfficer: 'Evelyn Vance (Director)'
  },
  {
    id: 'TDG-2026-108',
    createdAt: '2026-04-04T11:20:00.000Z',
    updatedAt: '2026-04-06T10:15:00.000Z',
    applicant: {
      fullName: 'Elena Rostova',
      email: 'elena@novapartnergroup.com',
      phone: '+1 (305) 554-9182',
      companyName: 'Nova Partner Group',
      country: 'United States',
      stateProvince: 'Florida',
      city: 'Miami',
      postalCode: '33131',
      entityType: 'corporation'
    },
    financials: {
      liquidCapital: 110000,
      netWorth: 340000,
      creditScoreTier: '700_749',
      fundingSource: 'investor_group'
    },
    planId: 'plan_platinum',
    currency: 'USD',
    territoryRequested: 'South Florida (Miami Beach & Coral Gables)',
    preferredStartDate: '2026-07-15',
    operationalExperienceYears: 8,
    businessBackgroundSummary: 'Retail franchising and hospitality management with 3 existing upscale coffee concepts in Brickell.',
    status: 'compliance_review',
    automatedEvaluation: {
      score: 88,
      liquidityStatus: 'pass',
      netWorthStatus: 'pass',
      creditStatus: 'pass',
      territoryAvailable: true,
      backgroundCheckPassed: true,
      preliminaryVerdict: 'conditional_fast_track',
      reasons: [
        'Liquid capital comfortably satisfies Multi-Unit tier ($60k min)',
        'Net worth meets standard criteria',
        'Territory availability verified in South Florida sector'
      ],
      calculatedAt: '2026-04-04T11:22:00.000Z'
    },
    documents: [
      {
        id: 'doc_108_1',
        type: 'gov_id',
        name: 'State_Drivers_License_Elena_Rostova.enc',
        sizeBytes: 1540000,
        mimeType: 'image/jpeg',
        uploadedAt: '2026-04-04T11:30:00.000Z',
        status: 'verified',
        isEncrypted: true,
        encryptionAlgorithm: 'AES-GCM-256',
        cipherChecksum: '2b4c6e8a0f1d3b5a7c9e1f3a5b7c9e1f3a5b7c9e1f3a5b7c9e1f3a5b7c9e1f3a',
        ivHex: 'fedcba9876543210fedcba98',
        previewDataUrl: ''
      },
      {
        id: 'doc_108_2',
        type: 'proof_of_funds',
        name: 'BankOfAmerica_Liquidity_Letter.enc',
        sizeBytes: 2100000,
        mimeType: 'application/pdf',
        uploadedAt: '2026-04-04T11:35:00.000Z',
        status: 'pending_audit',
        isEncrypted: true,
        encryptionAlgorithm: 'AES-GCM-256',
        cipherChecksum: '8f7e6d5c4b3a291807968574635241302f1e0d9c8b7a69584736251403f2e1d0',
        ivHex: 'aabbccddeeff001122334455',
        previewDataUrl: ''
      }
    ],
    payments: [
      {
        id: 'pay_108_fee',
        applicationId: 'TDG-2026-108',
        type: 'application_fee',
        amount: 750,
        currency: 'USD',
        method: 'card',
        status: 'completed',
        transactionHash: 'tx_0x44ab7192c31',
        referenceCode: 'TDG-APPFEE-108',
        timestamp: '2026-04-04T11:40:00.000Z',
        receiptNumber: 'REC-2026-0134',
        cardLast4: '8821',
        billingName: 'Elena Rostova'
      }
    ],
    reviewNotes: [
      {
        id: 'note_108_1',
        authorRole: 'compliance',
        authorName: 'David Chen',
        text: 'Initial corporate documents received. Requesting updated escrow letter from investor group.',
        timestamp: '2026-04-05T09:30:00.000Z'
      }
    ],
    assignedOfficer: 'David Chen (Compliance)'
  },
  {
    id: 'TDG-2026-112',
    createdAt: '2026-04-08T16:45:00.000Z',
    updatedAt: '2026-04-09T08:20:00.000Z',
    applicant: {
      fullName: 'Aria Montgomery',
      email: 'aria.m@montgomeryretail.org',
      phone: '+1 (206) 412-8871',
      companyName: 'Montgomery Retail Ventures',
      country: 'United States',
      stateProvince: 'Washington',
      city: 'Seattle',
      postalCode: '98101',
      entityType: 'individual'
    },
    financials: {
      liquidCapital: 48000,
      netWorth: 165000,
      creditScoreTier: '750_plus',
      fundingSource: 'cash_savings'
    },
    planId: 'plan_standard',
    currency: 'INR',
    territoryRequested: 'Maharashtra & Mumbai Commercial Zone',
    preferredStartDate: '2026-05-20',
    operationalExperienceYears: 6,
    businessBackgroundSummary: 'Managed luxury retail flagship for 6 years; strong local marketing presence in Mumbai.',
    status: 'automated_verified',
    automatedEvaluation: {
      score: 92,
      liquidityStatus: 'pass',
      netWorthStatus: 'pass',
      creditStatus: 'pass',
      territoryAvailable: true,
      backgroundCheckPassed: true,
      preliminaryVerdict: 'auto_approved',
      reasons: [
        'Liquid funds qualify for Standard Franchise baseline',
        'Net worth meets required ratio',
        'Zero criminal/credit flags in automated screening'
      ],
      calculatedAt: '2026-04-08T16:47:00.000Z'
    },
    documents: [
      {
        id: 'doc_112_1',
        type: 'gov_id',
        name: 'Aadhaar_Card_Aria_Sharma.enc',
        sizeBytes: 1200000,
        mimeType: 'image/jpeg',
        uploadedAt: '2026-04-08T16:50:00.000Z',
        status: 'pending_audit',
        isEncrypted: true,
        encryptionAlgorithm: 'AES-GCM-256',
        cipherChecksum: '11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff',
        ivHex: '33445566778899aabbccddee',
        previewDataUrl: ''
      }
    ],
    payments: [
      {
        id: 'pay_112_fee',
        applicationId: 'TDG-2026-112',
        type: 'application_fee',
        amount: 750,
        currency: 'INR',
        method: 'card',
        status: 'completed',
        transactionHash: 'tx_0x9923847120a',
        referenceCode: 'TDG-APPFEE-112',
        timestamp: '2026-04-08T16:55:00.000Z',
        receiptNumber: 'REC-2026-0158',
        cardLast4: '1092',
        billingName: 'Aria Sharma'
      }
    ],
    reviewNotes: []
  },
  {
    id: 'TDG-2026-115',
    createdAt: '2026-04-10T14:10:00.000Z',
    updatedAt: '2026-04-11T12:00:00.000Z',
    applicant: {
      fullName: 'Tariq Al-Mansoor',
      email: 'tariq@almansoorlogistics.ae',
      phone: '+971 4 391 2000',
      companyName: 'Al-Mansoor Global Logistics',
      country: 'United Arab Emirates',
      stateProvince: 'Dubai',
      city: 'Dubai',
      postalCode: '00000',
      entityType: 'corporation'
    },
    financials: {
      liquidCapital: 320000,
      netWorth: 1400000,
      creditScoreTier: '750_plus',
      fundingSource: 'cash_savings'
    },
    planId: 'plan_global_enterprise',
    currency: 'USD',
    territoryRequested: 'GCC Master Territory (Dubai UAE & Saudi Arabia)',
    preferredStartDate: '2026-09-01',
    operationalExperienceYears: 15,
    businessBackgroundSummary: 'International logistics network with 120 distribution vehicles and cross-border customs clearance infrastructure.',
    status: 'contract_issued',
    automatedEvaluation: {
      score: 98,
      liquidityStatus: 'pass',
      netWorthStatus: 'pass',
      creditStatus: 'pass',
      territoryAvailable: true,
      backgroundCheckPassed: true,
      preliminaryVerdict: 'auto_approved',
      reasons: [
        'International corporate liquidity audited and verified',
        'Strategic territory alignment with TrueDeal global expansion goals',
        'High compliance verification index'
      ],
      calculatedAt: '2026-04-10T14:12:00.000Z'
    },
    documents: [
      {
        id: 'doc_115_1',
        type: 'corporate_charter',
        name: 'UAE_DED_Commercial_License.enc',
        sizeBytes: 3100000,
        mimeType: 'application/pdf',
        uploadedAt: '2026-04-10T14:20:00.000Z',
        status: 'verified',
        isEncrypted: true,
        encryptionAlgorithm: 'AES-GCM-256',
        cipherChecksum: 'aabb1122cc3344dd5566ee7788ff9900aabb1122cc3344dd5566ee7788ff9900',
        ivHex: '556677889900aabbccddeeff',
        previewDataUrl: ''
      }
    ],
    payments: [
      {
        id: 'pay_115_fee',
        applicationId: 'TDG-2026-115',
        type: 'application_fee',
        amount: 750,
        currency: 'USD',
        method: 'card',
        status: 'completed',
        transactionHash: 'tx_0xaef1829031',
        referenceCode: 'TDG-APPFEE-115',
        timestamp: '2026-04-10T14:25:00.000Z',
        receiptNumber: 'REC-2026-0177',
        cardLast4: '7729',
        billingName: 'Tariq Al-Mansoor'
      }
    ],
    reviewNotes: [
      {
        id: 'note_115_1',
        authorRole: 'director',
        authorName: 'Evelyn Vance',
        text: 'Master franchise agreement drafted with international arbitration clause. Ready for countersignature.',
        timestamp: '2026-04-11T11:45:00.000Z'
      }
    ],
    contractSignedAt: '2026-04-11T11:55:00.000Z',
    assignedOfficer: 'Evelyn Vance (Director)'
  },
  {
    id: 'TDG-2026-119',
    createdAt: '2026-04-12T08:30:00.000Z',
    updatedAt: '2026-04-12T08:30:00.000Z',
    applicant: {
      fullName: 'Devon Patel',
      email: 'devon@pateldigital.in',
      phone: '+91 98250 44102',
      companyName: 'Patel Media Agency',
      country: 'India',
      stateProvince: 'Gujarat',
      city: 'Ahmedabad',
      postalCode: '380015',
      entityType: 'llc'
    },
    financials: {
      liquidCapital: 35000,
      netWorth: 120000,
      creditScoreTier: '700_749',
      fundingSource: 'cash_savings'
    },
    planId: 'plan_basic',
    currency: 'INR',
    territoryRequested: 'Ahmedabad & North Gujarat Digital Zone',
    preferredStartDate: '2026-05-01',
    operationalExperienceYears: 4,
    businessBackgroundSummary: 'Managed localized e-commerce ad spend and last-mile order aggregation for regional specialty merchants.',
    status: 'submitted',
    automatedEvaluation: {
      score: 84,
      liquidityStatus: 'pass',
      netWorthStatus: 'pass',
      creditStatus: 'pass',
      territoryAvailable: true,
      backgroundCheckPassed: true,
      preliminaryVerdict: 'conditional_fast_track',
      reasons: [
        'Liquid capital qualifies for Digital Agency tier ($12k min)',
        'Net worth meets 1.3x baseline',
        'Metro Phoenix digital territory currently unassigned'
      ],
      calculatedAt: '2026-04-12T08:32:00.000Z'
    },
    documents: [],
    payments: [
      {
        id: 'pay_119_fee',
        applicationId: 'TDG-2026-119',
        type: 'application_fee',
        amount: 750,
        currency: 'USD',
        method: 'card',
        status: 'completed',
        transactionHash: 'tx_0xee128945bb',
        referenceCode: 'TDG-APPFEE-119',
        timestamp: '2026-04-12T08:35:00.000Z',
        receiptNumber: 'REC-2026-0189',
        cardLast4: '9012',
        billingName: 'Devon Vance-Smith'
      }
    ],
    reviewNotes: []
  }
];

const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 'audit_001',
    timestamp: '2026-04-02T14:28:00.000Z',
    userEmail: 'allorganizationglobal@gmail.com',
    userRole: 'director',
    action: 'BIOMETRIC_APPROVAL_GRANTED',
    resourceId: 'TDG-2026-104',
    details: 'Master Franchise Agreement approved with biometric hardware authorization for Marcus Sterling.',
    ipOrClient: 'Client Enclave (Verified Secure Device)',
    syncStatus: 'synced',
    checksum: '6f8a4e2b0c1d3f5a7e9c1b3d5f7a9c1e3b5d7f9a1c3e5b7d9f1a3c5e7b9d1f3a'
  },
  {
    id: 'audit_002',
    timestamp: '2026-04-01T16:00:00.000Z',
    userEmail: 'm.sterling@sterlingholdings.com',
    userRole: 'applicant',
    action: 'PAYMENT_PROCESSED',
    resourceId: 'TDG-2026-104',
    details: 'Initial Franchise License Deposit $45,000 processed via Corporate Escrow Wire.',
    ipOrClient: 'Banking Gateway ACH/SWIFT',
    syncStatus: 'synced',
    checksum: '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b'
  },
  {
    id: 'audit_003',
    timestamp: '2026-04-04T11:22:00.000Z',
    userEmail: 'system.engine@truedealglobal.com',
    userRole: 'system',
    action: 'AUTOMATED_RULE_EVALUATED',
    resourceId: 'TDG-2026-108',
    details: 'Automated evaluation scored 88/100. Liquidity Pass, Net Worth Pass, Territory Open.',
    ipOrClient: 'Rule Engine Worker v2.4',
    syncStatus: 'synced',
    checksum: '3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d'
  },
  {
    id: 'audit_004',
    timestamp: '2026-04-08T16:47:00.000Z',
    userEmail: 'system.engine@truedealglobal.com',
    userRole: 'system',
    action: 'AUTOMATED_RULE_EVALUATED',
    resourceId: 'TDG-2026-112',
    details: 'Automated evaluation scored 92/100. Fast-track approval issued.',
    ipOrClient: 'Rule Engine Worker v2.4',
    syncStatus: 'synced',
    checksum: '5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f'
  }
];

const STORAGE_KEYS = {
  APPLICATIONS: 'truedeal_applications_v1',
  AUDIT_LOGS: 'truedeal_audit_logs_v1',
  SYNC_QUEUE: 'truedeal_sync_queue_v1',
  EMAILS: 'truedeal_emails_v1',
  NOTIFICATIONS: 'truedeal_notifications_v1',
  OFFLINE_SIM: 'truedeal_offline_sim_active',
  ACTIVE_ROLE: 'truedeal_active_role',
  COMPLIANCE_CONFIG: 'truedeal_compliance_config_v1',
  PLAN_OVERRIDES: 'truedeal_plan_overrides_v1',
  CONTACT_INQUIRIES: 'truedeal_contact_inquiries_v1'
};

// Automated Evaluation Scoring Algorithm
export function evaluateFranchiseApplication(
  plan: FranchisePlan,
  financials: FranchiseApplication['financials'],
  experienceYears: number,
  isTerritoryVacant: boolean = true
): AutomatedScoringResult {
  const reasons: string[] = [];
  let score = 50; // base

  // 1. Liquid Capital check (Baseline benchmark: 2x plan fee)
  let liquidityStatus: 'pass' | 'warning' | 'fail' = 'pass';
  const minRequiredLiquid = Math.max(10000, plan.priceINR * 1.5);
  const liquidRatio = financials.liquidCapital / minRequiredLiquid;
  if (liquidRatio >= 1.5) {
    score += 20;
    reasons.push(`Liquid reserves qualify comfortably for ${plan.title} tier.`);
  } else if (liquidRatio >= 1.0) {
    score += 15;
    reasons.push(`Liquid capital satisfies ${plan.title} requirement.`);
  } else if (liquidRatio >= 0.7) {
    liquidityStatus = 'warning';
    score += 5;
    reasons.push(`Liquid reserves slightly below optimal reserve buffer.`);
  } else {
    liquidityStatus = 'fail';
    score -= 20;
    reasons.push(`Insufficient liquid capital for ${plan.title}.`);
  }

  // 2. Net worth check (Baseline benchmark: 3x plan fee)
  let netWorthStatus: 'pass' | 'warning' | 'fail' = 'pass';
  const minRequiredNW = Math.max(25000, plan.priceINR * 3.0);
  const nwRatio = financials.netWorth / minRequiredNW;
  if (nwRatio >= 2.0) {
    score += 15;
    reasons.push(`Total verified net worth provides solid commercial stability.`);
  } else if (nwRatio >= 1.0) {
    score += 10;
    reasons.push(`Net worth meets tier solvency requirement.`);
  } else {
    netWorthStatus = 'warning';
    score -= 5;
    reasons.push(`Net worth is borderline for higher volume project dispatch.`);
  }

  // 3. Credit Score check
  let creditStatus: 'pass' | 'warning' | 'fail' = 'pass';
  if (financials.creditScoreTier === '750_plus') {
    score += 10;
    reasons.push('Tier 1 prime credit tier (750+) verified');
  } else if (financials.creditScoreTier === '700_749') {
    score += 6;
    reasons.push('Good standing credit tier (700-749)');
  } else if (financials.creditScoreTier === '650_699') {
    creditStatus = 'warning';
    reasons.push('Fair credit standing (650-699); subject to collateral review');
  } else {
    creditStatus = 'fail';
    score -= 15;
    reasons.push('Credit tier requires guarantor or additional collateral');
  }

  // 4. Operational experience
  if (experienceYears >= 5) {
    score += 5;
    reasons.push(`Robust operational background (${experienceYears} years management)`);
  } else if (experienceYears >= 2) {
    score += 2;
  }

  // Territory
  if (!isTerritoryVacant) {
    score = Math.min(score, 60);
    reasons.push('Requested territory conflicts with existing protected franchise radius');
  } else {
    reasons.push('Requested territorial sector is available and unassigned');
  }

  const finalScore = Math.min(100, Math.max(10, score));

  let preliminaryVerdict: AutomatedScoringResult['preliminaryVerdict'] = 'manual_review_required';
  if (finalScore >= 85 && liquidityStatus === 'pass' && isTerritoryVacant) {
    preliminaryVerdict = 'auto_approved';
  } else if (finalScore >= 70 && liquidityStatus !== 'fail') {
    preliminaryVerdict = 'conditional_fast_track';
  } else if (!isTerritoryVacant) {
    preliminaryVerdict = 'waitlist';
  }

  return {
    score: finalScore,
    liquidityStatus,
    netWorthStatus,
    creditStatus,
    territoryAvailable: isTerritoryVacant,
    backgroundCheckPassed: true,
    preliminaryVerdict,
    reasons,
    calculatedAt: new Date().toISOString()
  };
}

export class FranchiseStorageService {
  /**
   * Initializes local stores with rich seed data if empty
   */
  static init() {
    if (typeof window === 'undefined') return;

    if (!localStorage.getItem(STORAGE_KEYS.APPLICATIONS)) {
      localStorage.setItem(STORAGE_KEYS.APPLICATIONS, JSON.stringify(INITIAL_APPLICATIONS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS)) {
      localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(INITIAL_AUDIT_LOGS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.SYNC_QUEUE)) {
      localStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.EMAILS)) {
      localStorage.setItem(STORAGE_KEYS.EMAILS, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS)) {
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify([]));
    }
  }

  // Applications
  static getApplications(): FranchiseApplication[] {
    this.init();
    try {
      const data = localStorage.getItem(STORAGE_KEYS.APPLICATIONS);
      return data ? JSON.parse(data) : INITIAL_APPLICATIONS;
    } catch {
      return INITIAL_APPLICATIONS;
    }
  }

  static getApplicationById(id: string): FranchiseApplication | undefined {
    const apps = this.getApplications();
    return apps.find(a => a.id === id);
  }

  static saveApplication(app: FranchiseApplication, recordAudit: boolean = true) {
    const apps = this.getApplications();
    const existingIndex = apps.findIndex(a => a.id === app.id);
    if (existingIndex >= 0) {
      apps[existingIndex] = { ...app, updatedAt: new Date().toISOString() };
    } else {
      apps.unshift(app);
    }
    localStorage.setItem(STORAGE_KEYS.APPLICATIONS, JSON.stringify(apps));

    // Cloud persistence via Firebase Firestore
    syncApplicationToFirestore(app).catch(() => {});

    if (this.isSimulatedOffline()) {
      this.enqueueSyncItem({
        id: 'sync_' + Math.random().toString(36).substring(2, 9),
        operation: existingIndex >= 0 ? 'update_status' : 'create_application',
        payload: app,
        queuedAt: new Date().toISOString(),
        retryCount: 0,
        status: 'pending'
      });
    }

    if (recordAudit) {
      this.recordAuditLog(
        existingIndex >= 0 ? 'APPLICATION_UPDATED' : 'APPLICATION_SUBMITTED',
        app.id,
        `Application ${app.id} for ${app.applicant.fullName} (${app.planId}) saved. Status: ${app.status}.`,
        'applicant'
      );
    }
  }

  static updateApplicationStatus(
    id: string,
    newStatus: FranchiseApplication['status'],
    userEmail: string,
    userRole: UserRole,
    noteText?: string,
    biometricVerified?: boolean,
    expectedVersion?: number,
    decisionReason?: string
  ): FranchiseApplication | null {
    const apps = this.getApplications();
    const target = apps.find(a => a.id === id);
    if (!target) return null;

    // Optimistic concurrency locking
    if (expectedVersion !== undefined && target.concurrencyVersion !== undefined && target.concurrencyVersion !== expectedVersion) {
      console.warn(`[Concurrency Conflict] Application ${id} version mismatch (current: ${target.concurrencyVersion}, expected: ${expectedVersion})`);
      throw new Error('Concurrency conflict: This application record was modified by another officer. Please refresh to view latest state.');
    }

    const previousStatus = target.status;
    target.status = newStatus;
    target.updatedAt = new Date().toISOString();
    target.concurrencyVersion = (target.concurrencyVersion || 1) + 1;

    // Maintain immutable chronological status audit history
    if (!target.statusHistory) {
      target.statusHistory = [];
    }
    target.statusHistory.push({
      id: 'sh_' + Math.random().toString(36).substring(2, 9),
      fromStatus: previousStatus,
      toStatus: newStatus,
      timestamp: new Date().toISOString(),
      changedByEmail: userEmail,
      changedByRole: userRole,
      reason: decisionReason || noteText
    });

    if (decisionReason) {
      if (newStatus === 'approved') {
        target.decisionReason = decisionReason;
      } else if (newStatus === 'rejected' || newStatus === 'declined') {
        target.rejectionReason = decisionReason;
      }
    }

    if (biometricVerified) {
      target.biometricApprovalVerified = true;
      target.biometricApprovalTimestamp = new Date().toISOString();
    }

    if (noteText) {
      const newNote: ReviewNote = {
        id: 'note_' + Math.random().toString(36).substring(2, 9),
        authorRole: userRole,
        authorName: userEmail.split('@')[0],
        text: noteText,
        timestamp: new Date().toISOString()
      };
      target.reviewNotes.push(newNote);
    }

    localStorage.setItem(STORAGE_KEYS.APPLICATIONS, JSON.stringify(apps));

    // Cloud persistence
    syncApplicationToFirestore(target).catch(() => {});

    // Audit log
    this.recordAuditLog(
      `STATUS_CHANGED_TO_${newStatus.toUpperCase()}`,
      id,
      `Status transitioned from "${previousStatus}" to "${newStatus}". Biometric Verified: ${!!biometricVerified}. Reason: ${decisionReason || noteText || 'None'}`,
      userRole,
      userEmail
    );

    if (this.isSimulatedOffline()) {
      this.enqueueSyncItem({
        id: 'sync_' + Math.random().toString(36).substring(2, 9),
        operation: 'update_status',
        payload: { id, status: newStatus, biometricVerified, noteText },
        queuedAt: new Date().toISOString(),
        retryCount: 0,
        status: 'pending'
      });
    }

    return target;
  }

  static assignReviewer(
    appId: string,
    reviewerEmail: string,
    reviewerName: string,
    actorEmail: string
  ): boolean {
    const apps = this.getApplications();
    const target = apps.find(a => a.id === appId);
    if (!target) return false;

    target.assignedReviewer = reviewerName;
    target.assignedReviewerEmail = reviewerEmail;
    target.updatedAt = new Date().toISOString();
    target.concurrencyVersion = (target.concurrencyVersion || 1) + 1;

    localStorage.setItem(STORAGE_KEYS.APPLICATIONS, JSON.stringify(apps));
    syncApplicationToFirestore(target).catch(() => {});

    this.recordAuditLog(
      'REVIEWER_ASSIGNED',
      appId,
      `Assigned review officer ${reviewerName} (${reviewerEmail}) to application ${appId}`,
      'franchise_manager',
      actorEmail
    );
    return true;
  }

  static addReviewNote(
    appId: string,
    text: string,
    authorRole: UserRole = 'franchise_manager',
    authorName: string = 'Authorized Officer'
  ): boolean {
    const apps = this.getApplications();
    const target = apps.find(a => a.id === appId);
    if (!target) return false;

    if (!target.reviewNotes) {
      target.reviewNotes = [];
    }

    const newNote: ReviewNote = {
      id: 'note_' + Math.random().toString(36).substring(2, 9),
      authorRole,
      authorName,
      text,
      timestamp: new Date().toISOString()
    };

    target.reviewNotes.push(newNote);
    target.updatedAt = new Date().toISOString();
    target.concurrencyVersion = (target.concurrencyVersion || 1) + 1;

    localStorage.setItem(STORAGE_KEYS.APPLICATIONS, JSON.stringify(apps));
    syncApplicationToFirestore(target).catch(() => {});

    this.recordAuditLog(
      'NOTE_ADDED',
      appId,
      `Internal review note added by ${authorName} (${authorRole}): "${text.substring(0, 60)}${text.length > 60 ? '...' : ''}"`,
      authorRole,
      authorName
    );

    return true;
  }

  static updateDocumentStatus(
    appId: string,
    docId: string,
    newStatus: DocumentUpload['status'],
    notes?: string,
    reviewerEmail: string = 'director@truedealglobal.com'
  ): boolean {
    const apps = this.getApplications();
    const target = apps.find(a => a.id === appId);
    if (!target) return false;

    const doc = target.documents.find(d => d.id === docId);
    if (!doc) return false;

    doc.status = newStatus;
    if (notes) {
      doc.auditNotes = notes;
    }
    target.updatedAt = new Date().toISOString();
    target.concurrencyVersion = (target.concurrencyVersion || 1) + 1;

    localStorage.setItem(STORAGE_KEYS.APPLICATIONS, JSON.stringify(apps));
    syncApplicationToFirestore(target).catch(() => {});

    this.recordAuditLog(
      `DOC_STATUS_${newStatus.toUpperCase()}`,
      appId,
      `Document "${doc.name}" marked as ${newStatus}. Notes: ${notes || 'None'}`,
      'reviewer',
      reviewerEmail
    );
    return true;
  }

  static addDocument(id: string, doc: DocumentUpload): boolean {
    const apps = this.getApplications();
    const target = apps.find(a => a.id === id);
    if (!target) return false;

    target.documents.unshift(doc);
    target.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEYS.APPLICATIONS, JSON.stringify(apps));

    this.recordAuditLog(
      'DOCUMENT_ENCRYPTED_UPLOAD',
      id,
      `Uploaded encrypted document ${doc.name} (${doc.type}) with AES-GCM-256 and checksum ${doc.cipherChecksum.substring(0, 16)}...`,
      'applicant'
    );

    return true;
  }

  static addPayment(id: string, payment: PaymentRecord): boolean {
    const apps = this.getApplications();
    const target = apps.find(a => a.id === id);
    if (!target) return false;

    const existingIdx = target.payments.findIndex(
      (p) =>
        p.id === payment.id ||
        (payment.razorpayOrderId && p.razorpayOrderId === payment.razorpayOrderId)
    );

    if (existingIdx >= 0) {
      const existing = target.payments[existingIdx];
      // Never overwrite an already CAPTURED / SUCCESS payment with a downgraded attempt
      const alreadyFinalized =
        existing.razorpayStatus === 'CAPTURED' ||
        existing.payuStatus === 'SUCCESS' ||
        existing.status === 'completed';
      if (!alreadyFinalized || payment.razorpayStatus === 'REFUND_INITIATED' || payment.razorpayStatus === 'REFUNDED') {
        target.payments[existingIdx] = { ...existing, ...payment };
      }
    } else {
      target.payments.unshift(payment);
    }

    // Update top-level payment metadata cleanly while NEVER auto-approving application.status
    const nextPayStatus = payment.razorpayStatus || payment.payuStatus;
    if (nextPayStatus) {
      if (target.paymentStatus !== 'CAPTURED' && target.paymentStatus !== 'SUCCESS') {
        target.paymentStatus = nextPayStatus;
      } else if (nextPayStatus === 'REFUND_INITIATED' || nextPayStatus === 'REFUNDED' || nextPayStatus === 'REFUND_PENDING') {
        target.paymentStatus = nextPayStatus;
      }
    }
    if (payment.razorpayOrderId) target.razorpayOrderId = payment.razorpayOrderId;
    if (payment.razorpayPaymentId) target.razorpayPaymentId = payment.razorpayPaymentId;
    if (payment.txnId) target.txnId = payment.txnId;

    target.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEYS.APPLICATIONS, JSON.stringify(apps));
    syncApplicationToFirestore(target).catch(() => {});

    this.recordAuditLog(
      'PAYMENT_RECORDED',
      id,
      `Recorded payment ${payment.currency === 'INR' ? '₹' : '$'}${payment.amount.toLocaleString()} ${payment.currency} via ${payment.method}. Ref: ${payment.razorpayPaymentId || payment.razorpayOrderId || payment.referenceCode} (Status: ${nextPayStatus || payment.status})`,
      'applicant'
    );

    return true;
  }

  static updatePaymentStatus(
    appId: string,
    paymentId: string,
    newStatus: 'completed' | 'processing' | 'failed',
    verifiedBy: string = 'director@truedealglobal.com',
    extra?: Partial<PaymentRecord>
  ): boolean {
    const apps = this.getApplications();
    const target = apps.find(a => a.id === appId);
    if (!target) return false;

    const payment = target.payments.find(
      p => p.id === paymentId || (extra?.razorpayOrderId && p.razorpayOrderId === extra.razorpayOrderId)
    );
    if (!payment) return false;

    payment.status = newStatus;
    if (extra) {
      Object.assign(payment, extra);
    }

    // Keep payment confirmation strictly separate from franchise application approval!
    if (extra?.razorpayStatus) {
      target.paymentStatus = extra.razorpayStatus;
    } else if (extra?.payuStatus) {
      target.paymentStatus = extra.payuStatus;
    } else if (newStatus === 'completed') {
      target.paymentStatus = payment.method === 'razorpay' ? 'CAPTURED' : 'SUCCESS';
    } else if (newStatus === 'failed' && target.paymentStatus !== 'CAPTURED' && target.paymentStatus !== 'SUCCESS') {
      target.paymentStatus = 'FAILED';
    }

    if (payment.razorpayOrderId) target.razorpayOrderId = payment.razorpayOrderId;
    if (payment.razorpayPaymentId) target.razorpayPaymentId = payment.razorpayPaymentId;

    // Only transition legacy bank deposits if application was already approved & contract issued
    if (newStatus === 'completed' && payment.type === 'franchise_deposit' && target.status === 'contract_issued') {
      target.status = 'deposit_paid';
    }

    target.updatedAt = new Date().toISOString();

    localStorage.setItem(STORAGE_KEYS.APPLICATIONS, JSON.stringify(apps));
    this.saveApplication(target, false);

    this.recordAuditLog(
      'PAYMENT_STATUS_UPDATED',
      appId,
      `Payment ${paymentId} status updated to ${extra?.razorpayStatus || extra?.payuStatus || newStatus} by ${verifiedBy}. Ref: ${payment.razorpayPaymentId || payment.referenceCode}`,
      'director',
      verifiedBy
    );

    return true;
  }

  // Audit Logs
  static getAuditLogs(): AuditLogEntry[] {
    this.init();
    try {
      const data = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
      return data ? JSON.parse(data) : INITIAL_AUDIT_LOGS;
    } catch {
      return INITIAL_AUDIT_LOGS;
    }
  }

  static async recordAuditLog(
    action: string,
    resourceId: string,
    details: string,
    userRole: string = 'system',
    userEmail: string = 'director@truedealglobal.com'
  ) {
    const timestamp = new Date().toISOString();
    const checksum = await generateAuditChecksum(timestamp, userEmail, action, resourceId, details);

    const entry: AuditLogEntry = {
      id: 'audit_' + Math.random().toString(36).substring(2, 9),
      timestamp,
      userEmail,
      userRole,
      action,
      resourceId,
      details,
      ipOrClient: navigator.userAgent.includes('Mobile') ? 'Mobile Touch Client' : 'Desktop Enterprise Console',
      syncStatus: this.isSimulatedOffline() ? 'queued_offline' : 'synced',
      checksum
    };

    const logs = this.getAuditLogs();
    logs.unshift(entry);
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(logs.slice(0, 200)));
    syncAuditLogToFirestore(entry).catch(() => {});
  }

  // Offline Sync Queue
  static getSyncQueue(): SyncQueueItem[] {
    this.init();
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SYNC_QUEUE);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  static enqueueSyncItem(item: SyncQueueItem) {
    const queue = this.getSyncQueue();
    queue.push(item);
    localStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(queue));
  }

  static async processSyncQueue(): Promise<{
    successCount: number;
    failedCount: number;
    errors: string[];
  }> {
    const queue = this.getSyncQueue();
    if (queue.length === 0) {
      return { successCount: 0, failedCount: 0, errors: [] };
    }

    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    // Simulate batch network handshake and cryptographic payload transmission
    for (const item of queue) {
      try {
        // Mock 120ms roundtrip per item
        await new Promise(r => setTimeout(r, 120));
        successCount++;
        item.status = 'synced';
      } catch (err: any) {
        failedCount++;
        item.status = 'failed';
        errors.push(`Item ${item.id} sync failed: ${err?.message || 'Network timeout'}`);
      }
    }

    // Clear processed items
    const remaining = queue.filter(q => q.status === 'failed');
    localStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(remaining));

    // Audit log
    await this.recordAuditLog(
      'OFFLINE_SYNC_EXECUTED',
      'SYNC_BATCH',
      `Background sync batch completed: ${successCount} successful, ${failedCount} errors. Remaining in queue: ${remaining.length}`,
      'system'
    );

    return { successCount, failedCount, errors };
  }

  static clearSyncQueue() {
    localStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify([]));
  }

  // Simulated Offline Mode
  static isSimulatedOffline(): boolean {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEYS.OFFLINE_SIM) === 'true';
  }

  static setSimulatedOffline(val: boolean) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.OFFLINE_SIM, val ? 'true' : 'false');
  }

  // Export audit logs
  static exportAuditLogsCsv(): string {
    const logs = this.getAuditLogs();
    const headers = ['ID', 'Timestamp', 'User Email', 'Role', 'Action', 'Resource ID', 'Details', 'Sync Status', 'Checksum'];
    const rows = logs.map(l => [
      l.id,
      l.timestamp,
      `"${l.userEmail}"`,
      l.userRole,
      l.action,
      l.resourceId,
      `"${l.details.replace(/"/g, '""')}"`,
      l.syncStatus,
      l.checksum
    ]);
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  static exportAuditLogsJson(): string {
    const logs = this.getAuditLogs();
    return JSON.stringify(logs, null, 2);
  }

  // Admin-Configurable Compliance & Policy Settings
  static getComplianceConfig(): CompanyComplianceConfig {
    if (typeof window === 'undefined') return DEFAULT_COMPLIANCE_CONFIG;
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.COMPLIANCE_CONFIG);
      if (!saved) return DEFAULT_COMPLIANCE_CONFIG;
      return { ...DEFAULT_COMPLIANCE_CONFIG, ...JSON.parse(saved) };
    } catch {
      return DEFAULT_COMPLIANCE_CONFIG;
    }
  }

  static saveComplianceConfig(
    updates: Partial<CompanyComplianceConfig>,
    actorEmail: string = 'director@truedealglobal.com'
  ): CompanyComplianceConfig {
    const current = this.getComplianceConfig();
    const merged: CompanyComplianceConfig = {
      ...current,
      ...updates,
      lastUpdatedAt: new Date().toISOString()
    };
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.COMPLIANCE_CONFIG, JSON.stringify(merged));
    }
    this.recordAuditLog(
      'COMPLIANCE_CONFIG_UPDATED',
      'PORTAL_COMPLIANCE',
      `Updated legal/tax compliance configuration (GST status: ${merged.gstStatus}, Refund window: ${merged.refundWindowDays} days).`,
      'super_admin',
      actorEmail
    );
    return merged;
  }

  // Admin-Configurable Franchise Plan Pricing & Details
  static getPlans(): FranchisePlan[] {
    if (typeof window === 'undefined') return FRANCHISE_PLANS;
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PLAN_OVERRIDES);
      if (!saved) return FRANCHISE_PLANS;
      const overrides: Record<string, Partial<FranchisePlan>> = JSON.parse(saved);
      return FRANCHISE_PLANS.map(plan => {
        const override = overrides[plan.id];
        if (!override) return plan;
        const priceINR = typeof override.priceINR === 'number' && override.priceINR > 0 ? override.priceINR : plan.priceINR;
        return {
          ...plan,
          ...override,
          priceINR,
          priceUSD: calculateUSDPrice(priceINR)
        };
      });
    } catch {
      return FRANCHISE_PLANS;
    }
  }

  static updatePlanOverride(
    planId: string,
    updates: Partial<FranchisePlan>,
    actorEmail: string = 'director@truedealglobal.com'
  ): FranchisePlan[] {
    if (typeof window !== 'undefined') {
      let overrides: Record<string, Partial<FranchisePlan>> = {};
      try {
        const saved = localStorage.getItem(STORAGE_KEYS.PLAN_OVERRIDES);
        if (saved) overrides = JSON.parse(saved);
      } catch {}
      overrides[planId] = { ...(overrides[planId] || {}), ...updates };
      localStorage.setItem(STORAGE_KEYS.PLAN_OVERRIDES, JSON.stringify(overrides));
    }
    this.recordAuditLog(
      'FRANCHISE_PLAN_UPDATED',
      planId,
      `Admin updated package details/pricing for ${planId}.`,
      'super_admin',
      actorEmail
    );
    return this.getPlans();
  }

  // Customer Contact Inquiries Storage
  static getContactInquiries(): ContactInquiry[] {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CONTACT_INQUIRIES);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

  static saveContactInquiry(inquiry: ContactInquiry): ContactInquiry {
    const list = this.getContactInquiries();
    list.unshift(inquiry);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.CONTACT_INQUIRIES, JSON.stringify(list.slice(0, 200)));
    }
    return inquiry;
  }

  static updateContactInquiryStatus(
    id: string,
    status: ContactInquiry['status'],
    actorEmail: string = 'director@truedealglobal.com'
  ): ContactInquiry[] {
    const list = this.getContactInquiries();
    const target = list.find(i => i.id === id);
    if (target) {
      target.status = status;
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.CONTACT_INQUIRIES, JSON.stringify(list));
      }
      this.recordAuditLog(
        'CONTACT_INQUIRY_UPDATED',
        id,
        `Updated contact inquiry ${target.referenceCode} status to "${status}".`,
        'support_staff',
        actorEmail
      );
    }
    return list;
  }
}
