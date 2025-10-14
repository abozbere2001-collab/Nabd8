
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, getFirestore, CACHE_SIZE_UNLIMITED } from "firebase/firestore";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
export const firebaseConfig = {
  apiKey: "AIzaSyCSTuscXA3VzGr18ADaDVGj33XGks_DY4g",
  authDomain: "studio-3417145591-24d0a.firebaseapp.com",
  databaseURL: "https://studio-3417145591-24d0a-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "studio-3417145591-24d0a",
  storageBucket: "studio-3417145591-24d0a.appspot.com",
  messagingSenderId: "731644651563",
  appId: "1:731644651563:web:c545fe9730675b9e5f626e",
  measurementId: "G-JLPD1C0BFH"
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
let db: ReturnType<typeof getFirestore>;

// Check if running in a browser environment before initializing Firestore with cache
if (typeof window !== 'undefined') {
  try {
    db = initializeFirestore(app, {
      cache: persistentLocalCache({ cacheSizeBytes: CACHE_SIZE_UNLIMITED })
    });
  } catch (e) {
    // This can happen with Next.js fast refresh.
    // If it's already initialized, just get the instance.
    db = getFirestore(app);
  }
} else {
  // For server-side rendering, initialize without cache
  db = getFirestore(app);
}


export { app, auth, db };
