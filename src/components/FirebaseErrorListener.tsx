
"use client";

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import type { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';

export function FirebaseErrorListener() {
    const { toast } = useToast();

    useEffect(() => {
        const handlePermissionError = (error: FirestorePermissionError) => {
             // Throwing the error here will make it visible in the Next.js error overlay
             // during development, which is exactly what we want for debugging security rules.
            throw error;
        };

        errorEmitter.on('permission-error', handlePermissionError);

        return () => {
            errorEmitter.off('permission-error', handlePermissionError);
        };
    }, [toast]);

    return null; // This component does not render anything
}
