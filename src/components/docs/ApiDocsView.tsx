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
    path: '/api/payments/payu/initiate',
    title: 'Initiate PayU India Classic Hosted Checkout',
    description:
      'Calculates authoritative franchise package amount strictly on the server from plansCatalog.ts, generates a unique txnid, computes the SHA-512 request hash, persists PAYMENT_PENDING, and returns signed form fields for https://test.payu.in/_payment or https://secure.payu.in/_payment.',
    authNote: 'Requires Authorization: Bearer <FIREBASE_ID_TOKEN>',
    sampleRequest: {
      applicationId: 'TDG-2026-1042',
      planId: 'plan_standard',
      applicantName: 'Applicant Name',
      phone: '+919876543210'
    },
    sampleResponse: {
      ok: true,
      env: 'test',
      checkoutUrl: 'https://test.payu.in/_payment',
      formFields: {
        key: '<SERVER_MERCHANT_KEY>',
        txnid: 'TDG1A2B3C4D5E',
        amount: '4999.00',
        productinfo: 'TRUEDEAL GLOBAL Standard Franchise Plan',
        hash: '<SERVER_SHA512_HASH>'
      }
    }
  },
  {
    method: 'POST',
    path: '/api/payments/payu/callback',
    title: 'PayU Browser Redirect Callback (surl / furl)',
    description:
      'Receives PayU POST callback, verifies Merchant Key and timing-safe Reverse SHA-512 hash (with additionalCharges support), independently calls PayU verify_payment API, enforces monotonic SUCCESS protection, and redirects (303) to /payment-result.',
    authNote: 'Verified via PayU Reverse SHA-512 Hash + server-to-server verify_payment',
    sampleResponse: {
      redirect303: '/payment-result?txnid=TDG1A2B3C4D5E&applicationId=TDG-2026-1042&status=SUCCESS'
    }
  },
  {
    method: 'POST',
    path: '/api/payments/payu/webhook',
    title: 'PayU Server-to-Server Webhook Receiver',
    description:
      'Idempotently processes asynchronous PayU payment notifications, verifies Reverse SHA-512 hash + optional X-PayU-Signature HMAC, confirms via verify_payment API, issues verified receipt & SendGrid email ONLY on SUCCESS, and prevents downgrading verified SUCCESS records.',
    authNote: 'Verified via PayU Reverse SHA-512 Hash & optional PAYU_WEBHOOK_SECRET HMAC',
    sampleResponse: {
      ok: true,
      duplicate: false,
      finalStatus: 'SUCCESS',
      receiptNumber: 'REC-TDG-2026-3C4D5E'
    }
  },
  {
    method: 'POST',
    path: '/api/payments/payu/verify',
    title: 'Live PayU verify_payment Reconciliation',
    description:
      'Calls official PayU postservice.php?form=2 (command=verify_payment) server-side to reconcile pending or under-review transactions. Accessible only to the owning applicant or an authorized administrator.',
    authNote: 'Requires Authorization: Bearer <FIREBASE_ID_TOKEN> (Owner or Admin)',
    sampleRequest: { txnid: 'TDG1A2B3C4D5E' },
    sampleResponse: {
      ok: true,
      finalStatus: 'SUCCESS',
      message: 'Reconciled transaction with PayU: status is SUCCESS.'
    }
  },
  {
    method: 'GET',
    path: '/api/admin/payments',
    title: 'Admin Payment Ledger, Stats & Refund Controls',
    description:
      'Returns authoritative server payment counts, verified INR collections, PayU transaction list, and webhook audit events. POST supports action: "reconcile", "mark_refund_pending", and "mark_refunded".',
    authNote: 'Strictly Administrator Firebase ID Token required (403 for applicants)',
    sampleResponse: {
      ok: true,
      stats: {
        totalTransactions: 12,
        pendingCount: 2,
        successCount: 9,
        failedCount: 1,
        totalVerifiedCollectionsINR: 124990
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
    title: 'Service Health & PayU Configuration Status',
    description:
      'Returns server availability, CRM/SendGrid configuration flags (boolean only, zero secrets), and PayU Classic Hosted Checkout environment status.',
    authNote: 'Public health probe (zero secrets exposed)',
    sampleResponse: {
      status: 'healthy',
      paymentGateway: {
        provider: 'payu_classic_hosted',
        env: 'test',
        configured: false
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
            Server architecture, PayU webhook specifications, and administrative endpoints are restricted to authorized
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
          PayU Classic Hosted Checkout &amp; Portal Server APIs
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-3xl">
          Authoritative server-side endpoints deployed on{' '}
          <code className="font-mono text-indigo-600 dark:text-indigo-400">{CANONICAL_BASE}</code>. All PayU merchant
          salts, CRM keys, and SendGrid credentials remain strictly in server environment variables.
        </p>
      </div>

      <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-start gap-3 text-xs text-emerald-900 dark:text-emerald-200">
        <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
        <div>
          <strong>Zero Exposed Secrets:</strong> No PayU Salt, CRM keys, or SendGrid API keys are embedded in frontend
          bundles. All sensitive endpoints cryptographically verify Firebase ID tokens via{' '}
          <code className="font-mono">Authorization: Bearer &lt;FIREBASE_ID_TOKEN&gt;</code>.
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
