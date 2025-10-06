"use client";

import { initializeApp, getApps, getApp, type FirebaseOptions } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase for client side
function getClientSideApp() {
    if (getApps().length) {
        return getApp();
    }
    const app = initializeApp(firebaseConfig);
    return app;
}

// Singleton for Auth
let auth: Auth | null = null;
export function getClientAuth() {
    if (auth) {
        return auth;
    }
    // Check if firebaseConfig.apiKey is valid before initializing
    if (!firebaseConfig.apiKey) {
        console.error("Firebase API Key is missing. Authentication will not work.");
        // Return a mock auth object or throw an error to prevent the app from crashing
        // For now, we will let it fail to make the error visible.
    }
    const app = getClientSideApp();
    auth = getAuth(app);
    return auth;
}
