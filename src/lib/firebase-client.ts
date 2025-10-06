"use client";

import { getAuth, GoogleAuthProvider, signInWithRedirect, getRedirectResult, signOut as firebaseSignOut, onAuthStateChanged, type User, type Auth } from "firebase/auth";
import { initializeFirebase } from './firebase';

const app = initializeFirebase();

let auth: Auth;
try {
  auth = getAuth(app);
  // This line is for local development and might cause issues in some environments.
  // We keep it as it solves the 'auth/unauthorized-domain' for many local setups.
  // If issues persist, this might need to be configured in the Firebase Console.
  auth.tenantId = null; 
} catch (error) {
  console.error("Error initializing Firebase Auth:", error);
  // Provide a mock auth object if initialization fails, to prevent app crash
  auth = {
    currentUser: null,
    onAuthStateChanged: () => () => {},
    // Add other methods as needed, with mock implementations
  } as unknown as Auth;
}


const provider = new GoogleAuthProvider();

export const signInWithGoogle = () => {
  return signInWithRedirect(auth, provider);
};

export const getGoogleRedirectResult = () => {
  return getRedirectResult(auth);
};

export const signOut = () => {
  return firebaseSignOut(auth);
};

export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};
