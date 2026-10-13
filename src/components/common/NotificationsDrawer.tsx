import { useState } from 'react';
import { Bell, CheckCheck, Mail, ShieldAlert, CheckCircle2, AlertTriangle, Info, X, Zap } from 'lucide-react';
import { AppNotification } from '../../types/franchise';
import { NotificationService } from '../../services/notificationService';

interface NotificationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  onRefresh: () => void;
  onOpenEmails: () => void;
  onNavigateToApp?: (appId: string) => void;
}

export function NotificationsDrawer({
  isOpen,
  onClose,
  notifications,
  onRefresh,
  onOpenEmails,
  onNavigateToApp
}: NotificationsDrawerProps) {
  const [filterUnread, setFilterUnread] = useState(false);
  const [pushStatus, setPushStatus] = useState<string>('idle');

  if (!isOpen) return null;

  const handleMarkAll = () => {
    NotificationService.markAllNotificationsRead();
    onRefresh();
  };

  const handleEnablePush = async () => {
    const perm = await NotificationService.requestPushPermission();
    setPushStatus(perm);
    if (perm === 'granted') {
      NotificationService.addNotification(
        'Push Notifications Active',
        'You will now receive desktop and mobile push alerts for franchise updates.',
        'success'
      );
      onRefresh();
    }
  };

  const filtered = filterUnread ? notifications.filter(n => !n.read) : notifications;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-950/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl p-6 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Notification Center
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Browser Push Permission Banner */}
        <div className="py-3 px-3.5 my-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl border border-indigo-200 dark:border-indigo-800 flex items-center justify-between text-xs shrink-0">
          <div>
            <span className="font-semibold text-indigo-950 dark:text-indigo-200 block">
              Desktop & Mobile Push Alerts
            </span>
            <span className="text-[11px] text-indigo-800 dark:text-indigo-300">
              Receive background updates on applications
            </span>
          </div>
          <button
            type="button"
            onClick={handleEnablePush}
            className="py-1 px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded text-[11px] whitespace-nowrap transition-colors"
          >
            {pushStatus === 'granted' ? 'Enabled' : 'Enable'}
          </button>
        </div>

        {/* Filter controls */}
        <div className="flex items-center justify-between py-2 text-xs text-slate-500 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFilterUnread(false)}
              className={`px-2 py-0.5 rounded font-medium ${!filterUnread ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100' : ''}`}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterUnread(true)}
              className={`px-2 py-0.5 rounded font-medium ${filterUnread ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100' : ''}`}
            >
              Unread ({notifications.filter(n => !n.read).length})
            </button>
          </div>

          <button
            type="button"
            onClick={handleMarkAll}
            className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
          >
            <CheckCheck className="w-3 h-3" />
            <span>Mark All Read</span>
          </button>
        </div>

        {/* Notifications list */}
        <div className="flex-1 overflow-y-auto py-3 space-y-2.5">
          {filtered.length === 0 ? (
            <p className="text-center text-xs text-slate-400 py-12">
              No notifications to display.
            </p>
          ) : (
            filtered.map(notif => (
              <div
                key={notif.id}
                className={`p-3 rounded-xl border text-xs transition-colors ${
                  !notif.read
                    ? 'bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800'
                    : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {notif.title}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono shrink-0">
                    {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
                  {notif.message}
                </p>
                {notif.applicationId && (
                  <div className="mt-2 pt-1 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onNavigateToApp?.(notif.applicationId!);
                      }}
                      className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      View Application #{notif.applicationId}
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer: Open Email Dispatcher */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenEmails();
            }}
            className="w-full py-2 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <Mail className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>View Automated Email Dispatch Log</span>
          </button>
        </div>
      </div>
    </div>
  );
}
