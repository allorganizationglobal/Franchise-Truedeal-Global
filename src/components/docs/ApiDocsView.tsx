import { useState } from 'react';
import {
  Code2,
  Terminal,
  Copy,
  Check,
  Send,
  ShieldCheck,
  Globe,
  Layers,
  Key,
  Webhook
} from 'lucide-react';

interface EndpointDoc {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  title: string;
  description: string;
  authRequired: boolean;
  sampleRequest: Record<string, any>;
  sampleResponse: Record<string, any>;
}

const ENDPOINTS: EndpointDoc[] = [
  {
    method: 'POST',
    path: '/api/v1/franchise/applications',
    title: 'Submit Franchise Registration',
    description: 'Registers a new applicant, validates minimum tier liquid capital, and runs the automated evaluation scoring engine.',
    authRequired: true,
    sampleRequest: {
      planId: 'plan_standard',
      currency: 'INR',
      territoryRequested: 'South Florida Metro Cluster',
      applicant: {
        fullName: 'Elena Rostova',
        email: 'elena@novapartnergroup.com',
        phone: '+1 (305) 554-9182',
        companyName: 'Nova Partner Group LLC',
        entityType: 'llc'
      },
      financials: {
        liquidCapital: 110000,
        netWorth: 340000,
        creditScoreTier: '700_749',
        fundingSource: 'investor_group'
      },
      operationalExperienceYears: 8
    },
    sampleResponse: {
      status: 'success',
      applicationId: 'TDG-2026-108',
      preliminaryScore: 88,
      verdict: 'conditional_fast_track',
      liquidityStatus: 'pass',
      territoryAvailable: true,
      createdAt: '2026-04-12T14:30:00Z',
      nextAction: 'KYC_DOCUMENT_UPLOAD'
    }
  },
  {
    method: 'GET',
    path: '/api/v1/franchise/applications/{id}/status',
    title: 'Get Application Lifecycle & Score',
    description: 'Fetches real-time status, milestone progression, document audit status, and payment logs.',
    authRequired: true,
    sampleRequest: {},
    sampleResponse: {
      applicationId: 'TDG-2026-104',
      status: 'approved',
      planTier: 'master',
      territory: 'Central Texas Corridor',
      automatedScore: 96,
      contractSigned: true,
      biometricVerified: true,
      depositFunded: true,
      assignedDirector: 'Evelyn Vance'
    }
  },
  {
    method: 'POST',
    path: '/api/v1/documents/encrypted-upload',
    title: 'Upload AES-GCM Encrypted Vault Payload',
    description: 'Accepts client-side encrypted binary documents with SHA-256 checksum and initialization vector (IV) for tamper-evident storage.',
    authRequired: true,
    sampleRequest: {
      applicationId: 'TDG-2026-104',
      documentType: 'proof_of_funds',
      fileName: 'Chase_Liquidity_Statement_Q1.enc',
      encryptionAlgorithm: 'AES-GCM-256',
      cipherChecksum: '7d5a99f603f231d5390171626609193d...',
      ivHex: '91bc44ae22019ff88432a1bb',
      encryptedPayloadBase64: 'U2FsdGVkX1+vUppA21b9...'
    },
    sampleResponse: {
      status: 'vault_stored',
      documentId: 'doc_104_2',
      sha256DigestVerified: true,
      vaultRegion: 'us-central-enclave-secure'
    }
  },
  {
    method: 'POST',
    path: '/api/v1/payments/process-deposit',
    title: 'Process Franchise Fee or Deposit',
    description: 'Integrates with PCI Level 1 gateway to capture application fees or franchise license escrow deposits.',
    authRequired: true,
    sampleRequest: {
      applicationId: 'TDG-2026-104',
      amount: 45000,
      currency: 'USD',
      paymentRail: 'escrow_wire',
      billingEntity: 'Sterling Capital Holdings LLC'
    },
    sampleResponse: {
      status: 'completed',
      receiptNumber: 'REC-2026-0112',
      transactionHash: 'tx_0x9b8821a8f921d7',
      escrowAccountRef: 'TDG-ESCROW-CHASE-092'
    }
  },
  {
    method: 'POST',
    path: '/api/v1/sync/batch',
    title: 'Offline Background Data Synchronization',
    description: 'Batch endpoint for client field applications syncing queued modifications once stable network is restored.',
    authRequired: true,
    sampleRequest: {
      clientId: 'mobile_field_agent_084',
      conflictResolution: 'timestamp_merge',
      items: [
        { operation: 'update_status', id: 'TDG-2026-108', newStatus: 'compliance_review' },
        { operation: 'add_review_note', id: 'TDG-2026-108', note: 'Escrow letter verified' }
      ]
    },
    sampleResponse: {
      status: 'synced',
      itemsProcessed: 2,
      conflictsResolved: 0,
      syncHash: '0x8849bcae9123'
    }
  }
];

