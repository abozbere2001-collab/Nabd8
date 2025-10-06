"use client";

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import type { ScreenProps } from '@/app/page';
import { format, isToday, isYesterday, isTomorrow, parseISO, addDays, subDays } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useFirebase } from '@/firebase/provider';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';

interface Fixture {
  fixture: {
    id: number;
    date: string;
    status: {
      long: string;
      short: string;
      elapsed: number;
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

interface GroupedFixtures {
    [date: string]: Fixture[];
}

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

const START_DATE_LIMIT = subDays(new Date(), 180);
const END_DATE_LIMIT = addDays(new Date(), 180);


function InfiniteScrollTrigger({ onVisible, isLoading, hasMore }: { onVisible: () => void, isLoading: boolean, hasMore: boolean }) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const currentRef = ref.current;
        if (!currentRef || !hasMore) return;
        
        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (entry.isIntersecting && !isLoading) {
                    onVisible();
                }
            },
            { threshold: 0.1 }
        );

        observer.observe(currentRef);

        return () => {
            observer.unobserve(currentRef);
        };
    }, [onVisible, isLoading, hasMore]);

    return (
        <div ref={ref} className="h-20 flex justify-center items-center">
          {isLoading && <Skeleton className="h-24 w-full" />}
        </div>
    );
}

function FixturesList({ filter, favorites }: { filter?: 'favorites', favorites: Favorites }) {
    const [fixtures, setFixtures] = useState<GroupedFixtures>({});
    const [isLoadingNext, setIsLoadingNext] = useState(false);
    const [isLoadingPrev, setIsLoadingPrev] = useState(false);
    const [earliestDate, setEarliestDate] = useState(new Date());
    const [latestDate, setLatestDate] = useState(new Date());

    const hasMorePrev = useMemo(() => earliestDate > START_DATE_LIMIT, [earliestDate]);
    const hasMoreNext = useMemo(() => latestDate < END_DATE_LIMIT, [latestDate]);
    
    // Using refs to hold the latest state for callbacks without causing re-renders
    const fixturesRef = useRef(fixtures);
    fixturesRef.current = fixtures;

    const fetchFixturesByDate = useCallback(async (date: Date): Promise<boolean> => {
        const dateString = format(date, 'yyyy-MM-dd');
        if (fixturesRef.current[dateString]) return true;

        try {
            const response = await fetch(`/api/football/fixtures?date=${dateString}`);
            const data = await response.json();
            const newFixtures = data.response || [];

            setFixtures(prev => ({
                ...prev,
                [dateString]: newFixtures
            }));
            return true;
        } catch (error) {
            console.error(`Failed to fetch fixtures for ${dateString}:`, error);
            setFixtures(prev => ({ ...prev, [dateString]: [] }));
            return false;
        }
    }, []);

    useEffect(() => {
        const today = new Date();
        setIsLoadingNext(true);
        fetchFixturesByDate(today).finally(() => setIsLoadingNext(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fetchFixturesByDate]);

    const loadNextDay = useCallback(async () => {
        if (isLoadingNext || !hasMoreNext) return;
        setIsLoadingNext(true);
        const nextDay = addDays(latestDate, 1);
        await fetchFixturesByDate(nextDay);
        setLatestDate(nextDay);
        setIsLoadingNext(false);
    }, [isLoadingNext, hasMoreNext, latestDate, fetchFixturesByDate]);

    const loadPreviousDay = useCallback(async () => {
        if (isLoadingPrev || !hasMorePrev) return;
        setIsLoadingPrev(true);
        const prevDay = subDays(earliestDate, 1);
        await fetchFixturesByDate(prevDay);
        setEarliestDate(prevDay);
        setIsLoadingPrev(false);
    }, [isLoadingPrev, hasMorePrev, earliestDate, fetchFixturesByDate]);

    const sortedDates = useMemo(() => Object.keys(fixtures).sort((a, b) => new Date(a).getTime() - new Date(b).getTime()), [fixtures]);

    const renderFixture = (fixture: Fixture) => (
      <div key={fixture.fixture.id} className="rounded-lg border bg-card p-3 text-sm">
         <div className="flex justify-between items-center text-xs text-muted-foreground mb-2">
              <div className="flex items-center gap-2">
                  <Avatar className="h-4 w-4">
                      <AvatarImage src={fixture.league.logo} alt={fixture.league.name} />
                      <AvatarFallback>{fixture.league.name.substring(0,1)}</AvatarFallback>
                  </Avatar>
                  <span className="truncate">{fixture.league.name}</span>
              </div>
              <span>{fixture.fixture.status.short === 'TBD' ? 'لم تحدد' : fixture.fixture.status.long}</span>
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
                 {fixture.fixture.status.short === 'FT' || fixture.fixture.status.short === 'AET' || fixture.fixture.status.short === 'PEN'
                   ? `${fixture.goals.home} - ${fixture.goals.away}`
                   : new Date(fixture.fixture.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
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
    
    const renderEmptyState = (title: string, description: string) => (
       <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-64 p-4">
          <p className="font-bold text-lg">{title}</p>
          <p className="text-sm">{description}</p>
      </div>
    )

    const hasFavorites = useMemo(() => 
        (favorites?.teams && Object.keys(favorites.teams).length > 0) || (favorites?.leagues && Object.keys(favorites.leagues).length > 0),
    [favorites]);


    if (filter === 'favorites' && !hasFavorites) {
        return renderEmptyState("لا توجد مباريات في مفضلتك", "أضف فرقا أو بطولات للمفضلة لترى مبارياتها هنا.");
    }
      
    const renderedContent = sortedDates.map(date => {
      const fixturesForDate = fixtures[date];
      if (!fixturesForDate) return null;

      let fixturesToRender = fixturesForDate;

      if (filter === 'favorites') {
          const favoritedTeamIds = favorites?.teams ? Object.keys(favorites.teams).map(Number) : [];
          const favoritedLeagueIds = favorites?.leagues ? Object.keys(favorites.leagues).map(Number) : [];
          
          fixturesToRender = fixturesForDate.filter(f =>
              (favoritedTeamIds.includes(f.teams.home.id) || 
              favoritedTeamIds.includes(f.teams.away.id) ||
              favoritedLeagueIds.includes(f.league.id))
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
                  {fixturesToRender.map(renderFixture)}
              </div>
          </div>
      )
    }).filter(Boolean);

    if (renderedContent.length === 0 && !isLoadingPrev && !isLoadingNext) {
         if (filter === 'favorites' && hasFavorites) {
            return renderEmptyState(
                "لا توجد مباريات مفضلة في هذه الفترة",
                "جرّب التمرير لأعلى أو لأسفل لعرض أيام أخرى."
            );
        }
        if (filter !== 'favorites') {
             return renderEmptyState(
                "لا توجد مباريات متاحة.",
                "جرّب التمرير لأعلى أو لأسفل لعرض أيام أخرى."
            );
        }
    }

    return (
        <div className="p-4">
            <InfiniteScrollTrigger
                onVisible={loadPreviousDay}
                isLoading={isLoadingPrev}
                hasMore={hasMorePrev}
            />
            {renderedContent}
            <InfiniteScrollTrigger
                onVisible={loadNextDay}
                isLoading={isLoadingNext}
                hasMore={hasMoreNext}
            />
        </div>
    );
};


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
          >
             <FixturesList filter="favorites" favorites={favorites}/>
          </TabsContent>
          <TabsContent 
            value="all-matches" 
            className="mt-0 flex-1 overflow-y-auto"
          >
            <FixturesList favorites={favorites} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
