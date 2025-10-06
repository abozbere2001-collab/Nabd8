"use client";
import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { GoalStackLogo } from '@/components/icons/GoalStackLogo';
import { ScreenHeader } from '@/components/ScreenHeader';
import type { ScreenProps } from '@/app/page';
import { GoogleIcon } from '@/components/icons/GoogleIcon';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from 'lucide-react';

export function LoginScreen({ navigate, goBack, canGoBack }: ScreenProps) {
  const [loading] = useState(false);
  const [error] = useState<string | null>("ميزة تسجيل الدخول معطلة مؤقتًا.");
  const { toast } = useToast();

  useEffect(() => {
    console.log("LoginScreen init");
    return () => console.log("LoginScreen unmount");
  }, []);

  const handleGoogleLogin = async () => {
    toast({
      variant: "destructive",
      title: "ميزة معطلة",
      description: "تسجيل الدخول معطل مؤقتًا.",
    });
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader title="تسجيل الدخول" onBack={goBack} canGoBack={canGoBack} />
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>ميزة معطلة</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <GoalStackLogo className="h-24 w-24 mb-8" />
        <h1 className="text-2xl font-bold mb-2">مرحباً بك في Goal Stack</h1>
        <p className="text-muted-foreground mb-8">سجل دخولك باستخدام جوجل للمتابعة.</p>
        
        <Button 
          onClick={handleGoogleLogin} 
          className="w-full max-w-xs" 
          disabled={true}
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
