
"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Send, MoreVertical, Edit, Trash2, CornerDownRight, Heart } from 'lucide-react';
import type { ScreenProps } from '@/app/page';
import { useAuth, useFirebase } from '@/firebase/provider';
import { 
    getDatabase, 
    ref, 
    onValue, 
    push, 
    update, 
    remove, 
    serverTimestamp,
    query,
    orderByChild,
    limitToLast,
    runTransaction
} from "firebase/database";
import type { MatchComment, Like } from '@/lib/types';
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
} from "@/components/ui/alert-dialog";
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { collection, addDoc } from 'firebase/firestore';


interface CommentsScreenProps extends ScreenProps {
  matchId: number;
}


const CommentInput = ({
    user,
    sending,
    onSend,
    initialText = '',
    isReply = false,
    onCancel,
    autoFocus = false,
}: {
    user: any,
    sending: boolean,
    onSend: (text: string) => Promise<void>,
    initialText?: string,
    isReply?: boolean,
    onCancel?: () => void,
    autoFocus?: boolean,
}) => {
    const [text, setText] = useState(initialText);

    const handleSend = async () => {
        if (!text.trim()) return;
        await onSend(text);
        setText('');
    };

    return (
         <div className={cn("flex items-start gap-2", isReply ? 'mt-2' : 'sticky bottom-0 bg-background border-t p-4')}>
            {isReply && (
                <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.photoURL} />
                    <AvatarFallback>{user?.displayName?.charAt(0)}</AvatarFallback>
                </Avatar>
            )}
            <div className="flex-1 space-y-2">
                <Textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={isReply ? "اكتب ردك..." : "اكتب تعليقك..."}
                    className="flex-1 bg-card border-none focus-visible:ring-1 focus-visible:ring-ring"
                    rows={1}
                    autoFocus={autoFocus}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                        }
                    }}
                />
                 <div className="flex justify-end gap-2">
                    {onCancel && <Button variant="ghost" size="sm" onClick={onCancel}>إلغاء</Button>}
                    <Button onClick={handleSend} disabled={sending || !text.trim()} size={isReply ? "sm" : "icon"}>
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : isReply ? 'رد' : <Send className="h-4 w-4" />}
                    </Button>
                </div>
            </div>
        </div>
    );
};


const CommentItem = ({
    comment,
    user,
    onEdit,
    onDelete,
    onLike,
    isDeleting,
    isEditing,
    onUpdate,
    onCancelEdit,
    sending,
    editingText,
    setEditingText,
    children
}: {
    comment: MatchComment,
    user: any,
    onEdit: (comment: MatchComment) => void,
    onDelete: (commentId: string, parentId?: string) => void,
    onLike: (commentId: string, parentId?: string) => void,
    isDeleting: string | null,
    isEditing: boolean,
    onUpdate: () => void,
    onCancelEdit: () => void,
    sending: boolean,
    editingText: string,
    setEditingText: (text: string) => void,
    children: React.ReactNode,
}) => {
    const hasLiked = user && comment.likes && Object.keys(comment.likes).includes(user.uid);
    const likeCount = comment.likes ? Object.keys(comment.likes).length : 0;
    
    return (
        <div className="flex items-start gap-3">
          <Avatar>
            <AvatarImage src={comment.userPhoto} />
            <AvatarFallback>{comment.userName?.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 rounded-lg bg-card border p-3 w-full min-w-0">
            <div className="flex items-center justify-between mb-1">
              <p className="font-semibold text-sm">{comment.userName}</p>
              {comment.timestamp && (
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(comment.timestamp as number), { addSuffix: true, locale: ar })}
                </p>
              )}
            </div>
            {isEditing ? (
              <div className="space-y-2">
                <Textarea
                  value={editingText}
                  onChange={(e) => setEditingText(e.target.value)}
                  className="bg-background"
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={onCancelEdit}>إلغاء</Button>
                  <Button size="sm" onClick={onUpdate} disabled={sending}>
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'حفظ'}
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words">{comment.text}</p>
            )}
            
            <div className="flex items-center gap-2 mt-2 -mb-2 -ml-2">
               {children}
                <Button variant="ghost" size="sm" onClick={() => onLike(comment.id, comment.parentId)}>
                    <Heart className={cn("w-4 h-4 ml-1", hasLiked ? "text-red-500 fill-current" : "text-muted-foreground")} />
                    <span className="text-xs">{likeCount}</span>
                </Button>
            </div>
          </div>

          {user && user.uid === comment.userId && !isEditing && (
            <AlertDialog>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(comment)}>
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
                    لا يمكن التراجع عن هذا الإجراء. سيتم حذف تعليقك (وجميع الردود عليه) بشكل نهائي.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive hover:bg-destructive/90"
                    onClick={() => onDelete(comment.id, comment.parentId)}
                  >
                    {isDeleting === comment.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "حذف"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
    )
}


