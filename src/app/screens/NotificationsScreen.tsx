
"use client";

import React, { useEffect, useState } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import type { ScreenProps } from '@/app/page';
import { useAuth, useFirestore } from '@/firebase/provider';
import { collection, query, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import type { Notification } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, BellOff, MessageSquare, Heart } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';

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
    setLoading(true);
    const notificationsRef = collection(db, 'users', user.uid, 'notifications');
    const q = query(notificationsRef, orderBy('timestamp', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedNotifications = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Notification));
        setNotifications(fetchedNotifications);
        setLoading(false);
    }, (error) => {
        const permissionError = new FirestorePermissionError({
            path: `users/${user.uid}/notifications`,
            operation: 'list',
        });
        errorEmitter.emit('permission-error', permissionError);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [user, db]);

  const handleNotificationClick = (notification: Notification) => {
    if (notification.id && user && db && !notification.read) {
      const notifRef = doc(db, 'users', user.uid, 'notifications', notification.id);
      updateDoc(notifRef, { read: true }).catch(error => {
         const permissionError = new FirestorePermissionError({
            path: notifRef.path,
            operation: 'update',
            requestResourceData: { read: true }
        });
        errorEmitter.emit('permission-error', permissionError);
      });
    }

    if (notification.type === 'reply' || notification.type === 'like') {
        navigate('Comments', { matchId: notification.matchId });
    }
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'reply':
        return <MessageSquare className="h-5 w-5 text-blue-500" />;
      case 'like':
        return <Heart className="h-5 w-5 text-red-500" />;
      default:
        return <BellOff className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const renderNotificationText = (notification: Notification) => {
    switch (notification.type) {
      case 'reply':
        return (
          <p>
            <span className="font-bold">{notification.senderName}</span> رد على تعليقك:
            <span className="text-muted-foreground italic"> "{notification.commentText}"</span>
          </p>
        );
      case 'like':
        return (
          <p>
            <span className="font-bold">{notification.senderName}</span> أعجب بتعليقك:
            <span className="text-muted-foreground italic"> "{notification.commentText}"</span>
          </p>
        );
      default:
        return <p>إشعار جديد</p>;
    }
  };

  if (loading) {
    return (
      <div className="flex h-full flex-col bg-background">
        <ScreenHeader title="الإشعارات" onBack={goBack} canGoBack={canGoBack} />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader title="الإشعارات" onBack={goBack} canGoBack={canGoBack} actions={headerActions}/>
      <div className="flex-1 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-8">
            <BellOff className="h-12 w-12 mb-4" />
            <p className="text-lg font-bold">لا توجد إشعارات حاليًا</p>
            <p className="text-sm">سيتم عرض التفاعلات مع تعليقاتك هنا.</p>
          </div>
        ) : (
          <div className="divide-y">
            {notifications.map(notification => (
              <div
                key={notification.id}
                className={cn(
                  "flex items-start gap-4 p-4 cursor-pointer transition-colors hover:bg-accent/50",
                  !notification.read && "bg-primary/5"
                )}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="relative">
                    <Avatar>
                      <AvatarImage src={notification.senderPhoto} />
                      <AvatarFallback>{notification.senderName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 bg-background p-0.5 rounded-full">
                        {getNotificationIcon(notification.type)}
                    </div>
                </div>

                <div className="flex-1 text-sm">
                  {renderNotificationText(notification)}
                  <p className="text-xs text-muted-foreground mt-1">
                    {notification.timestamp ? formatDistanceToNow(notification.timestamp.toDate(), { addSuffix: true, locale: ar }) : ''}
                  </p>
                </div>
                 {!notification.read && (
                    <div className="w-2.5 h-2.5 bg-primary rounded-full self-center"></div>
                 )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
