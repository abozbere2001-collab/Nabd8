
"use client";

import { 
  GoogleAuthProvider, 
  signOut as firebaseSignOut, 
  onAuthStateChanged as firebaseOnAuthStateChanged,
  signInWithRedirect,
  getRedirectResult,
  signInAnonymously,
  updateProfile,
  type User, 
} from "firebase/auth";
import { doc, setDoc, getDoc } from 'firebase/firestore';
import type { UserProfile, UserScore } from './types';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { auth, firestore as db } from "@/firebase";

const GUEST_USER_KEY = 'isGuestUser';

export const guestUser = {
    uid: 'guest',
    displayName: 'زائر',
    email: null,
    photoURL: null,
    isGuest: true,
};

export const isGuest = (user: any): user is typeof guestUser => {
    return !!user && user.isGuest === true;
}

const handleNewUser = async (user: User) => {
    const userRef = doc(db, 'users', user.uid);
    const leaderboardRef = doc(db, 'leaderboard', user.uid);

    try {
        const userDoc = await getDoc(userRef);
        if (!userDoc.exists()) {
            const userProfileData: UserProfile = {
                displayName: user.displayName || 'مستخدم جديد',
                email: user.email!,
                photoURL: user.photoURL || '',
            };
            await setDoc(userRef, userProfileData);
        }

        const leaderboardDoc = await getDoc(leaderboardRef);
        if (!leaderboardDoc.exists()) {
             const leaderboardEntry: UserScore = {
                userId: user.uid,
                userName: user.displayName || 'مستخدم جديد',
                userPhoto: user.photoURL || '',
                totalPoints: 0,
            };
            await setDoc(leaderboardRef, leaderboardEntry);
        }

    } catch (error: any) {
         if (error.name === 'FirestorePermissionError') {
            errorEmitter.emit('permission-error', error);
         } else {
            const permissionError = new FirestorePermissionError({
                path: `users/${user.uid} or leaderboard/${user.uid}`,
                operation: 'create',
            });
            errorEmitter.emit('permission-error', permissionError);
         }
    }
}


export const signInWithGoogle = async (): Promise<void> => {
    const provider = new GoogleAuthProvider();
    await signInWithRedirect(auth, provider);
};

export const getGoogleRedirectResult = async (): Promise<User | null> => {
    try {
        const result = await getRedirectResult(auth);
        if (result && result.user) {
            return result.user;
        }
        return null;
    } catch (error) {
        console.error("Redirect sign-in error:", error);
        throw error;
    }
};


export const signOut = (): Promise<void> => {
    sessionStorage.removeItem(GUEST_USER_KEY);
    return firebaseSignOut(auth);
};

export const onAuthStateChange = (callback: (user: User | null | typeof guestUser) => void) => {
    
    const unsubscribe = firebaseOnAuthStateChanged(auth, (user) => {
        if (user) {
            sessionStorage.removeItem(GUEST_USER_KEY);
            handleNewUser(user);
            callback(user);
        } else {
            if (sessionStorage.getItem(GUEST_USER_KEY) === 'true') {
                callback(guestUser);
            } else {
                callback(null);
            }
        }
    });

    return unsubscribe;
};

export const setGuestUser = async () => {
    try {
        await signInAnonymously(auth);
    } catch (error) {
        console.error("Anonymous sign-in error:", error);
    }
}

export const updateUserDisplayName = async (user: User, newDisplayName: string): Promise<void> => {
    if (isGuest(user)) throw new Error("User not authenticated.");

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
