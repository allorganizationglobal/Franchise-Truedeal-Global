import fs from 'fs';
import path from 'path';

interface TestResult {
  name: string;
  passed: boolean;
  message?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, name: string, message?: string) {
  results.push({
    name,
    passed: condition,
    message: condition ? undefined : message || 'Assertion failed'
  });
}

const rootDir = process.cwd();

console.log('----------------------------------------------------');
console.log('TRUEDEAL GLOBAL SEO & INFRASTRUCTURE TEST RUNNER');
console.log('----------------------------------------------------\n');

// 1. Inspect index.html
const indexHtmlPath = path.join(rootDir, 'index.html');
const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

// Title Check
const titleMatch = indexHtml.match(/<title>(.*?)<\/title>/i);
assert(!!titleMatch, 'HTML <title> tag exists');
if (titleMatch) {
  const title = titleMatch[1];
  assert(title.length >= 30 && title.length <= 70, `Title length is optimal (${title.length} chars)`, `Length was ${title.length}`);
  assert(title.includes('TRUEDEAL GLOBAL'), 'Title includes brand TRUEDEAL GLOBAL');
  assert(!title.includes('Vite') && !title.includes('React App'), 'Title is not a generic template');
}

// Meta Description Check
const descMatch = indexHtml.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/i);
assert(!!descMatch, 'HTML meta description exists');
if (descMatch) {
  const desc = descMatch[1];
  assert(desc.length >= 100 && desc.length <= 180, `Meta description length is optimal (${desc.length} chars)`, `Length was ${desc.length}`);
  assert(desc.includes('TRUEDEAL GLOBAL'), 'Meta description mentions TRUEDEAL GLOBAL');
}

