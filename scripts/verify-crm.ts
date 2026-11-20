/**
 * TRUEDEAL GLOBAL CRM Integration Test Suite
 * Validates server-side CRM lead ingestion, input validation, consent enforcement,
 * honeypot spam protection, rate limiting, and safe error handling.
 */

import { validateLeadPayload, checkRateLimit, ingestLeadToCrm } from '../src/server/leadService';

console.log('====================================================');
console.log('TRUEDEAL GLOBAL CRM INGESTION INTEGRATION TEST SUITE');
console.log('====================================================\n');

let passed = 0;
let failed = 0;

function assert(condition: boolean, desc: string) {
  if (condition) {
    console.log(`  [PASS] ${desc}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${desc}`);
    failed++;
  }
}

// 1. Validation: Missing Name
const res1 = validateLeadPayload({
  name: '',
  email: 'investor@example.com',
  phone: '+91 9876543210',
  service: 'Standard Franchise',
  consent: true
});
assert(!res1.valid && !!res1.error, 'Rejects empty applicant name');

// 2. Validation: Invalid Email
const res2 = validateLeadPayload({
  name: 'Rajesh Sharma',
  email: 'not-an-email',
  phone: '+91 9876543210',
  service: 'Standard Franchise',
  consent: true
});
assert(!res2.valid && Boolean(res2.error?.includes('valid email')), 'Rejects invalid email format');

// 3. Validation: Missing Consent
const res3 = validateLeadPayload({
  name: 'Rajesh Sharma',
  email: 'investor@example.com',
  phone: '+91 9876543210',
  service: 'Standard Franchise',
  consent: false
});
assert(!res3.valid && Boolean(res3.error?.includes('Explicit consent is mandatory')), 'Strictly enforces consent=true');

// 4. Validation: Invalid Phone
const res4 = validateLeadPayload({
  name: 'Rajesh Sharma',
  email: 'investor@example.com',
  phone: '123',
  service: 'Standard Franchise',
  consent: true
});
assert(!res4.valid && Boolean(res4.error?.includes('between 7 and 15 digits')), 'Enforces phone digit length constraint');

// 5. Validation: Valid payload passes
const res5 = validateLeadPayload({
  name: 'Rajesh Sharma',
  email: 'investor@example.com',
  phone: '+91 9876543210',
  service: 'Corporate Franchise Plan',
  consent: true
});
assert(res5.valid === true, 'Accepts valid full payload');

// 6. Spam Prevention: Honeypot trap
async function testHoneypot() {
  const hpRes = await ingestLeadToCrm({
    name: 'Bot Spammer',
    email: 'spammer@bot.com',
    phone: '1234567890',
    service: 'Standard Franchise',
    consent: true,
    hp_website_url: 'http://spam-link.ru'
  });
  assert(!hpRes.success && hpRes.message.includes('Automated submission rejected'), 'Honeypot trap detects and blocks bot spam');
}

// 7. Rate Limiting Check
const rlIp = '198.51.100.99';
const rlEmail = 'ratelimit@example.com';
let rlBlocked = false;
for (let i = 0; i < 15; i++) {
  const rl = checkRateLimit(rlIp, rlEmail);
  if (!rl.allowed) {
    rlBlocked = true;
    break;
  }
}
assert(rlBlocked, 'Enforces IP & Email sliding window rate limiting');

async function run() {
  await testHoneypot();

  console.log('\n====================================================');
  console.log(`CRM TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
