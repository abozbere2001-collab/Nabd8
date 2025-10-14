
"use client";

import React from 'react';
import type { User } from 'firebase/auth';
import { LoginScreen } from './screens/LoginScreen';
import { FirebaseProvider, useAuth } from '@/firebase/provider';
import { AppContentWrapper } from './AppContentWrapper';
import { Loader2 } from 'lucide-react';
import { AdProvider } from '@/components/AdProvider';

export type ScreenKey = 'Login' | 'SignUp' | 'Matches' | 'Competitions' | 'Iraq' | 'News' | 'Settings' | 'CompetitionDetails' | 'TeamDetails' | 'PlayerDetails' | 'AdminFavoriteTeamDetails' | 'Comments' | 'Notifications' | 'GlobalPredictions' | 'AdminMatchSelection' | 'Profile' | 'SeasonPredictions' | 'SeasonTeamSelection' | 'SeasonPlayerSelection' | 'AddEditNews' | 'ManageTopScorers' | 'MatchDetails';

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
  
  // If user is null (not guest, not logged in), show Login.
  if (!user) {
    return <LoginScreen navigate={() => {}} goBack={() => {}} canGoBack={false} />;
  }

  // If user is logged in OR is a guest, show the main app.
  return <AppContentWrapper />;
}

export default function Home() {
  return (
    <FirebaseProvider>
        <AdProvider>
            <App />
        </AdProvider>
    </FirebaseProvider>
  );
}
