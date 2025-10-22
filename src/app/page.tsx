

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
import { handleNewUser } from '@/lib/firebase-client';
import { getRedirectResult } from 'firebase/auth';

export type ScreenKey = 'Welcome' | 'Login' | 'SignUp' | 'Matches' | 'Competitions' | 'AllCompetitions' | 'News' | 'Settings' | 'CompetitionDetails' | 'TeamDetails' | 'PlayerDetails' | 'AdminFavoriteTeamDetails' | 'Profile' | 'SeasonPredictions' | 'SeasonTeamSelection' | 'SeasonPlayerSelection' | 'AddEditNews' | 'ManageTopScorers' | 'MatchDetails' | 'NotificationSettings' | 'GeneralSettings' | 'ManagePinnedMatch' | 'PrivacyPolicy' | 'TermsOfService' | 'FavoriteSelection' | 'GoPro' | 'MyCountry';

export type ScreenProps = {
  navigate: (screen: ScreenKey, props?: Record<string, any>) => void;
  goBack: () => void;
  canGoBack: boolean;
};

const GUEST_ONBOARDING_COMPLETE_KEY = 'goalstack_guest_onboarding_complete';
const WELCOME_SEEN_KEY = 'goalstack_welcome_seen';

const LoadingSplashScreen = () => (
    <div className="flex flex-col items-center justify-center h-screen bg-background text-center">
        <NabdAlMalaebLogo className="h-24 w-24 mb-4" />
        <h1 className="text-2xl font-bold font-headline mb-8 text-primary">نبض الملاعب</h1>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
);


const AppFlow = () => {
    const { user, auth, isUserLoading } = useAuth();
    const { db } = useFirestore();
    const [flowState, setFlowState] = useState<'loading' | 'welcome' | 'favorite_selection' | 'app'>('loading');

    useEffect(() => {
        const checkUserStatus = async () => {
            if (isUserLoading) {
                setFlowState('loading');
                return;
            }

            // Handle redirect result first
            if (auth) {
                try {
                    const result = await getRedirectResult(auth);
                    if (result?.user) {
                        // A user just signed in via redirect. Let the main logic handle them.
                        // The onAuthStateChanged listener will fire, and the logic below will run again.
                        setFlowState('loading'); 
                        return;
                    }
                } catch (error) {
                    console.error("Auth redirect error:", error);
                    // Fallback to welcome screen on error
                    setFlowState('welcome');
                    return;
                }
            }


            if (user) {
                if (!db) return; 

                const userDocRef = doc(db, 'users', user.uid);
                try {
                    const userDoc = await getDoc(userDocRef);
                    if (userDoc.exists() && (userDoc.data().onboardingComplete || user.isAnonymous)) {
                         if (user.isAnonymous) {
                            const guestOnboardingComplete = localStorage.getItem(GUEST_ONBOARDING_COMPLETE_KEY) === 'true';
                            if (guestOnboardingComplete) {
                                setFlowState('app');
                            } else {
                                setFlowState('favorite_selection');
                            }
                         } else {
                             setFlowState('app');
                         }
                    } else {
                        if (!userDoc.exists()) {
                            await handleNewUser(user, db);
                        }
                        setFlowState('favorite_selection');
                    }
                } catch (error) {
                    if (!(error instanceof FirestorePermissionError)) {
                        const permissionError = new FirestorePermissionError({ path: userDocRef.path, operation: 'get' });
                        errorEmitter.emit('permission-error', permissionError);
                    }
                    setFlowState('welcome');
                }

            } else {
                const guestOnboardingComplete = localStorage.getItem(GUEST_ONBOARDING_COMPLETE_KEY) === 'true';
                if (guestOnboardingComplete) {
                    setFlowState('app');
                    return;
                }
                setFlowState('welcome');
            }
        };

        checkUserStatus();

    }, [user, isUserLoading, db, auth]);

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
    
    const handleGuestChoice = () => {
        localStorage.setItem(WELCOME_SEEN_KEY, 'true');
        setFlowState('favorite_selection');
    };
    
    switch (flowState) {
        case 'loading':
             return <LoadingSplashScreen />;
        case 'welcome':
            return <WelcomeScreen onGuestChoice={handleGuestChoice} />;
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

