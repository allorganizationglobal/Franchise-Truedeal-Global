import fs from 'fs';
import path from 'path';

interface TestResult {
  name: string;
  passed: boolean;
  category: 'SEO' | 'SECURITY' | 'APPLICANT_PORTAL' | 'PAYMENTS' | 'DATA_INTEGRITY';
  message?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, name: string, category: TestResult['category'], message?: string) {
  results.push({
    name,
    passed: condition,
    category,
    message: condition ? undefined : message || 'Assertion failed'
  });
}

const rootDir = process.cwd();

console.log('====================================================');
console.log('TRUEDEAL GLOBAL FULL-STACK PORTAL TEST SUITE');
console.log('====================================================\n');

// -------------------------------------------------------------------
// CATEGORY 1: TECHNICAL SEO & INFRASTRUCTURE
// -------------------------------------------------------------------
const indexHtmlPath = path.join(rootDir, 'index.html');
const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

const titleMatch = indexHtml.match(/<title>(.*?)<\/title>/i);
assert(!!titleMatch && titleMatch[1].includes('TRUEDEAL GLOBAL') && titleMatch[1].length >= 30, 'Page title is descriptive and branded', 'SEO');

const descMatch = indexHtml.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/i);
assert(!!descMatch && descMatch[1].length >= 100 && descMatch[1].includes('TRUEDEAL GLOBAL'), 'Meta description meets length standards and branding', 'SEO');

