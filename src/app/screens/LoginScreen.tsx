"use client";
import React, { useEffect, useState } from 'react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getClientAuth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { GoalStackLogo } from '@/components/icons/GoalStackLogo';
import { ScreenHeader } from '@/components/ScreenHeader';
import type { ScreenProps } from '@/app/page';
import { GoogleIcon } from '@/components/icons/GoogleIcon';

export function LoginScreen({ navigate, goBack, canGoBack }: ScreenProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    console.log("LoginScreen init");
    return () => console.log("LoginScreen unmount (should not happen with keep-alive)");
  }, []);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const auth = getClientAuth();
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      toast({ title: "تم تسجيل الدخول بنجاح" });
      // The main page component will detect the auth change and switch the stack
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: "خطأ في تسجيل الدخول",
        description: error.code === 'auth/popup-closed-by-user' 
          ? 'تم إغلاق نافذة تسجيل الدخول.' 
          : error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader title="تسجيل الدخول" onBack={goBack} canGoBack={canGoBack} />
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        <GoalStackLogo className="h-24 w-24 mb-8" />
        <h1 className="text-2xl font-bold mb-2">مرحباً بك في Goal Stack</h1>
        <p className="text-muted-foreground mb-8">سجل دخولك باستخدام جوجل للمتابعة.</p>
        
        <Button 
          onClick={handleGoogleLogin} 
          className="w-full max-w-xs" 
          disabled={loading}
          size="lg"
        >
          {loading ? (
            'جاري تسجيل الدخول...'
          ) : (
            <>
              <GoogleIcon className="h-5 w-5 mr-2" />
              تسجيل الدخول باستخدام جوجل
            </>
          )}
        </Button>

        <p className="mt-8 text-xs text-muted-foreground/80 px-4">
          بالنقر على "تسجيل الدخول"، أنت توافق على شروط الخدمة وسياسة الخصوصية الخاصة بنا.
        </p>
      </div>
    </div>
  );
}
