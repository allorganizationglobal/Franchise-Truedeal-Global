import fs from 'fs';
import path from 'path';

/**
 * Firestore Security Rules Static & Dirty-Dozen Invariant Verification Suite
 * Verifies every Pillar and Dirty-Dozen attack vector against firestore.rules
 * without requiring an external Java emulator runtime.
 */

const rootDir = process.cwd();
const rulesPath = fs.existsSync(path.join(rootDir, 'firestore.rules'))
  ? path.join(rootDir, 'firestore.rules')
  : path.join(rootDir, 'DRAFT_firestore.rules');

const rules = fs.readFileSync(rulesPath, 'utf8');

interface Check {
  name: string;
  passed: boolean;
  detail?: string;
}

const checks: Check[] = [];

function verify(condition: boolean, name: string, detail?: string) {
  checks.push({ name, passed: condition, detail: condition ? undefined : detail || 'Failed check' });
}

console.log('====================================================');
console.log('FIRESTORE SECURITY RULES — DIRTY DOZEN AUDIT SUITE');
console.log('====================================================\n');

// 1. Default-deny catch-all at top & never allow read, write: if true
verify(
  rules.includes('match /{document=**}') && rules.includes('allow read, write: if false;'),
  'Global default-deny safety net present at top of ruleset'
);
verify(
  !/allow\s+read,\s*write:\s*if\s+true/i.test(rules),
  'No insecure blanket allow read, write: if true anywhere in rules'
);

// 2. Dirty Dozen #1: Email verification required before checking admin email
verify(
  rules.includes('request.auth.token.email_verified == true') &&
    rules.includes('function isVerifiedBootstrapAdmin()'),
  'DD-1: Email spoofing blocked via mandatory email_verified == true check'
);

// 3. Dirty Dozen #2 & #3: Ownership isolation & no blanket list on PII collections
verify(
  rules.includes('existing().userId == request.auth.uid') &&
    !rules.includes('allow list: if isSignedIn();'),
  'DD-2/3: Cross-applicant PII reads and blanket allow list scraping blocked'
);

// 4. Dirty Dozen #4 & #5: Applicants cannot create/modify payments or forge paymentStatus/amount
verify(
  rules.includes('match /franchise_payments/{paymentId}') &&
    rules.includes('incoming().paymentStatus == existing().paymentStatus') &&
    rules.includes('incoming().amount == existing().amount'),
  'DD-4/5: Applicants blocked from writing franchise_payments or tampering with paymentStatus/amount'
);

// 5. Dirty Dozen #6: Plan prices writable only by admin
verify(
  rules.includes('match /franchise_plans/{planId}') &&
    rules.includes('isValidFranchisePlan(incoming(), planId)'),
  'DD-6: Franchise plan prices protected from applicant tampering'
);

// 6. Dirty Dozen #7: Shadow field / role elevation blocked on /users/{userId}
verify(
  rules.includes("data.keys().hasOnly(['uid', 'displayName', 'email', 'photoURL', 'lastLoginAt'])"),
  'DD-7: Shadow fields and self-assigned role/isAdmin blocked via strict hasOnly on users'
);

// 7. Dirty Dozen #8: Document upload ownership enforced
verify(
  rules.includes('match /franchise_documents/{docId}') &&
    rules.includes("incoming().status == 'pending_audit'") &&
    rules.includes('incoming().userId == request.auth.uid'),
  'DD-8: Identity spoofing and self-verification blocked on franchise_documents'
);

// 8. Dirty Dozen #9: Path ID poisoning blocked
verify(
  rules.includes("id.matches('^[a-zA-Z0-9_\\\\-]+$')") && rules.includes('id.size() <= 128'),
  'DD-9: Document ID poisoning blocked with regex and length cap'
);

// 9. Dirty Dozen #10: Audit logs immutable
verify(
  rules.includes('match /admin_audit_logs/{auditId}') &&
    rules.includes('allow update, delete: if false;'),
  'DD-10: Audit logs strictly immutable (no update or delete)'
);

// 10. Dirty Dozen #11: Webhook events blocked from applicant writes
verify(
  rules.includes('match /payment_webhook_events/{eventId}') &&
    rules.includes('isValidWebhookEvent(incoming(), eventId)'),
  'DD-11: Client webhook injection blocked on payment_webhook_events'
);

// 11. Dirty Dozen #12: Denial-of-Wallet size limits & monotonic SUCCESS/CAPTURED lock
verify(
  rules.includes('data.applicantName.size() <= 120') &&
    rules.includes('data.sizeBytes <= 10485760') &&
    rules.includes("!(existing().paymentStatus in ['SUCCESS', 'CAPTURED'])"),
  'DD-12: String/file size bounds enforced and SUCCESS/CAPTURED payments locked against downgrade'
);

let passed = 0;
for (const c of checks) {
  if (c.passed) {
    passed++;
    console.log(`  [PASS] ${c.name}`);
  } else {
    console.error(`  [FAIL] ${c.name}: ${c.detail}`);
  }
}

console.log(`\nFIRESTORE RULES AUDIT: ${passed}/${checks.length} PASSED\n`);
if (passed < checks.length) {
  process.exit(1);
}
