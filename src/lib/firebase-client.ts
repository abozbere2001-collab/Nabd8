
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
            setDoc(userRef, userProfileData)
              .catch((serverError) => {
                const permissionError = new FirestorePermissionError({
                  path: userRef.path,
                  operation: 'create',
                  requestResourceData: userProfileData,
                });
                errorEmitter.emit('permission-error', permissionError);
              });
        }

        const leaderboardDoc = await getDoc(leaderboardRef);
        if (!leaderboardDoc.exists()) {
             const leaderboardEntry: UserScore = {
                userId: user.uid,
                userName: user.displayName || 'مستخدم جديد',
                userPhoto: user.photoURL || '',
                totalPoints: 0,
            };
            setDoc(leaderboardRef, leaderboardEntry)
              .catch((serverError) => {
                const permissionError = new FirestorePermissionError({
                  path: leaderboardRef.path,
                  operation: 'create',
                  requestResourceData: leaderboardEntry,
                });
                errorEmitter.emit('permission-error', permissionError);
              });
        }

    } catch (error: any) {
        // This outer try-catch is for the getDoc calls, which should also be handled.
        const permissionError = new FirestorePermissionError({
            path: `users/${user.uid} or leaderboard/${user.uid}`,
            operation: 'get',
        });
        errorEmitter.emit('permission-error', permissionError);
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
            await handleNewUser(result.user);
            return result.user;
        }
        return null;
    } catch (error) {
        console.error("Redirect sign-in error:", error);
        throw error;
    }
};


export const signOut = (): Promise<void> => {
    return firebaseSignOut(auth);
};


export const setGuestUser = async () => {
    try {
        await signInAnonymously(auth);
    } catch (error) {
        console.error("Anonymous sign-in error:", error);
    }
}

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
