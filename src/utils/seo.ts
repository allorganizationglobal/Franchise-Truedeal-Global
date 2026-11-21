/**
 * TRUEDEAL GLOBAL Franchise Website - Technical SEO & Metadata Manager
 * Manages dynamic document title, meta descriptions, canonical URLs,
 * OpenGraph, Twitter cards, and indexing directives for all public and legal routes.
 */

export interface PageSeoConfig {
  title: string;
  description: string;
  canonicalUrl: string;
  robots: string;
  ogType?: string;
}

export const CANONICAL_BASE_URL = 'https://businessfranchise.truedealglobal.com';

const INDEX_ROBOTS = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
const NOINDEX_ROBOTS = 'noindex, nofollow, noarchive, nosnippet';

export const PAGE_SEO_MAP: Record<string, PageSeoConfig> = {
  plans: {
    title: 'TRUEDEAL GLOBAL Franchise Opportunities | Explore Franchise Plans',
    description:
      'Explore TRUEDEAL GLOBAL OPC PVT LTD franchise opportunities, compare transparent INR plans, review eligibility and policies, and apply online.',
    canonicalUrl: `${CANONICAL_BASE_URL}/`,
    robots: INDEX_ROBOTS,
    ogType: 'website'
  },
  pricing: {
    title: 'Pricing & Franchise Packages (INR) | TRUEDEAL GLOBAL OPC PVT LTD',
    description:
      'Complete transparent INR pricing, GST disclosures, inclusions, exclusions, activation timelines, and refund terms for all TRUEDEAL GLOBAL franchise packages.',
    canonicalUrl: `${CANONICAL_BASE_URL}/pricing`,
    robots: INDEX_ROBOTS,
    ogType: 'website'
  },
  about: {
    title: 'About Us | TRUEDEAL GLOBAL OPC PVT LTD Franchise Portal',
    description:
      'Learn about TRUEDEAL GLOBAL OPC PVT LTD, our incorporated business model, verified registrations, fulfillment operations, and franchise partner governance.',
    canonicalUrl: `${CANONICAL_BASE_URL}/about`,
    robots: INDEX_ROBOTS,
    ogType: 'website'
  },
  contact: {
    title: 'Contact Us & Official Support | TRUEDEAL GLOBAL OPC PVT LTD',
    description:
      'Contact TRUEDEAL GLOBAL OPC PVT LTD for franchise inquiries, billing clarifications, document verification, or grievance support via official email, phone, or inquiry form.',
    canonicalUrl: `${CANONICAL_BASE_URL}/contact`,
    robots: INDEX_ROBOTS,
    ogType: 'website'
  },
  terms: {
    title: 'Terms and Conditions | TRUEDEAL GLOBAL OPC PVT LTD',
    description:
      'Official Terms and Conditions governing access to the TRUEDEAL GLOBAL franchise registration portal, eligibility, payments, intellectual property, and Indian jurisdiction.',
    canonicalUrl: `${CANONICAL_BASE_URL}/terms`,
    robots: INDEX_ROBOTS,
    ogType: 'article'
  },
  privacy: {
    title: 'Privacy Policy (DPDP Act 2023) | TRUEDEAL GLOBAL OPC PVT LTD',
    description:
      'Read how TRUEDEAL GLOBAL OPC PVT LTD collects, encrypts, processes, and protects personal and KYC data in alignment with India’s Digital Personal Data Protection Act, 2023.',
    canonicalUrl: `${CANONICAL_BASE_URL}/privacy-policy`,
    robots: INDEX_ROBOTS,
    ogType: 'article'
  },
  refund: {
    title: 'Refund Policy | TRUEDEAL GLOBAL OPC PVT LTD',
    description:
      'Transparent Refund Policy detailing ₹0 application fee, pre-activation franchise fee refund eligibility, deductions, non-refundable scenarios, and bank-source timelines.',
    canonicalUrl: `${CANONICAL_BASE_URL}/refund-policy`,
    robots: INDEX_ROBOTS,
    ogType: 'article'
  },
  cancellation: {
    title: 'Cancellation Policy | TRUEDEAL GLOBAL OPC PVT LTD',
    description:
      'Official Cancellation Policy explaining how to cancel a pending franchise application or pre-activation package booking, notice rules, and settlement timelines.',
    canonicalUrl: `${CANONICAL_BASE_URL}/cancellation-policy`,
    robots: INDEX_ROBOTS,
    ogType: 'article'
  },
  'franchise-terms': {
    title: 'Franchise Agreement & Commercial Terms | TRUEDEAL GLOBAL OPC PVT LTD',
    description:
      'Understand franchise partner rights, manual KYC approval requirements, operational obligations, brand usage guidelines, and no-guaranteed-income commercial disclosures.',
    canonicalUrl: `${CANONICAL_BASE_URL}/franchise-terms`,
    robots: INDEX_ROBOTS,
    ogType: 'article'
  },
  grievance: {
    title: 'Grievance Redressal Policy | TRUEDEAL GLOBAL OPC PVT LTD',
    description:
      'Official Grievance Redressal mechanism, escalation tiers, acknowledgement timelines, and Grievance Officer contact channels for TRUEDEAL GLOBAL OPC PVT LTD.',
    canonicalUrl: `${CANONICAL_BASE_URL}/grievance-redressal`,
    robots: INDEX_ROBOTS,
    ogType: 'article'
  },
  delivery: {
    title: 'Shipping, Service & Onboarding Delivery Policy | TRUEDEAL GLOBAL',
    description:
      'Service and digital onboarding delivery timelines for TRUEDEAL GLOBAL franchise packages, license certificates, CRM portal access, and training schedules.',
    canonicalUrl: `${CANONICAL_BASE_URL}/delivery-policy`,
    robots: INDEX_ROBOTS,
    ogType: 'article'
  },
  apply: {
    title: 'Apply Online for TRUEDEAL GLOBAL Franchise | Official Registration',
    description:
      'Submit your TRUEDEAL GLOBAL franchise application online (₹0 application fee) with encrypted KYC upload, pre-payment review, and manual compliance verification.',
    canonicalUrl: `${CANONICAL_BASE_URL}/apply`,
    robots: INDEX_ROBOTS,
    ogType: 'website'
  },
  tracker: {
    title: 'Franchise Application Tracker | TRUEDEAL GLOBAL Onboarding Status',
    description:
      'Track your TRUEDEAL GLOBAL franchise application status, KYC document audit progress, payment reconciliation, and franchise agreement milestones securely.',
    canonicalUrl: `${CANONICAL_BASE_URL}/tracker`,
    robots: INDEX_ROBOTS,
    ogType: 'website'
  },
  api: {
    title: 'Partner Integration & API Specifications | TRUEDEAL GLOBAL',
    description:
      'Restricted technical API specifications, PayU webhook verification standards, and integration architecture for authorized TRUEDEAL GLOBAL administrators.',
    canonicalUrl: `${CANONICAL_BASE_URL}/api-docs`,
    robots: NOINDEX_ROBOTS,
    ogType: 'article'
  },
  'payment-result': {
    title: 'PayU Payment Verification Status | TRUEDEAL GLOBAL',
    description:
      'Private transaction verification and official receipt status page for TRUEDEAL GLOBAL franchise applicants.',
    canonicalUrl: `${CANONICAL_BASE_URL}/payment-result`,
    robots: NOINDEX_ROBOTS,
    ogType: 'website'
  },
  admin: {
    title: 'Executive Management Console | TRUEDEAL GLOBAL Portal',
    description:
      'Restricted administrative review portal for authorized TRUEDEAL GLOBAL OPC PVT LTD executive personnel and compliance officers.',
    canonicalUrl: `${CANONICAL_BASE_URL}/admin`,
    robots: NOINDEX_ROBOTS,
    ogType: 'website'
  },
  analytics: {
    title: 'Franchise Network Analytics | TRUEDEAL GLOBAL Portal',
    description:
      'Restricted network analytics and audit ledger for authorized TRUEDEAL GLOBAL OPC PVT LTD personnel.',
    canonicalUrl: `${CANONICAL_BASE_URL}/analytics`,
    robots: NOINDEX_ROBOTS,
    ogType: 'website'
  }
};

