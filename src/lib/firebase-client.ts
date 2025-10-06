"use client";

import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut, 
  onAuthStateChanged, 
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
  return signInWithRedirect(auth, provider);
};

export const getGoogleRedirectResult = (): Promise<UserCredential | null> => {
   return getRedirectResult(auth);
};

export const signOut = (): Promise<void> => {
  return firebaseSignOut(auth);
};

export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};
