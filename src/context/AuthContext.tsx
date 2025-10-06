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
    // This function will be called to handle the auth state.
    const handleAuth = async () => {
      setLoadingAuth(true);
      try {
        // First, check if there's a redirect result.
        const result = await getGoogleRedirectResult();
        if (result) {
          // If there's a result, onAuthStateChanged will soon fire with the new user.
          // We can wait for it.
          console.log('Redirect sign-in successful, waiting for auth state change.');
        }
      } catch (error) {
        // Handle potential errors from getRedirectResult, e.g., credential already in use.
        console.error("Error processing redirect result:", error);
      }

      // Set up the listener for real-time auth state changes.
      // This will also catch the user from the redirect result.
      const unsubscribe = onAuthStateChange((user) => {
        setUser(user);
        setLoadingAuth(false);
      });
      
      return unsubscribe;
    };
    
    const unsubscribePromise = handleAuth();

    // Cleanup function
    return () => {
      unsubscribePromise.then(unsubscribe => {
        if (unsubscribe) {
          unsubscribe();
        }
      });
    };
  }, []);

  const signInWithGoogle = async () => {
    setLoadingAuth(true); // Show loader while redirecting
    try {
        await firebaseSignIn();
        // The page will redirect, so no need to handle success here.
        // getRedirectResult will handle it on the return.
    } catch(error) {
       console.error("Error with redirect sign-in:", error);
       setLoadingAuth(false); // Re-enable button if redirect fails
       throw error;
    }
  };

  const signOut = async () => {
    await firebaseSignOut();
    // onAuthStateChange will handle setting user to null and loading state
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
