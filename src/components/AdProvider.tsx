
"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '@/firebase/provider';
import { Button } from './ui/button';
import { GoalStackLogo } from './icons/GoalStackLogo';

// --- Ad Context ---
interface AdContextType {
  showSplashAd: boolean;
  showBannerAd: boolean;
  setSplashAdShown: () => void;
}

const AdContext = createContext<AdContextType | undefined>(undefined);

const SESSION_COUNT_KEY = 'goalstack_session_count';

export const AdProvider = ({ children }: { children: React.ReactNode }) => {
  const { isProUser } = useAuth();
  const [splashAdShownThisSession, setSplashAdShownThisSession] = useState(
    () => sessionStorage.getItem('splashAdShown') === 'true'
  );
  const [sessionCount, setSessionCount] = useState(0);

  useEffect(() => {
    // Only track sessions and show ads for non-pro users.
    if (isProUser) {
      setSessionCount(0); // Reset count if user becomes pro
      return;
    };
    const count = parseInt(sessionStorage.getItem(SESSION_COUNT_KEY) || '0', 10);
    // Only increment on the first render of a session
    if (count === 0 && sessionCount === 0) {
        const newCount = 1;
        sessionStorage.setItem(SESSION_COUNT_KEY, newCount.toString());
        setSessionCount(newCount);
    } else {
        setSessionCount(count);
    }
  }, [isProUser, sessionCount]);
  
  const setSplashAdShown = () => {
      setSplashAdShownThisSession(true);
      sessionStorage.setItem('splashAdShown', 'true');
  }

  // Show splash ad on the first visit of a session for non-pro users.
  const showSplashAd = !isProUser && !splashAdShownThisSession;
  
  // Show banner ad for non-pro users.
  const showBannerAd = !isProUser;

  const value = {
    showSplashAd,
    showBannerAd,
    setSplashAdShown,
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
       <h2 className="text-xl font-bold">مرحباً بك في نبض الملاعب</h2>
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
