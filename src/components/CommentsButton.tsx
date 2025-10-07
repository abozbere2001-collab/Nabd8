
"use client";

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquare, MessageSquarePlus, Loader2 } from 'lucide-react';
import { useAdmin, useFirestore } from '@/firebase/provider';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { ScreenProps } from '@/app/page';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';

interface CommentsButtonProps {
  matchId: number;
  navigate: ScreenProps['navigate'];
  commentsEnabled?: boolean;
}

export function CommentsButton({ matchId, navigate, commentsEnabled }: CommentsButtonProps) {
  const { isAdmin } = useAdmin();
  const { db } = useFirestore();
  const [isActivating, setIsActivating] = useState(false);

  const handleActivateComments = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent navigation
    if (!isAdmin) return;
    
    setIsActivating(true);
    const matchDocRef = doc(db, 'matches', String(matchId));
    const data = { commentsEnabled: true };
    try {
      await setDoc(matchDocRef, data, { merge: true });
      // The parent component (MatchesScreen) will get the update via its snapshot listener
      // and re-render this component with the new `commentsEnabled` prop.
    } catch (error) {
        const permissionError = new FirestorePermissionError({
            path: matchDocRef.path,
            operation: 'create',
            requestResourceData: data,
        });
        errorEmitter.emit('permission-error', permissionError);
    } finally {
      setIsActivating(false);
    }
  };

  // Admin View
  if (isAdmin) {
    if (commentsEnabled) {
      return (
        <Button 
          variant="outline" 
          className="w-full"
          onClick={() => navigate('Comments', { matchId })}
        >
          <MessageSquare className="h-4 w-4 mr-2" />
          عرض التعليقات
        </Button>
      );
    }
    return (
      <Button 
        variant="secondary" 
        className="w-full" 
        onClick={handleActivateComments}
        disabled={isActivating}
      >
        {isActivating ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
            <MessageSquarePlus className="h-4 w-4 mr-2" />
        )}
        تفعيل التعليقات
      </Button>
    );
  }

  // Regular User View
  if (commentsEnabled) {
    return (
      <Button 
        variant="ghost" 
        className="w-full"
        onClick={() => navigate('Comments', { matchId })}
      >
        <MessageSquare className="h-4 w-4 mr-2" />
        التعليقات
      </Button>
    );
  }

  // If comments are not enabled for a regular user, render nothing.
  return null;
}
