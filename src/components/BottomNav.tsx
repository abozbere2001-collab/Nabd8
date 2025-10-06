"use client";
import { Futbol, Trophy, Map, Newspaper, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ScreenKey } from '@/app/page';

const navItems = [
  { key: 'Matches', label: 'المباريات', icon: Futbol },
  { key: 'Competitions', label: 'البطولات', icon: Trophy },
  { key: 'Iraq', label: 'العراق', icon: Map },
  { key: 'News', label: 'الأخبار', icon: Newspaper },
  { key: 'Settings', label: 'الإعدادات', icon: Settings2 },
];

interface BottomNavProps {
  activeScreen: ScreenKey;
  onNavigate: (screen: ScreenKey) => void;
  screens: Record<ScreenKey, JSX.Element>;
}

export function BottomNav({ activeScreen, onNavigate, screens }: BottomNavProps) {
  const handleNavigation = (key: ScreenKey) => {
    // Only navigate if the screen is a main tab screen
    if (Object.keys(screens).includes(key) && navItems.some(item => item.key === key)) {
      onNavigate(key);
    }
  };
  
  const isMainTabActive = navItems.some(item => item.key === activeScreen);

  if (!isMainTabActive) return null;

  return (
    <div className="absolute bottom-0 left-0 right-0 z-20 h-20 border-t bg-background/80 backdrop-blur-md">
      <nav className="flex h-full items-center justify-around px-2">
        {navItems.map(({ key, label, icon: Icon }) => {
          const isActive = activeScreen === key;
          return (
            <button
              key={key}
              onClick={() => handleNavigation(key as ScreenKey)}
              className={cn(
                'flex h-full flex-col items-center justify-center gap-1 px-2 text-center text-xs font-medium outline-none transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-6 w-6" />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
