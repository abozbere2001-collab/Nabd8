
'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';

// Consolidating config here to ensure the correct values are always used.
const firebaseConfig = {
  apiKey: "AIzaSyDKQK4mfCGlSCwJS7oOdMhJa0SIJAv3nXM",
  authDomain: "nabd-d71ab.firebaseapp.com",
  projectId: "nabd-d71ab",
  storageBucket: "nabd-d71ab.appspot.com",
  messagingSenderId: "529236633123",
  appId: "1:529236633123:web:7d4945daae4d51038e3396",
  measurementId: "G-X5SY2K798F"
};

let firebaseApp: FirebaseApp;
if (!getApps().length) {
  firebaseApp = initializeApp(firebaseConfig);
} else {
  firebaseApp = getApp();
}

const auth = getAuth(firebaseApp);
const firestore = getFirestore(firebaseApp);
const database = getDatabase(firebaseApp);

export { firebaseApp, auth, firestore, database };

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './auth/use-user';
export * from './errors';
export * from './error-emitter';
export * from './non-blocking-updates';
