

"use client";

import { useEffect } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Moon, Sun, Languages, Bell, LogOut, User, Search } from 'lucide-react';
import type { ScreenProps } from '@/app/page';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { signOut as firebaseSignOut } from '@/lib/firebase-client';
import { useTheme } from "next-themes";
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
import { SearchSheet } from '@/components/SearchSheet';
import { ProfileButton } from '../AppContentWrapper';


export function SettingsScreen({ navigate, goBack, canGoBack }: ScreenProps) {
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  
  const handleSignOut = async () => {
    try {
      await firebaseSignOut();
      toast({
        title: "تم تسجيل الخروج",
        description: "نأمل رؤيتك مرة أخرى قريبا.",
      });
      // The onAuthStateChanged listener in Home will handle navigation
    } catch (error) {
       toast({
        variant: 'destructive',
        title: "فشل تسجيل الخروج",
        description: "حدث خطأ أثناء تسجيل الخروج. يرجى المحاولة مرة أخرى.",
      });
    }
  };

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  const settingsItems = [
    { label: 'الملف الشخصي', icon: User, detail: '', action: () => navigate('Profile') },
    { label: 'اللغة', icon: Languages, detail: 'العربية', action: () => {} },
    { label: 'الإشعارات', icon: Bell, detail: '', action: () => navigate('Notifications') },
  ]


  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader 
        title="الإعدادات" 
        onBack={goBack} 
        canGoBack={canGoBack} 
        actions={
          <div className="flex items-center gap-1">
              <SearchSheet navigate={navigate}>
                  <Button variant="ghost" size="icon">
                      <Search className="h-5 w-5" />
                  </Button>
              </SearchSheet>
              <ProfileButton onProfileClick={() => navigate('Profile')} />
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-2">
            <button onClick={toggleTheme} className="flex w-full items-center justify-between rounded-lg bg-card p-4 text-right transition-colors hover:bg-accent/50">
               <div className="flex items-center gap-4">
                  {theme === 'light' ? <Sun className="h-6 w-6 text-primary"/> : <Moon className="h-6 w-6 text-primary"/>}
                  <span className="font-medium">المظهر</span>
               </div>
               <div className="flex items-center gap-2 text-muted-foreground">
                  <span>{theme === 'light' ? 'فاتح' : 'داكن'}</span>
                  <ChevronLeft className="h-5 w-5"/>
               </div>
           </button>
            {settingsItems.map(item => (
                 <button key={item.label} onClick={item.action} className="flex w-full items-center justify-between rounded-lg bg-card p-4 text-right transition-colors hover:bg-accent/50">
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
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="w-full gap-2">
              <LogOut className="h-5 w-5" />
              تسجيل الخروج
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
              <AlertDialogDescription>
                سيؤدي هذا الإجراء إلى تسجيل خروجك من حسابك.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction onClick={handleSignOut}>متابعة</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
