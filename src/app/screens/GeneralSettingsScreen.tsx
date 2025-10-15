
"use client";

import React from 'react';
import { useTheme } from "next-themes";
import type { ScreenProps } from '@/app/page';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Sun, Moon, Laptop, Gem, UserCog, Languages, Crown } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useAuth, useAdmin } from '@/firebase/provider';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/components/LanguageProvider';

export function GeneralSettingsScreen({ navigate, goBack, canGoBack, headerActions }: ScreenProps) {
  const { theme, setTheme } = useTheme();
  const { isProUser, setProUser } = useAuth();
  const { isAdmin, makeAdmin } = useAdmin();
  const { toast } = useToast();
  const { t, setLanguage, language } = useTranslation();

  const handleMakeAdmin = async () => {
    await makeAdmin();
    toast({
        title: t('upgrade_success_title'),
        description: t('upgrade_success_desc'),
    });
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader title={t('general_settings')} onBack={goBack} canGoBack={canGoBack} actions={headerActions} />
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Sun className="h-6 w-6" />
              <div>
                <CardTitle>{t('appearance')}</CardTitle>
                <CardDescription>{t('appearance_desc')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <RadioGroup value={theme} onValueChange={setTheme} className="grid grid-cols-3 gap-2 sm:gap-4">
              <Label htmlFor="light" className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer">
                <RadioGroupItem value="light" id="light" className="sr-only" />
                <Sun className="mb-2 h-5 w-5" />
                {t('light')}
              </Label>
              <Label htmlFor="dark" className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer">
                <RadioGroupItem value="dark" id="dark" className="sr-only" />
                <Moon className="mb-2 h-5 w-5" />
                {t('dark')}
              </Label>
              <Label htmlFor="system" className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer">
                <RadioGroupItem value="system" id="system" className="sr-only" />
                <Laptop className="mb-2 h-5 w-5" />
                {t('system')}
              </Label>
            </RadioGroup>
          </CardContent>
        </Card>
        
        <Card>
            <CardHeader>
                <div className="flex items-center gap-3">
                    <Languages className="h-6 w-6" />
                    <div>
                        <CardTitle>{t('app_language')}</CardTitle>
                        <CardDescription>{t('app_language_desc')}</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex gap-4">
                <Button variant={language === 'ar' ? 'default' : 'outline'} className="flex-1" onClick={() => setLanguage('ar')}>العربية</Button>
                <Button variant={language === 'en' ? 'default' : 'outline'} className="flex-1" onClick={() => setLanguage('en')}>English</Button>
            </CardContent>
        </Card>

        <Card>
           <CardHeader>
                <div className="flex items-center gap-3">
                    <UserCog className="h-6 w-6" />
                    <div>
                        <CardTitle>{t('account_settings')}</CardTitle>
                        <CardDescription>{t('account_settings_desc')}</CardDescription>
                    </div>
                </div>
            </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center space-x-3 space-x-reverse">
                <Gem className="text-primary h-5 w-5" />
                <Label htmlFor="pro-mode" className="font-bold">{t('pro_version')}</Label>
              </div>
              <Switch id="pro-mode" checked={isProUser} onCheckedChange={(checked) => setProUser(checked)} />
            </div>
             {!isAdmin && (
                <Button onClick={handleMakeAdmin} className="w-full">
                    <Crown className="ml-2 h-4 w-4" />
                    {t('upgrade_to_admin')}
                </Button>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
