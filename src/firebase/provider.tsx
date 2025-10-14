
"use client";
import React, { createContext, useContext, useMemo, useEffect, useState } from 'react';
import type { User, Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import { isGuest, guestUser, onAuthStateChange } from '@/lib/firebase-client';
import { auth, db } from '@/lib/firebase'; // Directly import the initialized instances

interface FirebaseContextType {
  auth: Auth;
  db: Firestore;
  user: User | typeof guestUser | null | undefined;
  isAdmin: boolean;
  isProUser: boolean;
  setProUser: (isPro: boolean) => void;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

const ADMIN_EMAIL = "sagralnarey@gmail.com";

export const FirebaseProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | typeof guestUser | null | undefined>(undefined);
  const [isProUser, setIsProUser] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChange((currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);
  
  const isAdmin = useMemo(() => {
      if (!user || isGuest(user)) return false;
      return user.email === ADMIN_EMAIL;
  }, [user]);

  // Listen for pro status changes in Firestore
  useEffect(() => {
    if (user && !isGuest(user) && db) {
      const userDocRef = doc(db, 'users', user.uid);
      const unsubscribe = onSnapshot(userDocRef, (doc) => {
        setIsProUser(doc.data()?.isProUser || false);
      });
      return () => unsubscribe();
    } else {
        // Reset for guest or logged out users
        setIsProUser(false);
    }
  }, [user, db]);

  // Function to manually set pro status (for admin or after payment)
  const setProUser = async (isPro: boolean) => {
    if (user && !isGuest(user) && db) {
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, { isProUser: isPro }, { merge: true });
        setIsProUser(isPro); // Optimistically update state
    }
  };


  const value = useMemo(() => ({
    auth,
    db,
    user: user,
    isAdmin,
    isProUser,
    setProUser,
  }), [user, isAdmin, isProUser]);

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
    return { auth: context.auth, user: context.user, isProUser: context.isProUser, setProUser: context.setProUser };
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
