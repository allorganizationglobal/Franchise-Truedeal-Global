import { useState } from 'react';
import { Mail, Clock, CheckCircle2, User, X, ExternalLink } from 'lucide-react';
import { EmailNotification } from '../../types/franchise';

interface EmailPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  emails: EmailNotification[];
}

export function EmailPreviewModal({ isOpen, onClose, emails }: EmailPreviewModalProps) {
  const [selectedEmail, setSelectedEmail] = useState<EmailNotification | null>(
    emails[0] || null
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 max-h-[90vh] flex flex-col overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Automated Email Dispatch Log & Notifications
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Real-time lifecycle triggers sent to applicant & franchise board
            </span>
          </div>
        </div>

        {/* Content Body: Split view list & detail */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 flex-1 min-h-0 overflow-hidden">
          {/* Email List */}
          <div className="md:col-span-5 border-r border-slate-100 dark:border-slate-800 overflow-y-auto pr-2 space-y-2">
            {emails.length === 0 ? (
              <p className="text-xs text-slate-500 p-4 text-center">No automated emails generated yet.</p>
            ) : (
              emails.map(email => (
                <button
                  key={email.id}
                  type="button"
                  onClick={() => setSelectedEmail(email)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    selectedEmail?.id === email.id
                      ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800'
                      : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                    <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[130px]">
                      {email.recipientName}
                    </span>
                    <span className="font-mono text-[10px]">
                      {new Date(email.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate mb-1">
                    {email.subject}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                    {email.previewText}
                  </p>
                </button>
              ))
            )}
          </div>

          {/* Email Preview Detail */}
          <div className="md:col-span-7 flex flex-col overflow-y-auto pl-2">
            {selectedEmail ? (
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">To:</span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {selectedEmail.recipientName} &lt;{selectedEmail.to}&gt;
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">From:</span>
                    <span className="text-slate-900 dark:text-slate-100">
                      TrueDeal Operations &lt;franchise@truedealglobal.com&gt;
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Timestamp:</span>
                    <span className="font-mono text-slate-600 dark:text-slate-400">
                      {new Date(selectedEmail.sentAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-700">
                    <span className="text-slate-500">Subject:</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {selectedEmail.subject}
                    </span>
                  </div>
                </div>

                <div
                  className="p-5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-slate-200 shadow-sm"
                  dangerouslySetInnerHTML={{ __html: selectedEmail.htmlBody }}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12">
                <Mail className="w-10 h-10 mb-2 opacity-50" />
                <p className="text-xs">Select an email to view full formatting</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
