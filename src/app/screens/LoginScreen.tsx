
"use client";
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { GoalStackLogo } from '@/components/icons/GoalStackLogo';
import { ScreenHeader } from '@/components/ScreenHeader';
import type { ScreenProps } from '@/app/page';
import { GoogleIcon } from '@/components/icons/GoogleIcon';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Loader2 } from 'lucide-react';
import { signInWithGoogle, setGuestUser } from '@/lib/firebase-client';

export function LoginScreen({ goBack }: ScreenProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuthError = (e: any) => {
    console.error("Login Error:", e);
     if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') {
        setError('تم إلغاء عملية تسجيل الدخول.');
    } else if (e.code === 'auth/unauthorized-domain') {
        setError('النطاق غير مصرح به. يرجى التأكد من إضافة نطاق التطبيق إلى قائمة النطاقات المصرح بها في إعدادات Firebase Authentication.');
    } else {
        setError('حدث خطأ أثناء محاولة تسجيل الدخول. يرجى المحاولة مرة أخرى.');
    }
  }

  const handleGoogleLogin = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      // On success, the onAuthStateChanged listener in FirebaseProvider will handle the state update.
      // We don't need to do anything here. The loader will be visible until the state changes.
    } catch (e: any) {
      handleAuthError(e);
      setLoading(false); // Only stop loading on error, on success the component will unmount.
    }
  };

  const handleSkip = () => {
    setGuestUser();
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader title="تسجيل الدخول" onBack={goBack} canGoBack={false} />
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        {loading ? (
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-muted-foreground">جاري تسجيل الدخول...</p>
            </div>
        ) : (
          <>
            {error && (
              <Alert variant="destructive" className="mb-6 text-right">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>خطأ في تسجيل الدخول</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <GoalStackLogo className="h-24 w-24 mb-8" />
            <h1 className="text-2xl font-bold mb-2">مرحباً بك في Goal Stack</h1>
            <p className="text-muted-foreground mb-8">سجل دخولك باستخدام جوجل للمتابعة أو تخطى للوصول السريع.</p>
            
            <div className="w-full max-w-xs space-y-4">
                <Button 
                  onClick={handleGoogleLogin} 
                  className="w-full" 
                  disabled={loading}
                  size="lg"
                >
                  <GoogleIcon className="h-5 w-5 mr-2" />
                  تسجيل الدخول باستخدام جوجل
                </Button>

                <Button 
                    onClick={handleSkip}
                    variant="link"
                    className="w-full"
                    disabled={loading}
                >
                    تخطي الآن
                </Button>
            </div>

            <p className="mt-8 text-xs text-muted-foreground/80 px-4">
              بالنقر على "تسجيل الدخول"، أنت توافق على شروط الخدمة وسياسة الخصوصية الخاصة بنا.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
