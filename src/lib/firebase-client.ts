
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
} from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from "firebase/app";
import { firebaseConfig } from "./firebase";
import type { UserProfile, UserScore } from './types';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';


const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Automatically authorize the development domain for authentication
if (typeof window !== 'undefined' && window.location.hostname === "localhost" && process.env.NODE_ENV === 'development') {
    auth.tenantId = null; 
    auth.settings.appVerificationDisabledForTesting = true;
    
    const config = (auth.config.emulator || {});
    const authEmulatorHost = config.host || "localhost";
    const authEmulatorPort = config.port || 9099;

    const currentHost = window.location.hostname;
    const isAuthorized = auth.config.authorizedDomains?.includes(currentHost);
    
    if(!isAuthorized) {
        auth.config.authorizedDomains = [...(auth.config.authorizedDomains || []), currentHost];
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
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  if (result.user) {
    await handleNewUser(result.user);
  }
};

export const signOut = (): Promise<void> => {
  return firebaseSignOut(auth);
};

export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return firebaseOnAuthStateChanged(auth, (user) => {
    if(user) {
        handleNewUser(user);
    }
    callback(user)
  });
};

export const checkRedirectResult = async (): Promise<User | null> => {
    try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
            await handleNewUser(result.user);
            return result.user;
        }
        return null;
    } catch (error) {
        console.error("Error getting redirect result:", error);
        return null;
    }
};

export const updateUserDisplayName = async (user: User, newDisplayName: string): Promise<void> => {
    if (!user) throw new Error("User not authenticated.");

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
