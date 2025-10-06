"use client";

import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged, type User, type Auth, UserCredential } from "firebase/auth";
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

export const signInWithGoogle = (): Promise<UserCredential> => {
  return signInWithPopup(auth, provider);
};

// This is no longer needed with signInWithPopup
export const getGoogleRedirectResult = () => {
  return Promise.resolve(null);
};

export const signOut = () => {
  return firebaseSignOut(auth);
};

export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};
