
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


const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const handleNewUser = async (user: User) => {
    const userRef = doc(db, 'users', user.uid);
    const leaderboardRef = doc(db, 'leaderboard', user.uid);

    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
        // Create user profile document
        const userProfile: UserProfile = {
            displayName: user.displayName || 'مستخدم جديد',
            email: user.email!,
            photoURL: user.photoURL || '',
        };
        await setDoc(userRef, userProfile);

        // Create leaderboard entry
        const leaderboardEntry: UserScore = {
            userId: user.uid,
            userName: user.displayName || 'مستخدم جديد',
            userPhoto: user.photoURL || '',
            totalPoints: 0,
        };
        await setDoc(leaderboardRef, leaderboardEntry);
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

    // Update Firebase Auth display name
    await updateProfile(user, { displayName: newDisplayName });

    // Update display name in 'users' collection
    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, { displayName: newDisplayName }, { merge: true });

    // Update display name in 'leaderboard' collection
    const leaderboardRef = doc(db, 'leaderboard', user.uid);
    await setDoc(leaderboardRef, { userName: newDisplayName }, { merge: true });

    // Note: We are not updating the name in past comments/predictions to avoid many writes.
    // New comments/predictions will use the new name.
};
