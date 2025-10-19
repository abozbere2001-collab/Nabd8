
"use client";

import React, { useState, useEffect } from 'react';
import { useAuth, useFirestore } from '@/firebase';
import { AppContentWrapper } from './AppContentWrapper';
import { AdProvider } from '@/components/AdProvider';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { Loader2 } from 'lucide-react';
import { FavoriteSelectionScreen } from './screens/FavoriteSelectionScreen';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { NabdAlMalaebLogo } from '@/components/icons/NabdAlMalaebLogo';

export type ScreenKey = 'Welcome' | 'Matches' | 'Competitions' | 'AllCompetitions' | 'Iraq' | 'News' | 'Settings' | 'CompetitionDetails' | 'TeamDetails' | 'PlayerDetails' | 'AdminFavoriteTeamDetails' | 'Comments' | 'Notifications' | 'GlobalPredictions' | 'AdminMatchSelection' | 'Profile' | 'SeasonPredictions' | 'SeasonTeamSelection' | 'SeasonPlayerSelection' | 'AddEditNews' | 'ManageTopScorers' | 'MatchDetails' | 'NotificationSettings' | 'GeneralSettings' | 'ManagePinnedMatch' | 'PrivacyPolicy' | 'TermsOfService' | 'FavoriteSelection' | 'GoPro' | 'Login';

export type ScreenProps = {
  navigate: (screen: ScreenKey, props?: Record<string, any>) => void;
  goBack: () => void;
  canGoBack: boolean;
};

const LoadingSplashScreen = () => (
    <div className="flex flex-col items-center justify-center h-screen bg-background text-center">
        <NabdAlMalaebLogo className="h-24 w-24 mb-4" />
        <h1 className="text-2xl font-bold font-headline mb-8 text-primary">نبض الملاعب</h1>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
);


const AppFlow = () => {
    const { user, isUserLoading } = useAuth();
    const { db } = useFirestore();
    const [flowState, setFlowState] = useState<'loading' | 'welcome' | 'favorite_selection' | 'app'>('loading');

    useEffect(() => {
        const checkOnboardingStatus = async () => {
            if (isUserLoading) {
                setFlowState('loading');
                return;
            }

            if (!user) {
                // Always show welcome screen if not logged in.
                // The welcome screen will handle guest mode continuation.
                setFlowState('welcome');
                return;
            }
            
            // If user is anonymous, they are essentially a guest, go to app.
            if (user.isAnonymous) {
                setFlowState('app');
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
                        // User exists but hasn't completed onboarding (e.g., from a fresh sign-up).
                        setFlowState('favorite_selection');
                    }
                } else {
                    // This is a fresh sign-up after the auth state has changed.
                    // The handleNewUser function should have created the doc,
                    // but as a fallback, show favorite selection.
                    setFlowState('favorite_selection');
                }
            } catch (error) {
                 const permissionError = new FirestorePermissionError({ path: userDocRef.path, operation: 'get' });
                 errorEmitter.emit('permission-error', permissionError);
                 // If we can't read the doc, fail gracefully into the app.
                 setFlowState('app');
            }
        };

        checkOnboardingStatus();

    }, [user, isUserLoading, db]);

    const handleOnboardingComplete = async () => {
        if (!user || !db || user.isAnonymous) {
            setFlowState('app');
            return;
        }
        
        const userDocRef = doc(db, 'users', user.uid);
         try {
            // Mark onboarding as complete for registered user
            await setDoc(userDocRef, { onboardingComplete: true }, { merge: true });
            setFlowState('app');
        } catch (error) {
            const permissionError = new FirestorePermissionError({ path: userDocRef.path, operation: 'update', requestResourceData: { onboardingComplete: true } });
            errorEmitter.emit('permission-error', permissionError);
            setFlowState('app'); // Fail gracefully
        }
    };
    
    // This function will be called from WelcomeScreen when "Continue as guest" is clicked.
    const handleGuestContinue = () => {
        setFlowState('app');
    };
    
    switch (flowState) {
        case 'loading':
             return <LoadingSplashScreen />;
        case 'welcome':
             return <WelcomeScreen onGuestContinue={handleGuestContinue} />;
        case 'favorite_selection':
            return <FavoriteSelectionScreen onOnboardingComplete={handleOnboardingComplete} />;
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
