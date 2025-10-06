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
  // Create a mock auth object if initialization fails to prevent crashes
  auth = {
    currentUser: null,
    onAuthStateChanged: () => () => {},
  } as unknown as Auth;
}

const provider = new GoogleAuthProvider();

export const signInWithGoogle = async (): Promise<void> => {
  if (auth) {
    // Use signInWithRedirect instead of signInWithPopup
    await signInWithRedirect(auth, provider);
  } else {
    console.error("Firebase Auth is not initialized.");
    // Optionally, you could throw an error here to be caught by the caller
    // throw new Error("Firebase Auth is not initialized.");
  }
};

export const checkRedirectResult = async (): Promise<UserCredential | null> => {
    if (auth) {
        return await getRedirectResult(auth);
    }
    return null;
}

export const signOut = (): Promise<void> => {
  if (auth) {
    return firebaseSignOut(auth);
  }
  return Promise.resolve();
};

export const onAuthStateChange = (callback: (user: User | null) => void) => {
  if (auth) {
    return firebaseOnAuthStateChanged(auth, callback);
  }
  // Return a dummy unsubscribe function if auth is not available
  return () => {};
};
