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
    
    // This is a workaround for development environments where the domain is not yet authorized,
    // or when a tenant ID might be unexpectedly interfering.
    // In a production environment, you should add your app's domain to the Firebase console.
    auth.tenantId = null;
    
    // Although setting authDomain is a common fix, setting tenantId to null
    // is a more robust solution for some complex development environments.
    // We keep this line commented for now as setting tenantId should be sufficient.
    // auth.settings.authDomain = "localhost";
    
    return auth;
}
