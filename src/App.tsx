import { useState, useEffect } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import {
  auth,
  signInWithGoogle,
  signOutUser,
  isUserAdmin,
  fetchApplicationsFromFirestore,
  fetchMyApplicationsFromFirestore
} from './services/firebase';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { FranchisePlansView } from './components/portal/FranchisePlansView';
import { ApplicationWizard } from './components/portal/ApplicationWizard';
import { ApplicantStatusTracker } from './components/portal/ApplicantStatusTracker';
import { PaymentResultView } from './components/portal/PaymentResultView';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AnalyticsView } from './components/admin/AnalyticsView';
import { ApiDocsView } from './components/docs/ApiDocsView';
import { ContactUsPage } from './components/legal/ContactUsPage';
import { PricingTransparencyPage } from './components/legal/PricingTransparencyPage';
import {
  AboutUsPage,
  TermsPage,
  PrivacyPolicyPage,
  RefundPolicyPage,
  CancellationPolicyPage,
  FranchiseTermsPage,
  GrievanceRedressalPage,
  DeliveryPolicyPage
} from './components/legal/LegalPages';
import { SyncStatusMonitorModal } from './components/common/SyncStatusMonitorModal';
import { EmailPreviewModal } from './components/common/EmailPreviewModal';
import { NotificationsDrawer } from './components/common/NotificationsDrawer';
import { PaymentModal } from './components/common/PaymentModal';
import { WhatsAppSupportWidget } from './components/common/WhatsAppSupportWidget';
import { FranchiseStorageService, getPlanById } from './services/storage';
import { NotificationService } from './services/notificationService';
import { updateDocumentSeo } from './utils/seo';
import { UserRole, AppNotification, EmailNotification, SyncQueueItem, Currency, FranchiseApplication } from './types/franchise';

const PATH_TO_TAB: Record<string, string> = {
  '/': 'plans',
  '/plans': 'plans',
  '/pricing': 'pricing',
  '/packages': 'pricing',
  '/apply': 'apply',
  '/tracker': 'tracker',
  '/about': 'about',
  '/about-us': 'about',
  '/contact': 'contact',
  '/contact-us': 'contact',
  '/terms': 'terms',
  '/terms-and-conditions': 'terms',
  '/privacy': 'privacy',
  '/privacy-policy': 'privacy',
  '/refund': 'refund',
  '/refund-policy': 'refund',
  '/cancellation': 'cancellation',
  '/cancellation-policy': 'cancellation',
  '/franchise-terms': 'franchise-terms',
  '/franchise-agreement': 'franchise-terms',
  '/grievance': 'grievance',
  '/grievance-redressal': 'grievance',
  '/delivery': 'delivery',
  '/delivery-policy': 'delivery',
  '/shipping-policy': 'delivery',
  '/admin': 'admin',
  '/analytics': 'analytics',
  '/api-docs': 'api',
  '/api': 'api',
  '/payment-result': 'payment-result'
};

const TAB_TO_PATH: Record<string, string> = {
  plans: '/',
  pricing: '/pricing',
  apply: '/apply',
  tracker: '/tracker',
  about: '/about',
  contact: '/contact',
  terms: '/terms',
  privacy: '/privacy-policy',
  refund: '/refund-policy',
  cancellation: '/cancellation-policy',
  'franchise-terms': '/franchise-terms',
  grievance: '/grievance-redressal',
  delivery: '/delivery-policy',
  admin: '/admin',
  analytics: '/analytics',
  api: '/api-docs',
  'payment-result': '/payment-result'
};

const VALID_TABS = new Set(Object.keys(TAB_TO_PATH));

function getTabFromLocation(): string {
  if (typeof window === 'undefined') return 'plans';

  const cleanPath = window.location.pathname.replace(/\/+$/, '').toLowerCase() || '/';
  if (cleanPath !== '/' && PATH_TO_TAB[cleanPath]) {
    return PATH_TO_TAB[cleanPath];
  }

  const hash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
  if (hash) {
    if (VALID_TABS.has(hash)) return hash;
    if (PATH_TO_TAB[`/${hash}`]) return PATH_TO_TAB[`/${hash}`];
  }

  return 'plans';
}

