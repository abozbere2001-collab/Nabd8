"use client";

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import type { ScreenProps } from '@/app/page';
import { format, parseISO, addDays, subDays, isToday, isYesterday, isTomorrow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useFirebase } from '@/firebase/provider';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import { Loader2 } from 'lucide-react';
import { useLayoutEffect } from 'react';


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

type DayFixtures = {
    date: string; // YYYY-MM-DD
    fixtures: Fixture[];
};

// Helper functions
const formatDateKey = (date: Date): string => format(date, 'yyyy-MM-dd');

const getDayLabel = (dateKey: string) => {
    const date = parseISO(dateKey);
    if (isToday(date)) return `اليوم - ${format(date, "d MMMM", { locale: ar })}`;
    if (isYesterday(date)) return `الأمس - ${format(date, "d MMMM", { locale: ar })}`;
    if (isTomorrow(date)) return `غداً - ${format(date, "d MMMM", { locale: ar })}`;
    return format(date, "EEEE, d MMMM yyyy", { locale: ar });
};


// Live Timer Component
const LiveTimer = ({ startTime, status }: { startTime: number, status: string }) => {
    const [elapsed, setElapsed] = useState<number | null>(null);

    useEffect(() => {
        if (status !== '1H' && status !== '2H' && status !== 'ET') {
            setElapsed(null);
            return;
        }

        const calculateElapsed = () => {
            const now = Math.floor(Date.now() / 1000);
            const difference = now - startTime;
            const minutes = Math.max(0, Math.floor(difference / 60));

            // Basic half-time logic
            if (status === '1H' && minutes > 45) return 45;
            if (status === '2H' && minutes > 90) return 90;
            // more logic for ET can be added
            return minutes;
        };
        
        setElapsed(calculateElapsed());

        const interval = setInterval(() => {
            setElapsed(calculateElapsed());
        }, 60000); // Update every minute

        return () => clearInterval(interval);
    }, [startTime, status]);

    if (elapsed === null) return null;
    const displayTime = elapsed > 45 && elapsed < 60 ? "45+" : `'${elapsed}`;

    return (
        <span className="text-red-600 font-bold text-xs animate-pulse">
            {displayTime}
        </span>
    );
};


