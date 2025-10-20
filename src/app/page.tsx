
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

export type ScreenKey = 'Welcome' | 'Login' | 'SignUp' | 'Matches' | 'Competitions' | 'AllCompetitions' | 'News' | 'Settings' | 'CompetitionDetails' | 'TeamDetails' | 'PlayerDetails' | 'AdminFavoriteTeamDetails' | 'GlobalPredictions' | 'AdminMatchSelection' | 'Profile' | 'SeasonPredictions' | 'SeasonTeamSelection' | 'SeasonPlayerSelection' | 'AddEditNews' | 'ManageTopScorers' | 'MatchDetails' | 'NotificationSettings' | 'GeneralSettings' | 'ManagePinnedMatch' | 'PrivacyPolicy' | 'TermsOfService' | 'FavoriteSelection' | 'GoPro';

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
                // This logic runs for both anonymous and registered users.
                // For registered users, it's crucial to check if their profile exists in Firestore.
                if (!db) return; // Wait for db to be available

                const userDocRef = doc(db, 'users', user.uid);
                try {
                    const userDoc = await getDoc(userDocRef);
                    if (userDoc.exists() && (userDoc.data().onboardingComplete || user.isAnonymous)) {
                        // User has an existing profile and has completed onboarding, or is a returning guest.
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
                        // This is a new registered user or one who hasn't completed onboarding.
                        if (!userDoc.exists()) {
                            await handleNewUser(user, db);
                        }
                        setFlowState('favorite_selection');
                    }
                } catch (error) {
                    // This error is critical if it happens for a logged-in user.
                    // It likely means rules are blocking the read. We must inform the user/developer.
                    if (!(error instanceof FirestorePermissionError)) {
                        const permissionError = new FirestorePermissionError({ path: userDocRef.path, operation: 'get' });
                        errorEmitter.emit('permission-error', permissionError);
                    }
                    // Fallback to login on error, as we can't determine the user's state.
                    setFlowState('login');
                }

            } else {
                // No user is logged in.
                const guestOnboardingComplete = localStorage.getItem(GUEST_ONBOARDING_COMPLETE_KEY) === 'true';
                if (guestOnboardingComplete) {
                    // They've used the app as a guest before. Let them in.
                    setFlowState('app');
                    return;
                }
                
                const welcomeSeen = localStorage.getItem(WELCOME_SEEN_KEY) === 'true';
                if (welcomeSeen) {
                    setFlowState('login');
                } else {
                    setFlowState('welcome');
                }
            }
        };

        checkUserStatus();

    }, [user, isUserLoading, db]);

    const handleOnboardingComplete = async () => {
        if (user && db && !user.isAnonymous) {
             const userDocRef = doc(db, 'users', user.uid);
             try {
                // Set onboarding as complete in their Firestore document.
                await setDoc(userDocRef, { onboardingComplete: true }, { merge: true });
            } catch (error) {
                const permissionError = new FirestorePermissionError({ path: userDocRef.path, operation: 'update', requestResourceData: { onboardingComplete: true } });
                errorEmitter.emit('permission-error', permissionError);
            }
        } else {
            // This is a guest user completing onboarding.
            localStorage.setItem(GUEST_ONBOARDING_COMPLETE_KEY, 'true');
        }
        setFlowState('app');
    };
    
    const handleWelcomeChoice = async (choice: 'login' | 'guest') => {
        localStorage.setItem(WELCOME_SEEN_KEY, 'true');
        if (choice === 'guest') {
            setFlowState('favorite_selection');
        } else {
            setFlowState('login');
        }
    };
    
    // This function is passed to LoginScreen to be called on successful authentication
    const handleLoginSuccess = () => {
        // The useEffect hook will automatically re-evaluate the user's status 
        // and navigate them to the correct screen. We just need to trigger a re-check.
        setFlowState('loading'); 
    }

    const goBackToWelcome = () => {
        localStorage.removeItem(WELCOME_SEEN_KEY);
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
