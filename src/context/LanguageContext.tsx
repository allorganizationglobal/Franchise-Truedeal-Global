import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'en' | 'hi';

export interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    // Top Bar & Corporate Identity
    'topBar.credentials': 'TRUEDEAL GLOBAL OPC PVT LTD · MCA Registered · DPIIT Startup India & Udyam MSME',
    'topBar.globalHq': 'Operating Location: Ghaziabad & Noida, UP, India',
    'topBar.hotline': '+91-9317194033',
    'topBar.whatsapp': 'WhatsApp: +91-8091667890',
    'topBar.email': 'info@truedealglobal.com',
    'topBar.offline': 'Offline Mode',
    'topBar.online': 'All Systems Online',
    'topBar.language': 'Language',

    // Brand
    'brand.name': 'TRUEDEAL GLOBAL',
    'brand.type': 'OPC PVT LTD',
    'brand.badge': 'OFFICIAL',
    'brand.sub': 'Franchise Onboarding Portal',

    // Navigation Tabs
    'nav.plans': 'Franchise Plans',
    'nav.successStories': 'How It Works',
    'nav.apply': 'Apply Online',
    'nav.tracker': 'Application Tracker',
    'nav.admin': 'Admin Console',
    'nav.analytics': 'Analytics & Audit',
    'nav.api': 'API Docs',
    'nav.ctaApplicant': 'Apply Online',
    'nav.ctaDirector': 'Admin Console',
    'nav.switchRole': 'Admin Role View (RBAC)',
    'nav.selectLanguage': 'Select Language / भाषा चुनें',
    'nav.english': 'English',
    'nav.hindi': 'हिन्दी (Hindi)',
    'nav.englishDesc': 'English portal interface',
    'nav.hindiDesc': 'हिन्दी इंटरफ़ेस और सहायता',

    // Hero Section
    'hero.badge': 'OFFICIAL BUSINESS FRANCHISE PORTAL · TRUEDEAL GLOBAL OPC PVT LTD',
    'hero.titlePrefix': 'Multi-Vertical Business',
    'hero.titleHighlight': 'Franchise Partnerships.',
    'hero.subtitle':
      'Partner with TRUEDEAL GLOBAL OPC PVT LTD to offer approved IT, digital marketing, travel, visa assistance, real estate, and corporate services with centralized fulfillment, transparent INR pricing, and zero annual royalties.',
    'hero.explorePlans': 'Explore All 8 Franchise Packages',
    'hero.calculateRoi': 'Illustrative Commission Estimator',

    // Plan Filter Categories
    'filter.all': 'All Franchise Plans (8)',
    'filter.starter': 'Starter Tier (₹2.5K - ₹4.9K)',
    'filter.growth': 'Corporate & Platinum (₹14.9K - ₹49.9K)',
    'filter.authority': 'Authority & Succession (₹99.9K - ₹1.99L)',
    'filter.master': 'Enterprise & Global (₹2.99L - ₹4.99L)',

    // Plan Card Common Elements
    'plan.selectAndApply': 'Select Plan & Apply',
    'plan.lifetimeValidity': 'One-Time Fee · Zero Annual Royalties',
    'plan.commission': 'Commission Schedule',
    'plan.referralBonus': 'Referral Structure',
    'plan.payoutFreq': 'Settlement Cycle',
    'plan.territory': 'Territory Scope',
    'plan.inclusions': 'Included Deliverables:',
    'plan.idealFor': 'Suitable For:',
    'plan.quickWhatsapp': 'Ask about this package on WhatsApp',

    // Earnings Calculator (Illustrative Only)
    'calc.title': 'Illustrative Commission & Revenue Estimator',
    'calc.subtitle':
      'Estimate hypothetical commission figures based on sample client order values. Actual earnings depend on client acquisition and are never guaranteed.',
    'calc.monthlyDeals': 'Hypothetical Monthly Client Orders',
    'calc.avgDealValue': 'Hypothetical Average Order Value',
    'calc.commissionRate': 'Sample Commission Tier',
    'calc.monthlyProjected': 'Illustrative Monthly Commission',
    'calc.annualProjected': 'Illustrative Annual Commission',
    'calc.applyWithProjected': 'Proceed to Franchise Application',

    // Onboarding Journey
    'stories.badge': 'TRANSPARENT ONBOARDING PROCESS',
    'stories.title': 'How Our Franchise Onboarding Works',
    'stories.subtitle':
      'From initial package evaluation and manual KYC review to written Franchise Agreement execution and digital activation.',

    // Verification & Certificates
    'verify.title': 'Registered Indian Corporate Entity & Verification Documents',
    'verify.subtitle':
      'TRUEDEAL GLOBAL OPC PVT LTD is incorporated under the Companies Act, 2013 (Ministry of Corporate Affairs, Govt. of India) and holds DPIIT Startup India and Udyam MSME registrations.',
    'verify.mcaTitle': 'MCA Incorporation & Charter',
    'verify.mcaDesc': 'Registered under the Companies Act, 2013 with verified e-MOA, e-AOA, and Corporate PAN.',
    'verify.dpiitTitle': 'DPIIT Startup India Recognition',
    'verify.dpiitDesc': 'Recognized entity under the Government of India Startup India program.',
    'verify.msmeTitle': 'Udyam MSME Registration',
    'verify.msmeDesc': 'Registered micro/small enterprise under the Ministry of MSME, Govt. of India.',

    // FAQ Section
    'faq.title': 'Frequently Asked Questions',
    'faq.subtitle': 'Transparent answers regarding package fees, compliance review, refunds, and partner obligations.',

    // Footer
    'footer.companyDesc':
      'TRUEDEAL GLOBAL OPC PVT LTD provides structured multi-vertical business franchise packages with centralized backend delivery and transparent onboarding terms.',
    'footer.directPhone': 'Customer Support Phone',
    'footer.instantWhatsapp': 'WhatsApp Helpdesk',
    'footer.officialEmail': 'Official Corporate Email',
    'footer.headquarters': 'Operating Location',
    'footer.copyright':
      '© 2026 TRUEDEAL GLOBAL OPC PVT LTD. All rights reserved. Registered under Ministry of Corporate Affairs, Govt. of India.'
  },
  hi: {
    // Top Bar & Corporate Identity
    'topBar.credentials': 'ट्रूडील ग्लोबल ओपीसी प्रा. लि. · एमसीए पंजीकृत · स्टार्टअप इंडिया एवं उद्यम एमएसएमई',
    'topBar.globalHq': 'कार्यक्षेत्र: गाजियाबाद एवं नोएडा, उत्तर प्रदेश, भारत',
    'topBar.hotline': '+91-9317194033',
    'topBar.whatsapp': 'व्हाट्सएप: +91-8091667890',
    'topBar.email': 'info@truedealglobal.com',
    'topBar.offline': 'ऑफलाइन मोड',
    'topBar.online': 'सभी सिस्टम ऑनलाइन',
    'topBar.language': 'भाषा',

    // Brand
    'brand.name': 'ट्रूडील ग्लोबल',
    'brand.type': 'ओपीसी प्रा. लि.',
    'brand.badge': 'आधिकारिक',
    'brand.sub': 'फ़्रैंचाइज़ी पंजीकरण पोर्टल',

    // Navigation Tabs
    'nav.plans': 'फ़्रैंचाइज़ी योजनाएं',
    'nav.successStories': 'ऑनबोर्डिंग प्रक्रिया',
    'nav.apply': 'ऑनलाइन आवेदन',
    'nav.tracker': 'आवेदन ट्रैकर',
    'nav.admin': 'एडमिन कंसोल',
    'nav.analytics': 'एनालिटिक्स व ऑडिट',
    'nav.api': 'एपीआई दस्तावेज़',
    'nav.ctaApplicant': 'ऑनलाइन आवेदन करें',
    'nav.ctaDirector': 'एडमिन कंसोल',
    'nav.switchRole': 'भूमिका बदलें (RBAC)',
    'nav.selectLanguage': 'भाषा चुनें / Select Language',
    'nav.english': 'English (अंग्रेज़ी)',
    'nav.hindi': 'हिन्दी (Hindi)',
    'nav.englishDesc': 'अंग्रेज़ी पोर्टल सामग्री',
    'nav.hindiDesc': 'हिन्दी इंटरफ़ेस और सहायता',

    // Hero Section
    'hero.badge': 'आधिकारिक बिज़नेस फ़्रैंचाइज़ी पोर्टल · ट्रूडील ग्लोबल ओपीसी प्रा. लि.',
    'hero.titlePrefix': 'मल्टी-वर्टिकल बिज़नेस',
    'hero.titleHighlight': 'फ़्रैंचाइज़ी साझेदारी।',
    'hero.subtitle':
      'ट्रूडील ग्लोबल ओपीसी प्राइवेट लिमिटेड के साथ जुड़ें। पारदर्शी INR शुल्क, शून्य वार्षिक रॉयल्टी और केंद्रीकृत बैकएंड डिलीवरी के साथ स्वीकृत आईटी, डिजिटल मार्केटिंग, ट्रैवल और कॉर्पोरेट सेवाएं प्रदान करें।',
    'hero.explorePlans': 'सभी 8 फ़्रैंचाइज़ी पैकेज देखें',
    'hero.calculateRoi': 'अनुमानित कमीशन कैलकुलेटर',

    // Plan Filter Categories
    'filter.all': 'सभी फ़्रैंचाइज़ी योजनाएं (8)',
    'filter.starter': 'स्टार्टर श्रेणियां (₹2,500 - ₹4,999)',
    'filter.growth': 'कॉर्पोरेट और प्लैटिनम (₹14,999 - ₹49,999)',
    'filter.authority': 'अथॉरिटी और उत्तराधिकार (₹99,999 - ₹1,99,999)',
    'filter.master': 'एंटरप्राइज और ग्लोबल (₹2,99,999 - ₹4,99,999)',

    // Plan Card Common Elements
    'plan.selectAndApply': 'योजना चुनें और आवेदन करें',
    'plan.lifetimeValidity': 'एकमुश्त शुल्क · शून्य वार्षिक रॉयल्टी',
    'plan.commission': 'कमीशन अनुसूची',
    'plan.referralBonus': 'रेफरल संरचना',
    'plan.payoutFreq': 'भुगतान चक्र',
    'plan.territory': 'कार्यक्षेत्र दायरा',
    'plan.inclusions': 'शामिल सेवाएं:',
    'plan.idealFor': 'उपयुक्त आवेदक:',
    'plan.quickWhatsapp': 'इस योजना के बारे में व्हाट्सएप पर पूछें',

    // Earnings Calculator
    'calc.title': 'उदाहरणात्मक कमीशन अनुमानक (केवल गणना हेतु)',
    'calc.subtitle':
      'नमूना ग्राहक ऑर्डर मूल्य के आधार पर संभावित कमीशन का अनुमान देखें। वास्तविक आय केवल व्यावसायिक प्रयास पर निर्भर करती है और किसी निश्चित आय की गारंटी नहीं है।',
    'calc.monthlyDeals': 'अनुमानित मासिक ग्राहक ऑर्डर',
    'calc.avgDealValue': 'प्रति ऑर्डर अनुमानित मूल्य',
    'calc.commissionRate': 'कमीशन श्रेणी',
    'calc.monthlyProjected': 'उदाहरणात्मक मासिक कमीशन',
    'calc.annualProjected': 'उदाहरणात्मक वार्षिक कमीशन',
    'calc.applyWithProjected': 'ऑनलाइन आवेदन पर आगे बढ़ें',

    // Onboarding Journey
    'stories.badge': 'पारदर्शी ऑनबोर्डिंग प्रक्रिया',
    'stories.title': 'हमारी फ़्रैंचाइज़ी प्रक्रिया कैसे काम करती है',
    'stories.subtitle':
      'ऑनलाइन आवेदन और मैनुअल केवाईसी जांच से लेकर लिखित फ़्रैंचाइज़ी अनुबंध और डिजिटल सक्रियण तक।',

    // Verification & Certificates
    'verify.title': 'भारत सरकार के तहत पंजीकृत कंपनी एवं दस्तावेज़',
    'verify.subtitle':
      'ट्रूडील ग्लोबल ओपीसी प्रा. लि. कंपनी अधिनियम 2013 (MCA), स्टार्टअप इंडिया DPIIT और उद्यम MSME के तहत पंजीकृत है।',
    'verify.mcaTitle': 'एमसीए निगमन एवं चार्टर दस्तावेज़',
    'verify.mcaDesc': 'कंपनी अधिनियम 2013 के तहत पंजीकृत (e-MOA, e-AOA एवं कॉर्पोरेट PAN उपलब्ध)।',
    'verify.dpiitTitle': 'डीपीआईआईटी स्टार्टअप इंडिया मान्यता',
    'verify.dpiitDesc': 'भारत सरकार के स्टार्टअप इंडिया कार्यक्रम के अंतर्गत मान्यता प्राप्त उद्यम।',
    'verify.msmeTitle': 'उद्यम एमएसएमई पंजीकरण',
    'verify.msmeDesc': 'एमएसएमई मंत्रालय, भारत सरकार के तहत पंजीकृत उद्यम।',

    // FAQ Section
    'faq.title': 'अक्सर पूछे जाने वाले प्रश्न (FAQ)',
    'faq.subtitle': 'पैकेज शुल्क, सत्यापन प्रक्रिया, रिफंड और साझेदार दायित्वों से जुड़े पारदर्शी उत्तर।',

    // Footer
    'footer.companyDesc':
      'ट्रूडील ग्लोबल ओपीसी प्राइवेट लिमिटेड पारदर्शी शर्तों और केंद्रीकृत बैकएंड सेवा वितरण के साथ बहु-उद्योग फ़्रैंचाइज़ी पैकेज प्रदान करती है।',
    'footer.directPhone': 'ग्राहक सहायता फोन',
    'footer.instantWhatsapp': 'व्हाट्सएप सहायता डेस्क',
    'footer.officialEmail': 'आधिकारिक कॉर्पोरेट ईमेल',
    'footer.headquarters': 'कार्यक्षेत्र स्थान',
    'footer.copyright':
      '© 2026 ट्रूडील ग्लोबल ओपीसी प्राइवेट लिमिटेड। सर्वाधिकार सुरक्षित। कॉर्पोरेट मामलों के मंत्रालय, भारत सरकार के तहत पंजीकृत।'
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
    return saved === 'hi' || saved === 'en' ? saved : 'en';
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
