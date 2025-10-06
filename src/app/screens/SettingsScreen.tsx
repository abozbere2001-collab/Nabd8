"use client";

import { useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Moon, Sun, Languages, Bell, LogOut } from 'lucide-react';
import type { ScreenProps } from '@/app/page';
import { Separator } from '@/components/ui/separator';

const settingsItems = [
  { label: 'المظهر', icon: Sun, detail: 'فاتح' },
  { label: 'اللغة', icon: Languages, detail: 'العربية' },
  { label: 'الإشعارات', icon: Bell, detail: 'مفعلة' },
]

export function SettingsScreen({ navigate, goBack, canGoBack }: ScreenProps) {
  useEffect(() => {
    console.log("SettingsScreen init");
    return () => console.log("SettingsScreen unmount (should not happen with keep-alive)");
  }, []);

  const handleSignOut = async () => {
    await signOut(auth);
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader title="الإعدادات" onBack={goBack} canGoBack={canGoBack} />
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-2">
            {settingsItems.map(item => (
                 <button key={item.label} className="flex w-full items-center justify-between rounded-lg bg-card p-4 text-right transition-colors hover:bg-accent/50">
                     <div className="flex items-center gap-4">
                        <item.icon className="h-6 w-6 text-primary"/>
                        <span className="font-medium">{item.label}</span>
                     </div>
                     <div className="flex items-center gap-2 text-muted-foreground">
                        <span>{item.detail}</span>
                        <ChevronLeft className="h-5 w-5"/>
                     </div>
                 </button>
            ))}
        </div>
        <Separator className="my-8" />
        <Button variant="destructive" className="w-full gap-2" onClick={handleSignOut}>
            <LogOut className="h-5 w-5" />
            تسجيل الخروج
        </Button>
      </div>
    </div>
  );
}
