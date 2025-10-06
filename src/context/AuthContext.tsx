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
    // This is the primary listener for auth state changes.
    const unsubscribe = onAuthStateChange((user) => {
      setUser(user);
      setLoadingAuth(false);
    });

    // We also explicitly check for a redirect result on initial load.
    // This can catch the user from the redirect faster than onAuthStateChanged
    // and helps in scenarios where the auth state might be slow to update.
    getGoogleRedirectResult()
      .then((result) => {
        if (result && result.user) {
          // The user is successfully signed in from the redirect.
          // onAuthStateChanged will also fire, but setting it here can speed up UI updates.
          setUser(result.user);
        }
      })
      .catch((error) => {
        // This is where 'auth/unauthorized-domain' would be caught if the redirect itself failed.
        // We've proven the domain is authorized, so this error shouldn't happen,
        // but we log it just in case.
        console.error("Error processing redirect result:", error);
      })
      .finally(() => {
        // Regardless of the redirect result, we let onAuthStateChanged
        // be the final authority on the loading state to ensure we have
        // the definitive auth status from Firebase.
      });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    setLoadingAuth(true);
    // Using signInWithRedirect. This function does not resolve as the page navigates away.
    // The result is handled by getRedirectResult when the user returns to the app.
    await firebaseSignIn();
  };

  const signOut = async () => {
    setLoadingAuth(true);
    await firebaseSignOut();
    setUser(null); // Explicitly set user to null on sign out for immediate UI update
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
