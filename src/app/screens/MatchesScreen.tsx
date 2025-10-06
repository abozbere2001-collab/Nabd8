"use client";

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
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
import { Loader2 } from 'lucide-react';

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
    if (isToday(date)) return "اليوم";
    if (isYesterday(date)) return "الأمس";
    if (isTomorrow(date)) return "غداً";
    return format(date, "EEEE, d MMMM", { locale: ar });
};


// Live Timer Component
const LiveTimer = ({ startTime }: { startTime: number }) => {
    const [elapsed, setElapsed] = useState<number | null>(null);

    useEffect(() => {
        const calculateElapsed = () => {
            const now = Math.floor(Date.now() / 1000);
            const difference = now - startTime;
            return Math.max(0, Math.floor(difference / 60));
        };
        
        setElapsed(calculateElapsed());

        const interval = setInterval(() => {
            setElapsed(calculateElapsed());
        }, 60000); // Update every minute

        return () => clearInterval(interval);
    }, [startTime]);

    if (elapsed === null) return null;
    const displayTime = elapsed > 45 && elapsed < 60 ? "45+" : `'${elapsed}`;

    return (
        <span className="text-red-600 font-bold text-xs animate-pulse">
            {displayTime}
        </span>
    );
};


// Fixture Item Component
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
              ) : ['LIVE', '1H', '2H'].includes(fixture.fixture.status.short) ? (
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
};

const FixturesList = ({ fixtures, favoritedTeamIds, favoritedLeagueIds, activeTab, hasAnyFavorites }: {
    fixtures: DayFixtures[];
    favoritedTeamIds: number[];
    favoritedLeagueIds: number[];
    activeTab: 'my-results' | 'all-matches';
    hasAnyFavorites: boolean;
}) => {
    
    const allDaysHaveFixtures = fixtures.every(day => day.fixtures.length > 0);
    const allFilteredDaysAreEmpty = fixtures.every(day => {
        const filtered = day.fixtures.filter(f =>
            favoritedTeamIds.includes(f.teams.home.id) ||
            favoritedTeamIds.includes(f.teams.away.id) ||
            favoritedLeagueIds.includes(f.league.id)
        );
        return filtered.length === 0;
    });

    if (activeTab === 'my-results' && !hasAnyFavorites) {
        return (
            <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-64 p-4">
                <p className="font-bold text-lg">لم تقم بإضافة أي مفضلات</p>
                <p className="text-sm">أضف فرقا أو بطولات لترى مبارياتها هنا.</p>
            </div>
        );
    }
    
    if (activeTab === 'my-results' && hasAnyFavorites && allDaysHaveFixtures && allFilteredDaysAreEmpty) {
         return (
            <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-64 p-4">
                <p className="font-bold text-lg">لا توجد مباريات مفضلة في هذه الفترة</p>
                <p className="text-sm">جرّب التمرير لأعلى أو لأسفل للبحث في تواريخ أخرى.</p>
            </div>
        );
    }

    return (
        <>
            {fixtures.map(({ date, fixtures: dayFixtures }) => {
                const filteredFixtures = activeTab === 'my-results'
                    ? dayFixtures.filter(f =>
                        favoritedTeamIds.includes(f.teams.home.id) ||
                        favoritedTeamIds.includes(f.teams.away.id) ||
                        favoritedLeagueIds.includes(f.league.id)
                      )
                    : dayFixtures;

                if (filteredFixtures.length === 0) {
                    if (activeTab === 'my-results') return null;
                    return (
                        <div key={`${date}-empty`} className="p-4 pt-2 space-y-3">
                            <h2 className="text-sm font-bold text-center text-muted-foreground pt-4 pb-2">{getDayLabel(date)}</h2>
                            <p className="text-center text-muted-foreground">لا توجد مباريات لهذا اليوم.</p>
                        </div>
                    );
                }
                
                return (
                    <div key={date} className="p-4 pt-2 space-y-3">
                        <h2 className="text-sm font-bold text-center text-muted-foreground pt-4 pb-2">{getDayLabel(date)}</h2>
                        {filteredFixtures.map(f => <FixtureItem key={f.fixture.id} fixture={f} />)}
                    </div>
                );
            })}
        </>
    );
};


const InfiniteScrollTrigger = ({ onIntersect, isLoading }: { onIntersect: () => void; isLoading: boolean; }) => {
    const ref = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting && !isLoading) {
                 onIntersect();
            }
        }, { threshold: 1.0 });

        const currentRef = ref.current;
        if (currentRef) {
            observer.observe(currentRef);
        }

        return () => {
            if (currentRef) {
                observer.unobserve(currentRef);
            }
        };
    }, [onIntersect, isLoading]);

    return <div ref={ref} className="h-10 flex justify-center items-center">
        {isLoading && <Loader2 className="h-6 w-6 animate-spin text-primary" />}
    </div>;
};

