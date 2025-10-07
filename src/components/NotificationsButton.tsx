"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Bell } from 'lucide-react';
import type { ScreenKey } from '@/app/page';

interface NotificationsButtonProps {
  navigate: (screen: ScreenKey, props?: Record<string, any>) => void;
}

export function NotificationsButton({ navigate }: NotificationsButtonProps) {
  return (
    <Button variant="ghost" size="icon" onClick={() => navigate('Notifications')}>
      <div className="relative">
        <Bell className="h-5 w-5" />
      </div>
    </Button>
  );
}
