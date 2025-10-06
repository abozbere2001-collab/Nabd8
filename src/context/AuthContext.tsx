"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChange, signInWithGoogle as firebaseSignIn, signOut as firebaseSignOut, getGoogleRedirectResult } from '../lib/firebase-client';

interface AuthContextType {
  user: User | null;
  loadingAuth: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChange((user) => {
      setUser(user);
      setLoadingAuth(false);
    });

    // Check for redirect result on initial load
    getGoogleRedirectResult()
      .then((result) => {
        if (result) {
          // User successfully signed in.
          // The onAuthStateChange listener will handle setting the user.
          console.log('Redirect sign-in successful');
        }
      })
      .catch((error) => {
        console.error('Error getting redirect result:', error);
      })
      .finally(() => {
        // This is a good place to hide any global loading indicators
        // related to the redirect sign-in check.
      });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    setLoadingAuth(true); // Show loader while redirecting
    try {
        await firebaseSignIn();
        // The page will redirect, so no need to handle success here.
        // getRedirectResult will handle it on the return.
    } catch(error) {
       console.error("Error with redirect sign-in:", error);
       setLoadingAuth(false);
       throw error;
    }
  };

  const signOut = async () => {
    await firebaseSignOut();
    // onAuthStateChange will handle setting user to null
  };

  return (
    <AuthContext.Provider value={{ user, loadingAuth, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
