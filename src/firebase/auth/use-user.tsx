'use client';

import { useContext } from 'react';
import type { User } from 'firebase/auth';
import { FirebaseContext } from '@/firebase/provider';

/**
 * Custom hook to access the current authenticated user and loading state.
 * This hook must be used within a component wrapped by FirebaseProvider.
 *
 * @returns An object containing the user object (or null if not authenticated)
 *          and a boolean `isUserLoading` which is true while the auth state is being determined.
 */
export const useUser = (): { user: User | null; isUserLoading: boolean } => {
  const context = useContext(FirebaseContext);
  
  // If the hook is used outside of the provider, we return a default state.
  if (context === undefined) {
    // We could throw an error, but returning a loading state is often more graceful
    // during development and for certain edge cases.
    return { user: null, isUserLoading: true };
  }
  
  return { user: context.user, isUserLoading: context.isLoading };
};
