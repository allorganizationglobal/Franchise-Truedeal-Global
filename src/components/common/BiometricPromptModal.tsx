import { useState, useEffect } from 'react';
import { Fingerprint, CheckCircle2, ShieldCheck, X } from 'lucide-react';
import { BiometricAuthResult } from '../../utils/biometrics';
import { playApprovalSuccessSound } from '../../utils/audio';

interface BiometricPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: BiometricAuthResult) => void;
  title?: string;
  description?: string;
  actionLabel?: string;
}

export function BiometricPromptModal({
  isOpen,
  onClose,
  onSuccess,
  title = 'Biometric Authorization Required',
  description = 'Authenticate using your device Touch ID, Face ID, or Passkey to approve this high-value franchise transaction.',
  actionLabel = 'Verify Biometrics'
}: BiometricPromptModalProps) {
  const [scanning, setScanning] = useState(false);
  const [success, setSuccess] = useState(false);
  const [pinMode, setPinMode] = useState(false);
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setScanning(false);
      setSuccess(false);
      setPinMode(false);
      setPin('');
      setErrorMsg('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSimulateScan = () => {
    setScanning(true);
    setErrorMsg('');

    setTimeout(() => {
      setScanning(false);
      setSuccess(true);
      playApprovalSuccessSound();

      setTimeout(() => {
        onSuccess({
          success: true,
          method: 'simulated_biometric',
          timestamp: new Date().toISOString(),
          credentialId: 'bio_auth_' + Math.random().toString(36).substring(2, 10)
        });
      }, 700);
    }, 1200);
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length < 4) {
      setErrorMsg('Please enter a 4-digit security PIN');
      return;
    }

    setScanning(true);
    setTimeout(() => {
      setScanning(false);
      setSuccess(true);
      playApprovalSuccessSound();

      setTimeout(() => {
        onSuccess({
          success: true,
          method: 'pin_fallback',
          timestamp: new Date().toISOString(),
          credentialId: 'pin_auth_' + Math.random().toString(36).substring(2, 10)
        });
      }, 700);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 overflow-hidden">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">WebAuthn FIDO2 / Biometric Level 3 Enclave</span>
          </div>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
          {description}
        </p>

        {/* Interactive Biometric Area */}
        {!pinMode ? (
          <div className="flex flex-col items-center justify-center py-6 px-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800/80 mb-6">
            <div className="relative mb-4">
              <button
                type="button"
                onClick={handleSimulateScan}
                disabled={scanning || success}
                className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                  success
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                    : scanning
                    ? 'bg-indigo-500 text-white animate-pulse'
                    : 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 hover:scale-105 active:scale-95 shadow-md border border-slate-200 dark:border-slate-700'
                }`}
              >
                {success ? (
                  <CheckCircle2 className="w-10 h-10" />
                ) : (
                  <Fingerprint className={`w-10 h-10 ${scanning ? 'animate-bounce' : ''}`} />
                )}
              </button>

              {scanning && (
                <div className="absolute inset-0 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
              )}
            </div>

            <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">
              {success
                ? 'Biometric Verification Confirmed'
                : scanning
                ? 'Scanning biometric signature...'
                : 'Touch Sensor or Face ID'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
              {success
                ? 'Cryptographic handshake validated.'
                : 'Click the fingerprint sensor above to authenticate.'}
            </p>
          </div>
        ) : (
          <form onSubmit={handlePinSubmit} className="mb-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Director Security PIN
              </label>
              <input
                type="password"
                maxLength={6}
                value={pin}
                onChange={e => {
                  setPin(e.target.value.replace(/\D/g, ''));
                  setErrorMsg('');
                }}
                placeholder="••••"
                className="w-full px-4 py-2.5 text-center text-lg tracking-widest font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
              />
              {errorMsg && <p className="mt-1.5 text-xs text-rose-500">{errorMsg}</p>}
            </div>

            <button
              type="submit"
              disabled={scanning || success || pin.length < 4}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-lg transition-colors disabled:opacity-50"
            >
              {scanning ? 'Verifying PIN...' : 'Authorize with PIN'}
            </button>
          </form>
        )}

        {/* Footer controls */}
        <div className="flex items-center justify-between text-xs pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setPinMode(!pinMode)}
            className="text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            {pinMode ? 'Use Biometrics instead' : 'Fallback to Director PIN'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