// Main Screen Component
export function MatchesScreen({ navigate, goBack, canGoBack }: ScreenProps) {
  const { user } = useFirebase();
  const [favorites, setFavorites] = useState<Favorites>({});
  const [activeTab, setActiveTab] = useState<'my-results' | 'all-matches'>('all-matches');
  
  const [fixtures, setFixtures] = useState<DayFixtures[]>([]);
  const [loadedDays, setLoadedDays] = useState<Set<string>>(new Set());
  
  const [isLoadingNext, setIsLoadingNext] = useState(false);
  const [isLoadingPrev, setIsLoadingPrev] = useState(false);
  
  const minDate = useMemo(() => subDays(new Date(), 180), []);
  const maxDate = useMemo(() => addDays(new Date(), 180), []);
  
  const hasMorePrev = useMemo(() => {
      if (fixtures.length === 0) return true;
      const firstDate = parseISO(fixtures[0].date);
      return firstDate > minDate;
  }, [fixtures, minDate]);

  const hasMoreNext = useMemo(() => {
      if (fixtures.length === 0) return true;
      const lastDate = parseISO(fixtures[fixtures.length - 1].date);
      return lastDate < maxDate;
  }, [fixtures, maxDate]);


  const fetchFixturesForDate = useCallback(async (date: Date) => {
    const dateKey = formatDateKey(date);
    if (loadedDays.has(dateKey)) return null;

    setLoadedDays(prev => new Set(prev).add(dateKey));
    try {
      const response = await fetch(`/api/football/fixtures?date=${dateKey}`);
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      return { date: dateKey, fixtures: data.response || [] };
    } catch (error) {
      console.error(`Failed to fetch fixtures for ${dateKey}:`, error);
      return { date: dateKey, fixtures: [] };
    }
  }, [loadedDays]);

  const loadNextDay = useCallback(async () => {
    if (isLoadingNext || !hasMoreNext) return;
    setIsLoadingNext(true);

    const lastDayStr = fixtures.length > 0 ? fixtures[fixtures.length - 1].date : formatDateKey(subDays(new Date(), 1));
    const nextDay = addDays(parseISO(lastDayStr), 1);
    
    const newDayData = await fetchFixturesForDate(nextDay);
    if (newDayData) {
      setFixtures(prevFixtures => [...prevFixtures, newDayData].sort((a,b) => a.date.localeCompare(b.date)));
    }
    setIsLoadingNext(false);
  }, [isLoadingNext, hasMoreNext, fetchFixturesForDate, fixtures]);

  const loadPreviousDay = useCallback(async () => {
    if (isLoadingPrev || !hasMorePrev) return;
    setIsLoadingPrev(true);

    const firstDayStr = fixtures.length > 0 ? fixtures[0].date : formatDateKey(addDays(new Date(), 1));
    const prevDay = subDays(parseISO(firstDayStr), 1);
    
    const newDayData = await fetchFixturesForDate(prevDay);
    if (newDayData) {
        setFixtures(prevFixtures => [newDayData, ...prevFixtures].sort((a,b) => a.date.localeCompare(b.date)));
    }
    setIsLoadingPrev(false);
  }, [isLoadingPrev, hasMorePrev, fetchFixturesForDate, fixtures]);

  // Initial load
  useEffect(() => {
    const today = new Date();
    const todayKey = formatDateKey(today);
    if (!loadedDays.has(todayKey)) {
        setIsLoadingNext(true); // Use one loader for init
        fetchFixturesForDate(today).then(todayData => {
            if(todayData) {
                setFixtures([todayData]);
            }
            setIsLoadingNext(false);
        });
    }
  }, [fetchFixturesForDate, loadedDays]);
  
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
          
          <TabsContent value="my-results" className="mt-0 flex-1 overflow-y-auto">
             <div className="overflow-y-auto">
                {hasMorePrev && <InfiniteScrollTrigger onIntersect={loadPreviousDay} isLoading={isLoadingPrev} />}
                <FixturesList fixtures={fixtures} favoritedTeamIds={favoritedTeamIds} favoritedLeagueIds={favoritedLeagueIds} activeTab="my-results" hasAnyFavorites={hasAnyFavorites} />
                {hasMoreNext && <InfiniteScrollTrigger onIntersect={loadNextDay} isLoading={isLoadingNext} />}
            </div>
          </TabsContent>
          <TabsContent value="all-matches" className="mt-0 flex-1 overflow-y-auto">
             <div className="overflow-y-auto">
                {hasMorePrev && <InfiniteScrollTrigger onIntersect={loadPreviousDay} isLoading={isLoadingPrev} />}
                <FixturesList fixtures={fixtures} favoritedTeamIds={favoritedTeamIds} favoritedLeagueIds={favoritedLeagueIds} activeTab="all-matches" hasAnyFavorites={hasAnyFavorites} />
                {hasMoreNext && <InfiniteScrollTrigger onIntersect={loadNextDay} isLoading={isLoadingNext} />}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

    