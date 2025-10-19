
"use client";

import React, { useState, useEffect } from 'react';
import { useAuth, useFirestore } from '@/firebase';
import { AppContentWrapper } from './AppContentWrapper';
import { AdProvider } from '@/components/AdProvider';
import { Loader2 } from 'lucide-react';
import { FavoriteSelectionScreen } from './screens/FavoriteSelectionScreen';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { NabdAlMalaebLogo } from '@/components/icons/NabdAlMalaebLogo';
import { getLocalFavorites, setLocalFavorites } from '@/lib/local-favorites';
import { LoginScreen } from './screens/LoginScreen';

export type ScreenKey = 'Welcome' | 'Matches' | 'Competitions' | 'AllCompetitions' | 'Iraq' | 'News' | 'Settings' | 'CompetitionDetails' | 'TeamDetails' | 'PlayerDetails' | 'AdminFavoriteTeamDetails' | 'Comments' | 'Notifications' | 'GlobalPredictions' | 'AdminMatchSelection' | 'Profile' | 'SeasonPredictions' | 'SeasonTeamSelection' | 'SeasonPlayerSelection' | 'AddEditNews' | 'ManageTopScorers' | 'MatchDetails' | 'NotificationSettings' | 'GeneralSettings' | 'ManagePinnedMatch' | 'PrivacyPolicy' | 'TermsOfService' | 'FavoriteSelection' | 'GoPro' | 'Login';

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
    const [flowState, setFlowState] = useState<'loading' | 'login' | 'favorite_selection' | 'app'>('loading');

    useEffect(() => {
        const checkOnboardingStatus = async () => {
            if (isUserLoading) {
                setFlowState('loading');
                return;
            }

            if (!user) {
                // Guest user flow
                const guestOnboardingComplete = localStorage.getItem(GUEST_ONBOARDING_COMPLETE_KEY) === 'true';
                if (guestOnboardingComplete) {
                    setFlowState('app');
                } else {
                    // Check if they have old local favorites, if so, they are "onboarded"
                    const localFavs = getLocalFavorites();
                    if (Object.keys(localFavs.teams || {}).length > 0 || Object.keys(localFavs.leagues || {}).length > 0) {
                        localStorage.setItem(GUEST_ONBOARDING_COMPLETE_KEY, 'true');
                        setFlowState('app');
                    } else {
                        setFlowState('favorite_selection');
                    }
                }
                return;
            }
            
            // Registered user flow
            if (user.isAnonymous) {
                // Anonymous users created via old system, treat as guests who completed onboarding.
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
                        setFlowState('favorite_selection');
                    }
                } else {
                    await handleNewUser(user, db);
                    setFlowState('favorite_selection');
                }
            } catch (error) {
                 const permissionError = new FirestorePermissionError({ path: userDocRef.path, operation: 'get' });
                 errorEmitter.emit('permission-error', permissionError);
                 setFlowState('app'); // Fail gracefully into the app
            }
        };

        checkOnboardingStatus();

    }, [user, isUserLoading, db]);

    const handleOnboardingComplete = async () => {
        if (user && db) {
             const userDocRef = doc(db, 'users', user.uid);
             try {
                await setDoc(userDocRef, { onboardingComplete: true }, { merge: true });
            } catch (error) {
                const permissionError = new FirestorePermissionError({ path: userDocRef.path, operation: 'update', requestResourceData: { onboardingComplete: true } });
                errorEmitter.emit('permission-error', permissionError);
            }
        } else {
            // This is a guest user completing onboarding
            localStorage.setItem(GUEST_ONBOARDING_COMPLETE_KEY, 'true');
        }
        setFlowState('app');
    };
    
    switch (flowState) {
        case 'loading':
             return <LoadingSplashScreen />;
        case 'login':
             return <LoginScreen navigate={(screen, props) => {
                 if (screen === 'FavoriteSelection') setFlowState('favorite_selection');
             }} goBack={() => {}} canGoBack={false} />;
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

// This needs to be here to avoid circular dependency issues with firebase-client
const handleNewUser = async (user: User, firestore: Firestore) => {
    const userRef = doc(firestore, 'users', user.uid);
    try {
        const userDoc = await getDoc(userRef);
        if (!userDoc.exists()) {
            const displayName = user.displayName || `مستخدم_${user.uid.substring(0, 5)}`;
            const photoURL = user.photoURL || '';

            const userProfileData: UserProfile = {
                displayName: displayName,
                email: user.email!,
                photoURL: photoURL,
                isProUser: false,
                isAnonymous: user.isAnonymous,
                onboardingComplete: false,
            };
            await setDoc(userRef, userProfileData);
        }
    } catch (error) {
        const permissionError = new FirestorePermissionError({ path: userRef.path, operation: 'write', requestResourceData: {}});
        errorEmitter.emit('permission-error', permissionError);
    }
};
