
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

const handleNewUser = async (user: User) => {
    const userRef = doc(db, 'users', user.uid);
    const leaderboardRef = doc(db, 'leaderboard', user.uid);

    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
        const userProfileData: UserProfile = {
            displayName: user.displayName || 'مستخدم جديد',
            email: user.email!,
            photoURL: user.photoURL || '',
        };
        setDoc(userRef, userProfileData).catch(serverError => {
            const permissionError = new FirestorePermissionError({
                path: userRef.path,
                operation: 'create',
                requestResourceData: userProfileData,
            });
            errorEmitter.emit('permission-error', permissionError);
        });

        const leaderboardEntry: UserScore = {
            userId: user.uid,
            userName: user.displayName || 'مستخدم جديد',
            userPhoto: user.photoURL || '',
            totalPoints: 0,
        };
        setDoc(leaderboardRef, leaderboardEntry).catch(serverError => {
            const permissionError = new FirestorePermissionError({
                path: leaderboardRef.path,
                operation: 'create',
                requestResourceData: leaderboardEntry,
            });
            errorEmitter.emit('permission-error', permissionError);
        });
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

    await updateProfile(user, { displayName: newDisplayName });

    const userRef = doc(db, 'users', user.uid);
    const leaderboardRef = doc(db, 'leaderboard', user.uid);
    
    const userProfileUpdateData = { displayName: newDisplayName };
    const leaderboardUpdateData = { userName: newDisplayName };

    // Update user profile
    setDoc(userRef, userProfileUpdateData, { merge: true })
        .catch(serverError => {
            const permissionError = new FirestorePermissionError({
                path: userRef.path,
                operation: 'update',
                requestResourceData: userProfileUpdateData,
            });
            errorEmitter.emit('permission-error', permissionError);
        });

    // Update leaderboard entry
    setDoc(leaderboardRef, leaderboardUpdateData, { merge: true })
        .catch(serverError => {
            const permissionError = new FirestorePermissionError({
                path: leaderboardRef.path,
                operation: 'update',
                requestResourceData: leaderboardUpdateData,
            });
            errorEmitter.emit('permission-error', permissionError);
        });
};
