"use client";

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Bell } from 'lucide-react';
import type { ScreenKey, ScreenProps } from '@/app/page';
import { useAuth, useFirestore } from '@/firebase/provider';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import type { Notification } from '@/lib/types';


interface NotificationsButtonProps {
  navigate: (screen: ScreenKey, props?: Record<string, any>) => void;
}

export function NotificationsButton({ navigate }: NotificationsButtonProps) {
  const { user } = useAuth();
  const { db } = useFirestore();
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    if (!user) return;

    const notifsRef = collection(db, 'users', user.uid, 'notifications');
    const q = query(notifsRef, where('read', '==', false));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setHasUnread(!snapshot.empty);
    });

    return () => unsubscribe();
  }, [user, db]);

  return (
    <Button variant="ghost" size="icon" onClick={() => navigate('Notifications')}>
      <div className="relative">
        <Bell className="h-5 w-5" />
        {hasUnread && (
          <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-background" />
        )}
      </div>
    </Button>
  );
}

    