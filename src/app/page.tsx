"use client";

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { BottomNav } from '@/components/BottomNav';
import { MatchesScreen } from './screens/MatchesScreen';
import { CompetitionsScreen } from './screens/CompetitionsScreen';
import { IraqScreen } from './screens/IraqScreen';
import { NewsScreen } from './screens/NewsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { CompetitionDetailScreen } from './screens/CompetitionDetailScreen';
import { cn } from '@/lib/utils';
import { LoginScreen } from './screens/LoginScreen';
import { AuthProvider, useAuth } from '@/context/AuthContext';

export type ScreenKey = 'Login' | 'SignUp' | 'Matches' | 'Competitions' | 'Iraq' | 'News' | 'Settings' | 'CompetitionDetails';
export type ScreenProps = {
  navigate: (screen: ScreenKey, props?: Record<string, any>) => void;
  goBack: () => void;
  canGoBack: boolean;
};

const screens: Record<ScreenKey, React.ComponentType<any>> = {
  Login: LoginScreen,
  SignUp: LoginScreen, 
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

function AppContent() {
  const { user, loadingAuth } = useAuth();
  
  const [stack, setStack] = useState<StackItem[]>([]);
  const [isAnimatingOut, setIsAnimatingOut] = useState<string | null>(null);
  
  const screenInstances = useRef<Record<string, JSX.Element>>({});

  useEffect(() => {
    if (!loadingAuth) {
      const initialScreen: ScreenKey = user ? 'Matches' : 'Login';
      setStack([{ key: `${initialScreen}-0`, screen: initialScreen }]);
    }
  }, [loadingAuth, user]);

  const goBack = useCallback(() => {
    if (stack.length > 1) {
      const lastItemKey = stack[stack.length - 1].key;
      setIsAnimatingOut(lastItemKey);
      setTimeout(() => {
        setStack(prev => {
            const newStack = prev.slice(0, -1);
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

    setStack(prevStack => {
      if (isMainTab) {
        if (prevStack.length === 1 && prevStack[0].screen === screen) return prevStack;
        screenInstances.current = {}; 
        return [newItem];
      } else {
        return [...prevStack, newItem];
      }
    });
  }, []);

  useEffect(() => {
    if (loadingAuth || stack.length === 0) return;

    const currentScreen = stack[stack.length-1].screen;
    if (user && (currentScreen === 'Login' || currentScreen === 'SignUp')) {
       navigate('Matches');
    } else if (!user && currentScreen !== 'Login' && currentScreen !== 'SignUp') {
       setStack([{ key: 'Login-0', screen: 'Login' }]);
       screenInstances.current = {};
    }
  }, [user, loadingAuth, navigate, stack]);


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

  if (loadingAuth || stack.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <main className="h-screen w-screen bg-background flex flex-col">
      <div className="relative flex-1 overflow-hidden">
        {renderedStack.map((item, index) => {
          const isTop = index === stack.length - 1;
          const isAnimating = isAnimatingOut === item.key;
          
          return (
            <div
              key={item.key}
              className={cn(
                "absolute inset-0 bg-background transition-transform duration-300 ease-out flex flex-col",
                stack.length > 1 && index > 0 && isTop && !isAnimating ? 'animate-slide-in-from-right' : '',
                isAnimating ? 'animate-slide-out-to-right' : '',
                !isTop ? 'pointer-events-none' : ''
              )}
              style={{ 
                zIndex: index,
                visibility: isTop ? 'visible' : 'hidden'
              }}
              aria-hidden={!isTop}
            >
              {item.component}
            </div>
          );
        })}
      </div>
      
      {activeScreenKey && <BottomNav activeScreen={activeScreenKey} onNavigate={navigate} />}
    </main>
  );
}

export default function Home() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
