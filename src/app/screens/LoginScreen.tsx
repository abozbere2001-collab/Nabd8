
"use client";
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { GoalStackLogo } from '@/components/icons/GoalStackLogo';
import { ScreenHeader } from '@/components/ScreenHeader';
import type { ScreenProps } from '@/app/page';
import { GoogleIcon } from '@/components/icons/GoogleIcon';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Loader2 } from 'lucide-react';
import { signInWithGoogle, handleNewUser } from '@/lib/firebase-client';
import { useFirestore } from '@/firebase/provider';


export function LoginScreen({ goBack }: ScreenProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { db } = useFirestore();

  const handleAuthError = (e: any) => {
    console.error("Login Error:", e);
    // User-friendly error messages based on error codes
    if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') {
        setError('تم إلغاء عملية تسجيل الدخول.');
    } else if (e.code === 'auth/unauthorized-domain' || e.code === 'auth/operation-not-allowed') {
        setError('النطاق غير مصرح به. يرجى التأكد من إضافة نطاق التطبيق إلى قائمة النطاقات المصرح بها في إعدادات Firebase Authentication.');
    } else if (e.code === 'auth/account-exists-with-different-credential') {
        setError('يوجد حساب بنفس البريد الإلكتروني ولكن بطريقة تسجيل دخول مختلفة.');
    } else {
        setError(e.message || 'حدث خطأ أثناء محاولة تسجيل الدخول. يرجى المحاولة مرة أخرى.');
    }
  }

  const handleGoogleLogin = async () => {
    if (loading || !db) return;
    setLoading(true);
    setError(null);
    try {
      const user = await signInWithGoogle();
      await handleNewUser(user, db);
      // The onAuthStateChanged listener in the provider will handle app state change.
    } catch (e: any) {
      handleAuthError(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader title="تسجيل الدخول" onBack={goBack} canGoBack={false} />
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        {error && (
          <Alert variant="destructive" className="mb-6 text-right">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>خطأ في تسجيل الدخول</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <GoalStackLogo className="h-24 w-24 mb-8" />
        <h1 className="text-2xl font-bold mb-2">مرحباً بك في Goal Stack</h1>
        <p className="text-muted-foreground mb-8">سجل دخولك باستخدام جوجل للمتابعة.</p>
        
        <div className="w-full max-w-xs space-y-4">
            <Button 
              onClick={handleGoogleLogin} 
              className="w-full" 
              disabled={loading}
              size="lg"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <GoogleIcon className="h-5 w-5 mr-2" />
              )}
              تسجيل الدخول باستخدام جوجل
            </Button>
        </div>

        <p className="mt-8 text-xs text-muted-foreground/80 px-4">
          بالنقر على "تسجيل الدخول"، أنت توافق على شروط الخدمة وسياسة الخصوصية الخاصة بنا.
        </p>
      </div>
    </div>
  );
}
