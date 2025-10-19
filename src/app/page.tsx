
"use client";

import React, { useState, useEffect } from 'react';
import { useUser, useFirestore, useAuth } from '@/firebase';
import { AppContentWrapper } from './AppContentWrapper';
import { AdProvider } from '@/components/AdProvider';
import { LoginScreen } from './screens/LoginScreen';
import { Loader2 } from 'lucide-react';
import { FavoriteSelectionScreen } from './screens/FavoriteSelectionScreen';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { UserProfile, Favorites } from '@/lib/types';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { NabdAlMalaebLogo } from '@/components/icons/NabdAlMalaebLogo';
import { getLocalFavorites, clearLocalFavorites } from '@/lib/local-favorites';

export type ScreenKey = 'Login' | 'SignUp' | 'Matches' | 'Competitions' | 'AllCompetitions' | 'Iraq' | 'News' | 'Settings' | 'CompetitionDetails' | 'TeamDetails' | 'PlayerDetails' | 'AdminFavoriteTeamDetails' | 'Comments' | 'Notifications' | 'GlobalPredictions' | 'AdminMatchSelection' | 'Profile' | 'SeasonPredictions' | 'SeasonTeamSelection' | 'SeasonPlayerSelection' | 'AddEditNews' | 'ManageTopScorers' | 'MatchDetails' | 'NotificationSettings' | 'GeneralSettings' | 'ManagePinnedMatch' | 'PrivacyPolicy' | 'TermsOfService' | 'Welcome' | 'FavoriteSelection' | 'GoPro';

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
    const [flowState, setFlowState] = useState<'loading' | 'favorite_selection' | 'app'>('loading');

    useEffect(() => {
        const checkOnboardingStatus = async () => {
            if (isUserLoading) {
                setFlowState('loading');
                return;
            }

            if (!user) {
                // If no user, just go to the app in guest mode.
                // Local storage will be used for favorites.
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
                        // User exists but hasn't completed onboarding.
                        // This can happen if they sign up but close the app.
                        setFlowState('favorite_selection');
                    }
                } else {
                    // This is a fresh sign-up. Show favorite selection.
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

    const handleFavoriteSelectionComplete = async () => {
        if (!user || !db) return;
        const userDocRef = doc(db, 'users', user.uid);
         try {
            // Merge local favorites with any selected during onboarding screen
            const localFavorites = getLocalFavorites();
            if (localFavorites) {
                // We merge teams and leagues.
                 await setDoc(userDocRef, {
                    favorites: {
                        teams: localFavorites.teams || {},
                        leagues: localFavorites.leagues || {},
                    }
                }, { merge: true });
                clearLocalFavorites();
            }
            
            await setDoc(userDocRef, { onboardingComplete: true }, { merge: true });
            setFlowState('app');
        } catch (error) {
            const permissionError = new FirestorePermissionError({ path: userDocRef.path, operation: 'update', requestResourceData: { onboardingComplete: true } });
            errorEmitter.emit('permission-error', permissionError);
            setFlowState('app'); // Fail gracefully
        }
    };
    
    switch (flowState) {
        case 'loading':
             return <LoadingSplashScreen />;
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
