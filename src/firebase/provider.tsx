
'use client';

import React, { DependencyList, createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore } from 'firebase/firestore';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
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
  isLoading: boolean;
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
      setIsLoading(true);
      if (firebaseUser) {
        setUser(firebaseUser);
        const adminDocRef = doc(firestore, 'admins', firebaseUser.uid);
        const userDocRef = doc(firestore, 'users', firebaseUser.uid);
        try {
            const [adminDoc, userDoc] = await Promise.all([
                getDoc(adminDocRef),
                getDoc(userDocRef)
            ]);
            setIsAdmin(adminDoc.exists());

            if (userDoc.exists()) {
                setProUser(userDoc.data()?.isProUser || false);
            } else {
                // If user doc doesn't exist, create it.
                const newUserProfile = {
                    displayName: firebaseUser.displayName,
                    email: firebaseUser.email,
                    photoURL: firebaseUser.photoURL,
                    isProUser: false,
                };
                await setDoc(userDocRef, newUserProfile);
            }
        } catch (error) {
            console.error("Error checking admin or pro status:", error);
            setIsAdmin(false);
            setProUser(false);
        }
      } else {
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


  const value = { firebaseApp, firestore, auth, user, isAdmin, isProUser, setProUser: handleSetPro, isLoading };

  return (
    <FirebaseContext.Provider value={value}>
       <FirebaseErrorListener />
      {children}
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
        setProUser: context.setProUser,
        isUserLoading: context.isLoading
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
    // This can happen on the very first render before the provider has mounted.
    // In this case, we are definitely loading.
    return { user: null, isUserLoading: true };
  }
  return { user: context.user, isUserLoading: context.isLoading };
};
