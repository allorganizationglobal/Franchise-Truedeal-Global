import { useState } from 'react';
import { FileText, ShieldCheck, Download, Lock, CheckCircle2, AlertCircle, X, Eye } from 'lucide-react';
import { DocumentUpload, UserRole } from '../../types/franchise';

interface DocumentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: DocumentUpload | null;
  applicantName: string;
  userRole: UserRole;
  onUpdateStatus?: (docId: string, status: 'verified' | 'revision_needed', notes?: string) => void;
}

export function DocumentViewerModal({
  isOpen,
  onClose,
  document: doc,
  applicantName,
  userRole,
  onUpdateStatus
}: DocumentViewerModalProps) {
  const [decrypted, setDecrypted] = useState(false);
  const [decrypting, setDecrypting] = useState(false);
  const [notes, setNotes] = useState('');

  if (!isOpen || !doc) return null;

  const handleDecrypt = () => {
    setDecrypting(true);
    setTimeout(() => {
      setDecrypting(false);
      setDecrypted(true);
    }, 600);
  };

  const handleDownload = () => {
    const dummyBlob = new Blob([`TrueDeal Global Decrypted Document: ${doc.name}\nApplicant: ${applicantName}\nChecksum: ${doc.cipherChecksum}`], { type: doc.mimeType });
    const url = URL.createObjectURL(dummyBlob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = doc.name.replace('.enc', '');
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{doc.name}</h3>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="capitalize">{doc.type.replace('_', ' ')}</span>
              <span aria-hidden="true">·</span>
              <span>{(doc.sizeBytes / (1024 * 1024)).toFixed(2)} MB</span>
              <span aria-hidden="true">·</span>
              <span>Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {/* Security & Cryptography Banner */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                End-to-End Encrypted Payload ({doc.encryptionAlgorithm})
              </span>
            </div>
            <span className={`text-xs font-medium px-2 py-0.5 rounded ${
              doc.status === 'verified'
                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                : doc.status === 'rejected' || doc.status === 'resubmission_required'
                ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
            }`}>
              Status: {doc.status.replace('_', ' ').toUpperCase()}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-700/60">
            <div>
              <span className="text-slate-400 block text-[11px]">SHA-256 Digest Checksum:</span>
              <span className="truncate block" title={doc.cipherChecksum}>{doc.cipherChecksum}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Initialization Vector (IV):</span>
              <span className="truncate block">{doc.ivHex}</span>
            </div>
          </div>
        </div>

        {/* Simulated Document Decryption Preview Area */}
        <div className="mb-6 p-6 bg-slate-100 dark:bg-slate-950/80 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
          {!decrypted ? (
            <div className="py-8">
              <Lock className="w-10 h-10 text-slate-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Encrypted at Rest in TrueDeal Object Vault
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 max-w-sm mx-auto">
                Only authenticated franchise officers and applicants can decrypt this document in client memory.
              </p>
              <button
                type="button"
                onClick={handleDecrypt}
                disabled={decrypting}
                className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition-colors inline-flex items-center gap-1.5"
              >
                {decrypting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Decrypting via AES-GCM-256...</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    <span>Decrypt & Inspect Document</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="text-left space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Decrypted in Memory (Zero plain text on disk)
                </span>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                >
                  <Download className="w-3 h-3" /> Download Plaintext
                </button>
              </div>

              {/* Mock Rendered Document Container */}
              <div className="p-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2 text-xs text-slate-700 dark:text-slate-300">
                <p className="font-semibold text-slate-900 dark:text-slate-100">
                  Document Verification Manifest · TrueDeal Global
                </p>
                <p><strong>Applicant Name:</strong> {applicantName}</p>
                <p><strong>Document Category:</strong> {doc.type.replace('_', ' ').toUpperCase()}</p>
                <p><strong>Authenticity Status:</strong> Cryptographic Checksum matches signature record</p>
                <p className="text-slate-500 dark:text-slate-400 text-[11px] pt-2 border-t border-slate-100 dark:border-slate-800">
                  Government compliance watermark: TDG-VERIFIED-VAULT-2026. All identity markers cross-checked with AML/KYC registries.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Administrative Audit Action Controls */}
        {(userRole === 'director' || userRole === 'compliance' || userRole === 'super_admin') && (
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Compliance Review Note (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Verified photo ID and address against business registry..."
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  onUpdateStatus?.(doc.id, 'revision_needed', notes);
                  onClose();
                }}
                className="py-1.5 px-3 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 rounded-lg text-xs font-medium transition-colors"
              >
                Request Re-upload
              </button>
              <button
                type="button"
                onClick={() => {
                  onUpdateStatus?.(doc.id, 'verified', notes);
                  onClose();
                }}
                className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition-colors"
              >
                Verify & Approve Document
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
