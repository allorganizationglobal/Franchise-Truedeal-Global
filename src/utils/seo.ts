/**
 * TRUEDEAL GLOBAL Franchise Website - Technical SEO & Metadata Manager
 * Manages dynamic document title, meta descriptions, canonical URLs,
 * OpenGraph, Twitter cards, and Schema.org structured data.
 */

export interface PageSeoConfig {
  title: string;
  description: string;
  canonicalUrl: string;
  robots: string;
  ogType?: string;
}

export const CANONICAL_BASE_URL = 'https://businessfranchise.truedealglobal.com';
export const SECONDARY_DOMAIN = 'https://franchise.truedealglobal.com';

export const PAGE_SEO_MAP: Record<string, PageSeoConfig> = {
  plans: {
    title: 'TRUEDEAL GLOBAL Franchise Opportunities | Explore Franchise Plans',
    description: 'Explore TRUEDEAL GLOBAL franchise opportunities, compare available plans, understand eligibility and application steps, and enquire about becoming a franchise partner.',
    canonicalUrl: `${CANONICAL_BASE_URL}/`,
    robots: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
    ogType: 'website'
  },
  apply: {
    title: 'Apply for TRUEDEAL GLOBAL Franchise | Online Registration Portal',
    description: 'Submit your verified TRUEDEAL GLOBAL franchise application online. Fast-track onboarding, automated approval scoring, and secure document verification.',
    canonicalUrl: `${CANONICAL_BASE_URL}/#apply`,
    robots: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
    ogType: 'website'
  },
  tracker: {
    title: 'Franchise Application Tracker | TRUEDEAL GLOBAL Onboarding Status',
    description: 'Track your TRUEDEAL GLOBAL franchise application progress, milestone verification, compliance clearance, and legal agreement issuance in real time.',
    canonicalUrl: `${CANONICAL_BASE_URL}/#tracker`,
    robots: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
    ogType: 'website'
  },
  api: {
    title: 'Franchise Developer API Documentation | TRUEDEAL GLOBAL Integration Suite',
    description: 'Technical API documentation and webhook specifications for TrueDeal Global enterprise partners and third-party portal integrations.',
    canonicalUrl: `${CANONICAL_BASE_URL}/#api`,
    robots: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
    ogType: 'article'
  },
  admin: {
    title: 'Executive Management Console | TRUEDEAL GLOBAL Portal',
    description: 'Restricted administrative review portal for authorized TrueDeal Global executive personnel and compliance officers.',
    canonicalUrl: `${CANONICAL_BASE_URL}/#admin`,
    robots: 'noindex, nofollow, noarchive, nosnippet',
    ogType: 'website'
  },
  analytics: {
    title: 'Franchise Network Analytics | TRUEDEAL GLOBAL Portal',
    description: 'Restricted network performance and telemetry dashboard for authorized TrueDeal Global executive personnel.',
    canonicalUrl: `${CANONICAL_BASE_URL}/#analytics`,
    robots: 'noindex, nofollow, noarchive, nosnippet',
    ogType: 'website'
  }
};

/**
 * Update document head metadata dynamically based on active tab / route
 */
export function updateDocumentSeo(tab: string): void {
  const config = PAGE_SEO_MAP[tab] || PAGE_SEO_MAP.plans;

  // 1. Update Title
  document.title = config.title;

  // 2. Helper to set or create meta tag
  const setMetaTag = (selector: string, attrName: string, attrValue: string, content: string) => {
    let tag = document.querySelector(selector) as HTMLMetaElement | null;
    if (!tag) {
      tag = document.createElement('meta');
      tag.setAttribute(attrName, attrValue);
      document.head.appendChild(tag);
    }
    tag.content = content;
  };

  // 3. Helper to set or create link tag
  const setLinkTag = (rel: string, href: string) => {
    let link = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.rel = rel;
      document.head.appendChild(link);
    }
    link.href = href;
  };

  // Standard Meta
  setMetaTag('meta[name="description"]', 'name', 'description', config.description);
  setMetaTag('meta[name="robots"]', 'name', 'robots', config.robots);

  // Canonical
  setLinkTag('canonical', config.canonicalUrl);

  // OpenGraph
  setMetaTag('meta[property="og:title"]', 'property', 'og:title', config.title);
  setMetaTag('meta[property="og:description"]', 'property', 'og:description', config.description);
  setMetaTag('meta[property="og:url"]', 'property', 'og:url', config.canonicalUrl);
  setMetaTag('meta[property="og:type"]', 'property', 'og:type', config.ogType || 'website');
  setMetaTag('meta[property="og:site_name"]', 'property', 'og:site_name', 'TRUEDEAL GLOBAL Franchise Network');
  setMetaTag('meta[property="og:image"]', 'property', 'og:image', `${CANONICAL_BASE_URL}/assets/truedeal_logo.png`);

  // Twitter Cards
  setMetaTag('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');
  setMetaTag('meta[name="twitter:title"]', 'name', 'twitter:title', config.title);
  setMetaTag('meta[name="twitter:description"]', 'name', 'twitter:description', config.description);
  setMetaTag('meta[name="twitter:image"]', 'name', 'twitter:image', `${CANONICAL_BASE_URL}/assets/truedeal_logo.png`);
}
