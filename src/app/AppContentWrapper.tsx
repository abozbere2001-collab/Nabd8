
"use client";

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { BottomNav } from '@/components/BottomNav';
import { MatchesScreen } from './screens/MatchesScreen';
import { CompetitionsScreen } from './screens/CompetitionsScreen';
import { IraqScreen } from './screens/IraqScreen';
import { NewsScreen } from './screens/NewsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { CompetitionDetailScreen } from './screens/CompetitionDetailScreen';
import { TeamDetailScreen } from './screens/TeamDetailScreen';
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
import { MatchDetailScreen } from './screens/MatchDetailScreen';
import { cn } from '@/lib/utils';
import { LoginScreen } from './screens/LoginScreen';
import type { ScreenKey } from './page';

import { useAuth } from '@/firebase/provider';
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

const screenConfig: Record<string, { component: React.ComponentType<any>;}> = {
  Matches: { component: MatchesScreen },
  Competitions: { component: CompetitionsScreen },
  Iraq: { component: IraqScreen },
  News: { component: NewsScreen },
  Settings: { component: SettingsScreen },
  CompetitionDetails: { component: CompetitionDetailScreen },
  TeamDetails: { component: TeamDetailScreen },
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
  MatchDetails: { component: MatchDetailScreen },
  Login: { component: LoginScreen },
  SignUp: { component: LoginScreen },
};


const mainTabs: ScreenKey[] = ['Matches', 'Competitions', 'Iraq', 'News', 'Settings'];

type StackItem = {
  key: string;
  screen: ScreenKey;
  props?: Record<string, any>;
};

export const ProfileButton = () => {
    const { user } = useAuth();

    const handleSignOut = async () => {
        await signOut();
    };
    
    const navigateToProfile = () => {
        // This is a placeholder. The actual navigation is handled by the parent component.
        // We'll call a prop passed down for navigation.
        // For now, we find the AppContentWrapper's navigate function on the window.
        if ((window as any).appNavigate) {
            (window as any).appNavigate('Profile');
        }
    };


    if (!user) return null;

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
                    <span>الملف الشخصي</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>تسجيل الخروج</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};


export function AppContentWrapper() {
  const [stack, setStack] = useState<StackItem[]>([{ key: 'Matches-0', screen: 'Matches' }]);

  const goBack = useCallback(() => {
    if (stack.length > 1) {
      setStack(prev => prev.slice(0, -1));
    }
  }, [stack.length]);

  const navigate = useCallback((screen: ScreenKey, props?: Record<string, any>) => {
    const isMainTab = mainTabs.includes(screen);
    const newKey = `${screen}-${Date.now()}`;
    const newItem = { key: newKey, screen, props };

    setStack(prevStack => {
      if (isMainTab) {
        // If it's a main tab, reset the stack to just this tab.
        return [newItem];
      } else {
        // Otherwise, push the new screen onto the stack.
        return [...prevStack, newItem];
      }
    });
  }, []);
  
  useEffect(() => {
      if (typeof window !== 'undefined') {
          (window as any).appNavigate = navigate;
      }
  }, [navigate]);


  const activeStackItem = stack[stack.length - 1];
  const ActiveScreenComponent = screenConfig[activeStackItem.screen]?.component;
  const showBottomNav = mainTabs.includes(activeStackItem.screen);

  if (!ActiveScreenComponent) {
    return (
        <div className="flex items-center justify-center h-screen bg-background">
          <p>شاشة غير موجودة: {activeStackItem.screen}</p>
        </div>
    );
  }
  
  const screenProps = {
    ...activeStackItem.props,
    navigate,
    goBack,
    canGoBack: stack.length > 1,
  };


  return (
    <main className="h-screen w-screen bg-background flex flex-col">
      <div className="relative flex-1 flex flex-col overflow-hidden">
        {stack.map((item, index) => {
          const ScreenComponent = screenConfig[item.screen]?.component;
          const isVisible = index === stack.length - 1;
          
          if (!ScreenComponent) return null;

          return (
            <div
              key={item.key}
              className={cn(
                'absolute inset-0 bg-background flex flex-col',
                { 'z-10': isVisible, 'z-0': !isVisible }
              )}
              style={{
                 transform: isVisible ? 'translateX(0)' : 'translateX(100%)',
                 transition: 'transform 0.3s ease-in-out',
                 // Render only the top 2 screens for performance
                 display: index < stack.length - 2 ? 'none' : 'flex'
              }}
            >
              <ScreenComponent {...item.props} {...screenProps} isVisible={isVisible} />
            </div>
          );
        })}
      </div>
      
      {showBottomNav && <BottomNav activeScreen={activeStackItem.screen} onNavigate={navigate} />}
    </main>
  );
}
