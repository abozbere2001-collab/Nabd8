
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Send, MoreVertical, Edit, Trash2 } from 'lucide-react';
import type { ScreenProps } from '@/app/page';
import { useAuth, useFirestore } from '@/firebase/provider';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import type { MatchComment } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
} from "@/components/ui/alert-dialog"

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

  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

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
    if (!editingCommentId) {
        commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comments, editingCommentId]);

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
    } finally {
      setSending(false);
    }
  };

  const handleEditClick = (c: MatchComment) => {
    if (!c.id) return;
    setEditingCommentId(c.id);
    setEditingText(c.text);
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditingText('');
  };

  const handleUpdateComment = async () => {
    if (!editingCommentId || !editingText.trim() || sending) return;
    setSending(true);
    const commentDocRef = doc(db, 'matches', String(matchId), 'comments', editingCommentId);
    try {
      await updateDoc(commentDocRef, {
        text: editingText.trim(),
      });
      handleCancelEdit();
    } catch (error) {
      console.error("Error updating comment:", error);
    } finally {
      setSending(false);
    }
  };
  
  const handleDeleteComment = async (commentId: string) => {
    setIsDeleting(commentId);
    try {
      const commentDocRef = doc(db, 'matches', String(matchId), 'comments', commentId);
      await deleteDoc(commentDocRef);
    } catch(error) {
      console.error("Error deleting comment:", error);
    } finally {
      setIsDeleting(null);
    }
  }

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
          comments.map((c) => (
            <div key={c.id} className="flex items-start gap-3">
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
                {editingCommentId === c.id ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      className="bg-background"
                      autoFocus
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={handleCancelEdit}>إلغاء</Button>
                      <Button size="sm" onClick={handleUpdateComment} disabled={sending}>
                        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'حفظ'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-foreground/90 whitespace-pre-wrap">{c.text}</p>
                )}
              </div>
              {user && user.uid === c.userId && !editingCommentId && (
                <AlertDialog>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEditClick(c)}>
                        <Edit className="ml-2 h-4 w-4" />
                        <span>تعديل</span>
                      </DropdownMenuItem>
                      <AlertDialogTrigger asChild>
                         <DropdownMenuItem className="text-destructive">
                           <Trash2 className="ml-2 h-4 w-4" />
                           <span>حذف</span>
                         </DropdownMenuItem>
                      </AlertDialogTrigger>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>هل أنت متأكد من الحذف؟</AlertDialogTitle>
                      <AlertDialogDescription>
                        لا يمكن التراجع عن هذا الإجراء. سيتم حذف تعليقك بشكل نهائي.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>إلغاء</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive hover:bg-destructive/90"
                        onClick={() => c.id && handleDeleteComment(c.id)}
                      >
                        {isDeleting === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "حذف"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          ))
        ) : (
          <p className="text-center text-muted-foreground pt-8">لا توجد تعليقات بعد. كن أول من يعلق!</p>
        )}
        <div ref={commentsEndRef} />
      </div>

      {!editingCommentId && (
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
      )}
    </div>
  );
}
