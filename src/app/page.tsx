"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { BottomNav } from '@/components/BottomNav';
import { LoginScreen } from './screens/LoginScreen';
import { MatchesScreen } from './screens/MatchesScreen';
import { CompetitionsScreen } from './screens/CompetitionsScreen';
import { IraqScreen } from './screens/IraqScreen';
import { NewsScreen } from './screens/NewsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { CompetitionDetailScreen } from './screens/CompetitionDetailScreen';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { Toaster } from '@/components/ui/toaster';

export type ScreenKey = 'Login' | 'SignUp' | 'Matches' | 'Competitions' | 'Iraq' | 'News' | 'Settings' | 'CompetitionDetails';
export type ScreenProps = {
  navigate: (screen: ScreenKey, props?: Record<string, any>) => void;
  goBack: () => void;
  canGoBack: boolean;
};

const screens: Record<ScreenKey, React.ComponentType<any>> = {
  Login: LoginScreen,
  SignUp: LoginScreen, // Placeholder for SignUp
  Matches: MatchesScreen,
  Competitions: CompetitionsScreen,
  Iraq: IraqScreen,
  News: NewsScreen,
  Settings: SettingsScreen,
  CompetitionDetails: CompetitionDetailScreen,
};

const mainTabs: ScreenKey[] = ['Matches', 'Competitions', 'Iraq', 'News', 'Settings'];

type StackItem = {
  key: string;
  screen: ScreenKey;
  props?: Record<string, any>;
};

export default function Home() {
  const { user, loading } = useAuth();
  const [stack, setStack] = useState<StackItem[]>([]);
  const [isAnimatingOut, setIsAnimatingOut] = useState<string | null>(null);
  
  // This ref holds the rendered components to keep them alive
  const screenInstances = useRef<Record<string, JSX.Element>>({});

  useEffect(() => {
    if (loading) return;
    if (!user) {
      if (stack.length === 0 || stack[0].screen !== 'Login') {
        setStack([{ key: 'Login-0', screen: 'Login' }]);
        screenInstances.current = {};
      }
    } else {
      if (stack.length === 0 || stack[0].screen === 'Login') {
        setStack([{ key: 'Matches-0', screen: 'Matches' }]);
        screenInstances.current = {};
      }
    }
  }, [user, loading, stack]);

  const goBack = useCallback(() => {
    if (stack.length > 1) {
      const lastItemKey = stack[stack.length - 1].key;
      setIsAnimatingOut(lastItemKey);
      setTimeout(() => {
        setStack(prev => {
            const newStack = prev.slice(0, -1);
            // Clean up instance from ref when it's fully gone
            delete screenInstances.current[lastItemKey];
            return newStack;
        });
        setIsAnimatingOut(null);
      }, 300);
    }
  }, [stack]);

  const navigate = useCallback((screen: ScreenKey, props?: Record<string, any>) => {
    const isMainTab = mainTabs.includes(screen);
    const newKey = `${screen}-${Date.now()}`;
    const newItem = { key: newKey, screen, props };

    if (isMainTab) {
      setStack([newItem]); // Reset stack for main tabs
      screenInstances.current = {};
    } else {
      setStack(prev => [...prev, newItem]);
    }
  }, []);

  const renderedStack = useMemo(() => {
    const canGoBack = stack.length > 1;
    const navigationProps = { navigate, goBack, canGoBack };
    
    return stack.map((item) => {
      if (!screenInstances.current[item.key]) {
        const ScreenComponent = screens[item.screen];
        screenInstances.current[item.key] = <ScreenComponent {...navigationProps} {...item.props} />;
      }
      return {
        ...item,
        component: screenInstances.current[item.key]
      };
    });
  }, [stack, navigate, goBack]);

  const activeScreenKey = stack.length > 0 ? stack[stack.length - 1].screen : null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-800 dark:bg-gray-900">
      <div className="w-full max-w-sm mx-auto bg-black rounded-[40px] shadow-2xl p-2 border-4 border-gray-600">
        <div className="w-full h-[700px] bg-background rounded-[32px] overflow-hidden relative flex flex-col">
          {/* Notch */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-black rounded-b-xl z-30"></div>
          
          <div className="relative flex-1 bg-background">
            {loading && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
            
            {!loading && renderedStack.map((item, index) => {
              const isTop = index === stack.length - 1;
              const isAnimating = isAnimatingOut === item.key;
              
              return (
                <div
                  key={item.key}
                  className={cn(
                    "absolute inset-0 bg-background transition-transform duration-300 ease-out",
                    isTop && !isAnimating ? 'animate-slide-in-from-right' : '',
                    isAnimating ? 'animate-slide-out-to-right' : '',
                  )}
                  style={{ zIndex: index }}
                  aria-hidden={!isTop}
                >
                  {item.component}
                </div>
              );
            })}
          </div>
          
          {user && activeScreenKey && <BottomNav activeScreen={activeScreenKey} onNavigate={navigate} screens={screens} />}
        </div>
      </div>
       <p className="text-white/50 text-xs mt-4">Goal Stack - Mobile Simulation</p>
    </main>
  );
}
