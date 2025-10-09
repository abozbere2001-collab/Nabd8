
"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Send, MoreVertical, Edit, Trash2, CornerDownRight, Heart } from 'lucide-react';
import type { ScreenProps } from '@/app/page';
import { useAuth, useFirestore } from '@/firebase/provider';
import { collection, addDoc, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, writeBatch, getDocs, setDoc, limit } from 'firebase/firestore';
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from '@/lib/utils';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';

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
    onSend: (text: string, parentId?: string | null) => Promise<void>,
    initialText?: string,
    isReply?: boolean,
    onCancel?: () => void,
    autoFocus?: boolean,
}) => {
    const [text, setText] = useState(initialText);

    const handleSend = async () => {
        if (!text.trim()) return;
        // The parentId logic is handled by the main component's onSend function
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
    onDelete: (commentId: string) => void,
    onLike: (commentId: string) => void,
    isDeleting: string | null,
    isEditing: boolean,
    onUpdate: () => void,
    onCancelEdit: () => void,
    sending: boolean,
    editingText: string,
    setEditingText: (text: string) => void,
    children: React.ReactNode,
}) => {
    const hasLiked = user && comment.likes?.some(like => like.id === user.uid);
    
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
                  {formatDistanceToNow(comment.timestamp.toDate(), { addSuffix: true, locale: ar })}
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
                <Button variant="ghost" size="sm" onClick={() => onLike(comment.id!)}>
                    <Heart className={cn("w-4 h-4 ml-1", hasLiked ? "text-red-500 fill-current" : "text-muted-foreground")} />
                    <span className="text-xs">{comment.likes?.length || 0}</span>
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
                    onClick={() => comment.id && onDelete(comment.id)}
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
  const { db } = useFirestore();
  const [comments, setComments] = useState<MatchComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  const commentsColRef = useMemo(() => {
      if (!db || !matchId) return null;
      return collection(db, 'matches', String(matchId), 'comments');
  }, [db, matchId]);
  
  useEffect(() => {
    if (!user || !commentsColRef) {
        setLoading(false);
        setComments([]);
        return;
    }

    setLoading(true);
    // Fetch the last 20 comments in descending order, then reverse them on the client.
    const q = query(commentsColRef, orderBy('timestamp', 'desc'), limit(20));
    
    const unsubscribe = onSnapshot(q, async (snapshot) => {
        const commentPromises = snapshot.docs.map(async (doc) => {
            const commentData = { id: doc.id, ...doc.data() } as MatchComment;
            
            const repliesRef = collection(db, 'matches', String(matchId), 'comments', doc.id, 'replies');
            const repliesQuery = query(repliesRef, orderBy('timestamp', 'asc'));
            const repliesSnapshot = await getDocs(repliesQuery);
            const replies = repliesSnapshot.docs.map(replyDoc => ({ id: replyDoc.id, ...replyDoc.data() } as MatchComment));

            const likesRef = collection(db, 'matches', String(matchId), 'comments', doc.id, 'likes');
            const likesSnapshot = await getDocs(likesRef);
            const likes = likesSnapshot.docs.map(likeDoc => ({ id: likeDoc.id, ...likeDoc.data() } as Like));

            const repliesWithLikes = await Promise.all(replies.map(async (reply) => {
                if (!reply.id) return reply;
                const replyLikesRef = collection(db, 'matches', String(matchId), 'comments', doc.id, 'replies', reply.id, 'likes');
                const replyLikesSnapshot = await getDocs(replyLikesRef);
                const replyLikes = replyLikesSnapshot.docs.map(likeDoc => ({ id: likeDoc.id, ...likeDoc.data() } as Like));
                return { ...reply, likes: replyLikes };
            }));

            return {
                ...commentData,
                replies: repliesWithLikes,
                likes
            };
        });

        try {
            const resolvedComments = await Promise.all(commentPromises);
            // Reverse the array to show the oldest of the last 20 comments first.
            setComments(resolvedComments.reverse());
        } catch(error) {
            // This could be a permission error on subcollections
            const permissionError = new FirestorePermissionError({
                path: `${commentsColRef.path}/...`, // Indicative path
                operation: 'list',
            });
            errorEmitter.emit('permission-error', permissionError);
        } finally {
            setLoading(false);
        }

    }, (error) => {
        if (!user) return;
        const permissionError = new FirestorePermissionError({
            path: commentsColRef.path,
            operation: 'list',
        });
        errorEmitter.emit('permission-error', permissionError);
        setLoading(false);
    });

    return () => {
        unsubscribe();
    };

  }, [user, commentsColRef, db, matchId]);


  useEffect(() => {
    if (!editingCommentId && !replyingTo) {
        commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comments, editingCommentId, replyingTo]);

  const handleSendComment = async (text: string) => {
    if (!text.trim() || !user || sending || !commentsColRef || !db) return;
  
    setSending(true);
    
    const parentId = replyingTo;

    const newCommentData = {
      text: text.trim(),
      userId: user.uid,
      userName: user.displayName,
      userPhoto: user.photoURL,
      timestamp: new Date(),
      parentId: parentId || null,
    };
    
    const collectionRef = parentId 
        ? collection(db, 'matches', String(matchId), 'comments', parentId, 'replies')
        : commentsColRef;

    addDoc(collectionRef, newCommentData)
    .then((newDocRef) => {
        if (parentId) {
            const parentComment = comments.find(c => c.id === parentId);
            if (parentComment && parentComment.userId !== user.uid) {
                const notificationsCollectionRef = collection(db, 'users', parentComment.userId, 'notifications');
                const notificationData = {
                    recipientId: parentComment.userId,
                    senderId: user.uid,
                    senderName: user.displayName,
                    senderPhoto: user.photoURL,
                    type: 'reply' as 'reply' | 'like',
                    matchId: matchId,
                    commentId: parentId,
                    commentText: text.trim(),
                    read: false,
                    timestamp: new Date(),
                };
                addDoc(notificationsCollectionRef, notificationData)
                .catch((serverError) => {
                     const permissionError = new FirestorePermissionError({
                        path: notificationsCollectionRef.path,
                        operation: 'create',
                        requestResourceData: notificationData
                    });
                    errorEmitter.emit('permission-error', permissionError);
                });
            }
        }
        if (replyingTo) {
            setReplyingTo(null);
        }
    })
    .catch((serverError) => {
        const permissionError = new FirestorePermissionError({
            path: collectionRef.path,
            operation: 'create',
            requestResourceData: newCommentData,
        });
        errorEmitter.emit('permission-error', permissionError);
    }).finally(() => {
      setSending(false);
    });
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

  const handleUpdateComment = () => {
    if (!editingCommentId || !editingText.trim() || sending || !db) return;
    setSending(true);
    
    let commentDocRef;
    
    const parentComment = comments.find(c => c.replies.some(r => r.id === editingCommentId));
    if (parentComment && parentComment.id) {
        commentDocRef = doc(db, 'matches', String(matchId), 'comments', parentComment.id, 'replies', editingCommentId);
    } else {
        commentDocRef = doc(db, 'matches', String(matchId), 'comments', editingCommentId);
    }

    const updatedData = { text: editingText.trim() };
    
    updateDoc(commentDocRef, updatedData)
    .then(() => {
      handleCancelEdit();
    })
    .catch((serverError) => {
        const permissionError = new FirestorePermissionError({
            path: commentDocRef.path,
            operation: 'update',
            requestResourceData: updatedData,
        });
        errorEmitter.emit('permission-error', permissionError);
    })
    .finally(() => {
      setSending(false);
    });
  };
  
  const handleDeleteComment = (commentId: string) => {
    if (!db) return;
    setIsDeleting(commentId);

    const batchDelete = async () => {
        const batch = writeBatch(db);

        let isTopLevel = true;
        let parentCommentId: string | undefined = undefined;

        const parentComment = comments.find(c => c.replies.some(r => r.id === commentId));
        if (parentComment && parentComment.id) {
            isTopLevel = false;
            parentCommentId = parentComment.id;
        }
        
        const commentRef = isTopLevel 
            ? doc(db, 'matches', String(matchId), 'comments', commentId)
            : doc(db, 'matches', String(matchId), 'comments', parentCommentId!, 'replies', commentId);

        const likesRef = collection(commentRef, 'likes');
        const repliesRef = collection(commentRef, 'replies'); 
        
        const likesSnapshot = await getDocs(likesRef);
        likesSnapshot.forEach(doc => batch.delete(doc.ref));

        if (isTopLevel) {
            const repliesSnapshot = await getDocs(repliesRef);
            repliesSnapshot.forEach(doc => batch.delete(doc.ref));
        }

        batch.delete(commentRef);
        await batch.commit();
    };

    batchDelete()
    .catch((serverError) => {
        const permissionError = new FirestorePermissionError({
            path: `matches/${matchId}/comments/...`, // Indicative path
            operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
    })
    .finally(() => {
        setIsDeleting(null);
    });
  }

  const handleLikeComment = (commentId: string) => {
    if (!user || !db) return;

    let parentCommentId: string | null = null;
    let originalComment: MatchComment | null = null;

    for (const parent of comments) {
        if (parent.id === commentId) {
            originalComment = parent;
            break;
        }
        const reply = parent.replies.find(r => r.id === commentId);
        if (reply && parent.id) {
            parentCommentId = parent.id;
            originalComment = reply;
            break;
        }
    }

    if (!originalComment) return;

    const likeRef = parentCommentId
        ? doc(db, 'matches', String(matchId), 'comments', parentCommentId, 'replies', commentId, 'likes', user.uid)
        : doc(db, 'matches', String(matchId), 'comments', commentId, 'likes', user.uid);

    const hasLiked = originalComment.likes?.some(like => like.id === user.uid);
    const likeData = { userId: user.uid };

    const originalComments = comments; 
    setComments(prevComments => prevComments.map(p => {
        const updateCommentLikes = (c: MatchComment): MatchComment => {
            if (c.id === commentId) {
                 const currentLikes = c.likes || [];
                 const newLikes = hasLiked
                    ? currentLikes.filter(l => l.id !== user.uid)
                    : [...currentLikes, { id: user.uid, userId: user.uid }];
                return { ...c, likes: newLikes };
            }
            if (c.replies && c.replies.length > 0) {
                 return { ...c, replies: c.replies.map(updateCommentLikes) };
            }
            return c;
        };
        return updateCommentLikes(p);
    }));

    const operation = hasLiked ? deleteDoc(likeRef) : setDoc(likeRef, likeData);

    operation.then(() => {
        if (!hasLiked && originalComment && originalComment.userId !== user.uid) {
            const notificationsCollectionRef = collection(db, 'users', originalComment.userId, 'notifications');
            const notificationData = {
                recipientId: originalComment.userId,
                senderId: user.uid,
                senderName: user.displayName,
                senderPhoto: user.photoURL,
                type: 'like' as 'like' | 'reply',
                matchId: matchId,
                commentId: commentId,
                commentText: originalComment.text,
                read: false,
                timestamp: new Date(),
            };
            addDoc(notificationsCollectionRef, notificationData).catch((serverError) => {
                 const permissionError = new FirestorePermissionError({
                    path: notificationsCollectionRef.path,
                    operation: 'create',
                    requestResourceData: notificationData
                });
                errorEmitter.emit('permission-error', permissionError);
            });
        }
    }).catch((serverError) => {
        setComments(originalComments); 
        
        const permissionError = new FirestorePermissionError({
            path: likeRef.path,
            operation: hasLiked ? 'delete' : 'create',
            requestResourceData: hasLiked ? undefined : likeData
        });
        errorEmitter.emit('permission-error', permissionError);
    });
  };

  const renderCommentTree = (comment: MatchComment, parentId: string | null = null) => (
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
                    onSend={(text) => handleSendComment(text)}
                    isReply={true}
                    onCancel={() => setReplyingTo(null)}
                    autoFocus
                />
            )}
            
            {comment.replies && comment.replies.length > 0 && (
                <div className="mt-4 space-y-4">
                    {comment.replies.map(reply => renderCommentTree(reply, comment.id))}
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
