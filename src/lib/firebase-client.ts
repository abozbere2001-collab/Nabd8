"use client";

import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, // Using popup
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
  // Create a mock auth object to prevent crashing the app server-side or if Firebase fails
  auth = {
    currentUser: null,
    onAuthStateChanged: () => () => {},
  } as unknown as Auth;
}

const provider = new GoogleAuthProvider();

export const signInWithGoogle = (): Promise<UserCredential> => {
  return signInWithPopup(auth, provider);
};

export const signOut = (): Promise<void> => {
  return firebaseSignOut(auth);
};

export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return firebaseOnAuthStateChanged(auth, callback);
};
