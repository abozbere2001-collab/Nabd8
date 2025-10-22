
"use client";

import { 
  signOut as firebaseSignOut, 
  updateProfile,
  type User, 
} from "firebase/auth";
import { doc, setDoc, getDoc, Firestore, writeBatch } from 'firebase/firestore';
import type { UserProfile, UserScore, Favorites } from './types';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { auth, firestore as db } from "@/firebase";
import { getLocalFavorites, clearLocalFavorites } from './local-favorites';
import { getDatabase, ref, set } from 'firebase/database';


export const handleNewUser = async (user: User, firestore: Firestore) => {
    const userRef = doc(firestore, 'users', user.uid);

    try {
        const userDoc = await getDoc(userRef);
        // Only create documents if they don't already exist.
        if (userDoc.exists()) {
            return;
        }

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

        const favoritesRef = doc(firestore, 'users', user.uid, 'favorites', 'data');
        let initialFavorites: Partial<Favorites> = { userId: user.uid, teams: {}, leagues: {} };
        
        // Merge local favorites if they exist (from guest session)
        const localFavorites = getLocalFavorites();
        if (Object.keys(localFavorites.teams || {}).length > 0 || Object.keys(localFavorites.leagues || {}).length > 0) {
             const mergedTeams = { ...(initialFavorites.teams || {}), ...(localFavorites.teams || {}) };
             const mergedLeagues = { ...(initialFavorites.leagues || {}), ...(localFavorites.leagues || {}) };
             initialFavorites.teams = mergedTeams;
             initialFavorites.leagues = mergedLeagues;
             clearLocalFavorites();
        }

        const batch = writeBatch(firestore);
        batch.set(userRef, userProfileData);
        batch.set(favoritesRef, initialFavorites);

        await batch.commit();

    } catch (error: any) {
        // This is a critical error, so we emit it.
        const permissionError = new FirestorePermissionError({
            path: `users/${user.uid}`,
            operation: 'write',
            requestResourceData: { displayName: user.displayName, email: user.email }
        });
        errorEmitter.emit('permission-error', permissionError);
        console.error("Failed to create new user documents:", error);
    }
}


export const signOut = (): Promise<void> => {
    localStorage.removeItem('goalstack_guest_onboarding_complete');
    return firebaseSignOut(auth);
};


export const updateUserDisplayName = async (user: User, newDisplayName: string): Promise<void> => {
    if (!user) throw new Error("User not authenticated.");

    await updateProfile(user, { displayName: newDisplayName });

    const userRef = doc(db, 'users', user.uid);
    const rtdbUserRef = ref(getDatabase(), `users/${user.uid}`);
    
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

    set(rtdbUserRef, { displayName: newDisplayName, photoURL: user.photoURL }).catch(console.error);
};
