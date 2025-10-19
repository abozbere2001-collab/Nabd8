
"use client";

import { 
  GoogleAuthProvider, 
  signOut as firebaseSignOut, 
  onAuthStateChanged as firebaseOnAuthStateChanged,
  signInWithPopup,
  updateProfile,
  type User, 
  linkWithCredential,
  signInAnonymously as firebaseSignInAnonymously
} from "firebase/auth";
import { doc, setDoc, getDoc, Firestore, writeBatch } from 'firebase/firestore';
import type { UserProfile, UserScore, Favorites } from './types';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { auth, firestore as db } from "@/firebase";
import { getLocalFavorites, clearLocalFavorites } from './local-favorites';

export const handleNewUser = async (user: User, firestore: Firestore) => {
    const userRef = doc(firestore, 'users', user.uid);
    const leaderboardRef = doc(firestore, 'leaderboard', user.uid);
    const favoritesRef = doc(firestore, 'users', user.uid, 'favorites', 'data');

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

            const leaderboardEntry: UserScore = {
                userId: user.uid,
                userName: displayName,
                userPhoto: photoURL,
                totalPoints: 0,
            };

            const initialFavorites: Partial<Favorites> = {
                userId: user.uid,
                teams: {},
                leagues: {},
            };

            const batch = writeBatch(firestore);
            batch.set(userRef, userProfileData);
            batch.set(leaderboardRef, leaderboardEntry);
            batch.set(favoritesRef, initialFavorites); // Create empty favorites doc

            await batch.commit();
        }
    } catch (error: any) {
        // This is a critical path. If this fails, the user can't be created properly.
        // We will emit a specific, detailed error for debugging.
        const permissionError = new FirestorePermissionError({
            path: `users/${user.uid} and related docs`, // Indicate batch write
            operation: 'write',
            requestResourceData: { 
                userProfile: { displayName: user.displayName, email: user.email },
                leaderboard: { userId: user.uid, userName: user.displayName }
            }
        });
        errorEmitter.emit('permission-error', permissionError);
        // Re-throw the original error to allow the caller to handle UI state
        throw error;
    }
}


export const signInWithGoogle = async (): Promise<User> => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    // --- Data Migration Logic ---
    const localFavorites = getLocalFavorites();
    if (db && (Object.keys(localFavorites.teams || {}).length > 0 || Object.keys(localFavorites.leagues || {}).length > 0)) {
        await handleNewUser(user, db); 
        
        const favRef = doc(db, 'users', user.uid, 'favorites', 'data');
        
        try {
            const remoteFavsDoc = await getDoc(favRef);
            const remoteFavs = remoteFavsDoc.exists() ? (remoteFavsDoc.data() as Favorites) : {};

            // Merge logic
            const mergedTeams = { ...(remoteFavs.teams || {}), ...(localFavorites.teams || {}) };
            const mergedLeagues = { ...(remoteFavs.leagues || {}), ...(localFavorites.leagues || {}) };

            const dataToSet = {
                userId: user.uid,
                teams: mergedTeams,
                leagues: mergedLeagues
            };

            await setDoc(favRef, dataToSet, { merge: true });

            clearLocalFavorites();
        } catch (error) {
            const permissionError = new FirestorePermissionError({
              path: favRef.path,
              operation: 'write',
              requestResourceData: localFavorites,
            });
            errorEmitter.emit('permission-error', permissionError);
        }
    } else if (db) {
         await handleNewUser(user, db);
    }
    
    return user;
};


export const signOut = (): Promise<void> => {
    // Clear guest data on any sign out, just in case
    localStorage.removeItem('goalstack_guest_onboarding_complete');
    return firebaseSignOut(auth);
};


export const updateUserDisplayName = async (user: User, newDisplayName: string): Promise<void> => {
    if (!user) throw new Error("User not authenticated.");

    await updateProfile(user, { displayName: newDisplayName });

    const userRef = doc(db, 'users', user.uid);
    const leaderboardRef = doc(db, 'leaderboard', user.uid);
    
    const userProfileUpdateData = { displayName: newDisplayName };
    setDoc(userRef, userProfileUpdateData, { merge: true })
        .catch((serverError) => {
            const permissionError = new FirestorePermissionError({
                path: userRef.path,
                operation: 'update',
                requestResourceData: userProfileUpdateData,
            });
            errorEmitter.emit('permission-error', permissionError);
        });

    const leaderboardUpdateData = { userName: newDisplayName };
    setDoc(leaderboardRef, leaderboardUpdateData, { merge: true })
        .catch((serverError) => {
            const permissionError = new FirestorePermissionError({
                path: leaderboardRef.path,
                operation: 'update',
                requestResourceData: leaderboardUpdateData,
            });
            errorEmitter.emit('permission-error', permissionError);
        });
};
