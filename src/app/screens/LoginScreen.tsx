

"use client";
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { GoalStackLogo } from '@/components/icons/GoalStackLogo';
import { ScreenHeader } from '@/components/ScreenHeader';
import type { ScreenProps } from '@/app/page';
import { GoogleIcon } from '@/components/icons/GoogleIcon';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Loader2 } from 'lucide-react';
import { signInWithGoogle, setGuestUser, checkRedirectResult } from '@/lib/firebase-client';

export function LoginScreen({ navigate, goBack, canGoBack }: ScreenProps) {
  const [loading, setLoading] = useState(false);
  const [authInProgress, setAuthInProgress] = useState(true); // To handle redirect state
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkRedirectResult()
      .then((err) => {
        if (err) {
          if (err.message.includes('auth/popup-closed-by-user') || err.message.includes('auth/cancelled-popup-request')) {
              setError('تم إلغاء عملية تسجيل الدخول.');
          } else {
              setError('حدث خطأ أثناء محاولة تسجيل الدخول. يرجى المحاولة مرة أخرى.');
          }
        }
        // If no error, onAuthStateChanged listener will handle the successful login.
      })
      .finally(() => {
        setAuthInProgress(false);
      });
  }, []);

  const handleGoogleLogin = async () => {
    if (loading || authInProgress) return;
    setLoading(true);
    setAuthInProgress(true);
    setError(null);
    try {
      await signInWithGoogle();
      // After calling signInWithRedirect, the page will reload.
      // We show a loading state until that happens.
    } catch (e: any) {
      console.error("Login Error:", e);
      setError('حدث خطأ أثناء محاولة تسجيل الدخول. يرجى المحاولة مرة أخرى.');
      setLoading(false);
      setAuthInProgress(false);
    }
  };

  const handleSkip = () => {
    setGuestUser();
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader title="تسجيل الدخول" onBack={goBack} canGoBack={false} />
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        {authInProgress ? (
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-muted-foreground">جاري التحقق من المصادقة...</p>
            </div>
        ) : (
          <>
            {error && (
              <Alert variant="destructive" className="mb-6">
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
                  {loading ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        جاري التحقق...
                    </>
                  ) : (
                    <>
                      <GoogleIcon className="h-5 w-5 mr-2" />
                      تسجيل الدخول باستخدام جوجل
                    </>
                  )}
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
