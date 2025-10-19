
"use client";
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { NabdAlMalaebLogo } from '@/components/icons/NabdAlMalaebLogo';
import type { ScreenProps } from '@/app/page';
import { GoogleIcon } from '@/components/icons/GoogleIcon';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Loader2, User } from 'lucide-react';
import { signInWithGoogle, handleNewUser, signInAnonymously } from '@/lib/firebase-client';
import { useFirestore } from '@/firebase/provider';


export function LoginScreen({ goBack }: ScreenProps) {
  const [loading, setLoading] = useState<null | 'google' | 'visitor'>(null);
  const [error, setError] = useState<string | null>(null);
  const { db } = useFirestore();

  const handleAuthError = (e: any) => {
    console.error("Login Error:", e);
    
    let errorMessage = e.message || 'حدث خطأ أثناء محاولة تسجيل الدخول. يرجى المحاولة مرة أخرى.';

    if (e.code === 'auth/unauthorized-domain') {
        errorMessage = `النطاق الذي تستخدمه غير مصرح به. يرجى إضافته إلى قائمة النطاقات المصرح بها في إعدادات Firebase Authentication.`;
    } else if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') {
        errorMessage = 'تم إلغاء عملية تسجيل الدخول.';
    } else if (e.code === 'auth/account-exists-with-different-credential') {
        errorMessage = 'يوجد حساب بنفس البريد الإلكتروني ولكن بطريقة تسجيل دخول مختلفة.';
    }
    
    setError(errorMessage);
    setLoading(null);
  }

  const handleGoogleLogin = async () => {
    if (loading || !db) return;
    setLoading('google');
    setError(null);
    try {
      const user = await signInWithGoogle();
      if (user) {
        await handleNewUser(user, db);
      }
    } catch (e: any) {
      handleAuthError(e);
    }
  };

  const handleVisitorLogin = async () => {
    if (loading || !db) return;
    setLoading('visitor');
    setError(null);
    try {
        const user = await signInAnonymously();
        if (user) {
            await handleNewUser(user, db);
        }
    } catch (e: any) {
        handleAuthError(e);
    }
  }


  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        {error && (
          <Alert variant="destructive" className="mb-6 text-right">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>خطأ في تسجيل الدخول</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <NabdAlMalaebLogo className="h-24 w-24 mb-4" />
        <h1 className="text-3xl font-bold mb-2 font-headline text-primary">أهلاً بك في نبض الملاعب</h1>
        <p className="text-muted-foreground mb-8">اختر طريقة الدخول للمتابعة.</p>
        
        <div className="w-full max-w-xs space-y-4">
            <Button 
              onClick={handleGoogleLogin} 
              className="w-full" 
              disabled={!!loading}
              size="lg"
            >
              {loading === 'google' ? (
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <GoogleIcon className="h-5 w-5 mr-2" />
              )}
              المتابعة باستخدام جوجل
            </Button>
            <Button onClick={handleVisitorLogin} variant="secondary" className="w-full" disabled={!!loading} size="lg">
                {loading === 'visitor' ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <User className="h-5 w-5 mr-2" />}
                المتابعة كزائر
            </Button>
        </div>

        <p className="mt-8 text-xs text-muted-foreground/80 px-4">
          بالاستمرار، أنت توافق على 
          <button className="underline hover:text-primary px-1" onClick={() => (window as any).appNavigate && (window as any).appNavigate('TermsOfService')}>شروط الخدمة</button> 
          و 
          <button className="underline hover:text-primary px-1" onClick={() => (window as any).appNavigate && (window as any).appNavigate('PrivacyPolicy')}>سياسة الخصوصية</button>
          .
        </p>
      </div>
    </div>
  );
}