export function CommentsScreen({ matchId, goBack, canGoBack, headerActions }: CommentsScreenProps) {
  const { user } = useAuth();
  const { firebaseApp, firestore } = useFirebase();
  const [comments, setComments] = useState<MatchComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  const db = useMemo(() => firebaseApp ? getDatabase(firebaseApp) : null, [firebaseApp]);
  const commentsRef = useMemo(() => db ? ref(db, `match-comments/${matchId}`) : null, [db, matchId]);
  
  useEffect(() => {
    if (!commentsRef) {
        setLoading(false);
        setComments([]);
        return;
    }

    setLoading(true);
    const commentsQuery = query(commentsRef, orderByChild('timestamp'), limitToLast(50));
    
    const unsubscribe = onValue(commentsQuery, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            const commentsArray: MatchComment[] = Object.entries(data).map(([id, value]) => ({
                id,
                ...(value as Omit<MatchComment, 'id'>),
                replies: (value as MatchComment).replies 
                  ? Object.entries((value as MatchComment).replies).map(([replyId, replyValue]) => ({
                      id: replyId,
                      ...(replyValue as Omit<MatchComment, 'id'>)
                    }))
                  : []
            }));
            setComments(commentsArray);
        } else {
            setComments([]);
        }
        setLoading(false);
    }, (error) => {
        console.error("RTDB Error:", error);
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في تحميل التعليقات.'});
        setLoading(false);
    });

    return () => unsubscribe();
  }, [commentsRef, toast]);


  useEffect(() => {
    if (!editingCommentId && !replyingTo) {
        commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comments, editingCommentId, replyingTo]);

  const handleSendComment = async (text: string) => {
    if (!text.trim() || !user || sending || !db) return;
  
    setSending(true);
    
    const parentId = replyingTo;
    const path = parentId ? `match-comments/${matchId}/${parentId}/replies` : `match-comments/${matchId}`;
    const targetRef = ref(db, path);

    const newCommentData = {
      text: text.trim(),
      userId: user.uid,
      userName: user.displayName,
      userPhoto: user.photoURL,
      timestamp: serverTimestamp(),
      parentId: parentId || null,
    };
    
    try {
        await push(targetRef, newCommentData);
        if (parentId) {
            setReplyingTo(null);
            const parentComment = comments.find(c => c.id === parentId);
            if (parentComment && parentComment.userId !== user.uid && firestore) {
                 const notificationsCollectionRef = collection(firestore, 'users', parentComment.userId, 'notifications');
                 const notificationData = {
                    recipientId: parentComment.userId,
                    senderId: user.uid,
                    senderName: user.displayName,
                    senderPhoto: user.photoURL,
                    type: 'reply' as 'reply' | 'like',
                    matchId: matchId,
                    commentId: parentId,
                    commentText: parentComment.text,
                    read: false,
                    timestamp: new Date(),
                };
                await addDoc(notificationsCollectionRef, notificationData);
            }
        }
    } catch (error) {
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل إرسال التعليق.'});
    } finally {
      setSending(false);
    }
  };

  const handleEditClick = (c: MatchComment) => {
    if (!c.id) return;
    setEditingCommentId(c.id);
    setEditingText(c.text);
    setReplyingTo(null);
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditingText('');
  };
  
  const handleReplyClick = (commentId: string) => {
    setReplyingTo(replyingTo === commentId ? null : commentId);
    setEditingCommentId(null);
  }

  const handleUpdateComment = async () => {
    if (!editingCommentId || !editingText.trim() || sending || !db) return;
    setSending(true);
    
    const parentComment = comments.find(c => c.replies && c.replies.some(r => r.id === editingCommentId));
    const path = parentComment
        ? `match-comments/${matchId}/${parentComment.id}/replies/${editingCommentId}`
        : `match-comments/${matchId}/${editingCommentId}`;
    
    const commentRef = ref(db, path);
    const updatedData = { text: editingText.trim() };
    
    try {
        await update(commentRef, updatedData);
        handleCancelEdit();
    } catch(error) {
         toast({ variant: 'destructive', title: 'خطأ', description: 'فشل تحديث التعليق.'});
    } finally {
      setSending(false);
    }
  };
  
  const handleDeleteComment = async (commentId: string, parentId?: string) => {
    if (!db) return;
    setIsDeleting(commentId);

    const path = parentId ? `match-comments/${matchId}/${parentId}/replies/${commentId}` : `match-comments/${matchId}/${commentId}`;
    const commentRef = ref(db, path);
    try {
        await remove(commentRef);
    } catch(error) {
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حذف التعليق.'});
    } finally {
        setIsDeleting(null);
    }
  }

  const handleLikeComment = (commentId: string, parentId?: string) => {
    if (!user || !db) return;

    const path = parentId
        ? `match-comments/${matchId}/${parentId}/replies/${commentId}/likes/${user.uid}`
        : `match-comments/${matchId}/${commentId}/likes/${user.uid}`;
    
    const likeRef = ref(db, path);

    const comment = parentId 
        ? comments.find(c => c.id === parentId)?.replies.find(r => r.id === commentId)
        : comments.find(c => c.id === commentId);

    if (!comment) return;

    runTransaction(likeRef, (currentData) => {
        if (currentData) {
            // User has liked, so unlike
            return null;
        } else {
            // User has not liked, so like
            return { userId: user.uid, timestamp: serverTimestamp() };
        }
    }).then((transactionResult) => {
        if (transactionResult.committed && firestore) {
            const hasLiked = transactionResult.snapshot.exists();
             if (hasLiked && comment.userId !== user.uid) {
                const notificationsCollectionRef = collection(firestore, 'users', comment.userId, 'notifications');
                const notificationData = {
                    recipientId: comment.userId,
                    senderId: user.uid,
                    senderName: user.displayName,
                    senderPhoto: user.photoURL,
                    type: 'like' as 'like' | 'reply',
                    matchId: matchId,
                    commentId: commentId,
                    commentText: comment.text,
                    read: false,
                    timestamp: new Date(),
                };
                addDoc(notificationsCollectionRef, notificationData).catch(console.error);
            }
        }
    }).catch(error => {
         toast({ variant: 'destructive', title: 'خطأ', description: 'فشلت عملية الإعجاب.'});
    });
  };

  const renderCommentTree = (comment: MatchComment) => (
    <div key={comment.id}>
        <CommentItem
            comment={comment}
            user={user}
            onEdit={handleEditClick}
            onDelete={handleDeleteComment}
            onLike={handleLikeComment}
            isDeleting={isDeleting}
            isEditing={editingCommentId === comment.id}
            onUpdate={handleUpdateComment}
            onCancelEdit={handleCancelEdit}
            sending={sending && editingCommentId === comment.id}
            editingText={editingText}
            setEditingText={setEditingText}
        >
            <Button variant="ghost" size="sm" onClick={() => handleReplyClick(comment.id)}>
                <CornerDownRight className="w-3 h-3 ml-1" />
                رد
            </Button>
        </CommentItem>
        
        <div className="ml-8 mt-2 pl-4 border-r-2">
            {replyingTo === comment.id && (
                <CommentInput 
                    user={user}
                    sending={sending && !editingCommentId}
                    onSend={handleSendComment}
                    isReply={true}
                    onCancel={() => setReplyingTo(null)}
                    autoFocus
                />
            )}
            
            {comment.replies && comment.replies.length > 0 && (
                <div className="mt-4 space-y-4">
                    {comment.replies.map(reply => renderCommentTree(reply))}
                </div>
            )}
        </div>
    </div>
  );


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
          comments.map((c) => renderCommentTree(c))
        ) : (
          <p className="text-center text-muted-foreground pt-8">لا توجد تعليقات بعد. كن أول من يعلق!</p>
        )}
        <div ref={commentsEndRef} />
      </div>

      {!editingCommentId && !replyingTo && (
        <CommentInput user={user} sending={sending && !editingCommentId} onSend={handleSendComment} />
      )}
    </div>
  );
}

