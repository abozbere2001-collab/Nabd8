
"use client";

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { BottomNav } from '@/components/BottomNav';
import { MatchesScreen } from './screens/MatchesScreen';
import { CompetitionsScreen } from './screens/CompetitionsScreen';
import { AllCompetitionsScreen } from './screens/AllCompetitionsScreen';
import { IraqScreen } from './screens/IraqScreen';
import { NewsScreen } from './screens/NewsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { CompetitionDetailScreen } from './screens/CompetitionDetailScreen';
import { TeamDetailScreen } from './screens/TeamDetailScreen';
import { PlayerDetailScreen } from './screens/PlayerDetailScreen';
import { AdminFavoriteTeamScreen } from './screens/AdminFavoriteTeamScreen';
import { CommentsScreen } from './screens/CommentsScreen';
import { NotificationsScreen } from './screens/NotificationsScreen';
import { GlobalPredictionsScreen } from './screens/GlobalPredictionsScreen';
import { AdminMatchSelectionScreen } from './screens/AdminMatchSelectionScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { SeasonPredictionsScreen } from './screens/SeasonPredictionsScreen';
import { SeasonTeamSelectionScreen } from './screens/SeasonTeamSelectionScreen';
import { SeasonPlayerSelectionScreen } from './screens/SeasonPlayerSelectionScreen';
import { AddEditNewsScreen } from './screens/AddEditNewsScreen';
import { ManageTopScorersScreen } from './screens/ManageTopScorersScreen';
import { ManagePinnedMatchScreen } from './screens/ManagePinnedMatchScreen';
import { MatchDetailScreen } from './screens/MatchDetailScreen';
import { LoginScreen } from './screens/LoginScreen';
import { NotificationSettingsScreen } from './screens/NotificationSettingsScreen';
import { GeneralSettingsScreen } from './screens/GeneralSettingsScreen';
import PrivacyPolicyScreen from './privacy-policy/page';
import TermsOfServiceScreen from './terms-of-service/page';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { GoProScreen } from './screens/GoProScreen';
import type { ScreenKey } from './page';

import { useAd, SplashScreenAd, BannerAd } from '@/components/AdProvider';
import { useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LogOut, User as UserIcon } from 'lucide-react';
import { signOut } from '@/lib/firebase-client';
import { cn } from '@/lib/utils';
import { LanguageProvider, useTranslation } from '@/components/LanguageProvider';

const screenConfig: Record<string, { component: React.ComponentType<any>;}> = {
  Matches: { component: MatchesScreen },
  Competitions: { component: CompetitionsScreen },
  AllCompetitions: { component: AllCompetitionsScreen },
  Iraq: { component: IraqScreen },
  News: { component: NewsScreen },
  Settings: { component: SettingsScreen },
  CompetitionDetails: { component: CompetitionDetailScreen },
  TeamDetails: { component: TeamDetailScreen },
  PlayerDetails: { component: PlayerDetailScreen },
  AdminFavoriteTeamDetails: { component: AdminFavoriteTeamScreen },
  Comments: { component: CommentsScreen },
  Notifications: { component: NotificationsScreen },
  GlobalPredictions: { component: GlobalPredictionsScreen },
  AdminMatchSelection: { component: AdminMatchSelectionScreen },
  Profile: { component: ProfileScreen },
  SeasonPredictions: { component: SeasonPredictionsScreen },
  SeasonTeamSelection: { component: SeasonTeamSelectionScreen },
  SeasonPlayerSelection: { component: SeasonPlayerSelectionScreen },
  AddEditNews: { component: AddEditNewsScreen },
  ManageTopScorers: { component: ManageTopScorersScreen },
  ManagePinnedMatch: { component: ManagePinnedMatchScreen },
  MatchDetails: { component: MatchDetailScreen },
  Login: { component: LoginScreen },
  SignUp: { component: LoginScreen },
  NotificationSettings: { component: NotificationSettingsScreen },
  GeneralSettings: { component: GeneralSettingsScreen },
  PrivacyPolicy: { component: PrivacyPolicyScreen },
  TermsOfService: { component: TermsOfServiceScreen },
  Welcome: { component: WelcomeScreen },
  GoPro: { component: GoProScreen },
};


const mainTabs: ScreenKey[] = ['Matches', 'Competitions', 'Iraq', 'News', 'Settings'];

type StackItem = {
  key: string;
  screen: ScreenKey;
  props?: Record<string, any>;
};