export default function App() {
  const [currentTab, setCurrentTab] = useState<string>(getTabFromLocation);
  const [userRole, setUserRole] = useState<UserRole>('applicant');
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [currency, setCurrency] = useState<Currency>(() => {
    if (typeof window === 'undefined') return 'INR';
    return (localStorage.getItem('truedeal_currency') as Currency) || 'INR';
  });
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      localStorage.getItem('truedeal_theme') === 'dark' ||
      (!('truedeal_theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)
    );
  });

  const [isOffline, setIsOffline] = useState<boolean>(() => FranchiseStorageService.isSimulatedOffline());
  const [selectedAppId, setSelectedAppId] = useState<string>('TDG-2026-104');
  const [wizardPlanId, setWizardPlanId] = useState<string>('plan_standard');

  // Modals state
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isNotifDrawerOpen, setIsNotifDrawerOpen] = useState(false);
  const [quickPayApp, setQuickPayApp] = useState<FranchiseApplication | null>(null);
  const [authErrorBanner, setAuthErrorBanner] = useState<string | null>(null);

  // Live collections
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [emails, setEmails] = useState<EmailNotification[]>([]);
  const [syncQueue, setSyncQueue] = useState<SyncQueueItem[]>([]);

  const handleNavigate = (tab: string) => {
    const resolved = VALID_TABS.has(tab) ? tab : PATH_TO_TAB[`/${tab}`] || 'plans';
    setCurrentTab(resolved);
    if (typeof window !== 'undefined') {
      const targetPath = TAB_TO_PATH[resolved] || '/';
      if (window.location.pathname !== targetPath || window.location.hash) {
        window.history.pushState({ tab: resolved }, '', targetPath);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Sync SEO metadata on tab changes
  useEffect(() => {
    updateDocumentSeo(currentTab);
  }, [currentTab]);

  // Listen to browser back/forward and hash changes
  useEffect(() => {
    const handleRouteChange = () => {
      setCurrentTab(getTabFromLocation());
    };
    window.addEventListener('popstate', handleRouteChange);
    window.addEventListener('hashchange', handleRouteChange);
    return () => {
      window.removeEventListener('popstate', handleRouteChange);
      window.removeEventListener('hashchange', handleRouteChange);
    };
  }, []);

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

  // Persist currency choice
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('truedeal_currency', currency);
    }
  }, [currency]);

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

  // Firebase Authentication State Listener & Live Database Hydration
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user && isUserAdmin(user.email)) {
        const lowerEmail = (user.email || '').toLowerCase();
        setUserRole(
          lowerEmail === 'allorganizationglobal@gmail.com' || lowerEmail === 'director@truedealglobal.com'
            ? 'super_admin'
            : 'director'
        );
        try {
          const remoteApps = await fetchApplicationsFromFirestore();
          if (remoteApps && remoteApps.length > 0) {
            remoteApps.forEach((app) => FranchiseStorageService.saveApplication(app, false));
            refreshAllData();
          }
        } catch (err) {
          console.warn('Could not sync remote Firestore applications:', err);
        }
      } else {
        setUserRole('applicant');
        if (user?.uid) {
          try {
            const myApps = await fetchMyApplicationsFromFirestore(user.uid);
            if (myApps && myApps.length > 0) {
              myApps.forEach((app) => FranchiseStorageService.saveApplication(app, false));
              refreshAllData();
            }
          } catch (err) {
            console.warn('Could not sync applicant Firestore applications:', err);
          }
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const handleSignInGoogle = async (): Promise<{ ok: boolean; error?: string }> => {
    setAuthErrorBanner(null);
    try {
      const user = await signInWithGoogle();
      if (user) {
        NotificationService.addNotification(
          'Signed In Successfully',
          `Welcome back, ${user.displayName || user.email || 'Authorized Partner'}.`,
          'success'
        );
        refreshAllData();
        return { ok: true };
      }
      return { ok: false };
    } catch (err: any) {
      const code = err?.code || '';
      const msg = err?.message || 'Google Sign-In could not be completed. Please try again.';
      if (!code.includes('popup-closed') && !msg.includes('popup-closed')) {
        setAuthErrorBanner(msg);
        NotificationService.addNotification(
          'Sign-In Notice',
          msg,
          'warning'
        );
        return { ok: false, error: msg };
      }
      return { ok: false };
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
      setUserRole('applicant');
      NotificationService.addNotification('Signed Out', 'You have successfully signed out.', 'info');
      refreshAllData();
    } catch (err) {
      console.warn('Sign-out warning:', err);
    }
  };

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

  const handleRoleChange = (nextRole: UserRole) => {
    if (currentUser && isUserAdmin(currentUser.email)) {
      setUserRole(nextRole);
    } else {
      setUserRole('applicant');
    }
  };

  /**
   * Direct Razorpay Checkout launcher from Franchise Plans & Pricing pages.
   * Reuses an existing unpaid application for the signed-in user & plan, or creates
   * a real PAYMENT_PENDING application reference ID so Razorpay order binding is authentic.
   */
  const handleQuickPayRazorpay = (planId: string) => {
    const plan = getPlanById(planId) || FranchiseStorageService.getPlans()[0];
    if (!plan) return;
    const apps = FranchiseStorageService.getApplications();
    const userEmail = currentUser?.email?.toLowerCase();
    const userUid = currentUser?.uid;

    const existingUnpaid = apps.find(
      (a) =>
        a.planId === plan.id &&
        a.paymentStatus !== 'CAPTURED' &&
        a.paymentStatus !== 'SUCCESS' &&
        ((userUid && a.userId === userUid) ||
          (userEmail && a.applicant.email.toLowerCase() === userEmail))
    );

    if (existingUnpaid) {
      setSelectedAppId(existingUnpaid.id);
      setQuickPayApp(existingUnpaid);
      return;
    }

    const nowIso = new Date().toISOString();
    const generatedId = `TDG-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const newApp: FranchiseApplication = {
      id: generatedId,
      userId: currentUser?.uid,
      createdAt: nowIso,
      updatedAt: nowIso,
      applicant: {
        fullName: currentUser?.displayName || '',
        email: currentUser?.email || '',
        phone: '',
        companyName: '',
        country: 'India',
        stateProvince: 'Uttar Pradesh',
        city: 'Ghaziabad',
        postalCode: '201001',
        entityType: 'individual'
      },
      financials: {
        liquidCapital: plan.priceINR,
        netWorth: plan.priceINR * 2,
        creditScoreTier: '700_749',
        fundingSource: 'cash_savings'
      },
      planId: plan.id,
      amount: plan.priceINR,
      paymentStatus: 'PAYMENT_PENDING',
      territoryRequested: 'India — Primary Territory',
      preferredStartDate: nowIso.slice(0, 10),
      operationalExperienceYears: 1,
      businessBackgroundSummary: `Direct Razorpay Checkout registration for ${plan.title}.`,
      status: 'PAYMENT_PENDING',
      automatedEvaluation: {
        score: 75,
        liquidityStatus: 'pass',
        netWorthStatus: 'pass',
        creditStatus: 'pass',
        territoryAvailable: true,
        backgroundCheckPassed: true,
        preliminaryVerdict: 'manual_review_required',
        reasons: ['Initiated via direct Razorpay Checkout; pending manual KYC & agreement execution.'],
        calculatedAt: nowIso
      },
      documents: [],
      payments: [],
      reviewNotes: []
    };

    FranchiseStorageService.saveApplication(newApp);
    setSelectedAppId(newApp.id);
    setQuickPayApp(newApp);
    refreshAllData();
  };

  const unreadNotifsCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Offline Banner when in offline mode */}
      {isOffline && (
        <div className="bg-amber-500 text-slate-950 px-4 py-1.5 text-xs font-semibold text-center flex items-center justify-center gap-2">
          <span>
            Offline Operation Active: Changes will be stored locally and queued for synchronization when reconnected.
          </span>
          <button
            type="button"
            onClick={() => handleToggleOffline(false)}
            className="underline hover:text-white transition-colors cursor-pointer"
          >
            Re-connect
          </button>
        </div>
      )}

      {/* Top Navbar */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={handleNavigate}
        userRole={userRole}
        onChangeRole={handleRoleChange}
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
        currentUser={currentUser}
        onSignInGoogle={handleSignInGoogle}
        onSignOut={handleSignOut}
      />

      {/* Visible Google Sign-In Notice Banner (e.g., unauthorized custom domain or blocked popup) */}
      {authErrorBanner && (
        <div className="bg-amber-50 dark:bg-amber-950/60 border-b border-amber-200 dark:border-amber-800 px-4 py-2.5 text-xs text-amber-950 dark:text-amber-200">
          <div className="max-w-7xl mx-auto flex items-start justify-between gap-3">
            <span className="leading-relaxed font-medium">{authErrorBanner}</span>
            <button
              type="button"
              onClick={() => setAuthErrorBanner(null)}
              className="shrink-0 font-bold underline hover:text-amber-700 dark:hover:text-white cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main Viewport Content */}
      <main className="flex-1 w-full max-w-full overflow-x-hidden">
        {currentTab === 'plans' && (
          <FranchisePlansView
            currency={currency}
            onToggleCurrency={setCurrency}
            onNavigate={handleNavigate}
            onQuickPayRazorpay={handleQuickPayRazorpay}
            onSelectPlan={(planId) => {
              setWizardPlanId(planId);
              handleNavigate('apply');
            }}
          />
        )}

        {currentTab === 'pricing' && (
          <PricingTransparencyPage
            onNavigate={handleNavigate}
            onQuickPayRazorpay={handleQuickPayRazorpay}
            onSelectPlan={(planId) => {
              setWizardPlanId(planId);
              handleNavigate('apply');
            }}
          />
        )}

        {currentTab === 'apply' && (
          <ApplicationWizard
            initialPlanId={wizardPlanId}
            currency={currency}
            onToggleCurrency={setCurrency}
            currentUser={currentUser}
            onSignInGoogle={handleSignInGoogle}
            onNavigate={handleNavigate}
            onApplicationCreated={(newApp) => {
              setSelectedAppId(newApp.id);
              refreshAllData();
            }}
            onNavigateToTracker={(appId) => {
              setSelectedAppId(appId);
              handleNavigate('tracker');
              refreshAllData();
            }}
          />
        )}

        {currentTab === 'tracker' && (
          <ApplicantStatusTracker
            applicationId={selectedAppId}
            onRefresh={refreshAllData}
            onSelectApplication={setSelectedAppId}
            currentUser={currentUser}
            onSignInGoogle={handleSignInGoogle}
            onNavigate={handleNavigate}
            userRole={userRole}
          />
        )}

        {currentTab === 'payment-result' && (
          <PaymentResultView
            currentUser={currentUser}
            onSignInGoogle={handleSignInGoogle}
            onNavigate={handleNavigate}
            onRefresh={refreshAllData}
            onNavigateToTracker={(appId) => {
              setSelectedAppId(appId);
              handleNavigate('tracker');
              refreshAllData();
            }}
          />
        )}

        {currentTab === 'about' && <AboutUsPage onNavigate={handleNavigate} />}
        {currentTab === 'contact' && <ContactUsPage onNavigate={handleNavigate} />}
        {currentTab === 'terms' && <TermsPage onNavigate={handleNavigate} />}
        {currentTab === 'privacy' && <PrivacyPolicyPage onNavigate={handleNavigate} />}
        {currentTab === 'refund' && <RefundPolicyPage onNavigate={handleNavigate} />}
        {currentTab === 'cancellation' && <CancellationPolicyPage onNavigate={handleNavigate} />}
        {currentTab === 'franchise-terms' && <FranchiseTermsPage onNavigate={handleNavigate} />}
        {currentTab === 'grievance' && <GrievanceRedressalPage onNavigate={handleNavigate} />}
        {currentTab === 'delivery' && <DeliveryPolicyPage onNavigate={handleNavigate} />}

        {currentTab === 'admin' && (
          <AdminDashboard
            userRole={userRole}
            currentUser={currentUser}
            onSignInGoogle={handleSignInGoogle}
            onRefresh={refreshAllData}
            onSelectApplication={(id) => {
              setSelectedAppId(id);
              handleNavigate('tracker');
            }}
          />
        )}

        {currentTab === 'analytics' && (
          <AnalyticsView currentUser={currentUser} onSignInGoogle={handleSignInGoogle} />
        )}

        {currentTab === 'api' && (
          <ApiDocsView currentUser={currentUser} onSignInGoogle={handleSignInGoogle} />
        )}
      </main>

      {/* Enterprise Global Footer with All Required Legal & Transparency Links */}
      <Footer
        currency={currency}
        onSelectTab={handleNavigate}
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
          handleNavigate('tracker');
        }}
      />

      {/* Direct Razorpay Express Checkout Modal (from Plans / Pricing cards) */}
      {quickPayApp && (
        <PaymentModal
          isOpen={true}
          onClose={() => setQuickPayApp(null)}
          application={
            currentUser && !quickPayApp.userId
              ? {
                  ...quickPayApp,
                  userId: currentUser.uid,
                  applicant: {
                    ...quickPayApp.applicant,
                    fullName: currentUser.displayName || quickPayApp.applicant.fullName,
                    email: currentUser.email || quickPayApp.applicant.email
                  }
                }
              : quickPayApp
          }
          paymentType="franchise_deposit"
          amount={getPlanById(quickPayApp.planId)?.priceINR ?? quickPayApp.amount ?? 4999}
          currency="INR"
          currentUser={currentUser}
          onSignInGoogle={handleSignInGoogle}
          onNavigate={handleNavigate}
          onPaymentSuccess={() => {
            refreshAllData();
          }}
        />
      )}

      {/* Instant WhatsApp & Helpline Floating Connector */}
      <WhatsAppSupportWidget />
    </div>
  );
}
