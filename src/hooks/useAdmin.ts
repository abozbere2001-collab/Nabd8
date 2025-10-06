// This file is being renamed to useAdmin.tsx
"use client";

import React, { createContext, useContext } from 'react';
import type { User } from 'firebase/auth';

const ADMIN_EMAIL = "sagralnarey@gmail.com";

interface AdminContextType {
  isAdmin: boolean;
  user: User | null;
}

const AdminContext = createContext<AdminContextType>({
  isAdmin: false,
  user: null,
});

export const AdminProvider = ({ children, user }: { children: React.ReactNode, user: User | null }) => {
  const isAdmin = user?.email === ADMIN_EMAIL;
  
  return (
    <AdminContext.Provider value={{ isAdmin, user }}>
      {children}
    </AdminContext.Provider>
  );
};

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
};
