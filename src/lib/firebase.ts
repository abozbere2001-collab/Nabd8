import { initializeApp, getApps, getApp, type FirebaseOptions } from "firebase/app";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
export const firebaseConfig: FirebaseOptions = {
  apiKey: "AIzaSyCSTuscXA3VzGr18ADaDVGj33XGks_DY4g",
  authDomain: "studio-3417145591-24d0a.firebaseapp.com",
  databaseURL: "https://studio-3417145591-24d0a-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "studio-3417145591-24d0a",
  storageBucket: "studio-3417145591-24d0a.firebasestorage.app",
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
