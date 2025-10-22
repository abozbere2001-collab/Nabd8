
"use client";
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { NabdAlMalaebLogo } from '@/components/icons/NabdAlMalaebLogo';
import { GoogleIcon } from '@/components/icons/GoogleIcon';
import { GoogleAuthProvider, signInWithRedirect, signInAnonymously } from 'firebase/auth';
import { auth } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

export function WelcomeScreen() {
  const { toast } = useToast();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isGuestLoading, setIsGuestLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithRedirect(auth, provider);
      // The redirect will navigate the user away. 
      // The result is handled by getRedirectResult in the Home component.
    } catch (e) {
      console.error("Login Error:", e);
      toast({
        variant: 'destructive',
        title: 'خطأ في تسجيل الدخول',
        description: 'لم نتمكن من بدء عملية تسجيل الدخول. يرجى المحاولة مرة أخرى.',
      });
      setIsGoogleLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setIsGuestLoading(true);
    try {
        await signInAnonymously(auth);
        // onAuthStateChanged will handle the rest.
    } catch(e) {
        console.error("Anonymous login error:", e);
        toast({
            variant: 'destructive',
            title: 'خطأ',
            description: 'فشل تسجيل الدخول كزائر. يرجى المحاولة مرة أخرى.',
        });
        setIsGuestLoading(false);
    }
  }

  const isLoading = isGoogleLoading || isGuestLoading;

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        <NabdAlMalaebLogo className="h-24 w-24 mb-4" />
        <h1 className="text-3xl font-bold mb-2 font-headline text-primary">أهلاً بك في نبض الملاعب</h1>
        <p className="text-muted-foreground mb-8">عالم كرة القدم بين يديك. سجل الدخول لمزامنة مفضلاتك، أو تصفح كزائر.</p>
        
        <div className="w-full max-w-xs space-y-4">
            <Button 
              onClick={handleGoogleLogin} 
              className="w-full" 
              size="lg"
              disabled={isLoading}
            >
              {isGoogleLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <GoogleIcon className="h-5 w-5 mr-2" />
                  المتابعة باستخدام جوجل
                </>
              )}
            </Button>
            <Button
                variant="ghost"
                onClick={handleGuestLogin}
                className="w-full"
                disabled={isLoading}
            >
               {isGuestLoading ? <Loader2 className="h-5 w-5 animate-spin"/> : 'تصفح كزائر'}
            </Button>
        </div>

        <p className="mt-8 text-xs text-muted-foreground/80 px-4">
          بالاستمرار، أنت توافق على شروط الخدمة و سياسة الخصوصية.
        </p>
      </div>
    </div>
  );
}
