"use client";
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { GoalStackLogo } from '@/components/icons/GoalStackLogo';
import { ScreenHeader } from '@/components/ScreenHeader';
import type { ScreenProps } from '@/app/page';
import { GoogleIcon } from '@/components/icons/GoogleIcon';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export function LoginScreen({ navigate, goBack, canGoBack }: ScreenProps) {
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      // On successful sign-in, AuthProvider handles navigation.
      // The component will unmount, so no need to setLoading(false).
    } catch (e: any) {
      console.error("Login Error:", e);
      // This specific error code can happen when the popup is closed by browser/environment events
      // like resizing the window. It's often not a "real" user cancellation.
      // We'll ignore it to prevent showing a disruptive error message on resize.
      if (e.code === 'auth/popup-closed-by-user') {
        setLoading(false); // Reset the button to be clickable again
        return; // Exit without setting an error message
      }

      let errorMessage = 'حدث خطأ أثناء تسجيل الدخول. يرجى المحاولة مرة أخرى.';
      setError(errorMessage);
      setLoading(false); // Allow the user to try again
    }
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader title="تسجيل الدخول" onBack={goBack} canGoBack={canGoBack} />
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>خطأ في تسجيل الدخول</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
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
