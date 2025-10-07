"use client";
import React, { createContext, useContext, useMemo } from 'react';
import type { User } from 'firebase/auth';

interface FirebaseContextType {
  user: User | null;
  isAdmin: boolean;
}

const FirebaseContext = createContext<FirebaseContextType>({
  user: null,
  isAdmin: false,
});

const ADMIN_EMAIL = "sagralnarey@gmail.com";

export const FirebaseProvider = ({ children, user }: { children: React.ReactNode, user: User | null }) => {
  const isAdmin = useMemo(() => user?.email === ADMIN_EMAIL, [user]);

  const value = useMemo(() => ({
    user,
    isAdmin,
  }), [user, isAdmin]);

  return (
    <FirebaseContext.Provider value={value}>
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

export const useAdmin = () => {
    const context = useContext(FirebaseContext);
    if (context === undefined) {
        throw new Error('useAdmin must be used within a FirebaseProvider');
    }
    return { isAdmin: context.isAdmin, user: context.user };
}
