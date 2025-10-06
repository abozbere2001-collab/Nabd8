"use client";

import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithRedirect,
  signOut as firebaseSignOut, 
  onAuthStateChanged as firebaseOnAuthStateChanged,
  getRedirectResult,
  type User, 
  type Auth, 
} from "firebase/auth";
import { initializeFirebase } from './firebase';

const app = initializeFirebase();
const auth: Auth = getAuth(app);
const provider = new GoogleAuthProvider();

export const signInWithGoogle = async (): Promise<void> => {
  await signInWithRedirect(auth, provider);
};

export const signOut = (): Promise<void> => {
  return firebaseSignOut(auth);
};

export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return firebaseOnAuthStateChanged(auth, callback);
};

export const checkRedirectResult = async (): Promise<User | null> => {
    try {
        const result = await getRedirectResult(auth);
        return result?.user ?? null;
    } catch (error) {
        console.error("Error getting redirect result:", error);
        return null;
    }
}