// Canonical Link Check
const canonicalMatch = indexHtml.match(/<link\s+rel=["']canonical["']\s+href=["'](.*?)["']/i);
assert(!!canonicalMatch, 'Canonical link tag exists');
if (canonicalMatch) {
  assert(canonicalMatch[1] === 'https://businessfranchise.truedealglobal.com/', 'Canonical URL points to verified production root');
}

// Robots Directive Check
const robotsMatch = indexHtml.match(/<meta\s+name=["']robots["']\s+content=["'](.*?)["']/i);
assert(!!robotsMatch, 'Robots meta tag exists');
if (robotsMatch) {
  assert(robotsMatch[1].includes('index') && robotsMatch[1].includes('follow'), 'Robots tag allows indexing on homepage');
}

// OpenGraph & Twitter Checks
assert(indexHtml.includes('property="og:title"'), 'OpenGraph og:title exists');
assert(indexHtml.includes('property="og:description"'), 'OpenGraph og:description exists');
assert(indexHtml.includes('property="og:image"'), 'OpenGraph og:image exists');
assert(indexHtml.includes('property="og:url"'), 'OpenGraph og:url exists');
assert(indexHtml.includes('name="twitter:card"'), 'Twitter card tag exists');

// Hreflang Tags Check
assert(indexHtml.includes('hreflang="en"'), 'English hreflang alternate exists');
assert(indexHtml.includes('hreflang="hi"'), 'Hindi hreflang alternate exists');
assert(indexHtml.includes('hreflang="x-default"'), 'x-default hreflang exists');

// JSON-LD Structured Data Check
const jsonLdMatch = indexHtml.match(/<script type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/i);
assert(!!jsonLdMatch, 'Schema.org JSON-LD script block exists');
if (jsonLdMatch) {
  try {
    const parsed = JSON.parse(jsonLdMatch[1]);
    assert(parsed['@context'] === 'https://schema.org', 'JSON-LD context is https://schema.org');
    assert(Array.isArray(parsed['@graph']), 'JSON-LD uses @graph collection');
    
    const types = parsed['@graph'].map((item: any) => item['@type']);
    assert(types.includes('Organization'), 'Structured data includes Organization schema');
    assert(types.includes('WebSite'), 'Structured data includes WebSite schema');
    assert(types.includes('ItemList'), 'Structured data includes ItemList for franchise plans');
    assert(types.includes('FAQPage'), 'Structured data includes FAQPage schema');
    assert(types.includes('BreadcrumbList'), 'Structured data includes BreadcrumbList schema');
  } catch (err: any) {
    assert(false, 'JSON-LD is valid JSON', err.message);
  }
}

// Pre-render Noscript Check
assert(indexHtml.includes('<noscript>'), 'Noscript crawlable pre-render block exists for non-JS crawlers');
assert(indexHtml.includes('Official Franchise Plans'), 'Noscript includes verified franchise plans overview');

// 2. Inspect robots.txt
const robotsTxtPath = path.join(rootDir, 'public', 'robots.txt');
assert(fs.existsSync(robotsTxtPath), 'public/robots.txt exists on disk');
if (fs.existsSync(robotsTxtPath)) {
  const robotsTxt = fs.readFileSync(robotsTxtPath, 'utf8');
  assert(robotsTxt.includes('User-agent: *'), 'robots.txt specifies User-agent: *');
  assert(robotsTxt.includes('Allow: /'), 'robots.txt allows public routes');
  assert(robotsTxt.includes('Disallow: /admin'), 'robots.txt disallows /admin');
  assert(robotsTxt.includes('Disallow: /analytics'), 'robots.txt disallows /analytics');
  assert(robotsTxt.includes('Sitemap: https://businessfranchise.truedealglobal.com/sitemap.xml'), 'robots.txt references canonical sitemap');
}

// 3. Inspect sitemap.xml
const sitemapPath = path.join(rootDir, 'public', 'sitemap.xml');
assert(fs.existsSync(sitemapPath), 'public/sitemap.xml exists on disk');
if (fs.existsSync(sitemapPath)) {
  const sitemapXml = fs.readFileSync(sitemapPath, 'utf8');
  assert(sitemapXml.includes('<urlset'), 'sitemap.xml has valid <urlset> root');
  assert(sitemapXml.includes('https://businessfranchise.truedealglobal.com/'), 'sitemap.xml has canonical homepage');
  assert(sitemapXml.includes('https://businessfranchise.truedealglobal.com/#plans'), 'sitemap.xml has plans catalog');
  assert(sitemapXml.includes('https://businessfranchise.truedealglobal.com/#apply'), 'sitemap.xml has apply wizard');
  assert(!sitemapXml.includes('/admin'), 'sitemap.xml does NOT leak private /admin route');
  assert(!sitemapXml.includes('/analytics'), 'sitemap.xml does NOT leak private /analytics route');
}

// 4. Inspect vercel.json
const vercelJsonPath = path.join(rootDir, 'vercel.json');
assert(fs.existsSync(vercelJsonPath), 'vercel.json exists on disk');
if (fs.existsSync(vercelJsonPath)) {
  try {
    const vercelConfig = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf8'));
    assert(Array.isArray(vercelConfig.rewrites), 'vercel.json defines SPA rewrites');
    assert(Array.isArray(vercelConfig.headers), 'vercel.json defines HTTP security headers');
    assert(Array.isArray(vercelConfig.redirects), 'vercel.json defines canonical domain redirects');
    
    const hasSecondaryRedirect = vercelConfig.redirects.some((r: any) => 
      r.has && r.has.some((h: any) => h.value === 'franchise.truedealglobal.com')
    );
    assert(hasSecondaryRedirect, 'vercel.json permanently redirects secondary franchise.truedealglobal.com domain');
  } catch (err: any) {
    assert(false, 'vercel.json is valid JSON', err.message);
  }
}

// 5. Inspect SEO Utility Module
const seoUtilPath = path.join(rootDir, 'src', 'utils', 'seo.ts');
assert(fs.existsSync(seoUtilPath), 'src/utils/seo.ts exists');
if (fs.existsSync(seoUtilPath)) {
  const seoCode = fs.readFileSync(seoUtilPath, 'utf8');
  assert(seoCode.includes('PAGE_SEO_MAP'), 'seo.ts defines PAGE_SEO_MAP');
  assert(seoCode.includes('updateDocumentSeo'), 'seo.ts exports updateDocumentSeo function');
}

// Print Results
console.log('TEST SUMMARY:');
let passedCount = 0;
for (const r of results) {
  if (r.passed) {
    passedCount++;
    console.log(`  [PASS] ${r.name}`);
  } else {
    console.error(`  [FAIL] ${r.name}: ${r.message}`);
  }
}

console.log(`\nTOTAL: ${passedCount}/${results.length} PASSED.`);

if (passedCount < results.length) {
  process.exit(1);
} else {
  console.log('All technical SEO requirements verified successfully!\n');
}
