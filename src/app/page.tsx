"use client";

import React, { useState, useCallback, useRef, useEffect } from 'react';
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
import { CommentsScreen } from './screens/CommentsScreen';
import { NotificationsScreen } from './screens/NotificationsScreen';
import { cn } from '@/lib/utils';
import { LoginScreen } from './screens/LoginScreen';
import { FirebaseProvider, useAuth } from '@/firebase/provider';
import { ProfileButton } from '@/components/ProfileButton';
import { SearchSheet } from '@/components/SearchSheet';
import { onAuthStateChange } from '@/lib/firebase-client';
import { NotificationsButton } from '@/components/NotificationsButton';

export type ScreenKey = 'Login' | 'SignUp' | 'Matches' | 'Competitions' | 'Iraq' | 'News' | 'Settings' | 'CompetitionDetails' | 'MatchDetails' | 'TeamDetails' | 'AdminFavoriteTeamDetails' | 'Comments' | 'Notifications';
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
  Comments: CommentsScreen,
  Notifications: NotificationsScreen,
};

const mainTabs: ScreenKey[] = ['Matches', 'Competitions', 'Iraq', 'News', 'Settings'];

type StackItem = {
  key: string;
  screen: ScreenKey;
  props?: Record<string, any>;
};

function AppContent({ user }: { user: User | null }) {
  const [stack, setStack] = useState<StackItem[]>([{ key: 'Matches-0', screen: 'Matches' }]);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const [isEntering, setIsEntering] = useState(false);
  
  const goBack = useCallback(() => {
    if (stack.length > 1) {
      setIsAnimatingOut(true);
      setTimeout(() => {
        setStack(prev => prev.slice(0, -1));
        setIsAnimatingOut(false);
      }, 300);
    }
  }, [stack]);

  const navigate = useCallback((screen: ScreenKey, props?: Record<string, any>) => {
    const isMainTab = mainTabs.includes(screen);
    const newKey = `${screen}-${Date.now()}`;
    const newItem = { key: newKey, screen, props };

    if (!isMainTab) {
        setIsEntering(true);
        setTimeout(() => setIsEntering(false), 300);
    }

    setStack(prevStack => {
      if (isMainTab) {
        if (prevStack.length === 1 && prevStack[0].screen === screen) {
           return prevStack;
        }
        return [newItem];
      } else {
        // Prevent pushing the same screen twice
        if (prevStack[prevStack.length - 1].screen === screen) {
            return prevStack;
        }
        return [...prevStack, newItem];
      }
    });
  }, []);

  if (!stack || stack.length === 0) {
    return (
        <div className="flex items-center justify-center h-screen bg-background">
          <p>جاري التحميل...</p>
        </div>
    );
  }

  const activeStackItem = stack[stack.length - 1];
  const previousStackItem = stack.length > 1 ? stack[stack.length - 2] : null;

  const ActiveScreenComponent = screens[activeStackItem.screen as Exclude<ScreenKey, 'Search'>];
  
  const navigationProps = { 
      navigate, 
      goBack, 
      canGoBack: stack.length > 1,
  };
  const headerActions = (
    <>
      <NotificationsButton navigate={navigate} />
      <ProfileButton navigate={navigate} />
    </>
  );


  const activeScreenKey = activeStackItem.screen;
  const showBottomNav = user && mainTabs.includes(activeScreenKey);

  return (
    <main className="h-screen w-screen bg-background flex flex-col">
       <SearchSheet navigate={navigate}>
          <div className='hidden'></div>
        </SearchSheet>
      <div className="relative flex-1 overflow-hidden">
        {/* Previous screen for animation */}
        {previousStackItem && isAnimatingOut && (
             (() => {
                const PreviousScreenComponent = screens[previousStackItem.screen as Exclude<ScreenKey, 'Search'>];
                return (
                     <div
                        key={previousStackItem.key}
                        className="absolute inset-0 bg-background flex flex-col"
                        style={{ zIndex: stack.length - 2 }}
                     >
                        <PreviousScreenComponent {...navigationProps} {...previousStackItem.props} headerActions={headerActions} />
                     </div>
                )
             })()
        )}
        
        {/* Active screen */}
        <div
            key={activeStackItem.key}
            className={cn(
            "absolute inset-0 bg-background flex flex-col",
            isEntering && !mainTabs.includes(activeStackItem.screen) && 'animate-slide-in-from-right',
            isAnimatingOut && 'animate-slide-out-to-right'
            )}
            style={{ zIndex: stack.length -1 }}
        >
           <ActiveScreenComponent {...navigationProps} {...activeStackItem.props} headerActions={headerActions} />
        </div>

      </div>
      
      {showBottomNav && <BottomNav activeScreen={activeScreenKey} onNavigate={navigate} />}
    </main>
  );
}


export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
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
    <FirebaseProvider>
      {user ? <AppContent user={user} /> : <LoginScreen navigate={() => {}} goBack={() => {}} canGoBack={false} />}
    </FirebaseProvider>
  );
}

    