export const ProfileButton = () => {
    const { user } = useUser();
    const { t } = useTranslation();

    const handleSignOut = async () => {
        await signOut();
    };
    
    const navigateToProfile = () => {
        if ((window as any).appNavigate) {
            (window as any).appNavigate('Profile');
        }
    };


    if (!user || user.isAnonymous) return null;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                        <AvatarImage src={user.photoURL || ''} alt={user.displayName || ''} />
                        <AvatarFallback>{user.displayName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user.displayName}</p>
                        <p className="text-xs leading-none text-muted-foreground">
                            {user.email}
                        </p>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={navigateToProfile}>
                    <UserIcon className="mr-2 h-4 w-4" />
                    <span>{t('profile')}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>{t('log_out')}</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};


export function AppContentWrapper() {
  const [navigationState, setNavigationState] = useState<{ activeTab: ScreenKey, stacks: Record<string, StackItem[]> }>({
    activeTab: 'Matches',
    stacks: {
        'Matches': [{ key: 'Matches-0', screen: 'Matches' }],
        'Competitions': [{ key: 'Competitions-0', screen: 'Competitions' }],
        'Iraq': [{ key: 'Iraq-0', screen: 'Iraq' }],
        'News': [{ key: 'News-0', screen: 'News' }],
        'Settings': [{ key: 'Settings-0', screen: 'Settings' }],
    },
  });

  const { showSplashAd, showBannerAd } = useAd();
  
  const goBack = useCallback(() => {
    setNavigationState(prevState => {
        const currentStack = prevState.stacks[prevState.activeTab];
        if (currentStack.length > 1) {
            return {
                ...prevState,
                stacks: {
                    ...prevState.stacks,
                    [prevState.activeTab]: currentStack.slice(0, -1),
                }
            };
        }
        if (!mainTabs.includes(prevState.activeTab)) {
            return { ...prevState, activeTab: 'Matches' };
        }
        return prevState;
    });
  }, []);

  const navigate = useCallback((screen: ScreenKey, props?: Record<string, any>) => {
    const newKey = `${screen}-${Date.now()}`;
    const newItem = { key: newKey, screen, props };

    setNavigationState(prevState => {
        const newStacks = { ...prevState.stacks };

        if (mainTabs.includes(screen)) {
            // If navigating to a main tab, switch active tab and reset its stack
            newStacks[screen] = [newItem];
            return { activeTab: screen, stacks: newStacks };
        } else {
            // If navigating to a detail screen, push it onto the current active stack
            const currentStack = newStacks[prevState.activeTab] || [];
            newStacks[prevState.activeTab] = [...currentStack, newItem];
            return { activeTab: prevState.activeTab, stacks: newStacks };
        }
    });
  }, []);
  
  useEffect(() => {
      if (typeof window !== 'undefined') {
          (window as any).appNavigate = navigate;
      }
  }, [navigate]);

  if (showSplashAd) {
    return <SplashScreenAd />;
  }
  
  const activeStack = navigationState.stacks[navigationState.activeTab] || [];

  return (
    <LanguageProvider>
        <main className="h-screen w-screen bg-background flex flex-col">
        <div className="relative flex-1 flex flex-col overflow-hidden">
            {Object.entries(navigationState.stacks).map(([tabKey, stack]) => {
                if (stack.length === 0) return null;
                const isActiveTab = navigationState.activeTab === tabKey;
            
                return (
                    <div key={tabKey} className={cn("absolute inset-0 flex flex-col", isActiveTab ? "z-10" : "-z-10")}>
                        {stack.map((stackItem, index) => {
                            const isVisible = isActiveTab && index === stack.length - 1;
                            const Component = screenConfig[stackItem.screen]?.component;
                            if (!Component) return null;
                            
                            const screenProps = {
                                ...stackItem.props,
                                navigate,
                                goBack,
                                canGoBack: stack.length > 1,
                                isVisible,
                            };

                            return (
                                <div key={stackItem.key} className={cn("absolute inset-0 flex flex-col transition-transform duration-300", 
                                    isVisible ? "z-10 transform-none" : "z-0 -translate-x-full"
                                )}>
                                    <Component {...screenProps} />
                                </div>
                            )
                        })}
                    </div>
                )
            })}
        </div>
        
        {showBannerAd && <BannerAd />}
        {mainTabs.includes(navigationState.activeTab) && <BottomNav activeScreen={navigationState.activeTab} onNavigate={(screen) => navigate(screen)} />}
        </main>
    </LanguageProvider>
  );
}
