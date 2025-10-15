
"use client";

import React, { useState, useEffect } from 'react';
import { FirebaseClientProvider, useUser } from '@/firebase';
import { AppContentWrapper } from './AppContentWrapper';
import { AdProvider } from '@/components/AdProvider';
import { LoginScreen } from './screens/LoginScreen';
import { Loader2 } from 'lucide-react';
import PrivacyPolicyScreen from './privacy-policy/page';
import TermsOfServiceScreen from './terms-of-service/page';
import { WelcomeScreen } from './screens/WelcomeScreen';

export type ScreenKey = 'Login' | 'SignUp' | 'Matches' | 'Competitions' | 'AllCompetitions' | 'Iraq' | 'News' | 'Settings' | 'CompetitionDetails' | 'TeamDetails' | 'PlayerDetails' | 'AdminFavoriteTeamDetails' | 'Comments' | 'Notifications' | 'GlobalPredictions' | 'AdminMatchSelection' | 'Profile' | 'SeasonPredictions' | 'SeasonTeamSelection' | 'SeasonPlayerSelection' | 'AddEditNews' | 'ManageTopScorers' | 'MatchDetails' | 'NotificationSettings' | 'GeneralSettings' | 'ManagePinnedMatch' | 'PrivacyPolicy' | 'TermsOfService' | 'Welcome';

export type ScreenProps = {
  navigate: (screen: ScreenKey, props?: Record<string, any>) => void;
  goBack: () => void;
  canGoBack: boolean;
};

const HAS_VISITED_KEY = 'goalstack_has_visited';

const AppFlow = () => {
    const { user, isUserLoading } = useUser();
    const [showWelcome, setShowWelcome] = useState<boolean | null>(null);

    useEffect(() => {
        const hasVisited = localStorage.getItem(HAS_VISITED_KEY);
        setShowWelcome(hasVisited !== 'true');
    }, []);

    const handleOnboardingComplete = () => {
        localStorage.setItem(HAS_VISITED_KEY, 'true');
        setShowWelcome(false);
    }
    
    if (isUserLoading || showWelcome === null) {
        return (
            <div className="flex items-center justify-center h-screen bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (showWelcome && !user) {
        return <WelcomeScreen onOnboardingComplete={handleOnboardingComplete} />;
    }

    if (!user) {
        return <LoginScreen navigate={() => {}} goBack={() => {}} canGoBack={false} />;
    }

    return (
        <AdProvider>
            <AppContentWrapper />
        </AdProvider>
    );
};


export default function Home() {
  return (
    <FirebaseClientProvider>
        <AppFlow />
    </FirebaseClientProvider>
  );
}
