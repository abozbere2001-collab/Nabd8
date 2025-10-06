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
import { getFirestore } from "firebase/firestore";

const app = initializeFirebase();
const auth: Auth = getAuth(app);
const db = getFirestore(app);
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
        if (result) {
            // User signed in or linked.
            // You can get the user's info here.
            return result.user;
        }
        return null;
    } catch (error) {
        console.error("Error getting redirect result:", error);
        return null;
    }
}

export { auth, db };
