
"use client";

import React, { useState, useEffect } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Heart, MessageSquare, CornerDownRight, Newspaper, Goal } from 'lucide-react';
import type { ScreenProps } from '@/app/page';
import { useAuth, useFirestore } from '@/firebase/provider';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, limit } from 'firebase/firestore';
import type { Notification } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';

const NotificationIcon = ({ type }: { type: Notification['type'] }) => {
    switch (type) {
        case 'like':
            return <Heart className="h-5 w-5 text-red-500 fill-current" />;
        case 'reply':
            return <CornerDownRight className="h-5 w-5 text-blue-500" />;
        case 'goal':
            return <Goal className="h-5 w-5 text-green-500" />;
        case 'news':
            return <Newspaper className="h-5 w-5 text-orange-500" />;
        default:
            return <MessageSquare className="h-5 w-5 text-gray-500" />;
    }
};

export function NotificationsScreen({ navigate, goBack, canGoBack, headerActions }: ScreenProps) {
  const { user } = useAuth();
  const { db } = useFirestore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !db) {
      setLoading(false);
      return;
    }

    const notifsRef = collection(db, 'users', user.uid, 'notifications');
    const q = query(notifsRef, orderBy('timestamp', 'desc'), limit(50));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedNotifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
      setNotifications(fetchedNotifications);
      setLoading(false);
    }, (error) => {
        const permissionError = new FirestorePermissionError({
            path: notifsRef.path,
            operation: 'list',
        });
        errorEmitter.emit('permission-error', permissionError);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [user, db]);

  const handleNotificationClick = async (notification: Notification) => {
    if (!user || !notification.id || !db) return;
    
    // Mark as read
    if (!notification.read) {
        const notifDocRef = doc(db, 'users', user.uid, 'notifications', notification.id);
        updateDoc(notifDocRef, { read: true }).catch(serverError => {
             const permissionError = new FirestorePermissionError({
                path: notifDocRef.path,
                operation: 'update',
                requestResourceData: { read: true }
            });
            errorEmitter.emit('permission-error', permissionError);
        });
    }

    // Navigate to comments screen
    navigate('Comments', { matchId: notification.matchId });
  };
  
  const getNotificationText = (notification: Notification) => {
      let baseText = 'لديك إشعار جديد';
      switch (notification.type) {
        case 'like':
            baseText = 'أعجب بتعليقك:';
            break;
        case 'reply':
            baseText = 'رد على تعليقك:';
            break;
        case 'goal':
             baseText = 'سجل هدفاً!';
             break;
        case 'news':
            baseText = 'خبر جديد:';
            break;
      }
      
      const commentText = notification.commentText ? (
           ` "${notification.commentText.length > 30 ? `${notification.commentText.substring(0, 30)}...` : notification.commentText}"`
      ) : '';


      return (
        <p className="text-sm">
          <span className="font-bold">{notification.senderName}</span>
          {' '}
          {baseText}
          <span className="text-muted-foreground italic">
            {commentText}
          </span>
        </p>
      );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader title="الإشعارات" onBack={goBack} canGoBack={canGoBack} actions={headerActions} />
      
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 space-y-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-3">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length > 0 ? (
          <ul className="divide-y divide-border">
            {notifications.map((notif) => (
              <li
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className={cn(
                  "p-4 flex items-start gap-4 hover:bg-accent cursor-pointer transition-colors",
                  !notif.read && "bg-primary/5"
                )}
              >
                <div className="relative">
                    <Avatar className="h-10 w-10 border">
                        <AvatarImage src={notif.senderPhoto} />
                        <AvatarFallback>{notif.senderName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5">
                        <NotificationIcon type={notif.type} />
                    </div>
                </div>

                <div className="flex-1">
                  {getNotificationText(notif)}
                  <p className="text-xs text-muted-foreground mt-1">
                    {notif.timestamp ? formatDistanceToNow(notif.timestamp.toDate(), { addSuffix: true, locale: ar }) : ''}
                  </p>
                </div>
                {!notif.read && <div className="h-2.5 w-2.5 rounded-full bg-primary mt-1 self-center"></div>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-center text-muted-foreground pt-16">لا توجد إشعارات لعرضها.</p>
        )}
      </div>
    </div>
  );
}
