
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import arTranslations from '@/lib/locales/ar.json';
import enTranslations from '@/lib/locales/en.json';

type Language = 'ar' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string) => string;
}

const translations = {
  ar: arTranslations,
  en: enTranslations,
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('ar');

  useEffect(() => {
    const storedLanguage = localStorage.getItem('goalstack_language') as Language;
    const resolvedLanguage = storedLanguage && ['ar', 'en'].includes(storedLanguage) ? storedLanguage : 'ar';
    
    setLanguageState(resolvedLanguage);
    document.documentElement.lang = resolvedLanguage;
    document.documentElement.dir = resolvedLanguage === 'ar' ? 'rtl' : 'ltr';
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('goalstack_language', lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  };

  const t = useCallback((key: string): string => {
      const langDict = translations[language] as Record<string, string>;
      return langDict[key] || key;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
}
