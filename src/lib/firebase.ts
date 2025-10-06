import { initializeApp, getApps, getApp, type FirebaseOptions } from "firebase/app";

export const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
export function initializeFirebase() {
    if (getApps().length) {
        return getApp();
    }
    
    if (!firebaseConfig.apiKey) {
      // This will be caught by the client-side check, but as a safeguard
      throw new Error("Firebase API Key is missing in the environment variables.");
    }

    return initializeApp(firebaseConfig);
}
