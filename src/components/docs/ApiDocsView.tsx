import { useState } from 'react';
import { Terminal, Copy, Check, ShieldCheck, Lock } from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import { isUserAdmin } from '../../services/firebase';

interface ApiDocsViewProps {
  currentUser?: FirebaseUser | null;
  onSignInGoogle?: () => void;
}

interface EndpointDoc {
  method: 'GET' | 'POST';
  path: string;
  title: string;
  description: string;
  authNote: string;
  sampleRequest?: Record<string, unknown>;
  sampleResponse: Record<string, unknown>;
}

const ENDPOINTS: EndpointDoc[] = [
  {
    method: 'POST',
    path: '/api/create-order',
    title: 'Create Razorpay Standard Checkout Order',
    description:
      'Validates applicant identity, looks up authoritative franchise package pricing & GST strictly on the server (plansCatalog.ts), prevents double payment on CAPTURED applications, creates a Razorpay Order in integer paise via official SDK, and returns public Key ID & Order ID.',
    authNote: 'Requires Authorization: Bearer <FIREBASE_ID_TOKEN>',
    sampleRequest: {
      applicationId: 'TDG-2026-1042',
      planId: 'plan_standard',
      paymentPurpose: 'franchise_deposit',
      applicantName: 'Applicant Name',
      phone: '+919876543210',
      termsAccepted: true
    },
    sampleResponse: {
      ok: true,
      order: {
        id: 'order_Q1AbCdEfGhIjKl',
        amount: 499900,
        currency: 'INR',
        keyId: 'rzp_test_U3VIznAN282H0E',
        mode: 'test'
      },
      pricing: {
        baseAmountINR: 4999,
        gstAmountINR: 0,
        finalAmountINR: 4999,
        amountPaise: 499900
      }
    }
  },
  {
    method: 'POST',
    path: '/api/verify-payment',
    title: 'Verify Razorpay Signature & Capture Status',
    description:
      'Verifies HMAC-SHA256(server_saved_order_id + "|" + razorpay_payment_id, RAZORPAY_KEY_SECRET) with timingSafeEqual, fetches payment via Razorpay API to verify order_id/amount/currency/captured status (never treating AUTHORIZED as CAPTURED), issues receipt REC-TDG-..., and sends SendGrid confirmation.',
    authNote: 'Requires Authorization: Bearer <FIREBASE_ID_TOKEN> (Owner or Admin)',
    sampleRequest: {
      razorpay_order_id: 'order_Q1AbCdEfGhIjKl',
      razorpay_payment_id: 'pay_Q1MnOpQrStUvWx',
      razorpay_signature: '<HMAC_SHA256_SIGNATURE>',
      applicationId: 'TDG-2026-1042'
    },
    sampleResponse: {
      ok: true,
      verified: true,
      captured: true,
      paymentStatus: 'CAPTURED',
      message: 'Payment verified and captured successfully. Franchise application remains queued for administrative approval.'
    }
  },
  {
    method: 'POST',
    path: '/api/webhooks/razorpay',
    title: 'Razorpay Raw-Body Webhook Receiver',
    description:
      'Reads exact raw request body, verifies X-Razorpay-Signature against RAZORPAY_WEBHOOK_SECRET using timingSafeEqual, deduplicates by X-Razorpay-Event-Id, handles payment.authorized, payment.captured, payment.failed, order.paid, refund.created, refund.processed, and refund.failed, and protects CAPTURED monotonically.',
    authNote: 'Verified via X-Razorpay-Signature (HMAC-SHA256 on raw body)',
    sampleResponse: {
      ok: true,
      duplicate: false,
      eventType: 'payment.captured',
      paymentStatus: 'CAPTURED'
    }
  },
  {
    method: 'GET',
    path: '/api/payments/razorpay/status',
    title: 'Razorpay Config Readiness & Status Sync',
    description:
      'GET ?mode=config returns public readiness metadata (zero secrets). Authenticated GET ?applicationId=... or ?orderId=... returns owner/admin payment history. Authenticated POST logs checkout dismissal (CANCELLED) or failure (FAILED) without ever allowing CAPTURED escalation.',
    authNote: 'Public for ?mode=config; Bearer token required for status/attempt logging',
    sampleResponse: {
      ok: true,
      config: {
        provider: 'razorpay_standard_checkout',
        mode: 'test',
        configured: true,
        publicKeyId: 'rzp_test_U3VIznAN282H0E'
      }
    }
  },
  {
    method: 'GET',
    path: '/api/admin/payments',
    title: 'Admin Razorpay Payment Ledger, Stats & Refund Controls',
    description:
      'Returns authoritative server Razorpay payment counts, captured INR collections, order/payment list, and webhook audit events. POST supports action: "reconcile_razorpay", "refund_razorpay", and "update_notes_razorpay".',
    authNote: 'Strictly Administrator Firebase ID Token required (403 for applicants)',
    sampleResponse: {
      ok: true,
      razorpayStats: {
        totalOrders: 12,
        pendingCount: 2,
        capturedCount: 9,
        failedCount: 1,
        refundedCount: 0,
        totalCapturedCollectionsINR: 124990
      }
    }
  },
  {
    method: 'POST',
    path: '/api/leads/ingest',
    title: 'Server-Side CRM Lead Ingestion Proxy',
    description:
      'Forwards validated franchise leads to TRUEDEAL GLOBAL CRM using server-side TRUEDEAL_LEAD_API_KEY (never exposed to browser).',
    authNote: 'Server-side x-api-key injected from environment',
    sampleRequest: {
      name: 'Applicant Name',
      email: 'applicant@example.com',
      phone: '+91-9876543210',
      service: 'Standard Franchise Plan',
      sourceWebsite: 'https://businessfranchise.truedealglobal.com/',
      consent: true
    },
    sampleResponse: {
      success: true,
      status: 'created'
    }
  },
  {
    method: 'GET',
    path: '/api/health',
    title: 'Service Health & Razorpay Configuration Status',
    description:
      'Returns server availability, CRM/SendGrid configuration flags (boolean only, zero secrets), and Razorpay Standard Checkout readiness status.',
    authNote: 'Public health probe (zero secrets exposed)',
    sampleResponse: {
      status: 'healthy',
      razorpay: {
        provider: 'razorpay_standard_checkout',
        mode: 'live',
        configured: true
      }
    }
  }
];

