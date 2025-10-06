"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChange, signInWithGoogle as firebaseSignIn, signOut as firebaseSignOut, getGoogleRedirectResult } from '../lib/firebase-client';

interface AuthContextType {
  user: User | null;
  loadingAuth: boolean;
  signInWithGoogle: () => Promise<any>;
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

    // Separately handle the redirect result on initial load.
    getGoogleRedirectResult()
      .then((result) => {
        if (result && result.user) {
          // The onAuthStateChanged observer will also catch this,
          // but we can set it here to potentially speed up the UI update.
          setUser(result.user);
        }
      })
      .catch((error) => {
        // This is where 'auth/unauthorized-domain' might be caught.
        // We log it but don't want to crash the app. The user will simply not be logged in.
        console.error("Error processing redirect result:", error);
      })
      .finally(() => {
        // We let onAuthStateChanged control the final loading state
        // to ensure we have the definitive auth status.
      });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    setLoadingAuth(true);
    // signInWithRedirect doesn't resolve a promise here as the page navigates away.
    // Errors are caught in getRedirectResult.
    await firebaseSignIn();
  };

  const signOut = async () => {
    setLoadingAuth(true);
    await firebaseSignOut();
    setUser(null); // Explicitly set user to null on sign out
    setLoadingAuth(false);
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
