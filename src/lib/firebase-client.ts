"use client";

import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup,
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

export const signInWithGoogle = async (): Promise<UserCredential | void> => {
  return await signInWithPopup(auth, provider);
};

export const signOut = (): Promise<void> => {
  return firebaseSignOut(auth);
};

export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return firebaseOnAuthStateChanged(auth, callback);
};
