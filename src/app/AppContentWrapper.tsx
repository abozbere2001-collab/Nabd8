
"use client";

import React, { useState, useCallback, useMemo } from 'react';
import { BottomNav } from '@/components/BottomNav';
import { MatchesScreen } from './screens/MatchesScreen';
import { CompetitionsScreen } from './screens/CompetitionsScreen';
import { IraqScreen } from './screens/IraqScreen';
import { NewsScreen } from './screens/NewsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { CompetitionDetailScreen } from './screens/CompetitionDetailScreen';
import { MatchDetailScreen } from './screens/MatchDetailScreen';
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
import { cn } from '@/lib/utils';
import { LoginScreen } from './screens/LoginScreen';
import { SearchSheet } from '@/components/SearchSheet';
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
import { ScreenHeader } from '@/components/ScreenHeader';

const screenConfig: Record<ScreenKey, { component: React.ComponentType<any>; title: string; }> = {
  Matches: { component: MatchesScreen, title: '' },
  Competitions: { component: CompetitionsScreen, title: 'البطولات' },
  Iraq: { component: IraqScreen, title: 'العراق' },
  News: { component: NewsScreen, title: 'الأخبار' },
  Settings: { component: SettingsScreen, title: 'الإعدادات' },
  CompetitionDetails: { component: CompetitionDetailScreen, title: 'تفاصيل البطولة' },
  MatchDetails: { component: MatchDetailScreen, title: 'تفاصيل المباراة' },
  TeamDetails: { component: TeamDetailScreen, title: 'تفاصيل الفريق' },
  AdminFavoriteTeamDetails: { component: AdminFavoriteTeamScreen, title: 'الفريق المفضل للمدير' },
  Comments: { component: CommentsScreen, title: 'التعليقات' },
  Notifications: { component: NotificationsScreen, title: 'الإشعارات' },
  GlobalPredictions: { component: GlobalPredictionsScreen, title: 'التوقعات' },
  AdminMatchSelection: { component: AdminMatchSelectionScreen, title: 'اختيار المباريات' },
  Profile: { component: ProfileScreen, title: 'الملف الشخصي' },
  SeasonPredictions: { component: SeasonPredictionsScreen, title: 'توقعات الموسم' },
  SeasonTeamSelection: { component: SeasonTeamSelectionScreen, title: 'اختيار الفريق' },
  SeasonPlayerSelection: { component: SeasonPlayerSelectionScreen, title: 'اختيار اللاعب' },
  Login: { component: LoginScreen, title: 'تسجيل الدخول'},
  SignUp: { component: LoginScreen, title: 'تسجيل'},
};


const mainTabs: ScreenKey[] = ['Matches', 'Competitions', 'Iraq', 'News', 'Settings'];

type StackItem = {
  key: string;
  screen: ScreenKey;
  props?: Record<string, any>;
};

const ProfileButton = ({ onProfileClick, onSignOut }: { onProfileClick: () => void, onSignOut: () => void }) => {
  const { user } = useAuth();

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
        <DropdownMenuItem onClick={onProfileClick}>
          <UserIcon className="mr-2 h-4 w-4" />
          <span>الملف الشخصي</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>تسجيل الخروج</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};


export function AppContentWrapper() {
  const [stack, setStack] = useState<StackItem[]>([{ key: 'Matches-0', screen: 'Matches' }]);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const [isEntering, setIsEntering] = useState(false);
  
  const goBack = useCallback(() => {
    if (stack.length > 1) {
      setIsAnimatingOut(true);
      setTimeout(() => {
        setStack(prev => prev.slice(0, -1));
        setIsAnimatingOut(false);
      }, 300);
    }
  }, [stack]);

  const navigate = useCallback((screen: ScreenKey, props?: Record<string, any>) => {
    const isMainTab = mainTabs.includes(screen);
    const newKey = `${screen}-${Date.now()}`;
    
    const newItem = { key: newKey, screen, props };

    if (!isMainTab) {
        setIsEntering(true);
        setTimeout(() => setIsEntering(false), 300);
    }

    setStack(prevStack => {
      if (isMainTab) {
        if (prevStack.length === 1 && prevStack[0].screen === screen) {
           return prevStack;
        }
        return [newItem];
      } else {
        // Prevent pushing the same screen twice
        if (prevStack.length > 0 && prevStack[prevStack.length - 1].screen === screen) {
            return prevStack;
        }
        return [...prevStack, newItem];
      }
    });
  }, []);

  const handleSignOut = async () => {
    await signOut();
  };

  const handleProfileClick = () => {
    navigate('Profile');
  }

  if (!stack || stack.length === 0) {
    return (
        <div className="flex items-center justify-center h-screen bg-background">
          <p>جاري التحميل...</p>
        </div>
    );
  }

  const activeStackItem = stack[stack.length - 1];
  const previousStackItem = stack.length > 1 ? stack[stack.length - 2] : null;

  const ActiveScreenComponent = screenConfig[activeStackItem.screen].component;
  
  const navigationProps = useMemo(() => ({ 
      navigate, 
      goBack, 
      canGoBack: stack.length > 1,
  }), [navigate, goBack, stack.length]);

  const activeScreenKey = activeStackItem.screen;
  const showBottomNav = mainTabs.includes(activeScreenKey);

  const getScreenTitle = (item: StackItem) => {
    // For specific screens, use dynamic titles from props if available
    if (item.screen === 'CompetitionDetails' && item.props?.title) {
        return item.props.title;
    }
    if (item.screen === 'TeamDetails' && item.props?.teamName) {
        return item.props.teamName;
    }
    // Default to static title from config
    return screenConfig[item.screen].title;
  };


  const renderScreen = (item: StackItem, isActive: boolean) => {
    const ScreenComponent = screenConfig[item.screen].component;
    const itemTitle = getScreenTitle(item);
    
    if (!ScreenComponent) return <p>Screen not found</p>;
    
    return (
        <div className="flex h-full flex-col bg-background">
            <ScreenHeader
                title={itemTitle}
                canGoBack={navigationProps.canGoBack}
                onBack={navigationProps.goBack}
                actions={<ProfileButton onProfileClick={handleProfileClick} onSignOut={handleSignOut} />}
            />
            <ScreenComponent {...navigationProps} {...item.props} isVisible={isActive} />
        </div>
    );
  }

  return (
    <main className="h-screen w-screen bg-background flex flex-col">
       <SearchSheet navigate={navigate}>
          <div className='hidden'></div>
       </SearchSheet>
      <div className="relative flex-1 overflow-hidden">
        {/* Previous screen for animation */}
        {previousStackItem && isAnimatingOut && (
             <div
                key={previousStackItem.key}
                className="absolute inset-0 bg-background"
                style={{ zIndex: stack.length - 2 }}
             >
                {renderScreen(previousStackItem, false)}
             </div>
        )}
        
        {/* Active screen */}
        <div
            key={activeStackItem.key}
            className={cn(
            "absolute inset-0 bg-background",
            isEntering && !mainTabs.includes(activeStackItem.screen) && 'animate-slide-in-from-right',
            isAnimatingOut && 'animate-slide-out-to-right'
            )}
            style={{ zIndex: stack.length -1 }}
        >
           {renderScreen(activeStackItem, true)}
        </div>

      </div>
      
      {showBottomNav && <BottomNav activeScreen={activeScreenKey} onNavigate={navigate} />}
    </main>
  );
}
