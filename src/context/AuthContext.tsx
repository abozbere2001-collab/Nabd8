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
    // This function handles the result of a redirect operation.
    const checkRedirectResult = async () => {
      try {
        const result = await getGoogleRedirectResult();
        if (result && result.user) {
          // User signed in successfully via redirect.
          // onAuthStateChanged will also fire, but this can make the UI update faster.
          setUser(result.user);
        }
      } catch (error: any) {
        // Handle errors from the redirect, e.g., if the user closes the window
        // or if there are other issues like 'auth/unauthorized-domain' on the redirect itself.
        console.error("Error processing redirect result:", error);
      } finally {
        // It's important to set loading to false AFTER checking the redirect.
        // But we will let onAuthStateChanged be the final authority.
      }
    };

    // Check for redirect result on initial load.
    checkRedirectResult();

    // This is the primary listener for auth state changes.
    // It will fire after the redirect check and whenever the auth state changes.
    const unsubscribe = onAuthStateChange((user) => {
      setUser(user);
      setLoadingAuth(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    setLoadingAuth(true);
    // Using signInWithRedirect. The page will navigate away.
    // The result is handled by getRedirectResult in the useEffect hook when the user returns.
    try {
      await firebaseSignIn();
    } catch(error) {
       console.error("Error starting redirect sign-in:", error);
       setLoadingAuth(false); // Reset loading state if the redirect fails to start
    }
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
