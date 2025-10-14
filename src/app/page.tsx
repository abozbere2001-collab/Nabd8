
"use client";

import React, { useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import { LoginScreen } from './screens/LoginScreen';
import { FirebaseProvider, useAuth } from '@/firebase/provider';
import { onAuthStateChange, guestUser } from '@/lib/firebase-client';
import { AppContentWrapper } from './AppContentWrapper';
import { Loader2 } from 'lucide-react';

export type ScreenKey = 'Login' | 'SignUp' | 'Matches' | 'Competitions' | 'Iraq' | 'News' | 'Settings' | 'CompetitionDetails' | 'TeamDetails' | 'AdminFavoriteTeamDetails' | 'Comments' | 'Notifications' | 'GlobalPredictions' | 'AdminMatchSelection' | 'Profile' | 'SeasonPredictions' | 'SeasonTeamSelection' | 'SeasonPlayerSelection' | 'AddEditNews' | 'ManageTopScorers' | 'MatchDetails';

export type ScreenProps = {
  navigate: (screen: ScreenKey, props?: Record<string, any>) => void;
  goBack: () => void;
  canGoBack: boolean;
};

function App() {
  const { user } = useAuth();
  
  if (user === undefined) {
      return (
          <div className="flex items-center justify-center h-screen bg-background">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-4">جاري التحميل...</p>
          </div>
      );
  }
  
  if (!user) { // This covers both null and guest users who aren't fully authenticated
    return <LoginScreen navigate={() => {}} goBack={() => {}} canGoBack={false} />;
  }

  // This will render for both a logged-in user and a guest user
  return <AppContentWrapper />;
}

export default function Home() {
  return (
    <FirebaseProvider>
      <App />
    </FirebaseProvider>
  );
}
