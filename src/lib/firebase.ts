
import { initializeApp, getApps, getApp, type FirebaseOptions, type FirebaseApp } from "firebase/app";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
export const firebaseConfig: FirebaseOptions = {
  "projectId": "goal-stack-top100-599550-3e16a",
  "appId": "1:596409947873:web:7a3938533fe1ed561b09a0",
  "apiKey": "AIzaSyAFxnjh0irb66bOhjScsx_0SIthCwT-Nx4",
  "authDomain": "goal-stack-top100-599550-3e16a.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "596409947873"
};


// Initialize Firebase
export function initializeFirebase(): FirebaseApp {
    if (getApps().length) {
        return getApp();
    }
    
    if (!firebaseConfig.apiKey) {
      // This should not happen with a hardcoded config, but as a safeguard.
      throw new Error("Firebase API Key is missing in the configuration.");
    }

    return initializeApp(firebaseConfig);
}
