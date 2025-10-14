
'use client';

import React, { DependencyList, createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore } from 'firebase/firestore';
import { Auth, User, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener'
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface FirebaseContextProps {
  firebaseApp: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null;
  user: User | null;
  isAdmin: boolean;
  isProUser: boolean;
  setProUser: (isPro: boolean) => void;
}

const FirebaseContext = createContext<FirebaseContextProps | undefined>(undefined);

export const FirebaseProvider = ({
  children,
  firebaseApp,
  auth,
  firestore,
}: {
  children: ReactNode;
  firebaseApp: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isProUser, setProUser] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        const adminDocRef = doc(firestore, 'admins', firebaseUser.uid);
        const userDocRef = doc(firestore, 'users', firebaseUser.uid);
        try {
            const [adminDoc, userDoc] = await Promise.all([
                getDoc(adminDocRef),
                getDoc(userDoc)
            ]);
            setIsAdmin(adminDoc.exists());
            if (userDoc.exists()) {
                setProUser(userDoc.data()?.isProUser || false);
            }
        } catch (error) {
            // Handle potential permission errors gracefully
            console.error("Error checking admin or pro status:", error);
            setIsAdmin(false);
            setProUser(false);
        }
      } else {
        // Handle unauthenticated state, maybe sign in anonymously
        signInAnonymously(auth).catch(error => {
            console.error("Anonymous sign in failed:", error);
        });
        setUser(null);
        setIsAdmin(false);
        setProUser(false);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [auth, firestore]);
  
  const handleSetPro = async (isPro: boolean) => {
    if (user) {
        const userDocRef = doc(firestore, 'users', user.uid);
        try {
            await setDoc(userDocRef, { isProUser: isPro }, { merge: true });
            setProUser(isPro);
        } catch (error) {
            console.error("Failed to update pro status:", error);
        }
    }
  }


  const value = { firebaseApp, firestore, auth, user, isAdmin, isProUser, setProUser: handleSetPro };

  return (
    <FirebaseContext.Provider value={value}>
       <FirebaseErrorListener />
      {!isLoading && children}
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
    const context = useFirebase();
    if (context === undefined) {
        throw new Error('useAuth must be used within a FirebaseProvider');
    }
    return { 
        user: context.user, 
        isProUser: context.isProUser, 
        setProUser: context.setProUser 
    };
};

export const useAdmin = () => {
    const context = useFirebase();
    if (context === undefined) {
        throw new Error('useAdmin must be used within a FirebaseProvider');
    }
    return { isAdmin: context.isAdmin };
};

export const useFirestore = () => {
    const context = useFirebase();
    if (context === undefined) {
        throw new Error('useFirestore must be used within a FirebaseProvider');
    }
    return { db: context.firestore };
};

export const useFirebaseApp = () => {
    const context = useFirebase();
    if (context === undefined) {
        throw new Error('useFirebaseApp must be used within a FirebaseProvider');
    }
    return { app: context.firebaseApp };
};

type MemoFirebase <T> = T & {__memo?: boolean};

export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T | (MemoFirebase<T>) {
  const memoized = useMemo(factory, deps);
  
  if(typeof memoized !== 'object' || memoized === null) return memoized;
  (memoized as MemoFirebase<T>).__memo = true;
  
  return memoized;
}

export const useUser = (): { user: User | null; isUserLoading: boolean } => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    return { user: null, isUserLoading: true };
  }
  return { user: context.user, isUserLoading: false };
};
