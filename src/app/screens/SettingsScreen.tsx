

"use client";

import { useEffect, useState } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Bell, LogOut, User, Search, Trophy, Settings as SettingsIcon, FileText, FileBadge } from 'lucide-react';
import type { ScreenProps } from '@/app/page';
import { useToast } from '@/hooks/use-toast';
import { signOut as firebaseSignOut } from '@/lib/firebase-client';
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
import { useAuth, useAdmin } from '@/firebase/provider';
import { Separator } from '@/components/ui/separator';
import { useTranslation } from '@/components/LanguageProvider';

export function SettingsScreen({ navigate, goBack, canGoBack }: ScreenProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  
  const mainSettingsItems = [
      { label: t('profile'), icon: User, action: (navigate: ScreenProps['navigate']) => navigate('Profile') },
      { label: t('all_competitions'), icon: Trophy, action: (navigate: ScreenProps['navigate']) => navigate('AllCompetitions') },
      { label: t('notifications'), icon: Bell, action: (navigate: ScreenProps['navigate']) => navigate('Notifications') },
      { label: t('general_settings'), icon: SettingsIcon, action: (navigate: ScreenProps['navigate']) => navigate('GeneralSettings')},
  ];

  const legalSettingsItems = [
      { label: t('privacy_policy'), icon: FileBadge, action: (navigate: ScreenProps['navigate']) => navigate('PrivacyPolicy') },
      { label: t('terms_of_service'), icon: FileText, action: (navigate: ScreenProps['navigate']) => navigate('TermsOfService') },
  ];

  const handleSignOut = async () => {
    try {
      await firebaseSignOut();
      toast({
        title: t('signed_out_title'),
        description: t('signed_out_desc'),
      });
      // The onAuthStateChanged listener in Home will handle navigation
    } catch (error) {
       toast({
        variant: 'destructive',
        title: t('sign_out_failed_title'),
        description: t('sign_out_failed_desc'),
      });
    }
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader 
        title={t('more')} 
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
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        
        <div className="space-y-2">
            {mainSettingsItems.map(item => (
                <button key={item.label} onClick={() => item.action(navigate)} className="flex w-full items-center justify-between rounded-lg bg-card p-4 text-right transition-colors hover:bg-accent/50">
                    <div className="flex items-center gap-4">
                        <item.icon className="h-6 w-6 text-primary"/>
                        <span className="font-medium">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <ChevronLeft className="h-5 w-5"/>
                    </div>
                </button>
            ))}
        </div>

        <div className="pt-4">
            <p className="px-4 pb-2 text-sm font-semibold text-muted-foreground">{t('legal')}</p>
            <div className="space-y-2">
                {legalSettingsItems.map(item => (
                    <button key={item.label} onClick={() => item.action(navigate)} className="flex w-full items-center justify-between rounded-lg bg-card p-4 text-right transition-colors hover:bg-accent/50">
                        <div className="flex items-center gap-4">
                            <item.icon className="h-6 w-6 text-muted-foreground"/>
                            <span className="font-medium">{item.label}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <ChevronLeft className="h-5 w-5"/>
                        </div>
                    </button>
                ))}
            </div>
        </div>


        <div className="pt-8">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full gap-2">
                  <LogOut className="h-5 w-5" />
                  {t('log_out')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('are_you_sure')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('log_out_confirm_desc')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={handleSignOut}>{t('continue')}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
        </div>
      </div>
    </div>
  );
}