const CANONICAL_BASE = 'https://businessfranchise.truedealglobal.com';

export function ApiDocsView({ currentUser, onSignInGoogle }: ApiDocsViewProps) {
  const [selectedEndpoint, setSelectedEndpoint] = useState<EndpointDoc>(ENDPOINTS[0]);
  const [codeLang, setCodeLang] = useState<'curl' | 'js' | 'python'>('curl');
  const [copied, setCopied] = useState(false);

  // Restrict internal API & technical documentation strictly to authenticated Administrators
  const isAdminAuthorized = Boolean(currentUser && isUserAdmin(currentUser.email));

  if (!isAdminAuthorized) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center mx-auto text-indigo-600 dark:text-indigo-400 shadow-md">
          <Lock className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Internal API Documentation Restricted
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            Server architecture, Razorpay webhook specifications, and administrative endpoints are restricted to authorized
            TRUEDEAL GLOBAL administrators.
          </p>
        </div>
        {currentUser ? (
          <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl text-xs text-amber-800 dark:text-amber-300 max-w-md mx-auto">
            Signed in as <strong>{currentUser.email}</strong>. Administrator privileges are required to view internal API specifications.
          </div>
        ) : (
          onSignInGoogle && (
            <button
              type="button"
              onClick={onSignInGoogle}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              <span>Sign In with Administrator Account</span>
            </button>
          )
        )}
      </div>
    );
  }

  const handleCopy = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const getCodeSnippet = (ep: EndpointDoc, lang: 'curl' | 'js' | 'python') => {
    if (lang === 'curl') {
      return `curl -X ${ep.method} "${CANONICAL_BASE}${ep.path}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <FIREBASE_ID_TOKEN>"${
    ep.method === 'POST' && ep.sampleRequest
      ? ` \\
  -d '${JSON.stringify(ep.sampleRequest, null, 2)}'`
      : ''
  }`;
    }

    if (lang === 'js') {
      return `const response = await fetch("${CANONICAL_BASE}${ep.path}", {
  method: "${ep.method}",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer " + firebaseIdToken
  }${
    ep.method === 'POST' && ep.sampleRequest
      ? `,
  body: JSON.stringify(${JSON.stringify(ep.sampleRequest, null, 2)})`
      : ''
  }
});

const data = await response.json();
console.log(data);`;
    }

    return `import requests

url = "${CANONICAL_BASE}${ep.path}"
headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer <FIREBASE_ID_TOKEN>"
}
${
  ep.method === 'POST' && ep.sampleRequest
    ? `payload = ${JSON.stringify(ep.sampleRequest, null, 4)}
response = requests.post(url, json=payload, headers=headers)`
    : `response = requests.get(url, headers=headers)`
}
print(response.json())`;
  };

  return (
    <div className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8 space-y-8">
      <div className="space-y-2 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider">
          <Terminal className="w-4 h-4" />
          <span>TRUEDEAL GLOBAL OPC PVT LTD · Restricted Administrator API Reference</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">
          Razorpay Standard Checkout &amp; Portal Server APIs
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-3xl">
          Authoritative server-side endpoints deployed on{' '}
          <code className="font-mono text-indigo-600 dark:text-indigo-400">{CANONICAL_BASE}</code>. All Razorpay key
          secrets, webhook secrets, CRM keys, and SendGrid credentials remain strictly in server environment variables.
        </p>
      </div>

      <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-start gap-3 text-xs text-emerald-900 dark:text-emerald-200">
        <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
        <div>
          <strong>Zero Exposed Secrets:</strong> No Razorpay Key Secret, Razorpay Webhook Secret, CRM keys, or SendGrid
          API keys are embedded in frontend bundles. All sensitive endpoints cryptographically verify Firebase ID tokens
          via <code className="font-mono">Authorization: Bearer &lt;FIREBASE_ID_TOKEN&gt;</code>.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-3">
          <div className="p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
            <span className="font-semibold text-slate-500 block mb-1">Canonical Base URL</span>
            <code className="font-mono text-indigo-600 dark:text-indigo-400 text-[11px] block truncate">
              {CANONICAL_BASE}
            </code>
          </div>

          <div className="space-y-1.5">
            {ENDPOINTS.map((ep) => (
              <button
                key={ep.path}
                type="button"
                onClick={() => setSelectedEndpoint(ep)}
                className={`w-full text-left p-3 rounded-xl border transition-all text-xs cursor-pointer ${
                  selectedEndpoint.path === ep.path
                    ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-600 text-indigo-950 dark:text-indigo-100'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${
                      ep.method === 'POST'
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                        : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                    }`}
                  >
                    {ep.method}
                  </span>
                  <span className="font-mono text-[11px] text-slate-500 truncate">{ep.path}</span>
                </div>
                <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">{ep.title}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-8">
          <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs space-y-5">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className={`px-2 py-0.5 rounded text-xs font-bold font-mono ${
                    selectedEndpoint.method === 'POST'
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                      : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                  }`}
                >
                  {selectedEndpoint.method}
                </span>
                <span className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {selectedEndpoint.path}
                </span>
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{selectedEndpoint.title}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{selectedEndpoint.description}</p>
              <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-slate-500">
                <Lock className="w-3.5 h-3.5 text-indigo-500" />
                <span>{selectedEndpoint.authNote}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {(['curl', 'js', 'python'] as const).map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setCodeLang(lang)}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md uppercase cursor-pointer ${
                        codeLang === lang
                          ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(getCodeSnippet(selectedEndpoint, codeLang))}
                  className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy Snippet'}</span>
                </button>
              </div>
              <pre className="p-4 bg-slate-950 text-slate-200 rounded-xl text-xs font-mono overflow-x-auto leading-relaxed border border-slate-800">
                {getCodeSnippet(selectedEndpoint, codeLang)}
              </pre>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Sample JSON Response</div>
              <pre className="p-4 bg-slate-950 text-emerald-400 rounded-xl text-xs font-mono overflow-x-auto leading-relaxed border border-slate-800">
                {JSON.stringify(selectedEndpoint.sampleResponse, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
