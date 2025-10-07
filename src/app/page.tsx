"use client";

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { User } from 'firebase/auth';
import { BottomNav } from '@/components/BottomNav';
import { MatchesScreen } from './screens/MatchesScreen';
import { CompetitionsScreen } from './screens/CompetitionsScreen';
import { IraqScreen } from './screens/IraqScreen';
import { NewsScreen } from './screens/NewsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { CompetitionDetailScreen } from './screens/CompetitionDetailScreen';
import { MatchDetailScreen } from './screens/MatchDetailScreen';
import { TeamDetailScreen } from './screens/TeamDetailScreen';
import { AdminFavoriteTeamScreen } from './screens/AdminFavoriteTeamScreen';
import { cn } from '@/lib/utils';
import { LoginScreen } from './screens/LoginScreen';
import { onAuthStateChange, checkRedirectResult } from '@/lib/firebase-client';
import { FirebaseProvider } from '@/firebase/provider';
import { ProfileButton } from '@/components/ProfileButton';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SearchSheet } from '@/components/SearchSheet';


export type ScreenKey = 'Login' | 'SignUp' | 'Matches' | 'Competitions' | 'Iraq' | 'News' | 'Settings' | 'CompetitionDetails' | 'MatchDetails' | 'TeamDetails' | 'AdminFavoriteTeamDetails';
export type ScreenProps = {
  navigate: (screen: ScreenKey, props?: Record<string, any>) => void;
  goBack: () => void;
  canGoBack: boolean;
};

const screens: Record<Exclude<ScreenKey, 'Search'>, React.ComponentType<any>> = {
  Login: LoginScreen,
  SignUp: LoginScreen, 
  Matches: MatchesScreen,
  Competitions: CompetitionsScreen,
  Iraq: IraqScreen,
  News: NewsScreen,
  Settings: SettingsScreen,
  CompetitionDetails: CompetitionDetailScreen,
  MatchDetails: MatchDetailScreen,
  TeamDetails: TeamDetailScreen,
  AdminFavoriteTeamDetails: AdminFavoriteTeamScreen,
};

const mainTabs: ScreenKey[] = ['Matches', 'Competitions', 'Iraq', 'News', 'Settings'];

type StackItem = {
  key: string;
  screen: ScreenKey;
  props?: Record<string, any>;
};

function AppContent({ user }: { user: User | null }) {
  const [stack, setStack] = useState<StackItem[]>([{ key: 'Matches-0', screen: 'Matches' }]);
  const [isAnimatingOut, setIsAnimatingOut] = useState<string | null>(null);
  
  const screenInstances = useRef<Record<string, JSX.Element>>({});

  const goBack = useCallback(() => {
    if (stack.length > 1) {
      const lastItemKey = stack[stack.length - 1].key;
      setIsAnimatingOut(lastItemKey);
      setTimeout(() => {
        setStack(prev => {
            const newStack = prev.slice(0, -1);
            // We don't delete the instance to keep it alive if needed later.
            // A more robust keep-alive implementation would manage memory.
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
        if (prevStack.length === 1 && prevStack[0].screen === screen) {
           return prevStack;
        }
        return [newItem];
      } else {
        return [...prevStack, newItem];
      }
    });
  }, []);

  const renderedStack = useMemo(() => {
    const canGoBack = stack.length > 1;
    
    const navigationProps = { 
      navigate, 
      goBack, 
      canGoBack,
      headerActions: (
          <div className="flex items-center gap-1">
             <SearchSheet navigate={navigate}>
                <Button variant="ghost" size="icon">
                    <Search className="h-5 w-5" />
                </Button>
            </SearchSheet>
             <ProfileButton navigate={navigate} />
          </div>
      )
    };
    
    return stack.map((item, index) => {
        const ScreenComponent = screens[item.screen as Exclude<ScreenKey, 'Search'>];
        if (!screenInstances.current[item.key]) {
            screenInstances.current[item.key] = <ScreenComponent {...navigationProps} {...item.props} />;
        }
        return {
            ...item,
            isEntering: stack.length > 1 && index === stack.length - 1 && !mainTabs.includes(item.screen),
            component: screenInstances.current[item.key]
        };
    });
  }, [stack, navigate, goBack]);

  if (!stack || stack.length === 0) {
    return (
        <div className="flex items-center justify-center h-screen bg-background">
          <p>جاري التحميل...</p>
        </div>
    );
  }

  const activeScreenKey = stack[stack.length - 1].screen;
  const showBottomNav = user && mainTabs.includes(activeScreenKey);

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
                "absolute inset-0 bg-background flex flex-col",
                item.isEntering && 'animate-slide-in-from-right',
                isAnimating && 'animate-slide-out-to-right'
              )}
              style={{
                zIndex: index,
                display: isTop ? 'flex' : 'none'
              }}
              aria-hidden={!isTop}
            >
              {item.component}
            </div>
          );
        })}
      </div>
      
      {showBottomNav && <BottomNav activeScreen={activeScreenKey} onNavigate={navigate} />}
    </main>
  );
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    checkRedirectResult().catch(err => {
        console.error("Redirect check failed:", err);
    });

    const unsubscribe = onAuthStateChange((currentUser) => {
      setUser(currentUser);
      setLoadingAuth(false);
    });
    
    return () => unsubscribe();
  }, []);

  if (loadingAuth) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <p>جاري التحميل...</p>
      </div>
    );
  }

  return (
    <FirebaseProvider user={user}>
      {user ? <AppContent user={user} /> : <LoginScreen navigate={() => {}} goBack={() => {}} canGoBack={false} />}
    </FirebaseProvider>
  );
}

