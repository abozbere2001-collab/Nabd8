
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, getFirestore, CACHE_SIZE_UNLIMITED } from "firebase/firestore";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
export const firebaseConfig = {
  "projectId": "goal-stack-top100-599550-3e16a",
  "appId": "1:596409947873:web:7a3938533fe1ed561b09a0",
  "apiKey": "AIzaSyAFxnjh0irb66bOhjScsx_0SIthCwT-Nx4",
  "authDomain": "goal-stack-top100-599550-3e16a.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "596409947873"
};


// Initialize Firebase
let app: FirebaseApp;
if (getApps().length) {
    app = getApp();
} else {
    if (!firebaseConfig.apiKey) {
      throw new Error("Firebase API Key is missing in the configuration.");
    }
    app = initializeApp(firebaseConfig);
}

const auth = getAuth(app);
const db = initializeFirestore(app, {
    cache: persistentLocalCache({ cacheSizeBytes: CACHE_SIZE_UNLIMITED })
});


export { app, auth, db };
