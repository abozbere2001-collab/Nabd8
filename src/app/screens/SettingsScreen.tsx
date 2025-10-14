

"use client";

import { useEffect, useState } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Moon, Sun, Languages, Bell, LogOut, User, Search, Goal, Redo, XCircle, Newspaper, Crown } from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuth, useFirestore, useAdmin } from '@/firebase/provider';
import { doc, setDoc } from 'firebase/firestore';


const notificationSettings = [
    { id: 'match-start', label: 'بداية المباراة', description: 'تنبيه عند انطلاق أي مباراة مهمة.', icon: Bell },
    { id: 'match-end', label: 'نهاية المباراة', description: 'تنبيه عند انتهاء المباريات بنتائجها النهائية.', icon: Bell },
    { id: 'goals', label: 'الأهداف', description: 'تنبيه فوري عند تسجيل هدف.', icon: Goal },
    { id: 'red-cards', label: 'البطاقات الحمراء', description: 'تنبيه عند إشهار بطاقة حمراء.', icon: XCircle },
    { id: 'penalties', label: 'ركلات الجزاء', description: 'تنبيه عند احتساب أو تسجيل ركلة جزاء.', icon: Redo },
    { id: 'news', label: 'الأخبار العاجلة', description: 'تنبيهات للأخبار والمقالات المهمة.', icon: Newspaper },
];

export function SettingsScreen({ navigate, goBack, canGoBack }: ScreenProps) {
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const { user, isProUser, setProUser } = useAuth();
  const { isAdmin, makeAdmin } = useAdmin();
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // In a real app, you would fetch these preferences from Firestore.
    // For now, we'll initialize them all to true for demonstration.
    const initialPrefs = notificationSettings.reduce((acc, item) => {
        acc[item.id] = true;
        return acc;
    }, {} as Record<string, boolean>);
    setNotifPrefs(initialPrefs);
  }, []);
  
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

  const handleNotifChange = (id: string, checked: boolean) => {
      setNotifPrefs(prev => ({...prev, [id]: checked}));
      // In a real app, you would save this preference to Firestore here.
      toast({
          title: `تم ${checked ? 'تفعيل' : 'إلغاء'} إشعارات "${notificationSettings.find(s => s.id === id)?.label}"`,
      })
  }
  
  const handleUpgrade = async () => {
    if(!user) return;
    // In a real app, this would trigger a payment flow.
    // For now, we'll just simulate the upgrade.
    await setProUser(true);
    toast({
        title: 'تمت الترقية بنجاح!',
        description: 'شكراً لك! لقد تم إخفاء جميع الإعلانات.',
    })
  }

  const settingsItems = [
    { label: 'الملف الشخصي', icon: User, detail: '', action: () => navigate('Profile') },
    { label: 'اللغة', icon: Languages, detail: 'العربية', action: () => {} },
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
              <ProfileButton/>
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        
        {!isAdmin && (
             <Button onClick={makeAdmin} className="w-full bg-amber-600 hover:bg-amber-700">
                (للتجربة) ترقية إلى مدير
            </Button>
        )}

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
        
        {!isProUser && !isAdmin && (
        <Card className="border-primary/50">
            <CardHeader>
                <CardTitle className="flex items-center gap-3 text-primary">
                    <Crown className="h-6 w-6" />
                    <span>الترقية إلى النسخة برو</span>
                </CardTitle>
                <CardDescription>
                    احصل على تجربة خالية من الإعلانات تمامًا وادعم تطوير التطبيق.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Button onClick={handleUpgrade} className="w-full">الترقية الآن</Button>
            </CardContent>
        </Card>
        )}
        
        {isAdmin && !isProUser && (
            <Button onClick={handleUpgrade} className="w-full">
                (Admin) الترقية إلى برو
            </Button>
        )}
        
        {isAdmin && isProUser && (
            <Button onClick={() => setProUser(false)} variant="destructive" className="w-full">
                (Admin) إيقاف وضع البرو
            </Button>
        )}
        
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5 text-primary" />
                    إعدادات الإشعارات
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
                 {notificationSettings.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 rounded-md hover:bg-accent/50">
                        <div className="flex items-start gap-3">
                            <item.icon className="h-5 w-5 mt-1 text-muted-foreground" />
                            <div>
                                <label htmlFor={item.id} className="font-medium cursor-pointer">{item.label}</label>
                                <p className="text-xs text-muted-foreground">{item.description}</p>
                            </div>
                        </div>
                        <Switch
                            id={item.id}
                            checked={notifPrefs[item.id] || false}
                            onCheckedChange={(checked) => handleNotifChange(item.id, checked)}
                        />
                    </div>
                 ))}
            </CardContent>
        </Card>
        
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
