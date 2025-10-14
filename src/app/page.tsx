
"use client";

import React from 'react';
import { FirebaseClientProvider, useUser } from '@/firebase';
import { AppContentWrapper } from './AppContentWrapper';
import { AdProvider } from '@/components/AdProvider';
import { LoginScreen } from './screens/LoginScreen';
import { Loader2 } from 'lucide-react';

export type ScreenKey = 'Login' | 'SignUp' | 'Matches' | 'Competitions' | 'Iraq' | 'News' | 'Settings' | 'CompetitionDetails' | 'TeamDetails' | 'PlayerDetails' | 'AdminFavoriteTeamDetails' | 'Comments' | 'Notifications' | 'GlobalPredictions' | 'AdminMatchSelection' | 'Profile' | 'SeasonPredictions' | 'SeasonTeamSelection' | 'SeasonPlayerSelection' | 'AddEditNews' | 'ManageTopScorers' | 'MatchDetails';

export type ScreenProps = {
  navigate: (screen: ScreenKey, props?: Record<string, any>) => void;
  goBack: () => void;
  canGoBack: boolean;
};

const AuthGate = () => {
    const { user, isUserLoading } = useUser();

    if (isUserLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-4">جاري التحميل...</p>
            </div>
        );
    }
    
    if (!user) {
        // Since LoginScreen doesn't have navigation props in this setup,
        // we can pass dummy functions. The screen will handle its own logic
        // and the auth state change will re-render this component.
        return <LoginScreen navigate={() => {}} goBack={() => {}} canGoBack={false} />;
    }

    return (
        <AdProvider>
            <AppContentWrapper />
        </AdProvider>
    );
}


export default function Home() {
  return (
    <FirebaseClientProvider>
        <AuthGate />
    </FirebaseClientProvider>
  );
}
