import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'en' | 'hi';

export interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    // Top Bar & Global Rankings
    'topBar.rankIndia': '#1 Franchise Provider in India',
    'topBar.rankWorld': 'Top 3 Worldwide',
    'topBar.credentials': 'MCA Govt. of India Registered · DPIIT Startup India Certified',
    'topBar.globalHq': 'Global HQ: Ghaziabad NCR',
    'topBar.regionalDesks': 'Regional Desks: Dubai 🇦🇪 · Texas 🇺🇸 · Melbourne 🇦🇺 · Mumbai 🇮🇳',
    'topBar.hotline': '+91-9317194033',
    'topBar.whatsapp': 'WhatsApp: +91-8091667890',
    'topBar.email': 'info@truedealglobal.com',
    'topBar.offline': 'Offline Mode',
    'topBar.online': 'All Systems Online',
    'topBar.language': 'Language',

    // Brand
    'brand.name': 'TRUEDEAL GLOBAL',
    'brand.type': 'OPC PVT LTD',
    'brand.badge': 'INDIA #1',
    'brand.sub': 'Ranked Top 3 Worldwide',

    // Navigation Tabs
    'nav.plans': 'Franchise Plans',
    'nav.successStories': 'Success Stories',
    'nav.apply': 'Apply Online',
    'nav.tracker': 'Application Tracker',
    'nav.admin': 'Admin Pipeline',
    'nav.analytics': 'Analytics & Audit',
    'nav.api': 'API Docs',
    'nav.ctaApplicant': 'Apply for Franchise',
    'nav.ctaDirector': 'Open Pipeline',
    'nav.switchRole': 'Switch Role View (RBAC)',
    'nav.selectLanguage': 'Select Language / भाषा चुनें',
    'nav.english': 'English',
    'nav.hindi': 'हिन्दी (Hindi)',
    'nav.englishDesc': 'International English content',
    'nav.hindiDesc': 'पूर्ण हिन्दी सामग्री और समर्थन',

    // Hero Section
    'hero.badge': 'OFFICIAL FRANCHISE RECRUITMENT 2026 · GLOBAL EXPANSION',
    'hero.titlePrefix': "India's #1 Franchise Opportunity.",
    'hero.titleHighlight': 'Ranked Top 3 in the World.',
    'hero.subtitle': 'Partner with TrueDeal Global OPC Pvt Ltd. Deliver 50+ high-demand business verticals worldwide with turnkey fulfillment, up to 85% commissions, zero recurring royalties, and instant WhatsApp support.',
    'hero.explorePlans': 'Explore All 8 Franchise Plans',
    'hero.calculateRoi': 'Calculate Projected Earnings',
    'hero.statPartners': 'Active Franchise Partners Worldwide',
    'hero.statSuccess': 'Franchisee Success & Retention Rate',
    'hero.statDisbursement': 'Total Commissions Disbursed',
    'hero.statPayout': 'Twice-Weekly Direct Bank Payouts',

    // Plan Filter Categories
    'filter.all': 'All Franchise Plans (8)',
    'filter.starter': 'Starter Tier (₹2.5K - ₹4.9K)',
    'filter.growth': 'Corporate & Platinum (₹14.9K - ₹49.9K)',
    'filter.authority': 'Authority & Master (₹99.9K - ₹1.99L)',
    'filter.master': 'Enterprise & Global (₹2.99L - ₹4.99L)',

    // Plan Card Common Elements
    'plan.selectAndApply': 'Select Plan & Apply',
    'plan.lifetimeValidity': 'Lifetime Validity · Zero Royalties',
    'plan.commission': 'Commission Rate',
    'plan.referralBonus': 'Direct Referral Bonus',
    'plan.payoutFreq': 'Payout Frequency',
    'plan.territory': 'Territory Scope',
    'plan.inclusions': 'What is Included:',
    'plan.idealFor': 'Ideal Candidate:',
    'plan.quickWhatsapp': 'Chat about this plan on WhatsApp',

    // Earnings Calculator
    'calc.title': 'Interactive Franchise Earnings & ROI Calculator',
    'calc.subtitle': 'Simulate your monthly and annual income based on deal size and franchise commission tier.',
    'calc.monthlyDeals': 'Estimated Monthly Client Projects',
    'calc.avgDealValue': 'Average Client Deal Value',
    'calc.commissionRate': 'Your Commission Rate Tier',
    'calc.monthlyProjected': 'Projected Monthly Earnings',
    'calc.annualProjected': 'Projected Annual Earnings',
    'calc.applyWithProjected': 'Apply for Franchise with this Projection',

    // Success Stories
    'stories.badge': 'PROVEN TRACK RECORD · INDIA & GLOBAL',
    'stories.title': 'Franchise Growth & Partner Success Stories',
    'stories.subtitle': 'Hear how entrepreneurs across India and global hubs scaled from single cities to multi-million enterprise revenue.',
    'stories.expansionBanner': 'Expanding rapidly across 28 Indian States & 6 International Territories with turnkey fulfillment and 24/7 dedicated account governance.',

    // Verification & Certificates
    'verify.title': 'Government Recognized & Legally Bound Security',
    'verify.subtitle': 'TrueDeal Global OPC Pvt Ltd operates under strict compliance with the Ministry of Corporate Affairs (Govt. of India), Startup India DPIIT, ISO 9001:2015, and international AML/KYC frameworks.',
    'verify.mcaTitle': 'MCA Certificate of Incorporation',
    'verify.mcaDesc': 'Government of India Companies Act 2013 registration with valid CIN & PAN.',
    'verify.dpiitTitle': 'DPIIT Startup India Recognition',
    'verify.dpiitDesc': 'Recognized innovative enterprise under the national Startup India initiative.',
    'verify.isoTitle': 'ISO 9001:2015 Quality Certified',
    'verify.isoDesc': 'Standardized turnkey customer delivery, partner support and escrow workflows.',

    // FAQ Section
    'faq.title': 'Frequently Asked Questions',
    'faq.subtitle': 'Transparent answers to guide your franchise evaluation and partnership decision.',

    // Footer
    'footer.companyDesc': 'TrueDeal Global OPC Pvt Ltd is India’s #1 and the world’s top 3 premier multi-vertical franchise conglomerate, empowering entrepreneurs with turnkey fulfillment across 50+ business sectors.',
    'footer.directPhone': 'Direct Phone Hotline',
    'footer.instantWhatsapp': 'Instant WhatsApp Helpdesk',
    'footer.officialEmail': 'Corporate Directorate Email',
    'footer.headquarters': 'Global Corporate Headquarters',
    'footer.headquartersAddr': 'TrueDeal Global Tower, Tech Zone, Ghaziabad, NCR Delhi 201002, India',
    'footer.copyright': '© 2026 TrueDeal Global OPC Pvt Ltd. All rights reserved. Registered under Ministry of Corporate Affairs, Govt. of India.'
  },
  hi: {
    // Top Bar & Global Rankings
    'topBar.rankIndia': 'भारत में #1 फ़्रैंचाइज़ी प्रदाता',
    'topBar.rankWorld': 'दुनिया भर में शीर्ष 3',
    'topBar.credentials': 'एमसीए भारत सरकार पंजीकृत · डीपीआईआईटी स्टार्टअप इंडिया प्रमाणित',
    'topBar.globalHq': 'वैश्विक मुख्यालय: गाजियाबाद एनसीआर',
    'topBar.regionalDesks': 'क्षेत्रीय कार्यालय: दुबई 🇦🇪 · टेक्सास 🇺🇸 · मेलबर्न 🇦🇺 · मुंबई 🇮🇳',
    'topBar.hotline': '+91-9317194033',
    'topBar.whatsapp': 'व्हाट्सएप: +91-8091667890',
    'topBar.email': 'info@truedealglobal.com',
    'topBar.offline': 'ऑफलाइन मोड',
    'topBar.online': 'सभी सिस्टम ऑनलाइन',
    'topBar.language': 'भाषा',

    // Brand
    'brand.name': 'ट्रूडील ग्लोबल',
    'brand.type': 'ओपीसी प्रा. लि.',
    'brand.badge': 'भारत #1',
    'brand.sub': 'दुनिया भर में शीर्ष 3 में प्रमाणित',

    // Navigation Tabs
    'nav.plans': 'फ़्रैंचाइज़ी योजनाएं',
    'nav.successStories': 'सफलता की कहानियां',
    'nav.apply': 'ऑनलाइन आवेदन',
    'nav.tracker': 'आवेदन ट्रैकर',
    'nav.admin': 'व्यवस्थापक पाइपलाइन',
    'nav.analytics': 'एनालिटिक्स व ऑडिट',
    'nav.api': 'एपीआई दस्तावेज़',
    'nav.ctaApplicant': 'फ़्रैंचाइज़ी हेतु आवेदन करें',
    'nav.ctaDirector': 'पाइपलाइन खोलें',
    'nav.switchRole': 'भूमिका बदलें (RBAC)',
    'nav.selectLanguage': 'भाषा चुनें / Select Language',
    'nav.english': 'English (अंग्रेज़ी)',
    'nav.hindi': 'हिन्दी (Hindi)',
    'nav.englishDesc': 'अंतर्राष्ट्रीय अंग्रेज़ी सामग्री',
    'nav.hindiDesc': 'पूर्ण हिन्दी सामग्री और भारत समर्थन',

    // Hero Section
    'hero.badge': 'आधिकारिक फ़्रैंचाइज़ी भर्ती 2026 · वैश्विक विस्तार',
    'hero.titlePrefix': 'भारत का #1 फ़्रैंचाइज़ी अवसर।',
    'hero.titleHighlight': 'दुनिया में शीर्ष 3 स्थान पर प्रमाणित।',
    'hero.subtitle': 'ट्रूडील ग्लोबल ओपीसी प्राइवेट लिमिटेड के साथ साझेदारी करें। शून्य वार्षिक रॉयल्टी, 85% तक कमीशन, पूर्ण टर्नकी बैकएंड समर्थन और त्वरित व्हाट्सएप सहायता के साथ 50+ उच्च मांग वाले व्यापारिक कार्यक्षेत्र संचालित करें।',
    'hero.explorePlans': 'सभी 8 फ़्रैंचाइज़ी योजनाएं देखें',
    'hero.calculateRoi': 'अनुमानित कमाई की गणना करें',
    'hero.statPartners': 'विश्व भर में सक्रिय साझेदार',
    'hero.statSuccess': 'साझेदार सफलता और निरंतरता दर',
    'hero.statDisbursement': 'कुल वितरित कमीशन राशि',
    'hero.statPayout': 'सप्ताह में दो बार सीधे बैंक में भुगतान',

    // Plan Filter Categories
    'filter.all': 'सभी फ़्रैंचाइज़ी योजनाएं (8)',
    'filter.starter': 'स्टार्टर श्रेणियां (₹2,500 - ₹4,999)',
    'filter.growth': 'कॉर्पोरेट और प्लैटिनम (₹14,999 - ₹49,999)',
    'filter.authority': 'अथॉरिटी और मास्टर (₹99,999 - ₹1,99,999)',
    'filter.master': 'एंटरप्राइज और ग्लोबल (₹2,99,999 - ₹4,99,999)',

    // Plan Card Common Elements
    'plan.selectAndApply': 'योजना चुनें और आवेदन करें',
    'plan.lifetimeValidity': 'आजीवन वैधता · शून्य वार्षिक रॉयल्टी',
    'plan.commission': 'कमीशन दर',
    'plan.referralBonus': 'प्रत्यक्ष रेफरल बोनस',
    'plan.payoutFreq': 'भुगतान चक्र',
    'plan.territory': 'कार्यक्षेत्र दायरा',
    'plan.inclusions': 'योजना में क्या शामिल है:',
    'plan.idealFor': 'उपयुक्त उम्मीदवार:',
    'plan.quickWhatsapp': 'इस योजना हेतु व्हाट्सएप पर चैट करें',

    // Earnings Calculator
    'calc.title': 'इंटरैक्टिव फ़्रैंचाइज़ी कमाई और रिटर्न कैलकुलेटर',
    'calc.subtitle': 'अपने अनुमानित मासिक ग्राहक सौदों और कमीशन श्रेणी के आधार पर अपनी कमाई का आकलन करें।',
    'calc.monthlyDeals': 'मासिक ग्राहक परियोजनाओं की संख्या',
    'calc.avgDealValue': 'प्रति सौदा औसत ग्राहक मूल्य',
    'calc.commissionRate': 'आपकी फ़्रैंचाइज़ी कमीशन दर',
    'calc.monthlyProjected': 'अनुमानित मासिक शुद्ध कमाई',
    'calc.annualProjected': 'अनुमानित वार्षिक शुद्ध कमाई',
    'calc.applyWithProjected': 'इस आय अनुमान के साथ आवेदन करें',

    // Success Stories
    'stories.badge': 'प्रमाणित परिणाम · भारत और वैश्विक साझेदार',
    'stories.title': 'फ़्रैंचाइज़ी विकास और साझेदार सफलता की कहानियां',
    'stories.subtitle': 'जानिए कैसे भारत और विदेशों के उद्यमियों ने ट्रूडील ग्लोबल के साथ साझेदारी करके अपने व्यवसाय को करोड़ों तक पहुंचाया।',
    'stories.expansionBanner': 'भारत के 28 राज्यों और 6 अंतर्राष्ट्रीय देशों में पूर्ण टर्नकी पूर्ति और 24/7 समर्पित गवर्नेंस के साथ तीव्र विस्तार।',

    // Verification & Certificates
    'verify.title': 'भारत सरकार द्वारा मान्यता प्राप्त एवं कानूनी सुरक्षा',
    'verify.subtitle': 'ट्रूडील ग्लोबल ओपीसी प्रा. लि. कॉर्पोरेट मामलों के मंत्रालय (MCA), स्टार्टअप इंडिया DPIIT, ISO 9001:2015 और वैश्विक मानकों के पूर्ण अनुपालन के तहत संचालित है।',
    'verify.mcaTitle': 'एमसीए निगमन प्रमाणपत्र',
    'verify.mcaDesc': 'कंपनी अधिनियम 2013 के तहत भारत सरकार द्वारा जारी वैध सीआईएन व पैन पंजीकरण।',
    'verify.dpiitTitle': 'डीपीआईआईटी स्टार्टअप इंडिया मान्यता',
    'verify.dpiitDesc': 'राष्ट्रीय स्टार्टअप इंडिया पहल के अंतर्गत पंजीकृत नवाचारी उद्यम।',
    'verify.isoTitle': 'आईएसओ 9001:2015 गुणवत्ता प्रमाणित',
    'verify.isoDesc': 'मानकीकृत टर्नकी ग्राहक वितरण, साझेदार सहायता और एस्क्रो कार्यप्रणाली।',

    // FAQ Section
    'faq.title': 'अक्सर पूछे जाने वाले प्रश्न (FAQ)',
    'faq.subtitle': 'ट्रूडील ग्लोबल के साथ आपकी फ़्रैंचाइज़ी साझेदारी से जुड़े सभी प्रश्नों के स्पष्ट उत्तर।',

    // Footer
    'footer.companyDesc': 'ट्रूडील ग्लोबल ओपीसी प्राइवेट लिमिटेड भारत की #1 और दुनिया की शीर्ष 3 अग्रणी बहु-उद्योग फ़्रैंचाइज़ी कंपनी है, जो 50+ व्यापारिक क्षेत्रों में उद्यमियों को सशक्त बनाती है।',
    'footer.directPhone': 'सीधी कॉर्पोरेट फोन हेल्पलाइन',
    'footer.instantWhatsapp': 'त्वरित व्हाट्सएप सहायता डेस्क',
    'footer.officialEmail': 'कॉर्पोरेट डायरेक्टरेट ईमेल',
    'footer.headquarters': 'वैश्विक कॉर्पोरेट मुख्यालय',
    'footer.headquartersAddr': 'ट्रूडील ग्लोबल टॉवर, टेक ज़ोन, गाजियाबाद, एनसीआर दिल्ली 201002, भारत',
    'footer.copyright': '© 2026 ट्रूडील ग्लोबल ओपीसी प्राइवेट लिमिटेड। सर्वाधिकार सुरक्षित। कॉर्पोरेट मामलों के मंत्रालय, भारत सरकार के तहत पंजीकृत।'
  }
};

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  t: (key: string) => key
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window === 'undefined') return 'en';
    const saved = localStorage.getItem('truedeal_language');
    return (saved === 'hi' || saved === 'en') ? saved : 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('truedeal_language', lang);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.documentElement.lang = language;
    }
  }, [language]);

  const t = (key: string): string => {
    const currentDict = translations[language];
    if (currentDict && currentDict[key]) {
      return currentDict[key];
    }
    const fallbackDict = translations['en'];
    return (fallbackDict && fallbackDict[key]) || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
