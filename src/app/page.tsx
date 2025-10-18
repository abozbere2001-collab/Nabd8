
"use client";

import React, { useState, useEffect } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { AppContentWrapper } from './AppContentWrapper';
import { AdProvider } from '@/components/AdProvider';
import { LoginScreen } from './screens/LoginScreen';
import { Loader2 } from 'lucide-react';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { FavoriteSelectionScreen } from './screens/FavoriteSelectionScreen';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { NabdAlMalaebLogo } from '@/components/icons/NabdAlMalaebLogo';

export type ScreenKey = 'Login' | 'SignUp' | 'Matches' | 'Competitions' | 'AllCompetitions' | 'Iraq' | 'News' | 'Settings' | 'CompetitionDetails' | 'TeamDetails' | 'PlayerDetails' | 'AdminFavoriteTeamDetails' | 'Comments' | 'Notifications' | 'GlobalPredictions' | 'AdminMatchSelection' | 'Profile' | 'SeasonPredictions' | 'SeasonTeamSelection' | 'SeasonPlayerSelection' | 'AddEditNews' | 'ManageTopScorers' | 'MatchDetails' | 'NotificationSettings' | 'GeneralSettings' | 'ManagePinnedMatch' | 'PrivacyPolicy' | 'TermsOfService' | 'Welcome' | 'FavoriteSelection' | 'GoPro';

export type ScreenProps = {
  navigate: (screen: ScreenKey, props?: Record<string, any>) => void;
  goBack: () => void;
  canGoBack: boolean;
};

const HAS_SEEN_WELCOME_KEY = 'goalstack_has_seen_welcome';

const LoadingSplashScreen = () => (
    <div className="flex flex-col items-center justify-center h-screen bg-background text-center">
        <NabdAlMalaebLogo className="h-24 w-24 mb-4" />
        <h1 className="text-2xl font-bold font-headline mb-8">نبض الملاعب</h1>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
);


const AppFlow = () => {
    const { user, isUserLoading } = useUser();
    const { db } = useFirestore();
    const [flowState, setFlowState] = useState<'loading' | 'welcome' | 'favorite_selection' | 'app' | 'login'>('loading');

    useEffect(() => {
        const checkOnboardingStatus = async () => {
            if (isUserLoading) {
                setFlowState('loading');
                return;
            }

            if (!user) {
                const hasSeenWelcome = localStorage.getItem(HAS_SEEN_WELCOME_KEY);
                if (hasSeenWelcome === 'true') {
                    setFlowState('login');
                } else {
                    setFlowState('welcome');
                }
                return;
            }
            
            if (!db) return;
            const userDocRef = doc(db, 'users', user.uid);
            try {
                const userDoc = await getDoc(userDocRef);
                if (userDoc.exists()) {
                    const userData = userDoc.data() as UserProfile;
                    if (userData.onboardingComplete) {
                        setFlowState('app');
                    } else {
                        setFlowState('favorite_selection');
                    }
                } else {
                    setFlowState('favorite_selection');
                }
            } catch (error) {
                 const permissionError = new FirestorePermissionError({ path: userDocRef.path, operation: 'get' });
                 errorEmitter.emit('permission-error', permissionError);
                 setFlowState('app');
            }
        };

        checkOnboardingStatus();

    }, [user, isUserLoading, db]);

    const handleWelcomeComplete = () => {
        localStorage.setItem(HAS_SEEN_WELCOME_KEY, 'true');
        setFlowState('loading'); 
    }

    const handleFavoriteSelectionComplete = async () => {
        if (!user || !db) return;
        const userDocRef = doc(db, 'users', user.uid);
         try {
            await setDoc(userDocRef, { onboardingComplete: true }, { merge: true });
            setFlowState('app');
        } catch (error) {
            const permissionError = new FirestorePermissionError({ path: userDocRef.path, operation: 'update', requestResourceData: { onboardingComplete: true } });
            errorEmitter.emit('permission-error', permissionError);
            setFlowState('app'); 
        }
    };
    
    switch (flowState) {
        case 'loading':
             return <LoadingSplashScreen />;
        case 'welcome':
            return <WelcomeScreen onOnboardingComplete={handleWelcomeComplete} />;
        case 'login':
             return <LoginScreen navigate={() => {}} goBack={() => {}} canGoBack={false} />;
        case 'favorite_selection':
            return <FavoriteSelectionScreen onOnboardingComplete={handleFavoriteSelectionComplete} />;
        case 'app':
            return (
                <AdProvider>
                    <AppContentWrapper />
                </AdProvider>
            );
        default:
             return <LoadingSplashScreen />;
    }
};


export default function Home() {
  return (
    <AppFlow />
  );
}
