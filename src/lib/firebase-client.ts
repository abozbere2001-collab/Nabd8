

"use client";

import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut as firebaseSignOut, 
  onAuthStateChanged as firebaseOnAuthStateChanged,
  getRedirectResult,
  updateProfile,
  type User, 
  type Auth, 
  signInWithRedirect,
} from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, enableIndexedDbPersistence } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from "firebase/app";
import { firebaseConfig } from "./firebase";
import type { UserProfile, UserScore } from './types';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';

// --- GUEST USER ---
const GUEST_USER_KEY = 'isGuestUser';
let isCurrentlyGuest = false;

export const guestUser = {
    uid: 'guest',
    displayName: 'زائر',
    email: null,
    photoURL: null,
    isGuestUser: true,
};

export const isGuest = (user: any): user is typeof guestUser => {
    return !!user && user.isGuestUser === true;
}
// --- END GUEST USER ---


const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Enable offline persistence
try {
    enableIndexedDbPersistence(db);
} catch (err: any) {
    if (err.code == 'failed-precondition') {
        // Multiple tabs open, persistence can only be enabled in one.
        // Silently fail.
    } else if (err.code == 'unimplemented') {
        // The current browser does not support all of the
        // features required to enable persistence
    }
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
             // Fallback for other potential errors, though less likely for this operation
            const permissionError = new FirestorePermissionError({
                path: `users/${user.uid} or leaderboard/${user.uid}`,
                operation: 'create',
            });
            errorEmitter.emit('permission-error', permissionError);
         }
    }
}


export const signInWithGoogle = async (): Promise<void> => {
  isCurrentlyGuest = false;
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
  } catch (error: any) {
    if (error.code === 'auth/popup-blocked' || error.code === 'auth/cancelled-popup-request' || error.code === 'auth/unauthorized-domain') {
      // If popup fails, fall back to redirect
      await signInWithRedirect(auth, provider);
    } else {
      // Rethrow other errors
      throw error;
    }
  }
};


export const signOut = (): Promise<void> => {
    isCurrentlyGuest = false;
    return firebaseSignOut(auth);
};

export const onAuthStateChange = (callback: (user: User | null | typeof guestUser) => void) => {
  const unsubscribe = firebaseOnAuthStateChanged(auth, (user) => {
    if (user) {
        // A real user is logged in.
        isCurrentlyGuest = false;
        handleNewUser(user);
        callback(user);
    } else if (isCurrentlyGuest) {
        // No real user, but we are in a guest session.
        callback(guestUser);
    } else {
        // No real user, and not in a guest session.
        callback(null);
    }
  });
  
  return unsubscribe;
};

// Function for other parts of the app to trigger a guest session
export const setGuestUser = () => {
    isCurrentlyGuest = true;
    // Manually trigger an auth state change by signing out, which will then fall back to guest logic in the listener.
    // This is a bit of a hack but ensures a single source of truth for auth state changes.
    // If the user is already null, we need to manually trigger the callback.
    if (auth.currentUser === null) {
        // To ensure the provider updates, we re-trigger the auth flow.
        // A simple way is to re-initialize the listener, but that's messy.
        // Instead, we can just call signOut which will trigger our listener. If already signed out, it's a no-op.
        signOut();
    } else {
        signOut();
    }
}


export const checkRedirectResult = async (): Promise<User | null> => {
    try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
            isCurrentlyGuest = false;
            // handleNewUser will be called by the onAuthStateChanged listener
            return result.user;
        }
        return null;
    } catch (error) {
        console.error("Error getting redirect result:", error);
        return null;
    }
};

export const updateUserDisplayName = async (user: User, newDisplayName: string): Promise<void> => {
    if (isGuest(user)) throw new Error("User not authenticated.");

    // This updates the name in Firebase Auth itself
    await updateProfile(user, { displayName: newDisplayName });

    const userRef = doc(db, 'users', user.uid);
    const leaderboardRef = doc(db, 'leaderboard', user.uid);
    
    // Update user profile in 'users' collection
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

    // Update leaderboard entry in 'leaderboard' collection
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
