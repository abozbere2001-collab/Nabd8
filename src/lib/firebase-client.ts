"use client";

import { getAuth, type Auth } from "firebase/auth";
import { initializeFirebase, firebaseConfig } from "./firebase";

// This file is for client-side Firebase initialization only.

// Singleton for Auth
let auth: Auth | null = null;
export function getClientAuth() {
    if (auth) {
        return auth;
    }
    
    // Check if firebaseConfig.apiKey is valid before initializing
    if (!firebaseConfig.apiKey) {
        throw new Error("Firebase API Key is missing. Make sure it is set in your environment variables (NEXT_PUBLIC_FIREBASE_API_KEY).");
    }

    const app = initializeFirebase();
    auth = getAuth(app);
    return auth;
}
