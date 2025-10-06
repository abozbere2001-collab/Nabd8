"use client";

import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithRedirect, // Using redirect
  getRedirectResult,  // To get the result after redirect
  signOut as firebaseSignOut, 
  onAuthStateChanged as firebaseOnAuthStateChanged,
  type User, 
  type Auth, 
  type UserCredential 
} from "firebase/auth";
import { initializeFirebase } from './firebase';

const app = initializeFirebase();

let auth: Auth;
try {
  auth = getAuth(app);
} catch (error) {
  console.error("Error initializing Firebase Auth:", error);
  auth = {
    currentUser: null,
    onAuthStateChanged: () => () => {},
  } as unknown as Auth;
}

const provider = new GoogleAuthProvider();

export const signInWithGoogle = (): Promise<void> => {
  // Use signInWithRedirect instead of signInWithPopup
  return signInWithRedirect(auth, provider);
};

export const checkRedirectResult = (): Promise<UserCredential | null> => {
    return getRedirectResult(auth);
}

export const signOut = (): Promise<void> => {
  return firebaseSignOut(auth);
};

export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return firebaseOnAuthStateChanged(auth, callback);
};
