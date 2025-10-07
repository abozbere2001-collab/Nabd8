
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Send } from 'lucide-react';
import type { ScreenProps } from '@/app/page';
import { useAuth, useFirestore } from '@/firebase/provider';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot } from 'firebase/firestore';
import type { MatchComment } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

interface CommentsScreenProps extends ScreenProps {
  matchId: number;
}

export function CommentsScreen({ matchId, goBack, canGoBack, headerActions }: CommentsScreenProps) {
  const { user } = useAuth();
  const { db } = useFirestore();
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState<MatchComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  const commentsColRef = collection(db, 'matches', String(matchId), 'comments');

  useEffect(() => {
    setLoading(true);
    const q = query(commentsColRef, orderBy('timestamp', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedComments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MatchComment));
      setComments(fetchedComments);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching comments:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [matchId, db]);

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);


  const handleSendComment = async () => {
    if (!comment.trim() || !user || sending) return;

    setSending(true);
    try {
      await addDoc(commentsColRef, {
        text: comment.trim(),
        userId: user.uid,
        userName: user.displayName,
        userPhoto: user.photoURL,
        timestamp: serverTimestamp(),
      });
      setComment('');
    } catch (error) {
      console.error("Error sending comment:", error);
      // TODO: Show toast error
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader title="التعليقات" onBack={goBack} canGoBack={canGoBack} actions={headerActions} />
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          ))
        ) : comments.length > 0 ? (
          comments.map((c, index) => (
            <div key={index} className="flex items-start gap-3">
              <Avatar>
                <AvatarImage src={c.userPhoto} />
                <AvatarFallback>{c.userName?.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 rounded-lg bg-card border p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-semibold text-sm">{c.userName}</p>
                  {c.timestamp && (
                     <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(c.timestamp.toDate(), { addSuffix: true, locale: ar })}
                     </p>
                  )}
                </div>
                <p className="text-sm text-foreground/90 whitespace-pre-wrap">{c.text}</p>
              </div>
            </div>
          ))
        ) : (
          <p className="text-center text-muted-foreground pt-8">لا توجد تعليقات بعد. كن أول من يعلق!</p>
        )}
        <div ref={commentsEndRef} />
      </div>

      <div className="sticky bottom-0 bg-background border-t p-4">
        <div className="flex items-start gap-2">
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="اكتب تعليقك..."
            className="flex-1 bg-card border-none focus-visible:ring-1 focus-visible:ring-ring"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendComment();
              }
            }}
          />
          <Button onClick={handleSendComment} disabled={sending || !comment.trim()} size="icon">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
