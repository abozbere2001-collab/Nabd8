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
    // This is a workaround for development environments where the domain is not yet authorized.
    // In a production environment, you should add your app's domain to the Firebase console.
    auth.tenantId = null;
    auth.settings.authDomain = "localhost";
    
    return auth;
}
