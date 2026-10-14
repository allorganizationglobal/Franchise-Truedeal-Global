import { useState } from 'react';
import { Phone, Mail, MessageSquare, X, Send, ExternalLink, ShieldCheck, Copy, Check } from 'lucide-react';

export function WhatsAppIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      stroke="currentColor"
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path
        d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
        fill="currentColor"
      />
    </svg>
  );
}

export function WhatsAppSupportWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [customMsg, setCustomMsg] = useState('');

  const phoneNo = '+91-9317194033';
  const phoneClean = '+919317194033';
  const whatsappNo = '+91-8091667890';
  const whatsappDigits = '918091667890';
  const email = 'info@truedealglobal.com';

  const defaultWaUrl = `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(
    'Hello TrueDeal Global Team, I am interested in a franchise partnership. Please guide me.'
  )}`;

  const quickPrompts = [
    'I want to inquire about Franchise Plans & Pricing',
    'I need help completing my franchise application',
    'I want to speak with the Directorate Team',
    'Payment & Banking account assistance'
  ];

  const handleSendPrompt = (promptText: string) => {
    const url = `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(promptText)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCustomSend = (e: React.FormEvent) => {
    e.preventDefault();
    const textToSend = customMsg.trim() || 'Hello TrueDeal Global Team, I want to inquire about a franchise.';
    const url = `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(textToSend)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    setCustomMsg('');
    setIsOpen(false);
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end">
      {/* Floating Card Popup */}
      {isOpen && (
        <div className="mb-3 w-[360px] max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 p-4 text-white relative">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="absolute top-3 right-3 text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              title="Close widget"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-white/15 backdrop-blur-xs flex items-center justify-center text-white border border-white/20 shadow-inner shrink-0">
                <WhatsAppIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h4 className="font-bold text-sm tracking-wide">TrueDeal Global Desk</h4>
                <div className="flex items-center gap-1.5 text-xs text-emerald-100">
                  <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
                  <span>Online · Quick Instant Response</span>
                </div>
              </div>
            </div>
            <div className="mt-2 text-[11px] text-emerald-100/90 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-200 shrink-0" />
              <span>Official WhatsApp: {whatsappNo}</span>
            </div>
          </div>

          {/* Body */}
          <div className="p-4 space-y-4 text-xs">
            {/* Quick Connect Actions */}
            <div className="space-y-2">
              <p className="text-slate-500 dark:text-slate-400 font-medium">Quick connection topic:</p>
              <div className="grid grid-cols-1 gap-1.5">
                {quickPrompts.map((prompt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendPrompt(prompt)}
                    className="w-full text-left p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-200 dark:border-slate-700/80 hover:border-emerald-500/50 text-slate-800 dark:text-slate-200 hover:text-emerald-700 dark:hover:text-emerald-400 font-medium transition-all flex items-center justify-between group"
                  >
                    <span>{prompt}</span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 shrink-0 ml-2" />
                  </button>
                ))}
              </div>
            </div>

            {/* Custom message prompt */}
            <form onSubmit={handleCustomSend} className="space-y-2">
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                Or write your direct query:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={customMsg}
                  onChange={(e) => setCustomMsg(e.target.value)}
                  placeholder="Type message to start WhatsApp chat..."
                  className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white p-2.5 rounded-xl transition-colors shrink-0 shadow-xs flex items-center justify-center"
                  title="Send via WhatsApp"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>

            {/* Primary Action Button */}
            <a
              href={defaultWaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all"
            >
              <WhatsAppIcon className="w-4 h-4 text-white" />
              <span>Connect on WhatsApp ({whatsappNo})</span>
            </a>

            {/* Alternative Helplines */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-amber-500" />
                  <span>Call Hotline:</span>
                </span>
                <div className="flex items-center gap-2">
                  <a
                    href={`tel:${phoneClean}`}
                    className="font-mono font-bold text-slate-900 dark:text-slate-100 hover:text-emerald-600"
                  >
                    {phoneNo}
                  </a>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(phoneNo, 'phone')}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    title="Copy phone"
                  >
                    {copiedKey === 'phone' ? (
                      <Check className="w-3 h-3 text-emerald-500" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Official Email:</span>
                </span>
                <div className="flex items-center gap-2">
                  <a
                    href={`mailto:${email}`}
                    className="font-medium text-slate-900 dark:text-slate-100 hover:text-emerald-600"
                  >
                    {email}
                  </a>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(email, 'email')}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    title="Copy email"
                  >
                    {copiedKey === 'email' ? (
                      <Check className="w-3 h-3 text-emerald-500" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Floating Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative group flex items-center gap-2.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95"
        title="Chat on WhatsApp (+91-8091667890)"
      >
        <span className="relative flex items-center justify-center">
          <WhatsAppIcon className="w-6 h-6 text-white" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-300 border-2 border-emerald-600 rounded-full animate-ping" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-300 border-2 border-emerald-600 rounded-full" />
        </span>
        <div className="flex flex-col text-left">
          <span className="font-bold text-xs leading-tight tracking-wide">WhatsApp Us</span>
          <span className="text-[10px] text-emerald-100 leading-none">{whatsappNo}</span>
        </div>
      </button>
    </div>
  );
}
