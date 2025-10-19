
"use client";

import { 
  GoogleAuthProvider, 
  signOut as firebaseSignOut, 
  onAuthStateChanged as firebaseOnAuthStateChanged,
  signInWithPopup,
  updateProfile,
  type User, 
} from "firebase/auth";
import { doc, setDoc, getDoc, Firestore, writeBatch } from 'firebase/firestore';
import type { UserProfile, UserScore, Favorites } from './types';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { auth, firestore as db } from "@/firebase";
import { getLocalFavorites, clearLocalFavorites } from './local-favorites';

export const handleNewUser = async (user: User, firestore: Firestore) => {
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
                onboardingComplete: false, // Onboarding is not complete on initial creation
            };

            const leaderboardEntry: UserScore = {
                userId: user.uid,
                userName: displayName,
                userPhoto: photoURL,
                totalPoints: 0,
            };

            const batch = writeBatch(firestore);
            batch.set(userRef, userProfileData);
            batch.set(doc(firestore, 'leaderboard', user.uid), leaderboardEntry);

            await batch.commit();
        }

    } catch (error: any) {
        const permissionError = new FirestorePermissionError({
            path: `users/${user.uid} or related docs`,
            operation: 'write',
        });
        errorEmitter.emit('permission-error', permissionError);
    }
}


export const signInWithGoogle = async (): Promise<User> => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    // --- Data Migration Logic ---
    const localFavorites = getLocalFavorites();
    if (db && (localFavorites.teams || localFavorites.leagues)) {
        await handleNewUser(user, db); // Ensure user doc exists
        
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

            clearLocalFavorites(); // Clear local data after successful migration
        } catch (error) {
            const permissionError = new FirestorePermissionError({
              path: favRef.path,
              operation: 'write',
              requestResourceData: localFavorites,
            });
            errorEmitter.emit('permission-error', permissionError);
            // We don't clear local favorites if migration fails
        }
    } else if (db) {
         await handleNewUser(user, db);
    }
    // -------------------------

    return user;
};


export const signOut = (): Promise<void> => {
    return firebaseSignOut(auth);
};


export const updateUserDisplayName = async (user: User, newDisplayName: string): Promise<void> => {
    if (!user) throw new Error("User not authenticated.");

    // Update Firebase Auth profile first
    await updateProfile(user, { displayName: newDisplayName });

    const userRef = doc(db, 'users', user.uid);
    const leaderboardRef = doc(db, 'leaderboard', user.uid);
    
    // Update users collection
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

    // Update leaderboard collection
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
