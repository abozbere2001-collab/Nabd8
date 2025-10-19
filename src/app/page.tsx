
"use client";

import React, { useState, useEffect } from 'react';
import { useAuth, useFirestore } from '@/firebase';
import { AppContentWrapper } from './AppContentWrapper';
import { AdProvider } from '@/components/AdProvider';
import { Loader2 } from 'lucide-react';
import { FavoriteSelectionScreen } from './screens/FavoriteSelectionScreen';
import { doc, getDoc, setDoc, type Firestore } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { NabdAlMalaebLogo } from '@/components/icons/NabdAlMalaebLogo';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { LoginScreen } from './screens/LoginScreen';
import { handleNewUser } from '@/lib/firebase-client';

export type ScreenKey = 'Welcome' | 'Login' | 'SignUp' | 'Matches' | 'Competitions' | 'AllCompetitions' | 'Iraq' | 'News' | 'Settings' | 'CompetitionDetails' | 'TeamDetails' | 'PlayerDetails' | 'AdminFavoriteTeamDetails' | 'Comments' | 'Notifications' | 'GlobalPredictions' | 'AdminMatchSelection' | 'Profile' | 'SeasonPredictions' | 'SeasonTeamSelection' | 'SeasonPlayerSelection' | 'AddEditNews' | 'ManageTopScorers' | 'MatchDetails' | 'NotificationSettings' | 'GeneralSettings' | 'ManagePinnedMatch' | 'PrivacyPolicy' | 'TermsOfService' | 'FavoriteSelection' | 'GoPro';

export type ScreenProps = {
  navigate: (screen: ScreenKey, props?: Record<string, any>) => void;
  goBack: () => void;
  canGoBack: boolean;
};

const GUEST_ONBOARDING_COMPLETE_KEY = 'goalstack_guest_onboarding_complete';

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
    const [flowState, setFlowState] = useState<'loading' | 'welcome' | 'login' | 'favorite_selection' | 'app'>('loading');

    useEffect(() => {
        const checkUserStatus = async () => {
            if (isUserLoading) {
                setFlowState('loading');
                return;
            }

            if (user) {
                if (user.isAnonymous) {
                    const guestOnboardingComplete = localStorage.getItem(GUEST_ONBOARDING_COMPLETE_KEY) === 'true';
                    if (guestOnboardingComplete) {
                        setFlowState('app');
                    } else {
                        setFlowState('favorite_selection');
                    }
                    return;
                }

                // Registered user
                if (!db) return;
                const userDocRef = doc(db, 'users', user.uid);
                try {
                    const userDoc = await getDoc(userDocRef);
                    if (userDoc.exists() && userDoc.data().onboardingComplete) {
                        setFlowState('app');
                    } else {
                        await handleNewUser(user, db);
                        setFlowState('favorite_selection');
                    }
                } catch (error) {
                    if (!(error instanceof FirestorePermissionError)) {
                        const permissionError = new FirestorePermissionError({ path: userDocRef.path, operation: 'get' });
                        errorEmitter.emit('permission-error', permissionError);
                    }
                     setFlowState('login'); // Fallback to login on error
                }
            } else {
                // No user is logged in at all, show welcome screen.
                setFlowState('welcome');
            }
        };

        checkUserStatus();

    }, [user, isUserLoading, db]);

    const handleOnboardingComplete = async () => {
        if (user && db && !user.isAnonymous) {
             const userDocRef = doc(db, 'users', user.uid);
             try {
                await setDoc(userDocRef, { onboardingComplete: true }, { merge: true });
            } catch (error) {
                const permissionError = new FirestorePermissionError({ path: userDocRef.path, operation: 'update', requestResourceData: { onboardingComplete: true } });
                errorEmitter.emit('permission-error', permissionError);
            }
        } else {
            localStorage.setItem(GUEST_ONBOARDING_COMPLETE_KEY, 'true');
        }
        setFlowState('app');
    };
    
    const handleWelcomeChoice = async (choice: 'login' | 'guest') => {
        if (choice === 'guest') {
            setFlowState('favorite_selection');
        } else {
            setFlowState('login');
        }
    };
    
    // This function is passed to LoginScreen to be called on successful authentication
    const handleLoginSuccess = () => {
        // The useEffect hook will automatically re-evaluate the user's status 
        // and navigate them to the correct screen ('app' or 'favorite_selection').
        // We just need to trigger a loading state to allow the hook to run.
        setFlowState('loading'); 
    }

    const goBackToWelcome = () => {
        setFlowState('welcome');
    }
    
    switch (flowState) {
        case 'loading':
             return <LoadingSplashScreen />;
        case 'welcome':
            return <WelcomeScreen onChoice={handleWelcomeChoice} />;
        case 'login':
            return <LoginScreen onLoginSuccess={handleLoginSuccess} goBack={goBackToWelcome} />;
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
