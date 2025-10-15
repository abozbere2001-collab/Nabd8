
"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '@/firebase/provider';
import { Button } from './ui/button';
import { GoalStackLogo } from './icons/GoalStackLogo';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

// --- Ad Context ---
interface AdContextType {
  showSplashAd: boolean;
  showBannerAd: boolean;
  setSplashAdShown: () => void;
  dismissBannerAd: () => void;
}

const AdContext = createContext<AdContextType | undefined>(undefined);

const SPLASH_AD_SEEN_KEY = 'goalstack_splash_ad_seen'; // Use localStorage for persistence
const BANNER_AD_DISMISSED_KEY = 'goalstack_banner_ad_dismissed_session'; // Use sessionStorage for session-only dismissal

export const AdProvider = ({ children }: { children: React.ReactNode }) => {
  const { isProUser } = useAuth();
  
  // Splash ad state (persistent)
  const [splashAdSeen, setSplashAdSeen] = useState(() => {
    if (typeof window === 'undefined') return true; // Don't show on server
    return localStorage.getItem(SPLASH_AD_SEEN_KEY) === 'true';
  });

  // Banner ad state (session-based)
  const [bannerAdDismissed, setBannerAdDismissed] = useState(() => {
    if (typeof window === 'undefined') return true; // Don't show on server
    return sessionStorage.getItem(BANNER_AD_DISMISSED_KEY) === 'true';
  });

  const setSplashAdShown = () => {
    setSplashAdSeen(true);
    localStorage.setItem(SPLASH_AD_SEEN_KEY, 'true');
  }

  const dismissBannerAd = () => {
    setBannerAdDismissed(true);
    sessionStorage.setItem(BANNER_AD_DISMISSED_KEY, 'true');
  }

  // Show splash ad only for non-pro users who have never seen it before
  const showSplashAd = !isProUser && !splashAdSeen;
  
  // Show banner ad for non-pro users if it hasn't been dismissed this session
  const showBannerAd = !isProUser && !bannerAdDismissed;

  const value = {
    showSplashAd,
    showBannerAd,
    setSplashAdShown,
    dismissBannerAd,
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
    const { dismissBannerAd } = useAd();
    return (
        <div className="relative w-full h-16 bg-card border-t flex items-center justify-center text-muted-foreground text-sm z-20">
            <p>منطقة الإعلان (Banner Ad)</p>
            <Button 
                variant="ghost" 
                size="icon" 
                className="absolute top-1 right-1 h-7 w-7"
                onClick={dismissBannerAd}
            >
                <X className="h-4 w-4" />
            </Button>
        </div>
    )
}
