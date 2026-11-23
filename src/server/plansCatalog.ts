/**
 * TRUEDEAL GLOBAL — Server-Side Authoritative Franchise Plan Pricing Catalog
 *
 * All Razorpay order amounts MUST be computed exclusively on the server
 * from this authoritative catalog (or protected admin-managed Firestore records).
 * Browser-submitted prices or totals are NEVER trusted.
 */

export interface AuthoritativePlan {
  id: string;
  tier: string;
  title: string;
  badge: string;
  priceINR: number;
  currency: 'INR';
  active: boolean;
  activationTimeline: string;
  benefits: string[];
}

export const AUTHORITATIVE_FRANCHISE_PLANS: readonly AuthoritativePlan[] = [
  {
    id: 'plan_basic',
    tier: 'basic',
    title: 'Basic Plan',
    badge: 'Starter',
    priceINR: 2500,
    currency: 'INR',
    active: true,
    activationTimeline: '2-3 Business Days post KYC & Fee Verification',
    benefits: [
      'Affiliate entry access to 5+ verified commercial services',
      '10%–15% commission tier (per Franchise Agreement)',
      'Digital onboarding kit & partner CRM access'
    ]
  },
  {
    id: 'plan_standard',
    tier: 'standard',
    title: 'Standard Plan',
    badge: 'Most Popular',
    priceINR: 4999,
    currency: 'INR',
    active: true,
    activationTimeline: '3-5 Business Days post KYC & Fee Verification',
    benefits: [
      'Commercial rights across 20+ verified business service verticals',
      '15%–25% commission tier (per Franchise Agreement)',
      'Authorized franchise certificate & marketing collateral'
    ]
  },
  {
    id: 'plan_corporate',
    tier: 'corporate',
    title: 'Corporate Plan',
    badge: 'High Growth',
    priceINR: 14999,
    currency: 'INR',
    active: true,
    activationTimeline: '5-7 Business Days post KYC & Fee Verification',
    benefits: [
      'Expanded multi-industry service catalog including e-commerce & IT',
      '25%–35% commission tier (per Franchise Agreement)',
      'Dedicated corporate onboarding manager & custom business toolkit'
    ]
  },
  {
    id: 'plan_platinum',
    tier: 'platinum',
    title: 'Platinum Plan',
    badge: 'Master Partner',
    priceINR: 49999,
    currency: 'INR',
    active: true,
    activationTimeline: '5-7 Business Days post KYC & Fee Verification',
    benefits: [
      'White-label commercial branding options & multi-city scope',
      '35%–45% commission tier (per Franchise Agreement)',
      'Dedicated account director & priority backend fulfillment'
    ]
  },
  {
    id: 'plan_entrepreneur',
    tier: 'entrepreneur',
    title: 'Entrepreneur Plan',
    badge: 'State Authority',
    priceINR: 99999,
    currency: 'INR',
    active: true,
    activationTimeline: '7-10 Business Days post KYC & Fee Verification',
    benefits: [
      'State-level territory coordination & CRM integration',
      '45%–55% commission tier (per Franchise Agreement)',
      'Priority commercial support & strategic partner review'
    ]
  },
  {
    id: 'plan_retirement',
    tier: 'retirement',
    title: 'Legacy & Succession Plan',
    badge: 'Long-Term',
    priceINR: 149999,
    currency: 'INR',
    active: true,
    activationTimeline: '7-10 Business Days post KYC & Fee Verification',
    benefits: [
      'Multi-year transferable franchise license under written agreement',
      'Full commercial service portfolio & dedicated fulfillment team',
      'Succession planning documentation & executive onboarding'
    ]
  },
  {
    id: 'plan_enterprise',
    tier: 'enterprise',
    title: 'Enterprise Plan',
    badge: 'Regional HQ',
    priceINR: 499999,
    currency: 'INR',
    active: true,
    activationTimeline: '10-14 Business Days post KYC & Legal Review',
    benefits: [
      'Multi-state regional hub commercial rights',
      'Custom enterprise fulfillment SLA & dedicated ops desk',
      'Executive legal & compliance onboarding support'
    ]
  },
  {
    id: 'plan_global',
    tier: 'global',
    title: 'Global Master Franchise',
    badge: 'Global Rights',
    priceINR: 999999,
    currency: 'INR',
    active: true,
    activationTimeline: '14-21 Business Days post Due Diligence & Legal Review',
    benefits: [
      'Cross-border commercial distribution & country-level rights',
      'Board-level onboarding & dedicated international support team',
      'Custom master franchise agreement & compliance documentation'
    ]
  }
];

export function getAuthoritativePlan(planId: string): AuthoritativePlan | null {
  if (!planId || typeof planId !== 'string') return null;
  const normalized = planId.trim();
  return AUTHORITATIVE_FRANCHISE_PLANS.find((p) => p.id === normalized && p.active) || null;
}

export interface ServerFeeCalculation {
  planId: string;
  planTitle: string;
  baseAmountINR: number;
  gstRatePercent: number;
  gstAmountINR: number;
  totalAmountINR: number;
  baseAmountPaise: number;
  gstAmountPaise: number;
  totalAmountPaise: number;
  formattedAmount: string; // Always exact 2 decimals e.g. "4999.00"
  currency: 'INR';
  gstMode: 'excluded' | 'included' | 'not_applicable';
}

/**
 * Computes authoritative server-side INR amount (rupees and paise) formatted strictly
 * for the Razorpay Orders API (integer paise >= 100).
 */
export function calculateServerPlanAmount(planId: string): ServerFeeCalculation | null {
  const plan = getAuthoritativePlan(planId);
  if (!plan) return null;

  // Server-controlled GST policy via environment variables (default: base price without fabricating unconfirmed tax)
  const rawMode = (process.env.RAZORPAY_GST_MODE || 'not_applicable').toLowerCase().trim();
  const gstMode: 'excluded' | 'included' | 'not_applicable' =
    rawMode === 'excluded' || rawMode === 'included' ? rawMode : 'not_applicable';
  const rawRate = Number(process.env.RAZORPAY_GST_RATE_PERCENT || '18');
  const gstRatePercent = gstMode === 'not_applicable' || !Number.isFinite(rawRate) || rawRate < 0 ? 0 : rawRate;

  let baseAmountINR = plan.priceINR;
  let gstAmountINR = 0;
  let totalAmountINR = plan.priceINR;

  if (gstMode === 'excluded' && gstRatePercent > 0) {
    gstAmountINR = Math.round(((baseAmountINR * gstRatePercent) / 100) * 100) / 100;
    totalAmountINR = Math.round((baseAmountINR + gstAmountINR) * 100) / 100;
  } else if (gstMode === 'included' && gstRatePercent > 0) {
    baseAmountINR = Math.round((totalAmountINR / (1 + gstRatePercent / 100)) * 100) / 100;
    gstAmountINR = Math.round((totalAmountINR - baseAmountINR) * 100) / 100;
  }

  const totalAmountPaise = Math.round(totalAmountINR * 100);
  const baseAmountPaise = Math.round(baseAmountINR * 100);
  const gstAmountPaise = Math.max(0, totalAmountPaise - baseAmountPaise);

  return {
    planId: plan.id,
    planTitle: plan.title,
    baseAmountINR,
    gstRatePercent,
    gstAmountINR,
    totalAmountINR,
    baseAmountPaise,
    gstAmountPaise,
    totalAmountPaise,
    formattedAmount: totalAmountINR.toFixed(2),
    currency: 'INR',
    gstMode
  };
}