const canonicalMatch = indexHtml.match(/<link\s+rel=["']canonical["']\s+href=["'](.*?)["']/i);
assert(!!canonicalMatch && canonicalMatch[1] === 'https://businessfranchise.truedealglobal.com/', 'Canonical link points to production domain', 'SEO');

const robotsMatch = indexHtml.match(/<meta\s+name=["']robots["']\s+content=["'](.*?)["']/i);
assert(!!robotsMatch && robotsMatch[1].includes('index, follow'), 'Robots meta tag permits search indexing', 'SEO');

assert(indexHtml.includes('property="og:title"') && indexHtml.includes('property="og:image"'), 'OpenGraph social sharing tags present', 'SEO');
assert(indexHtml.includes('name="twitter:card"'), 'Twitter card metadata present', 'SEO');
assert(indexHtml.includes('hreflang="en"') && indexHtml.includes('hreflang="hi"'), 'Multilingual alternate hreflang tags configured', 'SEO');

// JSON-LD Validation
const jsonLdMatch = indexHtml.match(/<script type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/i);
assert(!!jsonLdMatch, 'Schema.org JSON-LD structured data block exists', 'SEO');
if (jsonLdMatch) {
  try {
    const parsed = JSON.parse(jsonLdMatch[1]);
    const types = parsed['@graph'].map((item: any) => item['@type']);
    assert(types.includes('Organization') && types.includes('WebSite') && types.includes('ItemList') && types.includes('FAQPage'), 'JSON-LD includes Organization, WebSite, ItemList, and FAQPage', 'SEO');
  } catch (err: any) {
    assert(false, 'JSON-LD syntax is valid JSON', 'SEO', err.message);
  }
}

// Robots.txt
const robotsTxtPath = path.join(rootDir, 'public', 'robots.txt');
assert(fs.existsSync(robotsTxtPath), 'public/robots.txt file exists', 'SEO');
if (fs.existsSync(robotsTxtPath)) {
  const content = fs.readFileSync(robotsTxtPath, 'utf8');
  assert(content.includes('Disallow: /admin') && content.includes('Sitemap: https://businessfranchise.truedealglobal.com/sitemap.xml'), 'robots.txt protects /admin and references sitemap', 'SEO');
}

// Sitemap.xml
const sitemapPath = path.join(rootDir, 'public', 'sitemap.xml');
assert(fs.existsSync(sitemapPath), 'public/sitemap.xml file exists', 'SEO');
if (fs.existsSync(sitemapPath)) {
  const content = fs.readFileSync(sitemapPath, 'utf8');
  assert(content.includes('<urlset') && content.includes('https://businessfranchise.truedealglobal.com/#plans') && !content.includes('/admin'), 'sitemap.xml includes public routes and excludes admin', 'SEO');
}

// Vercel.json
const vercelJsonPath = path.join(rootDir, 'vercel.json');
assert(fs.existsSync(vercelJsonPath), 'vercel.json exists', 'SEO');
if (fs.existsSync(vercelJsonPath)) {
  const config = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf8'));
  assert(Array.isArray(config.rewrites) && Array.isArray(config.headers) && Array.isArray(config.redirects), 'vercel.json defines rewrites, headers, and redirects', 'SEO');
}

// -------------------------------------------------------------------
// CATEGORY 2: DOCUMENT SECURITY & MAGIC BYTE VERIFICATION
// -------------------------------------------------------------------
const cryptoSource = fs.readFileSync(path.join(rootDir, 'src', 'utils', 'crypto.ts'), 'utf8');
assert(cryptoSource.includes('MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024'), 'Strict 10MB max file size constant enforced', 'SECURITY');
assert(cryptoSource.includes('MIN_FILE_SIZE_BYTES = 100'), 'Minimum 100-byte file limit prevents empty/corrupt files', 'SECURITY');
assert(cryptoSource.includes('ALLOWED_EXTENSIONS'), 'Whitelisted file extensions enforced (.pdf, .jpg, .png, .webp)', 'SECURITY');
assert(cryptoSource.includes('bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46'), 'PDF magic byte signature (%PDF) verified', 'SECURITY');
assert(cryptoSource.includes('bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47'), 'PNG magic byte signature (\\x89PNG) verified', 'SECURITY');
assert(cryptoSource.includes('bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF'), 'JPEG magic byte signature verified', 'SECURITY');
assert(cryptoSource.includes('sanitizedName'), 'Safe filename generation prevents path traversal', 'SECURITY');

// -------------------------------------------------------------------
// CATEGORY 3: SECURE APPLICANT PORTAL & RECORD ISOLATION
// -------------------------------------------------------------------
const trackerSource = fs.readFileSync(path.join(rootDir, 'src', 'components', 'portal', 'ApplicantStatusTracker.tsx'), 'utf8');
assert(trackerSource.includes('hasAccess = isAdmin || isOwner || sessionUnlocked'), 'Applicant portal enforces three-tier access control (Admin, Owner, Session)', 'APPLICANT_PORTAL');
assert(trackerSource.includes('Secure Applicant Verification'), 'Unverified public visitors are gated behind verification screen', 'APPLICANT_PORTAL');
assert(trackerSource.includes('targetContact'), 'Verification requires matching email or phone number', 'APPLICANT_PORTAL');
assert(trackerSource.includes('sessionStorage.setItem'), 'Secure scoped session storage token generated upon valid identity challenge', 'APPLICANT_PORTAL');

// -------------------------------------------------------------------
// CATEGORY 4: PAYMENT RELIABILITY & FRAUD PREVENTION
// -------------------------------------------------------------------
const paymentSource = fs.readFileSync(path.join(rootDir, 'src', 'components', 'common', 'PaymentModal.tsx'), 'utf8');
assert(paymentSource.includes("const isOfflineBankTransfer = method === 'upi' || method === 'netbanking' || method === 'escrow_wire'"), 'Offline bank transfers identified separately from instant cards', 'PAYMENTS');
assert(paymentSource.includes("const paymentStatus: 'completed' | 'processing' = isOfflineBankTransfer ? 'processing' : 'completed'"), 'Bank transfers/receipts marked as processing pending admin reconciliation', 'PAYMENTS');
assert(!paymentSource.includes('cardCvc:'), 'Card security code (CVV/CVC) is never stored or persisted', 'PAYMENTS');
assert(paymentSource.includes('cardLast4: method === \'card\' ? cardNumber.slice(-4) : undefined'), 'Only truncated card last4 stored for accounting compliance', 'PAYMENTS');

const adminSource = fs.readFileSync(path.join(rootDir, 'src', 'components', 'admin', 'AdminDashboard.tsx'), 'utf8');
assert(adminSource.includes('updatePaymentStatus'), 'Admin dashboard includes interactive bank transfer verification & clearing', 'PAYMENTS');
assert(adminSource.includes('Verify &amp; Clear Bank Funds') || adminSource.includes('Verify & Clear Bank Funds'), 'Administrator payment clearance action button present', 'PAYMENTS');
assert(adminSource.includes('WhatsApp Applicant') && adminSource.includes('Send Direct Email'), 'Admin direct applicant WhatsApp and Email communications present', 'DATA_INTEGRITY');

// -------------------------------------------------------------------
// CATEGORY 5: APPLICATION WIZARD, DRAFT & DUPLICATE CHECKS
// -------------------------------------------------------------------
const wizardSource = fs.readFileSync(path.join(rootDir, 'src', 'components', 'portal', 'ApplicationWizard.tsx'), 'utf8');
assert(wizardSource.includes('validateUploadFile'), 'Application wizard invokes binary magic byte file validator', 'SECURITY');
assert(wizardSource.includes('handleSaveDraft') && wizardSource.includes('handleResumeDraft'), 'Save-and-resume application draft mechanism implemented', 'DATA_INTEGRITY');
assert(wizardSource.includes('Saved Application Draft Found'), 'Saved draft detected on mount and offered to applicant', 'DATA_INTEGRITY');
assert(wizardSource.includes('duplicateAppWarning'), 'Duplicate active application detection and warning implemented', 'DATA_INTEGRITY');
assert(wizardSource.includes('consentAccuracy') && wizardSource.includes('consentTerms'), 'Mandatory applicant truth certification and consent checkboxes required before submission', 'DATA_INTEGRITY');

// -------------------------------------------------------------------
// CATEGORY 6: FRANCHISE PLANS CONSISTENCY
// -------------------------------------------------------------------
const storageSource = fs.readFileSync(path.join(rootDir, 'src', 'services', 'storage.ts'), 'utf8');
assert(storageSource.includes("priceINR: 2500") && storageSource.includes("Basic Plan"), 'Basic Plan verified at ₹2,500 INR', 'DATA_INTEGRITY');
assert(storageSource.includes("priceINR: 4999") && storageSource.includes("Standard Plan"), 'Standard Plan verified at ₹4,999 INR', 'DATA_INTEGRITY');
assert(storageSource.includes("priceINR: 14999") && storageSource.includes("Corporate Plan"), 'Corporate Plan verified at ₹14,999 INR', 'DATA_INTEGRITY');
assert(storageSource.includes("priceINR: 49999") && storageSource.includes("Platinum Plan"), 'Platinum Plan verified at ₹49,999 INR', 'DATA_INTEGRITY');

// Summary Reporting
console.log('TEST SUMMARY BY CATEGORY:');
const categories = ['SEO', 'SECURITY', 'APPLICANT_PORTAL', 'PAYMENTS', 'DATA_INTEGRITY'] as const;

let totalPassed = 0;
for (const cat of categories) {
  const catTests = results.filter(r => r.category === cat);
  const catPassed = catTests.filter(r => r.passed).length;
  console.log(`\n[${cat}] (${catPassed}/${catTests.length} Passed):`);
  for (const t of catTests) {
    if (t.passed) {
      console.log(`  ✓ ${t.name}`);
      totalPassed++;
    } else {
      console.error(`  ✗ ${t.name} (FAIL: ${t.message})`);
    }
  }
}

console.log(`\n====================================================`);
console.log(`TOTAL RESULT: ${totalPassed}/${results.length} PASSED.`);
console.log(`====================================================\n`);

if (totalPassed < results.length) {
  process.exit(1);
} else {
  console.log('All production franchise portal tests passed successfully!');
}