export function ApiDocsView() {
  const [selectedEndpoint, setSelectedEndpoint] = useState<EndpointDoc>(ENDPOINTS[0]);
  const [codeLang, setCodeLang] = useState<'curl' | 'js' | 'python'>('curl');
  const [copied, setCopied] = useState(false);
  const [testOutput, setTestOutput] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleRunTest = () => {
    setTesting(true);
    setTestOutput(null);

    setTimeout(() => {
      setTesting(false);
      setTestOutput(JSON.stringify(selectedEndpoint.sampleResponse, null, 2));
    }, 600);
  };

  // Generate code snippet
  const getCodeSnippet = (ep: EndpointDoc, lang: 'curl' | 'js' | 'python') => {
    if (lang === 'curl') {
      return `curl -X ${ep.method} "https://franchise.truedealglobal.com${ep.path}" \\
  -H "Authorization: Bearer tdg_live_sec_9934a81bc2" \\
  -H "Content-Type: application/json"${ep.method === 'POST' ? ` \\
  -d '${JSON.stringify(ep.sampleRequest, null, 2)}'` : ''}`;
    }

    if (lang === 'js') {
      return `const response = await fetch("https://franchise.truedealglobal.com${ep.path}", {
  method: "${ep.method}",
  headers: {
    "Authorization": "Bearer tdg_live_sec_9934a81bc2",
    "Content-Type": "application/json"
  }${ep.method === 'POST' ? `,
  body: JSON.stringify(${JSON.stringify(ep.sampleRequest, null, 2)})` : ''}
});

const data = await response.json();
console.log(data);`;
    }

    return `import requests

url = "https://franchise.truedealglobal.com${ep.path}"
headers = {
    "Authorization": "Bearer tdg_live_sec_9934a81bc2",
    "Content-Type": "application/json"
}
${ep.method === 'POST' ? `payload = ${JSON.stringify(ep.sampleRequest, null, 4)}

response = requests.post(url, json=payload, headers=headers)` : `response = requests.get(url, headers=headers)`}

print(response.json())`;
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
          <Terminal className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span>Developer Platform & Integration Architecture</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          TrueDeal Global Franchise API & SDK Explorer
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
          RESTful JSON endpoints, WebCrypto document encryption specifications, Webhooks, and offline background sync protocols for third-party ERP, CRM, and compliance systems.
        </p>
      </div>

      {/* Main Grid: Endpoint List & Detail Console */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Endpoint Selector List */}
        <div className="lg:col-span-4 space-y-2">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
            <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Base API URL
            </span>
            <code className="font-mono text-indigo-600 dark:text-indigo-400 text-[11px] block truncate">
              https://franchise.truedealglobal.com/api/v1
            </code>
          </div>

          <div className="space-y-1.5 pt-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block px-1">
              Core Endpoints
            </span>
            {ENDPOINTS.map(ep => (
              <button
                key={ep.path}
                type="button"
                onClick={() => {
                  setSelectedEndpoint(ep);
                  setTestOutput(null);
                }}
                className={`w-full text-left p-3 rounded-xl border transition-all text-xs ${
                  selectedEndpoint.path === ep.path
                    ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-600 text-indigo-950 dark:text-indigo-100'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${
                    ep.method === 'POST'
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                      : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                  }`}>
                    {ep.method}
                  </span>
                  <span className="font-mono text-[11px] text-slate-500 truncate">{ep.path}</span>
                </div>
                <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">{ep.title}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Interactive Console */}
        <div className="lg:col-span-8 space-y-6">
          <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-6">
            {/* Selected Endpoint Header */}
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`px-2 py-0.5 rounded text-xs font-bold font-mono ${
                  selectedEndpoint.method === 'POST'
                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                    : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                }`}>
                  {selectedEndpoint.method}
                </span>
                <span className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {selectedEndpoint.path}
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {selectedEndpoint.title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {selectedEndpoint.description}
              </p>
            </div>

            {/* Code Generator & Snippet */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {(['curl', 'js', 'python'] as const).map(lang => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setCodeLang(lang)}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md uppercase transition-colors ${
                        codeLang === lang
                          ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => handleCopy(getCodeSnippet(selectedEndpoint, codeLang))}
                  className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 flex items-center gap-1 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy Code'}</span>
                </button>
              </div>

              <pre className="p-4 bg-slate-950 text-slate-200 rounded-xl text-xs font-mono overflow-x-auto max-h-60 leading-relaxed border border-slate-800">
                {getCodeSnippet(selectedEndpoint, codeLang)}
              </pre>
            </div>

            {/* Live Interactive Test Runner */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Interactive API Test Console
                </h4>
                <button
                  type="button"
                  onClick={handleRunTest}
                  disabled={testing}
                  className="py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {testing ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Executing Request...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Execute Call</span>
                    </>
                  )}
                </button>
              </div>

              {testOutput && (
                <div className="space-y-1.5 animate-fade-in">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                      HTTP 200 OK · 142ms
                    </span>
                    <span className="text-slate-400 font-mono">Content-Type: application/json</span>
                  </div>
                  <pre className="p-4 bg-slate-950 text-emerald-400 rounded-xl text-xs font-mono overflow-x-auto max-h-60 leading-relaxed border border-slate-800">
                    {testOutput}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
