import { useState } from 'react';
import { Terminal, Copy, Check, ShieldCheck, Lock } from 'lucide-react';

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
    method: 'GET',
    path: '/api/health',
    title: 'Service Health & Gateway Readiness',
    description:
      'Returns server availability, CRM/SendGrid configuration flags (boolean only, zero secrets), and Razorpay readiness status.',
    authNote: 'Public health probe (no credentials exposed)',
    sampleResponse: {
      ok: true,
      service: 'truedeal-franchise-portal',
      crmConfigured: true,
      sendGridConfigured: false,
      paymentGateway: {
        provider: 'razorpay',
        status: 'pending_verification',
        liveCheckoutEnabled: false
      }
    }
  },
  {
    method: 'POST',
    path: '/api/contact',
    title: 'Submit Public Contact / Support Inquiry',
    description:
      'Validates customer inquiry fields, checks explicit privacy consent, applies IP rate limiting and honeypot spam protection, and forwards to CRM when configured.',
    authNote: 'Public form endpoint with rate limit + honeypot protection',
    sampleRequest: {
      name: 'Applicant Name',
      email: 'applicant@example.com',
      phone: '+91-9876543210',
      inquiryType: 'franchise_inquiry',
      subject: 'Question about Corporate Package inclusions',
      message: 'Please share agreement review details for the Corporate Franchise Plan.',
      consent: true
    },
    sampleResponse: {
      ok: true,
      status: 'received',
      referenceCode: 'TDG-INQ-482910',
      crmSynced: true,
      emailDispatched: false
    }
  },
  {
    method: 'POST',
    path: '/api/leads/ingest',
    title: 'Server-Side CRM Lead Ingestion Proxy',
    description:
      'Forwards validated franchise leads from this portal to TRUEDEAL GLOBAL CRM using the server-side TRUEDEAL_LEAD_API_KEY environment variable.',
    authNote: 'Server-side x-api-key injected from environment; never exposed to browser',
    sampleRequest: {
      name: 'Applicant Name',
      email: 'applicant@example.com',
      phone: '+91-9876543210',
      service: 'Standard Franchise Plan',
      sourceWebsite: 'https://businessfranchise.truedealglobal.com/',
      message: 'Application ID: TDG-2026-109',
      consent: true
    },
    sampleResponse: {
      ok: true,
      status: 'created',
      crmDelivered: true,
      leadId: 'crm_lead_9281'
    }
  },
  {
    method: 'GET',
    path: '/api/payments/readiness',
    title: 'Razorpay Integration Readiness Blueprint',
    description:
      'Exposes current gateway compliance posture (liveCheckoutEnabled: false prior to Razorpay approval) and planned server-verified payment lifecycle endpoints.',
    authNote: 'Public metadata endpoint (never exposes Razorpay secrets)',
    sampleResponse: {
      ok: true,
      provider: 'razorpay',
      status: 'pending_verification',
      liveCheckoutEnabled: false,
      requiredServerEnvVars: ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET']
    }
  },
  {
    method: 'POST',
    path: '/api/webhooks/payment',
    title: 'Signed Payment Webhook Receiver (Razorpay Ready)',
    description:
      'Verifies X-Razorpay-Signature / X-TrueDeal-Signature using constant-time HMAC-SHA256 verification against server-side webhook secret.',
    authNote: 'Requires valid HMAC-SHA256 signature header',
    sampleRequest: {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_sample_id',
            order_id: 'order_sample_id',
            amount: 499900,
            currency: 'INR',
            status: 'captured'
          }
        }
      }
    },
    sampleResponse: {
      ok: true,
      received: true,
      verified: true
    }
  }
];

const CANONICAL_BASE = 'https://businessfranchise.truedealglobal.com';

export function ApiDocsView() {
  const [selectedEndpoint, setSelectedEndpoint] = useState<EndpointDoc>(ENDPOINTS[0]);
  const [codeLang, setCodeLang] = useState<'curl' | 'js' | 'python'>('curl');
  const [copied, setCopied] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const getCodeSnippet = (ep: EndpointDoc, lang: 'curl' | 'js' | 'python') => {
    if (lang === 'curl') {
      return `curl -X ${ep.method} "${CANONICAL_BASE}${ep.path}" \\
  -H "Content-Type: application/json"${
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
    "Content-Type": "application/json"
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
headers = {"Content-Type": "application/json"}
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
          <span>TRUEDEAL GLOBAL OPC PVT LTD · Server Architecture Reference</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">
          Portal API & Razorpay Readiness Specification
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-3xl">
          Documents the verified server-side endpoints hosted on{' '}
          <code className="font-mono text-indigo-600 dark:text-indigo-400">{CANONICAL_BASE}</code>. All API keys,
          webhook secrets, and payment gateway credentials remain strictly server-side in environment variables.
        </p>
      </div>

      {/* Security Notice */}
      <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-start gap-3 text-xs text-emerald-900 dark:text-emerald-200">
        <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
        <div>
          <strong>Zero Exposed Secrets:</strong> No production API tokens, Razorpay keys, or CRM secrets are embedded
          in frontend bundles. Authenticated admin operations verify Firebase ID tokens server-side via{' '}
          <code className="font-mono">Authorization: Bearer &lt;FIREBASE_ID_TOKEN&gt;</code>.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Endpoint List */}
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

        {/* Right: Endpoint Details */}
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
