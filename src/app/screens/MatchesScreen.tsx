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
    leagues?: { [key: number]: any };
    teams?: { [key: number]: any };
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

const START_DATE = subDays(new Date(), 180);
const END_DATE = addDays(new Date(), 180);

export function MatchesScreen({ navigate, goBack, canGoBack }: ScreenProps) {
  const { user } = useFirebase();
  const [favorites, setFavorites] = useState<Favorites>({});

  const [fixtures, setFixtures] = useState<GroupedFixtures>({});
  const [isLoadingNext, setIsLoadingNext] = useState(false);
  const [isLoadingPrev, setIsLoadingPrev] = useState(false);
  const [hasMoreNext, setHasMoreNext] = useState(true);
  const [hasMorePrev, setHasMorePrev] = useState(true);
  const [earliestDate, setEarliestDate] = useState(new Date());
  const [latestDate, setLatestDate] = useState(new Date());

  const allMatchesContainerRef = useRef<HTMLDivElement>(null);
  const myResultsContainerRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef<Record<string, number>>({ all: 0, my: 0 });

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'favorites', user.uid), (doc) => {
      setFavorites(doc.data() as Favorites || {});
    });
    return () => unsub();
  }, [user]);

  const fetchFixturesByDate = useCallback(async (date: Date): Promise<boolean> => {
    const dateString = format(date, 'yyyy-MM-dd');
    if (fixtures[dateString]) return true; // Already fetched

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
  }, [fixtures]);
  
  // Initial fetch for today
  useEffect(() => {
    const today = new Date();
    setEarliestDate(today);
    setLatestDate(today);
    setHasMorePrev(today > START_DATE);
    setHasMoreNext(today < END_DATE);
    fetchFixturesByDate(today);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadNextDay = useCallback(async () => {
    if (isLoadingNext || !hasMoreNext) return;
    
    setIsLoadingNext(true);
    const nextDay = addDays(latestDate, 1);
    await fetchFixturesByDate(nextDay);
    
    setLatestDate(nextDay);
    if (nextDay >= END_DATE) {
      setHasMoreNext(false);
    }
    setIsLoadingNext(false);
  }, [isLoadingNext, hasMoreNext, latestDate, fetchFixturesByDate]);

  const loadPreviousDay = useCallback(async (container: HTMLDivElement | null) => {
      if (isLoadingPrev || !hasMorePrev || !container) return;

      setIsLoadingPrev(true);
      const prevDay = subDays(earliestDate, 1);
      
      prevScrollHeightRef.current[container.id] = container.scrollHeight;

      await fetchFixturesByDate(prevDay);
      setEarliestDate(prevDay);
      
      if (prevDay <= START_DATE) {
          setHasMorePrev(false);
      }
      // The scroll adjustment will happen in a useLayoutEffect
      // setIsLoadingPrev(false) is called in the effect
  }, [isLoadingPrev, hasMorePrev, earliestDate, fetchFixturesByDate]);

  useEffect(() => {
      if (isLoadingPrev) {
          const containerAll = allMatchesContainerRef.current;
          const containerMy = myResultsContainerRef.current;
          
          const adjustScroll = (container: HTMLDivElement | null) => {
            if (container && prevScrollHeightRef.current[container.id]) {
                const newScrollHeight = container.scrollHeight;
                const previousHeight = prevScrollHeightRef.current[container.id];
                container.scrollTop += (newScrollHeight - previousHeight);
                prevScrollHeightRef.current[container.id] = 0; // Reset
            }
          }

          requestAnimationFrame(() => {
            adjustScroll(containerAll);
            adjustScroll(containerMy);
            setIsLoadingPrev(false);
          });
      }
  }, [fixtures, isLoadingPrev]);


  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>, type: 'all' | 'my') => {
      const container = e.currentTarget;
      if (!container) return;

      const { scrollTop, scrollHeight, clientHeight } = container;

      if (scrollHeight - scrollTop - clientHeight < 300) { // Near bottom
          loadNextDay();
      }
      if (scrollTop < 300) { // Near top
          loadPreviousDay(container);
      }
  }, [loadNextDay, loadPreviousDay]);

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

  const renderFixturesForDate = (dateString: string, filter?: 'favorites') => {
    const fixturesForDate = fixtures[dateString];
    if (!fixturesForDate) return null;

    let fixturesToRender = fixturesForDate;

    if (filter === 'favorites') {
        const favoritedTeamIds = favorites?.teams ? Object.keys(favorites.teams).map(Number) : [];
        const favoritedLeagueIds = favorites?.leagues ? Object.keys(favorites.leagues).map(Number) : [];
        
        const favoriteTeamFixtures = fixturesForDate.filter(f =>
            favoritedTeamIds.includes(f.teams.home.id) || favoritedTeamIds.includes(f.teams.away.id)
        );

        const favoriteLeagueFixtures = fixturesForDate.filter(f =>
            favoritedLeagueIds.includes(f.league.id) && !favoriteTeamFixtures.some(fav => fav.fixture.id === f.fixture.id)
        );

        const allFavoriteFixtures = [...favoriteTeamFixtures, ...favoriteLeagueFixtures];
        if(allFavoriteFixtures.length === 0) return null;
        fixturesToRender = allFavoriteFixtures;
    }
     
     if (fixturesToRender.length === 0) return null;

     return (
        <div key={dateString}>
            <h2 className="font-bold text-lg sticky top-0 bg-background/95 backdrop-blur-sm z-10 p-4 py-3 border-b -mx-4">
              {getDayLabel(dateString)}
              <span className="text-sm font-normal text-muted-foreground ml-2">{format(parseISO(dateString), "d MMMM yyyy", { locale: ar })}</span>
            </h2>
            <div className="space-y-3 pt-4">
                {fixturesToRender.map(renderFixture)}
            </div>
        </div>
    )
  }
  
  const renderAllMatches = () => {
    const renderedContent = sortedDates.map(date => renderFixturesForDate(date)).filter(Boolean);
    
    if (renderedContent.length === 0 && !isLoadingPrev && !isLoadingNext) {
        return renderEmptyState("لا توجد مباريات متاحة.", "حاول التمرير لأعلى أو لأسفل لجلب أيام أخرى.");
    }
    
    return (
        <div className="p-4">
            {isLoadingPrev && <div className="py-4"><Skeleton className="h-24 w-full" /></div>}
            {renderedContent}
            {isLoadingNext && <div className="py-4"><Skeleton className="h-24 w-full" /></div>}
        </div>
    );
  }
  
  const renderMyResults = () => {
      const hasFavorites = (favorites?.teams && Object.keys(favorites.teams).length > 0) || (favorites?.leagues && Object.keys(favorites.leagues).length > 0);

      if (!hasFavorites) {
        return renderEmptyState("لا توجد مباريات في مفضلتك", "أضف فرقا أو بطولات للمفضلة لترى مبارياتها هنا.");
      }
      
      const renderedContent = sortedDates.map(date => renderFixturesForDate(date, 'favorites')).filter(Boolean);

    if (renderedContent.length === 0 && !isLoadingPrev && !isLoadingNext) {
        return renderEmptyState("لا توجد مباريات مفضلة في هذه الفترة", "جرّب التمرير لأعلى أو لأسفل لعرض أيام أخرى.");
    }
    
    return (
        <div className="p-4">
            {isLoadingPrev && <div className="py-4"><Skeleton className="h-24 w-full" /></div>}
            {renderedContent}
            {isLoadingNext && <div className="py-4"><Skeleton className="h-24 w-full" /></div>}
        </div>
    );
  }

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
            id="my"
            value="my-results" 
            className="mt-0 flex-1 overflow-y-auto"
            ref={myResultsContainerRef}
            onScroll={e => handleScroll(e, 'my')}
          >
             {renderMyResults()}
          </TabsContent>
          <TabsContent 
            id="all"
            value="all-matches" 
            className="mt-0 flex-1 overflow-y-auto"
            ref={allMatchesContainerRef}
            onScroll={e => handleScroll(e, 'all')}
          >
            {renderAllMatches()}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
