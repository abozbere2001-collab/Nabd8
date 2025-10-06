import { initializeApp, getApps, getApp, type FirebaseOptions } from "firebase/app";

// NOTE: This config is hardcoded based on user's request to fix a persistent API key issue.
export const firebaseConfig: FirebaseOptions = {
  apiKey: "AIzaSyCSTuscXA3VzGr18ADaDVGj33XGks_DY4g",
  authDomain: "studio-3417145591-24d0a.firebaseapp.com",
  projectId: "studio-3417145591-24d0a",
  storageBucket: "studio-3417145591-24d0a.appspot.com",
  messagingSenderId: "731644651563",
  appId: "1:731644651563:web:c545fe9730675b9e5f626e",
  measurementId: "G-JLPD1C0BFH"
};

// Initialize Firebase
export function initializeFirebase() {
    if (getApps().length) {
        return getApp();
    }
    
    if (!firebaseConfig.apiKey) {
      // This should not happen with a hardcoded config, but as a safeguard.
      throw new Error("Firebase API Key is missing in the configuration.");
    }

    return initializeApp(firebaseConfig);
}
