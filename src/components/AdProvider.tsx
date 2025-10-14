
"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '@/firebase/provider';
import { Button } from './ui/button';
import { GoalStackLogo } from './icons/GoalStackLogo';

// --- Ad Context ---
interface AdContextType {
  isProUser: boolean;
  showSplashAd: boolean;
  showBannerAd: boolean;
  setSplashAdShown: () => void;
}

const AdContext = createContext<AdContextType | undefined>(undefined);

const SESSION_COUNT_KEY = 'goalstack_session_count';

export const AdProvider = ({ children }: { children: React.ReactNode }) => {
  const { isProUser } = useAuth();
  const [splashAdShown, setSplashAdShown] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);

  useEffect(() => {
    const count = parseInt(sessionStorage.getItem(SESSION_COUNT_KEY) || '0', 10);
    const newCount = count + 1;
    sessionStorage.setItem(SESSION_COUNT_KEY, newCount.toString());
    setSessionCount(newCount);
  }, []);
  
  const showSplashAd = !isProUser && !splashAdShown;
  const showBannerAd = !isProUser && sessionCount % 3 === 0;

  const value = {
    isProUser,
    showSplashAd,
    showBannerAd,
    setSplashAdShown: () => setSplashAdShown(true),
  };

  return <AdContext.Provider value={value}>{children}</AdContext.Provider>;
};

export const useAd = () => {
  const context = useContext(AdContext);
  if (!context) {
    throw new Error('useAd must be used within an AdProvider');
  }
  return context;
};

// --- Ad Components (Placeholders) ---

export const SplashScreenAd = () => {
  const { setSplashAdShown } = useAd();
  const [showSkip, setShowSkip] = useState(false);

  useEffect(() => {
    const skipTimer = setTimeout(() => setShowSkip(true), 1000);
    const hideTimer = setTimeout(() => setSplashAdShown(), 3000);
    return () => {
      clearTimeout(skipTimer);
      clearTimeout(hideTimer);
    };
  }, [setSplashAdShown]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
       <GoalStackLogo className="h-24 w-24 mb-4" />
       <h2 className="text-xl font-bold">مرحباً بك في Goal Stack</h2>
       <p className="text-muted-foreground">تجربتك الكروية تبدأ الآن</p>
       
       <div className="absolute bottom-10">
        <p className="text-xs text-muted-foreground">هذا إعلان ترحيبي</p>
       </div>

      {showSkip && (
        <Button
          variant="ghost"
          className="absolute top-4 right-4"
          onClick={setSplashAdShown}
        >
          تخطي
        </Button>
      )}
    </div>
  );
};


export const BannerAd = () => {
    return (
        <div className="relative w-full h-16 bg-card border-t flex items-center justify-center text-muted-foreground text-sm z-20">
            <p>منطقة الإعلان (Banner Ad)</p>
        </div>
    )
}
