
"use client";

import React from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import type { ScreenProps } from '@/app/page';

export function NotificationsScreen({ navigate, goBack, canGoBack }: ScreenProps) {
  
  // This screen will be used to display a list of actual notifications (e.g., goals, match starts, comments).
  // The logic for managing notification *settings* has been moved to NotificationSettingsScreen.

  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader title="الإشعارات" onBack={goBack} canGoBack={canGoBack} />
      <div className="flex-1 overflow-y-auto flex items-center justify-center">
        <p className="text-center text-muted-foreground p-8">
            لا توجد إشعارات حاليًا. <br/>
            سيتم عرض إشعارات المباريات والأهداف هنا.
        </p>
      </div>
    </div>
  );
}
