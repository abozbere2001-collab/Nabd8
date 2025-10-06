"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import type { User } from 'firebase/auth';
import { 
  signInWithGoogle as firebaseSignIn, 
  signOut as firebaseSignOut, 
  onAuthStateChange
} from '../lib/firebase-client';

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

    return () => unsubscribe();
  }, []);


  const signInWithGoogle = useCallback(async () => {
    setLoadingAuth(true);
    try {
      await firebaseSignIn();
      // onAuthStateChanged will handle the rest
    } catch(e) {
      console.error("signInWithPopup error", e);
      setLoadingAuth(false);
      throw e;
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await firebaseSignOut();
      // onAuthStateChanged will set user to null
    } catch (e) {
       console.error("Sign out error", e);
    }
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
