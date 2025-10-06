"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
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
    // First, check for the redirect result
    getGoogleRedirectResult()
      .then((result) => {
        if (result) {
          // User signed in or already signed in.
          // onAuthStateChanged will handle setting the user.
          console.log("Redirect result processed.");
        }
        // Even if result is null, we continue to the auth state listener.
      })
      .catch((error) => {
        console.error("Error processing redirect result:", error);
      })
      .finally(() => {
        // Now, set up the real-time listener.
        const unsubscribe = onAuthStateChange((user) => {
          setUser(user);
          setLoadingAuth(false);
        });
        return () => unsubscribe();
      });
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setLoadingAuth(true); // Set loading before redirect
    try {
        await firebaseSignIn();
        // The page will redirect, so no need to do anything after this.
    } catch(e) {
        console.error("signInWithRedirect error", e);
        setLoadingAuth(false); // Reset loading on error
    }
  }, []);

  const signOut = useCallback(async () => {
    setLoadingAuth(true);
    await firebaseSignOut();
    // onAuthStateChanged will set user to null and setLoadingAuth to false.
  }, []);

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
