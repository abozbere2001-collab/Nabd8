

"use client";
import React, { createContext, useContext, useMemo, useEffect, useState } from 'react';
import type { User, Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { firebaseConfig } from '@/lib/firebase';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import { isGuest } from '@/lib/firebase-client';

interface FirebaseContextType {
  auth: Auth;
  db: Firestore;
  user: User | null | { isGuestUser: boolean };
  isAdmin: boolean;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

const ADMIN_EMAIL = "sagralnarey@gmail.com";

export const FirebaseProvider = ({ children, user }: { children: React.ReactNode, user: User | null | { isGuestUser: boolean } | undefined }) => {

  const { auth, db } = useMemo(() => {
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);
    return { app, auth, db };
  }, []);
  
  const isAdmin = useMemo(() => {
      if (!user || isGuest(user)) return false;
      // @ts-ignore
      return user.email === ADMIN_EMAIL;
  }, [user]);

  const value = useMemo(() => ({
    auth,
    db,
    user: user === undefined ? undefined : user, // Propagate the undefined state
    isAdmin,
  }), [auth, db, user, isAdmin]);

  return (
    <FirebaseContext.Provider value={value}>
      {children}
      {process.env.NODE_ENV === 'development' && <FirebaseErrorListener />}
    </FirebaseContext.Provider>
  );
};

export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
};

export const useAuth = () => {
    const context = useContext(FirebaseContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within a FirebaseProvider');
    }
    return { auth: context.auth, user: context.user };
}

export const useFirestore = () => {
    const context = useContext(FirebaseContext);
    if (context === undefined) {
        throw new Error('useFirestore must be used within a FirebaseProvider');
    }
    return { db: context.db };
}

export const useAdmin = () => {
    const context = useContext(FirebaseContext);
    if (context === undefined) {
        throw new Error('useAdmin must be used within a FirebaseProvider');
    }
    return { isAdmin: context.isAdmin, user: context.user };
}
