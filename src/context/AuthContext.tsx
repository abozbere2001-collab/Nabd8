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
    // Flag to prevent race conditions
    let isProcessingRedirect = true;

    getGoogleRedirectResult()
      .then((result) => {
        if (result) {
          // A user signed in via redirect.
          // The onAuthStateChanged listener below will catch this new user state.
          console.log("Redirect result successfully processed.");
        }
      })
      .catch((error) => {
        console.error("Error processing redirect result:", error);
      })
      .finally(() => {
        // We are done processing the redirect, regardless of outcome.
        isProcessingRedirect = false;
        // If onAuthStateChanged has already run and found no user,
        // we might need to re-set loading to false.
        // It's safer to just let the listener handle it.
        setLoadingAuth(currentLoading => user === null && !currentLoading ? false : currentLoading);
      });

    const unsubscribe = onAuthStateChange((user) => {
      setUser(user);
      // Only set loading to false if we are not in the middle of processing a redirect.
      // This prevents the login screen from flashing before the redirect result is handled.
      if (!isProcessingRedirect) {
        setLoadingAuth(false);
      }
    });

    return () => unsubscribe();
  }, []);


  const signInWithGoogle = useCallback(async () => {
    setLoadingAuth(true); // Set loading before redirect
    try {
        await firebaseSignIn();
        // The page will redirect, so no need to do anything after this.
    } catch(e) {
        console.error("signInWithRedirect error", e);
        setLoadingAuth(false); // Reset loading on error
        throw e;
    }
  }, []);

  const signOut = useCallback(async () => {
    setLoadingAuth(true);
    await firebaseSignOut();
    // onAuthStateChanged will set user to null, which will then set loading to false.
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
