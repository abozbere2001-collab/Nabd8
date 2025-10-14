

"use client";

import React, { useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import { LoginScreen } from './screens/LoginScreen';
import { FirebaseProvider, useAuth } from '@/firebase/provider';
import { onAuthStateChange, guestUser } from '@/lib/firebase-client';
import { AppContentWrapper } from './AppContentWrapper';

export type ScreenKey = 'Login' | 'SignUp' | 'Matches' | 'Competitions' | 'Iraq' | 'News' | 'Settings' | 'CompetitionDetails' | 'TeamDetails' | 'AdminFavoriteTeamDetails' | 'Comments' | 'Notifications' | 'GlobalPredictions' | 'AdminMatchSelection' | 'Profile' | 'SeasonPredictions' | 'SeasonTeamSelection' | 'SeasonPlayerSelection' | 'AddEditNews' | 'ManageTopScorers' | 'MatchDetails';

export type ScreenProps = {
  navigate: (screen: ScreenKey, props?: Record<string, any>) => void;
  goBack: () => void;
  canGoBack: boolean;
};

function App() {
  const { user } = useAuth();

  // Unified loading and auth check
  if (user === undefined) {
      return (
          <div className="flex items-center justify-center h-screen bg-background">
              <p>جاري التحميل...</p>
          </div>
      );
  }
  
  if (user === null) {
    return <LoginScreen navigate={() => {}} goBack={() => {}} canGoBack={false} />;
  }

  // This will render for both a logged-in user and a guest user
  return <AppContentWrapper />;
}

export default function Home() {
  const [user, setUser] = useState<User | typeof guestUser | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = onAuthStateChange((currentUser) => {
      setUser(currentUser);
    });
    
    return () => unsubscribe();
  }, []);

  return (
    <FirebaseProvider user={user}>
      <App />
    </FirebaseProvider>
  );
}
