"use client";

import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut, 
  onAuthStateChanged as firebaseOnAuthStateChanged,
  type User, 
  type Auth, 
  type UserCredential 
} from "firebase/auth";
import { initializeFirebase } from './firebase';

const app = initializeFirebase();
const auth: Auth = getAuth(app);
const provider = new GoogleAuthProvider();

export const signInWithGoogle = async (): Promise<void> => {
  await signInWithRedirect(auth, provider);
};

export const checkRedirectResult = async (): Promise<UserCredential | null> => {
    return await getRedirectResult(auth);
}

export const signOut = (): Promise<void> => {
  return firebaseSignOut(auth);
};

export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return firebaseOnAuthStateChanged(auth, callback);
};
