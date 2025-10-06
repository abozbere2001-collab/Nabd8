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

interface FixturesByDate {
    [date: string]: Fixture[];
}

// Constants
const PAST_DAYS_LIMIT = 180;
const FUTURE_DAYS_LIMIT = 180;

// Helper functions
const formatDateKey = (date: Date): string => format(date, 'yyyy-MM-dd');

const getDayLabel = (dateString: string) => {
    try {
        const date = parseISO(dateString);
        if (isToday(date)) return "اليوم";
        if (isYesterday(date)) return "الأمس";
        if (isTomorrow(date)) return "غداً";
        return format(date, "EEEE", { locale: ar });
    } catch (e) {
        return dateString;
    }
}

// Live Timer Component
const LiveTimer = ({ startTime }: { startTime: number }) => {
    const [elapsed, setElapsed] = useState<number | null>(null);

    useEffect(() => {
        const calculateElapsed = () => {
            const now = Math.floor(Date.now() / 1000);
            const difference = now - startTime;
            return Math.floor(difference / 60);
        };
        
        setElapsed(calculateElapsed());

        const interval = setInterval(() => {
            setElapsed(calculateElapsed());
        }, 60000); // Update every minute

        return () => clearInterval(interval);
    }, [startTime]);

    if (elapsed === null) return null;

    return (
        <span className="text-red-600 font-bold text-xs animate-pulse">
            {`'${elapsed}`}
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
              {fixture.fixture.status.short === 'LIVE' ? (
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
             <div className="font-bold text-lg px-2 bg-muted rounded-md">
                 {(fixture.fixture.status.short === 'FT' || fixture.fixture.status.short === 'AET' || fixture.fixture.status.short === 'PEN' || fixture.fixture.status.short === 'LIVE')
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


// Reusable Fixtures List with Infinite Scroll
function FixturesList({ filter, favorites }: { filter?: 'favorites', favorites: Favorites }) {
    const [fixtures, setFixtures] = useState<FixturesByDate>({});
    
    // State for managing loading and data availability
    const [isLoadingPrev, setIsLoadingPrev] = useState(false);
    const [isLoadingNext, setIsLoadingNext] = useState(false);
    
    const oldestDateLoaded = useRef(new Date());
    const newestDateLoaded = useRef(new Date());

    const startDateLimit = useMemo(() => subDays(new Date(), PAST_DAYS_LIMIT), []);
    const endDateLimit = useMemo(() => addDays(new Date(), FUTURE_DAYS_LIMIT), []);

    const hasMorePrev = useMemo(() => oldestDateLoaded.current > startDateLimit, [startDateLimit]);
    const hasMoreNext = useMemo(() => newestDateLoaded.current < endDateLimit, [endDateLimit]);
    
    // Refs to track intersection observers
    const topObserver = useRef<IntersectionObserver | null>(null);
    const bottomObserver = useRef<IntersectionObserver | null>(null);

    const topTriggerRef = useRef<HTMLDivElement>(null);
    const bottomTriggerRef = useRef<HTMLDivElement>(null);

    const fetchFixtures = useCallback(async (dateToFetch: Date) => {
        const dateKey = formatDateKey(dateToFetch);
        if (fixtures[dateKey]) return; // Don't fetch if already loaded

        try {
            const response = await fetch(`/api/football/fixtures?date=${dateKey}`);
            const data = await response.json();
            const newFixtures = data.response || [];
            
            setFixtures(prev => ({
                ...prev,
                [dateKey]: newFixtures
            }));
        } catch (error) {
            console.error(`Failed to fetch fixtures for ${dateKey}:`, error);
        }
    }, [fixtures]);

    const loadPreviousDay = useCallback(async () => {
        if (isLoadingPrev || !hasMorePrev) return;
        setIsLoadingPrev(true);
        const prevDate = subDays(oldestDateLoaded.current, 1);
        await fetchFixtures(prevDate);
        oldestDateLoaded.current = prevDate;
        setIsLoadingPrev(false);
    }, [isLoadingPrev, hasMorePrev, fetchFixtures]);

    const loadNextDay = useCallback(async () => {
        if (isLoadingNext || !hasMoreNext) return;
        setIsLoadingNext(true);
        const nextDate = addDays(newestDateLoaded.current, 1);
        await fetchFixtures(nextDate);
        newestDateLoaded.current = nextDate;
        setIsLoadingNext(false);
    }, [isLoadingNext, hasMoreNext, fetchFixtures]);

    // Initial load
    useEffect(() => {
        const today = new Date();
        oldestDateLoaded.current = today;
        newestDateLoaded.current = today;
        setIsLoadingNext(true);
        fetchFixtures(today).finally(() => setIsLoadingNext(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Intersection Observer setup
    useEffect(() => {
        const topElement = topTriggerRef.current;
        const bottomElement = bottomTriggerRef.current;

        const handleIntersect = (entries: IntersectionObserverEntry[], observer: IntersectionObserver) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    if (entry.target === topElement) {
                        loadPreviousDay();
                    } else if (entry.target === bottomElement) {
                        loadNextDay();
                    }
                }
            });
        };
        
        topObserver.current = new IntersectionObserver(handleIntersect, { threshold: 1.0 });
        if (topElement) topObserver.current.observe(topElement);

        bottomObserver.current = new IntersectionObserver(handleIntersect, { threshold: 1.0 });
        if (bottomElement) bottomObserver.current.observe(bottomElement);

        return () => {
            if (topElement) topObserver.current?.unobserve(topElement);
            if (bottomElement) bottomObserver.current?.unobserve(bottomElement);
        };
    }, [loadPreviousDay, loadNextDay]);

    const sortedDates = useMemo(() => Object.keys(fixtures).sort((a, b) => a.localeCompare(b)), [fixtures]);
    
    const favoritedTeamIds = useMemo(() => favorites?.teams ? Object.keys(favorites.teams).map(Number) : [], [favorites.teams]);
    const favoritedLeagueIds = useMemo(() => favorites?.leagues ? Object.keys(favorites.leagues).map(Number) : [], [favorites.leagues]);

    const renderedContent = useMemo(() => {
        return sortedDates.map(date => {
            const fixturesForDate = fixtures[date];
            if (!fixturesForDate) return null;

            let fixturesToRender = fixturesForDate;
            if (filter === 'favorites') {
                fixturesToRender = fixturesForDate.filter(f =>
                    favoritedTeamIds.includes(f.teams.home.id) || 
                    favoritedTeamIds.includes(f.teams.away.id) ||
                    favoritedLeagueIds.includes(f.league.id)
                );
            }
            
            if (fixturesToRender.length === 0) return null;

            return (
                <div key={date}>
                    <h2 className="font-bold text-lg sticky top-0 bg-background/95 backdrop-blur-sm z-10 p-4 py-3 border-b -mx-4">
                      {getDayLabel(date)}
                      <span className="text-sm font-normal text-muted-foreground ml-2">{format(parseISO(date), "d MMMM yyyy", { locale: ar })}</span>
                    </h2>
                    <div className="space-y-3 pt-4">
                        {fixturesToRender.map(f => <FixtureItem key={f.fixture.id} fixture={f} />)}
                    </div>
                </div>
            )
        }).filter(Boolean);
    }, [sortedDates, fixtures, filter, favoritedTeamIds, favoritedLeagueIds]);
    
    const hasAnyFavorites = favoritedTeamIds.length > 0 || favoritedLeagueIds.length > 0;

    const renderEmptyState = (title: string, description: string) => (
       <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-64 p-4">
          <p className="font-bold text-lg">{title}</p>
          <p className="text-sm">{description}</p>
      </div>
    );
    
    if (filter === 'favorites' && !hasAnyFavorites) {
        return renderEmptyState("لا توجد مباريات في مفضلتك", "أضف فرقا أو بطولات للمفضلة لترى مبارياتها هنا.");
    }
    
    const isContentEmpty = renderedContent.length === 0;
    const isStillLoading = isLoadingNext || isLoadingPrev;

    if (isContentEmpty && !isStillLoading) {
        if(filter === 'favorites' && hasAnyFavorites) {
            return renderEmptyState("لا توجد مباريات مفضلة في هذه الفترة", "جرّب التمرير لأعلى أو لأسفل لعرض أيام أخرى.");
        }
    }

    return (
        <div className="p-4">
            <div ref={topTriggerRef} className="h-10">
                {isLoadingPrev && <Skeleton className="h-20 w-full" />}
            </div>
            
            {renderedContent}
            
            <div ref={bottomTriggerRef} className="h-10">
                {isLoadingNext && renderedContent.length > 0 && <Skeleton className="h-20 w-full" />}
            </div>
        </div>
    );
};


// Main Screen Component
export function MatchesScreen({ navigate, goBack, canGoBack }: ScreenProps) {
  const { user } = useFirebase();
  const [favorites, setFavorites] = useState<Favorites>({});
  
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'favorites', user.uid), (doc) => {
      setFavorites(doc.data() as Favorites || { leagues: {}, teams: {} });
    });
    return () => unsub();
  }, [user]);
  
  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader title="المباريات" onBack={goBack} canGoBack={canGoBack} />
      <div className="flex-1 flex flex-col">
        <Tabs defaultValue="all-matches" className="w-full flex-1 flex flex-col">
          <div className="p-4 border-b">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="my-results">نتائجي</TabsTrigger>
              <TabsTrigger value="all-matches">كل المباريات</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent 
            value="my-results" 
            className="mt-0 flex-1 overflow-y-auto"
            forceMount // Keep it in the DOM to preserve scroll state
          >
             <FixturesList filter="favorites" favorites={favorites}/>
          </TabsContent>
          <TabsContent 
            value="all-matches" 
            className="mt-0 flex-1 overflow-y-auto"
             forceMount // Keep it in the DOM to preserve scroll state
          >
            <FixturesList favorites={favorites} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
