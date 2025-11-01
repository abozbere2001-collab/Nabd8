
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
    setPersistence(auth, browserLocalPersistence);
    
    // This is the crucial fix for multi-tenant auth on different domains like github.io
    // It tells Firebase to trust the domain the app is currently running on.
    if (auth.tenantId === null && auth.config.authDomain) {
        auth.tenantId = auth.config.authDomain;
    }

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
