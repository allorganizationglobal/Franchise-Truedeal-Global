/**
 * TRUEDEAL GLOBAL OPC PVT LTD — Client Referral Tracking & 10% Commission Helper
 *
 * - Captures ?ref=CODE from URL on any visit and stores it for 30 days in both
 *   localStorage and an HTTP cookie (tdg_ref_code) so referral attribution persists
 *   across page reloads and sessions.
 * - Computes exact 10% franchise referral commission rounded to the nearest whole rupee.
 */

export const REFERRAL_COMMISSION_PERCENT = 10;
export const REFERRAL_PORTAL_URL = 'https://businessfranchise.truedealglobal.com';
export const REFERRAL_STORAGE_KEY = 'tdg_referral_attribution_v1';
export const REFERRAL_COOKIE_NAME = 'tdg_ref_code';
export const REFERRAL_TTL_DAYS = 30;
const REFERRAL_TTL_MS = REFERRAL_TTL_DAYS * 24 * 60 * 60 * 1000;

interface StoredReferralAttribution {
  code: string;
  capturedAt: number;
  expiresAt: number;
}

export function normalizeReferralCodeClient(raw?: string | null): string {
  const cleaned = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '');
  if (cleaned.length < 4 || cleaned.length > 32) return '';
  return cleaned;
}

/**
 * Exact 10% commission rounded to nearest whole rupee:
 * ₹2,500 -> ₹250 | ₹4,999 -> ₹500 | ₹9,99,999 -> ₹1,00,000
 */
export function calculateReferralCommissionINR(basePriceINR: number): number {
  if (!Number.isFinite(basePriceINR) || basePriceINR <= 0) return 0;
  return Math.round(basePriceINR * (REFERRAL_COMMISSION_PERCENT / 100));
}

export function buildReferralLink(referralCode: string): string {
  const clean = normalizeReferralCodeClient(referralCode);
  return `${REFERRAL_PORTAL_URL}/?ref=${encodeURIComponent(clean)}`;
}

export function buildWhatsAppReferralShareUrl(referralCode: string, referrerName?: string): string {
  const link = buildReferralLink(referralCode);
  const intro = referrerName ? `${referrerName} invited you to explore` : 'Explore';
  const text = `${intro} official TRUEDEAL GLOBAL OPC PVT LTD Business Franchise Opportunities (plans from ₹2,500 to ₹9,99,999).\n\nApply directly using my verified Partner Referral Link:\n${link}\n\nReferral Code: ${referralCode}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string, maxAgeSeconds: number): void {
  if (typeof document === 'undefined') return;
  const secureFlag = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${maxAgeSeconds}; path=/; SameSite=Lax${secureFlag}`;
}

function deleteCookie(name: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; max-age=0; path=/; SameSite=Lax`;
}

export function setStoredReferralCode(rawCode: string): string {
  const code = normalizeReferralCodeClient(rawCode);
  if (!code || typeof window === 'undefined') return '';
  const now = Date.now();
  const payload: StoredReferralAttribution = {
    code,
    capturedAt: now,
    expiresAt: now + REFERRAL_TTL_MS
  };
  try {
    localStorage.setItem(REFERRAL_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Non-blocking storage fallback
  }
  writeCookie(REFERRAL_COOKIE_NAME, code, Math.floor(REFERRAL_TTL_MS / 1000));
  return code;
}

export function getStoredReferralCode(): string {
  if (typeof window === 'undefined') return '';
  try {
    const raw = localStorage.getItem(REFERRAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredReferralAttribution;
      if (parsed?.code && typeof parsed.expiresAt === 'number' && Date.now() < parsed.expiresAt) {
        const clean = normalizeReferralCodeClient(parsed.code);
        if (clean) return clean;
      } else {
        localStorage.removeItem(REFERRAL_STORAGE_KEY);
      }
    }
  } catch {
    // Fallback to cookie
  }

  const cookieCode = normalizeReferralCodeClient(readCookie(REFERRAL_COOKIE_NAME));
  if (cookieCode) {
    return cookieCode;
  }
  return '';
}

export function clearStoredReferralCode(): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(REFERRAL_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
  deleteCookie(REFERRAL_COOKIE_NAME);
}

/**
 * Inspects window.location.search for ?ref=CODE and persists it for 30 days.
 * Returns the captured code if present, or existing active stored code.
 */
export function captureReferralFromUrl(): string {
  if (typeof window === 'undefined') return '';
  try {
    const params = new URLSearchParams(window.location.search);
    const refParam = params.get('ref') || params.get('referral') || params.get('referralCode');
    if (refParam) {
      const clean = setStoredReferralCode(refParam);
      if (clean) return clean;
    }
  } catch {
    // ignore URL parse error
  }
  return getStoredReferralCode();
}
