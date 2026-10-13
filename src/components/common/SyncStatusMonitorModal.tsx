import { useState } from 'react';
import { RefreshCw, Wifi, WifiOff, ShieldCheck, AlertTriangle, CheckCircle2, Clock, X, Zap } from 'lucide-react';
import { SyncQueueItem } from '../../types/franchise';
import { FranchiseStorageService } from '../../services/storage';
import { NotificationService } from '../../services/notificationService';
import { playApprovalSuccessSound } from '../../utils/audio';

interface SyncStatusMonitorModalProps {
  isOpen: boolean;
  onClose: () => void;
  isOffline: boolean;
  onToggleOffline: (val: boolean) => void;
  syncQueue: SyncQueueItem[];
  onSyncComplete: () => void;
}

export function SyncStatusMonitorModal({
  isOpen,
  onClose,
  isOffline,
  onToggleOffline,
  syncQueue,
  onSyncComplete
}: SyncStatusMonitorModalProps) {
  const [syncing, setSyncing] = useState(false);
  const [conflictPolicy, setConflictPolicy] = useState<'server_wins' | 'client_wins' | 'timestamp_merge'>('timestamp_merge');
  const [lastSyncResult, setLastSyncResult] = useState<{
    successCount: number;
    failedCount: number;
    errors: string[];
  } | null>(null);

  if (!isOpen) return null;

  const handleManualSync = async () => {
    if (isOffline) {
      NotificationService.addNotification(
        'Cannot Sync While Offline',
        'Please disable Offline Simulation or connect to a network before synchronizing data.',
        'warning'
      );
      return;
    }

    setSyncing(true);
    setLastSyncResult(null);

    const result = await FranchiseStorageService.processSyncQueue();
    setSyncing(false);
    setLastSyncResult(result);
    onSyncComplete();

    if (result.errors.length === 0) {
      playApprovalSuccessSound();
      NotificationService.addNotification(
        'Manual Sync Completed',
        `Successfully encrypted and synchronized ${result.successCount} local changes to TrueDeal Cloud Vault.`,
        'success'
      );
    } else {
      NotificationService.addNotification(
        'Sync Completed with Errors',
        `Synchronized ${result.successCount} items; ${result.failedCount} items encountered conflict.`,
        'error'
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <RefreshCw className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Data Synchronization & Offline Lifecycle
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Encrypted background replication for fieldwork & intermittent connectivity
            </span>
          </div>
        </div>

        {/* Status card */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800 mb-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {isOffline ? (
                <WifiOff className="w-4 h-4 text-amber-500" />
              ) : (
                <Wifi className="w-4 h-4 text-emerald-500" />
              )}
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {isOffline ? 'Offline Mode (Local Storage & Queue Active)' : 'Online (Active Cloud Vault Connection)'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onToggleOffline(!isOffline)}
              className={`px-3 py-1 text-xs font-medium rounded-lg border transition-colors ${
                isOffline
                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-800 hover:bg-amber-200'
                  : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600 hover:bg-slate-50'
              }`}
            >
              {isOffline ? 'Go Online' : 'Simulate Offline Mode'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs pt-3 border-t border-slate-200 dark:border-slate-700">
            <div>
              <span className="text-slate-500 dark:text-slate-400 block">Pending Queue Items:</span>
              <span className="text-base font-mono font-bold text-slate-900 dark:text-slate-100">
                {syncQueue.length} <span className="text-xs font-normal text-slate-500">actions</span>
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block">Payload Security:</span>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                TLS 1.3 + AES-GCM Encrypted
              </span>
            </div>
          </div>
        </div>

        {/* Conflict Resolution Selector */}
        <div className="mb-5 space-y-2">
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
            Conflict Resolution Strategy
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'timestamp_merge', label: 'Timestamp Merge', desc: 'Newest edit wins' },
              { id: 'server_wins', label: 'Server Wins', desc: 'Cloud authoritative' },
              { id: 'client_wins', label: 'Client Wins', desc: 'Local draft authoritative' }
            ].map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => setConflictPolicy(item.id as any)}
                className={`p-2.5 text-left rounded-lg border transition-all text-xs ${
                  conflictPolicy === item.id
                    ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 text-indigo-900 dark:text-indigo-200 font-medium'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}
              >
                <div className="font-semibold text-slate-900 dark:text-slate-100">{item.label}</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{item.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Queue Items Inspection */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Pending Sync Queue ({syncQueue.length})
            </h4>
            {syncQueue.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  FranchiseStorageService.clearSyncQueue();
                  onSyncComplete();
                }}
                className="text-[11px] text-slate-400 hover:text-rose-500 transition-colors"
              >
                Clear Queue
              </button>
            )}
          </div>

          <div className="max-h-40 overflow-y-auto space-y-1.5 border border-slate-200 dark:border-slate-800 rounded-lg p-2 bg-slate-50 dark:bg-slate-900/50">
            {syncQueue.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">All local records are fully synchronized.</p>
            ) : (
              syncQueue.map(item => (
                <div
                  key={item.id}
                  className="p-2 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700/80 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-mono text-slate-900 dark:text-slate-100">{item.operation}</span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {new Date(item.queuedAt).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Sync Result Feedback */}
        {lastSyncResult && (
          <div className={`p-3 rounded-lg mb-5 text-xs border ${
            lastSyncResult.errors.length === 0
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
          }`}>
            <div className="flex items-center gap-2 font-semibold mb-1">
              {lastSyncResult.errors.length === 0 ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600" />
              )}
              <span>Sync Batch Report</span>
            </div>
            <p>
              Successfully synchronized {lastSyncResult.successCount} item(s).
              {lastSyncResult.failedCount > 0 && ` ${lastSyncResult.failedCount} error(s) occurred.`}
            </p>
          </div>
        )}

        {/* Action button */}
        <button
          type="button"
          onClick={handleManualSync}
          disabled={syncing || (syncQueue.length === 0 && !lastSyncResult)}
          className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-lg transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {syncing ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Encrypting & Synchronizing...</span>
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" />
              <span>Trigger Manual Sync Now</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
