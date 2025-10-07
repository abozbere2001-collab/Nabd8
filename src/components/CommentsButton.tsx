
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
          setMatchDetails(null);
        }
      } catch (error) {
        const permissionError = new FirestorePermissionError({
            path: matchDocRef.path,
            operation: 'get',
        });
        errorEmitter.emit('permission-error', permissionError);
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

  if (loading) {
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

  // Regular user view
  if (matchDetails?.commentsEnabled) {
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

  // If comments are not enabled and user is not admin, show nothing.
  return null;
}
