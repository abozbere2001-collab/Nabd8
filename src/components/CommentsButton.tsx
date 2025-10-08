
"use client";

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquare, MessageSquarePlus, MessageSquareX, Loader2 } from 'lucide-react';
import { useAdmin, useFirestore } from '@/firebase/provider';
import { doc, setDoc } from 'firebase/firestore';
import type { ScreenProps } from '@/app/page';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface CommentsButtonProps {
  matchId: number;
  navigate: ScreenProps['navigate'];
  commentsEnabled?: boolean;
}

export function CommentsButton({ matchId, navigate, commentsEnabled }: CommentsButtonProps) {
  const { isAdmin } = useAdmin();
  const { db } = useFirestore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDeactivateAlertOpen, setDeactivateAlertOpen] = useState(false);
  const pressTimer = useRef<NodeJS.Timeout | null>(null);

  const handleActivateComments = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAdmin || !db) return;
    
    setIsProcessing(true);
    const matchDocRef = doc(db, 'matches', String(matchId));
    const data = { commentsEnabled: true };
    setDoc(matchDocRef, data, { merge: true })
        .catch((serverError) => {
            const permissionError = new FirestorePermissionError({
                path: matchDocRef.path,
                operation: 'create',
                requestResourceData: data,
            });
            errorEmitter.emit('permission-error', permissionError);
        })
        .finally(() => {
            setIsProcessing(false);
        });
  };
  
  const handleDeactivateComments = () => {
    if (!isAdmin || !db) return;
    
    setIsProcessing(true);
    const matchDocRef = doc(db, 'matches', String(matchId));
    const data = { commentsEnabled: false };
    setDoc(matchDocRef, data, { merge: true })
        .catch((serverError) => {
            const permissionError = new FirestorePermissionError({
                path: matchDocRef.path,
                operation: 'update',
                requestResourceData: data,
            });
            errorEmitter.emit('permission-error', permissionError);
        })
        .finally(() => {
            setIsProcessing(false);
            setDeactivateAlertOpen(false);
        });
  }

  const handleTouchStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    pressTimer.current = setTimeout(() => {
        setDeactivateAlertOpen(true);
    }, 700); // 700ms for long press
  };

  const handleTouchEnd = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (pressTimer.current) {
        clearTimeout(pressTimer.current);
        pressTimer.current = null;
    }
  };
  
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if(pressTimer.current === null) {
      navigate('Comments', { matchId });
    }
  }


  // Admin View
  if (isAdmin) {
    if (commentsEnabled) {
      return (
         <AlertDialog open={isDeactivateAlertOpen} onOpenChange={setDeactivateAlertOpen}>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={handleClick}
              onMouseDown={handleTouchStart}
              onMouseUp={handleTouchEnd}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              عرض التعليقات (اضغط مطولاً للإلغاء)
            </Button>
            <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
                  <AlertDialogDescription>
                    سيؤدي هذا الإجراء إلى إلغاء تفعيل التعليقات لهذه المباراة.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeactivateComments} disabled={isProcessing}>
                    {isProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : <MessageSquareX className="h-4 w-4 ml-2"/>}
                    تأكيد الإلغاء
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
        </AlertDialog>
      );
    }
    return (
      <Button 
        variant="secondary" 
        className="w-full" 
        onClick={handleActivateComments}
        disabled={isProcessing}
      >
        {isProcessing ? (
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
