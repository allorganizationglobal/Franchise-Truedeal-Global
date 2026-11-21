# TRUEDEAL GLOBAL Franchise Portal — Firestore Security Specification (Phase 0 TDD)

## 1. Core Data Invariants
1. **Default-Deny Baseline:** Every unspecified Firestore path is denied by `match /{document=**} { allow read, write: if false; }`.
2. **Verified Identity Requirement:** All authenticated applicant and admin writes require `request.auth != null && request.auth.token.email_verified == true`.
3. **Strict Ownership Isolation:** Applicants may only read (`get`/`list`) their own records in `/franchise_applications`, `/applications`, `/franchise_payments`, `/franchise_documents`, and `/users/{uid}`.
4. **Immutable Payment & Pricing Integrity:** Applicants can NEVER write, forge, or update `franchise_payments`, `payment_webhook_events`, `franchise_plans`, or payment verification fields (`paymentStatus`, `amount`, `payuTransactionId`, `verifiedAt`).
5. **No Self-Assigned Roles:** Users creating or updating `/users/{userId}` are blocked by strict `hasOnly(...)` keys from adding `role`, `isAdmin`, or `permissions`.
6. **Path ID Poisoning Protection:** Single-document rules validate document IDs via `isValidId(id)` (`^[a-zA-Z0-9_\-]+$`, max 128 chars).
7. **Terminal State Locking:** Finalized applications (`approved`, `rejected`, `onboarded`) and settled payments (`SUCCESS`, `REFUNDED`) cannot be downgraded or edited by non-admins.
8. **Immutable Audit Logs:** `/admin_audit_logs` and `/audit_logs` prohibit `update` and `delete` for everyone including admins.

## 2. The "Dirty Dozen" Adversarial Payloads (All Must Return PERMISSION_DENIED)
1. **Unverified Admin Email Spoof:** Auth token claims `email: "allorganizationglobal@gmail.com"` with `email_verified: false` attempting to read `/franchise_payments`.
2. **Cross-Applicant PII Read:** Applicant A (`uid: "user_a"`) calling `get` on Applicant B's `/franchise_applications/TDG-2026-999` (`userId: "user_b"`).
3. **Blanket List Scraping:** Applicant A calling unscoped `list` on `/franchise_applications` without ownership constraint.
4. **Client-Side Payment Forgery:** Applicant attempting `create` on `/franchise_payments/pay_fake` with `paymentStatus: "SUCCESS"`.
5. **Payment Status Tampering on Application:** Applicant updating own `/franchise_applications/{id}` to set `paymentStatus: "SUCCESS"` or `applicationStatus: "approved"`.
6. **Plan Price Tampering:** Applicant attempting `update` on `/franchise_plans/plan_platinum` setting `priceINR: 1`.
7. **Shadow Field Injection (Ghost Field):** Applicant creating `/users/{uid}` with ghost field `isAdmin: true` or `role: "super_admin"`.
8. **Identity Spoofing on Document Create:** Applicant A creating `/franchise_documents/doc_1` with `userId: "user_b"`.
9. **ID Poisoning Attack:** Writing to `/franchise_applications/../../../evil$id` or a 1,500-character document ID.
10. **Audit Log Tampering / Deletion:** Even an authenticated admin attempting `update` or `delete` on `/admin_audit_logs/{auditId}`.
11. **Webhook Injection from Client:** Applicant attempting to write `/payment_webhook_events/evt_fake` directly via browser SDK.
12. **Oversized Denial-of-Wallet Payload:** Applicant submitting a 50KB string in `applicantName` or `fileName` exceeding `.size()` limits.