/**
 * Update document head metadata dynamically based on active tab / route
 */
export function updateDocumentSeo(tab: string): void {
  const config = PAGE_SEO_MAP[tab] || PAGE_SEO_MAP.plans;

  document.title = config.title;

  const setMetaTag = (selector: string, attrName: string, attrValue: string, content: string) => {
    let tag = document.querySelector(selector) as HTMLMetaElement | null;
    if (!tag) {
      tag = document.createElement('meta');
      tag.setAttribute(attrName, attrValue);
      document.head.appendChild(tag);
    }
    tag.content = content;
  };

  const setLinkTag = (rel: string, href: string) => {
    let link = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.rel = rel;
      document.head.appendChild(link);
    }
    link.href = href;
  };

  setMetaTag('meta[name="description"]', 'name', 'description', config.description);
  setMetaTag('meta[name="robots"]', 'name', 'robots', config.robots);

  setLinkTag('canonical', config.canonicalUrl);

  setMetaTag('meta[property="og:title"]', 'property', 'og:title', config.title);
  setMetaTag('meta[property="og:description"]', 'property', 'og:description', config.description);
  setMetaTag('meta[property="og:url"]', 'property', 'og:url', config.canonicalUrl);
  setMetaTag('meta[property="og:type"]', 'property', 'og:type', config.ogType || 'website');
  setMetaTag('meta[property="og:site_name"]', 'property', 'og:site_name', 'TRUEDEAL GLOBAL Franchise Network');
  setMetaTag('meta[property="og:image"]', 'property', 'og:image', `${CANONICAL_BASE_URL}/assets/truedeal_logo.png`);

  setMetaTag('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');
  setMetaTag('meta[name="twitter:title"]', 'name', 'twitter:title', config.title);
  setMetaTag('meta[name="twitter:description"]', 'name', 'twitter:description', config.description);
  setMetaTag('meta[name="twitter:image"]', 'name', 'twitter:image', `${CANONICAL_BASE_URL}/assets/truedeal_logo.png`);
}