// Fixture Item Component
const FixtureItem = React.memo(({ fixture }: { fixture: Fixture }) => {
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
              ) : ['1H', '2H', 'ET'].includes(fixture.fixture.status.short) ? (
                <LiveTimer startTime={fixture.fixture.timestamp} status={fixture.fixture.status.short} />
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
                 {(['FT', 'AET', 'PEN', 'LIVE', 'HT', '1H', '2H'].includes(fixture.fixture.status.short))
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
});
FixtureItem.displayName = 'FixtureItem';


// Fixtures List Component
const FixturesList = ({ days, activeTab, favoritedTeamIds, favoritedLeagueIds, hasAnyFavorites }: { 
    days: DayFixtures[], 
    activeTab: string, 
    favoritedTeamIds: number[],
    favoritedLeagueIds: number[],
    hasAnyFavorites: boolean
}) => {
    
    const filteredDays = useMemo(() => {
        if (activeTab === 'all-matches') {
            return days;
        }
        return days.map(day => ({
            ...day,
            fixtures: day.fixtures.filter(f => 
                favoritedTeamIds.includes(f.teams.home.id) ||
                favoritedTeamIds.includes(f.teams.away.id) ||
                favoritedLeagueIds.includes(f.league.id)
            )
        }));
    }, [days, activeTab, favoritedTeamIds, favoritedLeagueIds]);

    const hasFixturesInAnyDay = filteredDays.some(day => day.fixtures.length > 0);

    if (activeTab === 'my-results' && !hasAnyFavorites) {
        return (
            <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-64 p-4">
                <p className="font-bold text-lg">لم تقم بإضافة أي مفضلات</p>
                <p className="text-sm">أضف فرقا أو بطولات لترى مبارياتها هنا.</p>
            </div>
        );
    }
    
    if (days.length > 0 && !hasFixturesInAnyDay) {
        return (
            <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-64 p-4">
                <p className="font-bold text-lg">لا توجد مباريات مفضلة في هذه الفترة</p>
                <p className="text-sm">جرّب التمرير لأعلى أو لأسفل للبحث في تواريخ أخرى.</p>
            </div>
        );
    }

    return (
        <div>
            {filteredDays.map(({ date, fixtures }) => {
                if (fixtures.length === 0 && activeTab === 'all-matches') {
                    return (
                        <div key={date} className="p-4 pt-2 space-y-3">
                            <h2 className="text-sm font-bold text-center text-muted-foreground pt-4 pb-2">{getDayLabel(date)}</h2>
                            <p className="text-center text-muted-foreground">لا توجد مباريات لهذا اليوم.</p>
                        </div>
                    );
                }
                if (fixtures.length === 0) return null;
                
                return (
                    <div key={date} className="p-4 pt-2 space-y-3">
                        <h2 className="text-sm font-bold text-center text-muted-foreground pt-4 pb-2">{getDayLabel(date)}</h2>
                        {fixtures.map(f => <FixtureItem key={f.fixture.id} fixture={f} />)}
                    </div>
                );
            })}
        </div>
    );
};

// Main Screen Component
export function MatchesScreen({ navigate, goBack, canGoBack }: ScreenProps) {
  const { user } = useFirebase();
  const [favorites, setFavorites] = useState<Favorites>({});
  const [activeTab, setActiveTab] = useState<'my-results' | 'all-matches'>('all-matches');

  const [days, setDays] = useState<DayFixtures[]>([]);
  const loadedDaysRef = useRef(new Set<string>());
  
  const [isLoadingNext, setIsLoadingNext] = useState(false);
  const [isLoadingPrev, setIsLoadingPrev] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollPosRef = useRef(0);

  const minDate = useMemo(() => subDays(new Date(), 180), []);
  const maxDate = useMemo(() => addDays(new Date(), 180), []);

  const [hasMorePrev, setHasMorePrev] = useState(true);
  const [hasMoreNext, setHasMoreNext] = useState(true);

  // Preserve scroll position when loading previous days
  useLayoutEffect(() => {
    if (scrollRef.current && scrollPosRef.current > 0) {
      scrollRef.current.scrollTop = scrollPosRef.current;
      scrollPosRef.current = 0;
    }
  }, [days]);

  const fetchFixturesForDate = useCallback(async (date: Date) => {
    const dateKey = formatDateKey(date);
    if (loadedDaysRef.current.has(dateKey)) return null;

    loadedDaysRef.current.add(dateKey);
    try {
      const response = await fetch(`/api/football/fixtures?date=${dateKey}`);
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      return { date: dateKey, fixtures: data.response || [] };
    } catch (error) {
      console.error(`Failed to fetch fixtures for ${dateKey}:`, error);
      return { date: dateKey, fixtures: [] };
    }
  }, []);

  const loadNextDay = useCallback(async () => {
    if (isLoadingNext || !hasMoreNext) return;

    setIsLoadingNext(true);
    const lastDayStr = days.length > 0 ? days[days.length - 1].date : formatDateKey(subDays(new Date(), 1));
    const nextDay = addDays(parseISO(lastDayStr), 1);
    
    if (nextDay > maxDate) {
        setHasMoreNext(false);
        setIsLoadingNext(false);
        return;
    }

    const newDayData = await fetchFixturesForDate(nextDay);
    if (newDayData) {
      setDays(prevDays => [...prevDays, newDayData]);
    }
    setIsLoadingNext(false);
  }, [isLoadingNext, hasMoreNext, fetchFixturesForDate, days, maxDate]);

  const loadPreviousDay = useCallback(async () => {
    if (isLoadingPrev || !hasMorePrev) return;

    setIsLoadingPrev(true);
    const firstDayStr = days.length > 0 ? days[0].date : formatDateKey(addDays(new Date(), 1));
    const prevDay = subDays(parseISO(firstDayStr), 1);

    if (prevDay < minDate) {
        setHasMorePrev(false);
        setIsLoadingPrev(false);
        return;
    }
    
    const newDayData = await fetchFixturesForDate(prevDay);
    
    if (newDayData && scrollRef.current) {
        const oldScrollHeight = scrollRef.current.scrollHeight;
        const oldScrollTop = scrollRef.current.scrollTop;
        
        setDays(prevDays => [newDayData, ...prevDays]);

        // This is the magic: after the new state is rendered, this will be calculated
        const newScrollHeight = scrollRef.current.scrollHeight;
        scrollPosRef.current = oldScrollTop + (newScrollHeight - oldScrollHeight);
    }
    setIsLoadingPrev(false);
  }, [isLoadingPrev, hasMorePrev, fetchFixturesForDate, days, minDate]);


  // Initial load
  useEffect(() => {
    const todayKey = formatDateKey(new Date());
    if (!loadedDaysRef.current.has(todayKey)) {
        setIsLoadingNext(true); 
        fetchFixturesForDate(new Date()).then(todayData => {
            if (todayData) {
                setDays([todayData]);
            }
            setIsLoadingNext(false);
        });
    }
  }, [fetchFixturesForDate]);
  
  // Intersection Observers for infinite scroll
  const topObserverRef = useRef<HTMLDivElement>(null);
  const bottomObserverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const topObserver = new IntersectionObserver(
        ([entry]) => {
            if (entry.isIntersecting && !isLoadingPrev) {
                loadPreviousDay();
            }
        },
        { root: scrollRef.current, threshold: 0.1 }
    );
    const bottomObserver = new IntersectionObserver(
        ([entry]) => {
            if (entry.isIntersecting && !isLoadingNext) {
                loadNextDay();
            }
        },
        { root: scrollRef.current, threshold: 0.1 }
    );

    if (topObserverRef.current) topObserver.observe(topObserverRef.current);
    if (bottomObserverRef.current) bottomObserver.observe(bottomObserverRef.current);

    return () => {
        if (topObserverRef.current) topObserver.unobserve(topObserverRef.current);
        if (bottomObserverRef.current) bottomObserver.unobserve(bottomObserverRef.current);
    };
  }, [isLoadingPrev, isLoadingNext, loadPreviousDay, loadNextDay]);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'favorites', user.uid), (doc) => {
      setFavorites(doc.data() as Favorites || {});
    });
    return () => unsub();
  }, [user]);

  const favoritedTeamIds = useMemo(() => favorites?.teams ? Object.keys(favorites.teams).map(Number) : [], [favorites.teams]);
  const favoritedLeagueIds = useMemo(() => favorites?.leagues ? Object.keys(favorites.leagues).map(Number) : [], [favorites.leagues]);
  const hasAnyFavorites = favoritedLeagueIds.length > 0 || favoritedTeamIds.length > 0;
    
  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader title="المباريات" onBack={goBack} canGoBack={canGoBack} />
      <div className="flex-1 flex flex-col">
        <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)} className="w-full flex-1 flex flex-col">
          <div className="px-4 pt-4 border-b">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="my-results">نتائجي</TabsTrigger>
              <TabsTrigger value="all-matches">كل المباريات</TabsTrigger>
            </TabsList>
          </div>
          
          <div ref={scrollRef} className="flex-1 overflow-y-auto">
              <div ref={topObserverRef} className="h-10 flex justify-center items-center">
                  {isLoadingPrev && <Loader2 className="h-6 w-6 animate-spin text-primary" />}
              </div>
              
              <FixturesList 
                  days={days} 
                  activeTab={activeTab} 
                  favoritedLeagueIds={favoritedLeagueIds}
                  favoritedTeamIds={favoritedTeamIds}
                  hasAnyFavorites={hasAnyFavorites}
              />
              
              <div ref={bottomObserverRef} className="h-10 flex justify-center items-center">
                  {isLoadingNext && <Loader2 className="h-6 w-6 animate-spin text-primary" />}
              </div>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
