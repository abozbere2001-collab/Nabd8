"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import type { ScreenProps } from '@/app/page';
import { format, parseISO, addDays, subDays, isToday, isYesterday, isTomorrow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useFirebase } from '@/firebase/provider';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// Interfaces
interface Fixture {
  fixture: {
    id: number;
    date: string;
    timestamp: number;
    status: {
      long: string;
      short: string;
      elapsed: number | null;
    };
  };
  league: {
    id: number;
    name: string;
    logo: string;
  };
  teams: {
    home: { id: number; name: string; logo: string; winner: boolean };
    away: { id: number; name: string; logo: string; winner: boolean };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
}

interface Favorites {
    leagues?: { [key: string]: any };
    teams?: { [key:string]: any };
}

// Helper functions
const formatDateKey = (date: Date): string => format(date, 'yyyy-MM-dd');

const getDayLabel = (date: Date) => {
    if (isToday(date)) return "اليوم";
    if (isYesterday(date)) return "الأمس";
    if (isTomorrow(date)) return "غداً";
    return format(date, "EEEE", { locale: ar });
}

// Live Timer Component
const LiveTimer = ({ startTime }: { startTime: number }) => {
    const [elapsed, setElapsed] = useState<number | null>(null);

    useEffect(() => {
        const calculateElapsed = () => {
            const now = Math.floor(Date.now() / 1000);
            const difference = now - startTime;
            // Handle potential time sync issues where elapsed might be negative
            return Math.max(0, Math.floor(difference / 60));
        };
        
        setElapsed(calculateElapsed());

        const interval = setInterval(() => {
            setElapsed(calculateElapsed());
        }, 60000); // Update every minute

        return () => clearInterval(interval);
    }, [startTime]);

    if (elapsed === null) return null;

    // Display '45+' for halftime, etc.
    const displayTime = elapsed > 45 && elapsed < 60 ? "45+" : `'${elapsed}`;

    return (
        <span className="text-red-600 font-bold text-xs animate-pulse">
            {displayTime}
        </span>
    );
};


// Main Fixture Item Component
const FixtureItem = ({ fixture }: { fixture: Fixture }) => {
    return (
      <div key={fixture.fixture.id} className="rounded-lg border bg-card p-3 text-sm">
         <div className="flex justify-between items-center text-xs text-muted-foreground mb-2">
              <div className="flex items-center gap-2">
                  <Avatar className="h-4 w-4">
                      <AvatarImage src={fixture.league.logo} alt={fixture.league.name} />
                      <AvatarFallback>{fixture.league.name.substring(0,1)}</AvatarFallback>
                  </Avatar>
                  <span className="truncate">{fixture.league.name}</span>
              </div>
              {fixture.fixture.status.short === 'HT' ? (
                 <span className="text-red-600 font-bold text-xs">نصف الوقت</span>
              ) : fixture.fixture.status.short === 'LIVE' ? (
                <LiveTimer startTime={fixture.fixture.timestamp} />
              ) : (
                <span>{fixture.fixture.status.long}</span>
              )}
         </div>
         <div className="flex items-center justify-between gap-2">
             <div className="flex items-center gap-2 flex-1 justify-end truncate">
                 <span className="font-semibold truncate">{fixture.teams.home.name}</span>
                 <Avatar className="h-8 w-8">
                     <AvatarImage src={fixture.teams.home.logo} alt={fixture.teams.home.name} />
                     <AvatarFallback>{fixture.teams.home.name.substring(0, 2)}</AvatarFallback>
                 </Avatar>
             </div>
             <div className="font-bold text-lg px-2 bg-muted rounded-md min-w-[80px] text-center">
                 {(['FT', 'AET', 'PEN', 'LIVE', 'HT'].includes(fixture.fixture.status.short))
                   ? `${fixture.goals.home ?? 0} - ${fixture.goals.away ?? 0}`
                   : format(new Date(fixture.fixture.date), "HH:mm")}
             </div>
             <div className="flex items-center gap-2 flex-1 truncate">
                  <Avatar className="h-8 w-8">
                     <AvatarImage src={fixture.teams.away.logo} alt={fixture.teams.away.name} />
                     <AvatarFallback>{fixture.teams.away.name.substring(0, 2)}</AvatarFallback>
                 </Avatar>
                 <span className="font-semibold truncate">{fixture.teams.away.name}</span>
             </div>
         </div>
      </div>
    );
};


function FixturesList({ filter, favorites, selectedDate }: { filter?: 'favorites', favorites: Favorites, selectedDate: Date }) {
    const [fixtures, setFixtures] = useState<Fixture[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const dateKey = useMemo(() => formatDateKey(selectedDate), [selectedDate]);

    useEffect(() => {
        const fetchFixtures = async () => {
            setIsLoading(true);
            try {
                const response = await fetch(`/api/football/fixtures?date=${dateKey}`);
                if (!response.ok) {
                    throw new Error('Failed to fetch data');
                }
                const data = await response.json();
                setFixtures(data.response || []);
            } catch (error) {
                console.error(`Failed to fetch fixtures for ${dateKey}:`, error);
                setFixtures([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchFixtures();
    }, [dateKey]);

    const favoritedTeamIds = useMemo(() => favorites?.teams ? Object.keys(favorites.teams).map(Number) : [], [favorites.teams]);
    const favoritedLeagueIds = useMemo(() => favorites?.leagues ? Object.keys(favorites.leagues).map(Number) : [], [favorites.leagues]);

    const filteredFixtures = useMemo(() => {
        if (filter === 'favorites') {
            const hasAnyFavorites = favoritedTeamIds.length > 0 || favoritedLeagueIds.length > 0;
            if (!hasAnyFavorites) return [];

            return fixtures.filter(f =>
                favoritedTeamIds.includes(f.teams.home.id) || 
                favoritedTeamIds.includes(f.teams.away.id) ||
                favoritedLeagueIds.includes(f.league.id)
            );
        }
        return fixtures;
    }, [fixtures, filter, favoritedTeamIds, favoritedLeagueIds]);


    const renderEmptyState = (title: string, description: string) => (
       <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-64 p-4">
          <p className="font-bold text-lg">{title}</p>
          <p className="text-sm">{description}</p>
      </div>
    );

    if (isLoading) {
        return (
            <div className="space-y-3 p-4">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
        );
    }

    if (filter === 'favorites' && (favoritedLeagueIds.length === 0 && favoritedTeamIds.length === 0)) {
        return renderEmptyState("لا توجد مباريات في مفضلتك", "أضف فرقا أو بطولات للمفضلة لترى مبارياتها هنا.");
    }
    
    if (filteredFixtures.length === 0) {
        return renderEmptyState("لا توجد مباريات", `لا توجد مباريات مجدولة لهذا اليوم ${filter === 'favorites' ? 'في مفضلتك' : ''}.`);
    }

    return (
        <div className="p-4 space-y-3">
            {filteredFixtures.map(f => <FixtureItem key={f.fixture.id} fixture={f} />)}
        </div>
    );
};


const DateScroller = ({ selectedDate, onSelectDate }: { selectedDate: Date, onSelectDate: (date: Date) => void }) => {
    const dates = useMemo(() => {
        const today = new Date();
        const days = [];
        for (let i = -30; i <= 30; i++) {
            days.push(addDays(today, i));
        }
        return days;
    }, []);

    const selectedDateKey = formatDateKey(selectedDate);
    const todayKey = formatDateKey(new Date());

    return (
        <div className="p-2 border-b">
            <div className="flex space-x-2 overflow-x-auto pb-2 -mx-2 px-2" style={{ scrollbarWidth: 'none', '-ms-overflow-style': 'none' }}>
                {dates.map(date => {
                    const dateKey = formatDateKey(date);
                    const isSelected = dateKey === selectedDateKey;
                    
                    return (
                        <Button
                            key={dateKey}
                            variant={isSelected ? "default" : "outline"}
                            className={cn(
                                "flex flex-col h-auto p-2 min-w-[70px] whitespace-nowrap",
                                !isSelected && dateKey === todayKey && "border-primary"
                            )}
                            onClick={() => onSelectDate(date)}
                        >
                            <span className="text-xs font-bold">{getDayLabel(date)}</span>
                            <span className="text-xs text-muted-foreground">{format(date, "d MMM", {locale: ar})}</span>
                        </Button>
                    )
                })}
            </div>
        </div>
    );
}

// Main Screen Component
export function MatchesScreen({ navigate, goBack, canGoBack }: ScreenProps) {
  const { user } = useFirebase();
  const [favorites, setFavorites] = useState<Favorites>({});
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'favorites', user.uid), (doc) => {
      setFavorites(doc.data() as Favorites || {});
    });
    return () => unsub();
  }, [user]);
  
  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader title="المباريات" onBack={goBack} canGoBack={canGoBack} />
      <div className="flex-1 flex flex-col">
        <Tabs defaultValue="all-matches" className="w-full flex-1 flex flex-col">
          <div className="px-4 pt-4 border-b">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="my-results">نتائجي</TabsTrigger>
              <TabsTrigger value="all-matches">كل المباريات</TabsTrigger>
            </TabsList>
          </div>
          <DateScroller selectedDate={selectedDate} onSelectDate={setSelectedDate} />
          <TabsContent 
            value="my-results" 
            className="mt-0 flex-1 overflow-y-auto"
            forceMount
          >
            <FixturesList filter="favorites" favorites={favorites} selectedDate={selectedDate} />
          </TabsContent>
          <TabsContent 
            value="all-matches" 
            className="mt-0 flex-1 overflow-y-auto"
            forceMount
          >
            <FixturesList favorites={favorites} selectedDate={selectedDate} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

    