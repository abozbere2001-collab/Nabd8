
"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '@/firebase/provider';
import { Button } from './ui/button';
import { GoalStackLogo } from './icons/GoalStackLogo';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isToday, isBefore, addMonths, parseISO, format } from 'date-fns';

// --- Ad Context ---
interface AdContextType {
  showSplashAd: boolean;
  showBannerAd: boolean;
  setSplashAdShown: () => void;
  dismissBannerAd: () => void;
}

const AdContext = createContext<AdContextType | undefined>(undefined);

const FIRST_USE_DATE_KEY = 'goalstack_first_use_date';
const SPLASH_AD_LAST_SHOWN_KEY = 'goalstack_splash_ad_last_shown';
const BANNER_AD_DISMISSED_KEY = 'goalstack_banner_ad_dismissed_session';

export const AdProvider = ({ children }: { children: React.ReactNode }) => {
  const { isProUser } = useAuth();
  const [shouldShowSplash, setShouldShowSplash] = useState(false);
  const [bannerAdDismissed, setBannerAdDismissed] = useState(() => {
    if (typeof window === 'undefined') return true;
    return sessionStorage.getItem(BANNER_AD_DISMISSED_KEY) === 'true';
  });

  useEffect(() => {
    if (isProUser || typeof window === 'undefined') {
      setShouldShowSplash(false);
      return;
    }

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const lastShownDate = localStorage.getItem(SPLASH_AD_LAST_SHOWN_KEY);

    if (lastShownDate === todayStr) {
      setShouldShowSplash(false); // Already shown today
      return;
    }
    
    const firstUseDateStr = localStorage.getItem(FIRST_USE_DATE_KEY);

    if (!firstUseDateStr) {
      // First time user ever, set the date but don't show the ad.
      localStorage.setItem(FIRST_USE_DATE_KEY, new Date().toISOString());
      setShouldShowSplash(false);
    } else {
      const firstUseDate = parseISO(firstUseDateStr);
      const oneMonthLater = addMonths(firstUseDate, 1);
      
      // Show the ad only if one month has passed since first use.
      if (isBefore(new Date(), oneMonthLater)) {
        setShouldShowSplash(false);
      } else {
        setShouldShowSplash(true);
      }
    }
  }, [isProUser]);

  const setSplashAdShown = () => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    localStorage.setItem(SPLASH_AD_LAST_SHOWN_KEY, todayStr);
    setShouldShowSplash(false);
  }

  const dismissBannerAd = () => {
    setBannerAdDismissed(true);
    sessionStorage.setItem(BANNER_AD_DISMISSED_KEY, 'true');
  }

  const showSplashAd = !isProUser && shouldShowSplash;
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

// --- Ad Components ---

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
