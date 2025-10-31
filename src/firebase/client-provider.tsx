
'use client';

import React, { type ReactNode, useEffect } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { firebaseApp, auth, firestore } from '@/firebase';
import { browserLocalPersistence, setPersistence } from 'firebase/auth';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  useEffect(() => {
    // This ensures that the auth state is persisted locally in the browser.
    // It's the recommended persistence for web applications.
    // We also switch to 'redirect' login flow here which is necessary for many hosting environments like GitHub pages.
    setPersistence(auth, browserLocalPersistence);
  }, []);

  return (
    <FirebaseProvider
      firebaseApp={firebaseApp}
      auth={auth}
      firestore={firestore}
    >
      {children}
    </FirebaseProvider>
  );
}
