
"use client";

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquare, MessageSquarePlus, Loader2 } from 'lucide-react';
import { useAdmin, useFirestore } from '@/firebase/provider';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { ScreenProps } from '@/app/page';
import type { MatchDetails } from '@/lib/types';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';

interface CommentsButtonProps {
  matchId: number;
  navigate: ScreenProps['navigate'];
}

export function CommentsButton({ matchId, navigate }: CommentsButtonProps) {
  const { isAdmin } = useAdmin();
  const { db } = useFirestore();
  const [matchDetails, setMatchDetails] = useState<MatchDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    const fetchMatchDetails = async () => {
      // Only admins should fetch this, as regular users don't have direct access
      if (!isAdmin) {
          setLoading(false);
          return;
      }
      setLoading(true);
      const matchDocRef = doc(db, 'matches', String(matchId));
      try {
        const docSnap = await getDoc(matchDocRef);
        if (docSnap.exists()) {
          setMatchDetails(docSnap.data() as MatchDetails);
        } else {
          // If doc doesn't exist, it means comments are not enabled
          setMatchDetails({ commentsEnabled: false });
        }
      } catch (error) {
        const permissionError = new FirestorePermissionError({
            path: matchDocRef.path,
            operation: 'get',
        });
        errorEmitter.emit('permission-error', permissionError);
        // Set a default state on error to avoid inconsistent UI
        setMatchDetails({ commentsEnabled: false });
      } finally {
        setLoading(false);
      }
    };
    
    fetchMatchDetails();
  }, [matchId, db, isAdmin]);

  const handleActivateComments = async () => {
    setActivating(true);
    const matchDocRef = doc(db, 'matches', String(matchId));
    const data = { commentsEnabled: true };
    try {
      await setDoc(matchDocRef, data, { merge: true });
      setMatchDetails(data); // Optimistically update state
    } catch (error) {
        const permissionError = new FirestorePermissionError({
            path: matchDocRef.path,
            operation: 'create',
            requestResourceData: data,
        });
        errorEmitter.emit('permission-error', permissionError);
    } finally {
      setActivating(false);
    }
  };

  // If loading and user is admin, show loading state.
  if (loading && isAdmin) {
    return (
      <Button variant="ghost" className="w-full" disabled>
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        جاري تحميل التعليقات...
      </Button>
    );
  }

  // Admin view
  if (isAdmin) {
    if (matchDetails?.commentsEnabled) {
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
        disabled={activating}
      >
        {activating ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
            <MessageSquarePlus className="h-4 w-4 mr-2" />
        )}
        تفعيل التعليقات
      </Button>
    );
  }

  // For regular users, we can't be sure if comments are enabled without a read.
  // The most robust solution is to just always show the button and let the CommentsScreen handle it
  // if the match doc doesn't exist or isn't enabled.
  // The alternative would be to make `/matches/{matchId}` readable by everyone.
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
