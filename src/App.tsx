import { useState, useEffect } from 'react';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { FranchisePlansView } from './components/portal/FranchisePlansView';
import { ApplicationWizard } from './components/portal/ApplicationWizard';
import { ApplicantStatusTracker } from './components/portal/ApplicantStatusTracker';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AnalyticsView } from './components/admin/AnalyticsView';
import { ApiDocsView } from './components/docs/ApiDocsView';
import { SyncStatusMonitorModal } from './components/common/SyncStatusMonitorModal';
import { EmailPreviewModal } from './components/common/EmailPreviewModal';
import { NotificationsDrawer } from './components/common/NotificationsDrawer';
import { WhatsAppSupportWidget } from './components/common/WhatsAppSupportWidget';
import { FranchiseStorageService } from './services/storage';
import { NotificationService } from './services/notificationService';
import { UserRole, AppNotification, FranchiseApplication, EmailNotification, SyncQueueItem, Currency } from './types/franchise';

export default function App() {
  const [currentTab, setCurrentTab] = useState<string>('plans');
  const [userRole, setUserRole] = useState<UserRole>('director');
  const [currency, setCurrency] = useState<Currency>(() => {
    if (typeof window === 'undefined') return 'INR';
    return (localStorage.getItem('truedeal_currency') as Currency) || 'INR';
  });
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('truedeal_theme') === 'dark' ||
      (!('truedeal_theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  const [isOffline, setIsOffline] = useState<boolean>(() => FranchiseStorageService.isSimulatedOffline());
  const [selectedAppId, setSelectedAppId] = useState<string>('TDG-2026-104');
  const [wizardPlanId, setWizardPlanId] = useState<string>('plan_standard');

  // Modals state
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isNotifDrawerOpen, setIsNotifDrawerOpen] = useState(false);

  // Live collections
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [emails, setEmails] = useState<EmailNotification[]>([]);
  const [syncQueue, setSyncQueue] = useState<SyncQueueItem[]>([]);

  // Apply dark mode class
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('truedeal_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('truedeal_theme', 'light');
    }
  }, [darkMode]);

  // Load initial stores & listen to network events
  useEffect(() => {
    FranchiseStorageService.init();
    refreshAllData();

    const handleOnline = () => {
      if (!FranchiseStorageService.isSimulatedOffline()) {
        setIsOffline(false);
        FranchiseStorageService.processSyncQueue().then(() => refreshAllData());
      }
    };

    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const refreshAllData = () => {
    setNotifications(NotificationService.getNotifications());
    setEmails(NotificationService.getEmails());
    setSyncQueue(FranchiseStorageService.getSyncQueue());
  };

  const handleToggleOffline = (val: boolean) => {
    FranchiseStorageService.setSimulatedOffline(val);
    setIsOffline(val);
    if (!val) {
      FranchiseStorageService.processSyncQueue().then(() => refreshAllData());
    }
  };

  const unreadNotifsCount = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Offline Banner when in offline mode */}
      {isOffline && (
        <div className="bg-amber-500 text-slate-950 px-4 py-1.5 text-xs font-semibold text-center flex items-center justify-center gap-2">
          <span>Offline Operation Active: Changes will be stored in your encrypted local enclave and queued for background sync.</span>
          <button
            type="button"
            onClick={() => handleToggleOffline(false)}
            className="underline hover:text-white transition-colors"
          >
            Re-connect
          </button>
        </div>
      )}

      {/* Top Navbar */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        userRole={userRole}
        onChangeRole={setUserRole}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
        isOffline={isOffline}
        pendingSyncCount={syncQueue.length}
        onOpenSyncModal={() => setIsSyncModalOpen(true)}
        onOpenEmailModal={() => setIsEmailModalOpen(true)}
        notifications={notifications}
        onOpenNotifications={() => setIsNotifDrawerOpen(true)}
        unreadCount={unreadNotifsCount}
        currency={currency}
        onToggleCurrency={setCurrency}
      />

      {/* Main Viewport Content */}
      <main className="flex-1">
        {currentTab === 'plans' && (
          <FranchisePlansView
            currency={currency}
            onToggleCurrency={setCurrency}
            onSelectPlan={(planId) => {
              setWizardPlanId(planId);
              setCurrentTab('apply');
            }}
          />
        )}

        {currentTab === 'apply' && (
          <ApplicationWizard
            initialPlanId={wizardPlanId}
            currency={currency}
            onToggleCurrency={setCurrency}
            onApplicationCreated={(newApp) => {
              setSelectedAppId(newApp.id);
              refreshAllData();
            }}
            onNavigateToTracker={(appId) => {
              setSelectedAppId(appId);
              setCurrentTab('tracker');
              refreshAllData();
            }}
          />
        )}

        {currentTab === 'tracker' && (
          <ApplicantStatusTracker
            applicationId={selectedAppId}
            onRefresh={refreshAllData}
            onSelectApplication={setSelectedAppId}
          />
        )}

        {currentTab === 'admin' && (
          <AdminDashboard
            userRole={userRole}
            onRefresh={refreshAllData}
            onSelectApplication={(id) => {
              setSelectedAppId(id);
              setCurrentTab('tracker');
            }}
          />
        )}

        {currentTab === 'analytics' && <AnalyticsView />}

        {currentTab === 'api' && <ApiDocsView />}
      </main>

      {/* World-Class Enterprise Global Footer */}
      <Footer
        currency={currency}
        onSelectTab={setCurrentTab}
        onOpenEmailModal={() => setIsEmailModalOpen(true)}
        onOpenSyncModal={() => setIsSyncModalOpen(true)}
        emailsCount={emails.length}
        syncQueueCount={syncQueue.length}
      />

      {/* Modals & Drawers */}
      <SyncStatusMonitorModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        isOffline={isOffline}
        onToggleOffline={handleToggleOffline}
        syncQueue={syncQueue}
        onSyncComplete={refreshAllData}
      />

      <EmailPreviewModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        emails={emails}
      />

      <NotificationsDrawer
        isOpen={isNotifDrawerOpen}
        onClose={() => setIsNotifDrawerOpen(false)}
        notifications={notifications}
        onRefresh={refreshAllData}
        onOpenEmails={() => setIsEmailModalOpen(true)}
        onNavigateToApp={(appId) => {
          setSelectedAppId(appId);
          setCurrentTab('tracker');
        }}
      />

      {/* Instant WhatsApp & Helpline Floating Connector */}
      <WhatsAppSupportWidget />
    </div>
  );
}
