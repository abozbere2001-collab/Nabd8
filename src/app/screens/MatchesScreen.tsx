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
import { collection, onSnapshot } from 'firebase/firestore';
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

interface GroupedFixtures {
    [date: string]: Fixture[];
}


const getDayLabel = (dateString: string) => {
    const date = parseISO(dateString);
    if (isToday(date)) return "اليوم";
    if (isYesterday(date)) return "الأمس";
    if (isTomorrow(date)) return "غداً";
    return format(date, "EEEE", { locale: ar });
}

export function MatchesScreen({ navigate, goBack, canGoBack }: ScreenProps) {
  const { user } = useFirebase();
  const [favoriteTeams, setFavoriteTeams] = useState<Set<number>>(new Set());
  const [favoriteLeagues, setFavoriteLeagues] = useState<Set<number>>(new Set());

  const [groupedFixtures, setGroupedFixtures] = useState<GroupedFixtures>({});
  const [isLoadingNext, setIsLoadingNext] = useState(false);
  const [isLoadingPrev, setIsLoadingPrev] = useState(false);
  const [earliestDate, setEarliestDate] = useState(new Date());
  const [latestDate, setLatestDate] = useState(new Date());

  const allMatchesContainerRef = useRef<HTMLDivElement>(null);
  const myResultsContainerRef = useRef<HTMLDivElement>(null);
  
  const scrollPositions = useRef({ all: 0, my: 0 }).current;
  const scrollHeights = useRef({ all: 0, my: 0 }).current;


  useEffect(() => {
    if (!user) return;
    const teamsUnsub = onSnapshot(collection(db, `users/${user.uid}/favoriteTeams`), (snapshot) => {
      const teams = new Set<number>();
      snapshot.forEach((doc) => {
        teams.add(doc.data().teamId);
      });
      setFavoriteTeams(teams);
    });

    const leaguesUnsub = onSnapshot(collection(db, `users/${user.uid}/favoriteLeagues`), (snapshot) => {
      const leagues = new Set<number>();
      snapshot.forEach((doc) => {
        leagues.add(doc.data().leagueId);
      });
      setFavoriteLeagues(leagues);
    });

    return () => {
      teamsUnsub();
      leaguesUnsub();
    };
  }, [user]);

  const fetchFixtures = useCallback(async (date: Date) => {
    const dateString = format(date, 'yyyy-MM-dd');
    if (groupedFixtures[dateString]) return;

    try {
      const response = await fetch(`/api/football/fixtures?date=${dateString}`);
      const data = await response.json();
      const newFixtures = data.response || [];

      setGroupedFixtures(prev => ({
          ...prev,
          [dateString]: newFixtures
      }));
    } catch (error) {
      console.error(`Failed to fetch fixtures for ${dateString}:`, error);
      setGroupedFixtures(prev => ({ ...prev, [dateString]: [] }));
    }
  }, [groupedFixtures]);

  useEffect(() => {
    fetchFixtures(new Date());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleScroll = useCallback((container: HTMLDivElement | null, type: 'all' | 'my') => {
      if (!container) return;

      const { scrollTop, scrollHeight, clientHeight } = container;
      scrollPositions[type] = scrollTop;
      scrollHeights[type] = scrollHeight;

      const loadNextDay = async () => {
          if (isLoadingNext) return;
          setIsLoadingNext(true);
          const nextDay = addDays(latestDate, 1);
          await fetchFixtures(nextDay);
          setLatestDate(nextDay);
          setIsLoadingNext(false);
      };

      const loadPreviousDay = async () => {
          if (isLoadingPrev) return;
          setIsLoadingPrev(true);
          const prevDay = subDays(earliestDate, 1);
          
          const oldScrollHeight = container.scrollHeight;

          await fetchFixtures(prevDay);
          setEarliestDate(prevDay);
          
          setTimeout(() => {
            if (container) {
                const newScrollHeight = container.scrollHeight;
                const addedHeight = newScrollHeight - oldScrollHeight;
                container.scrollTop = scrollTop + addedHeight;
                scrollPositions[type] += addedHeight;
            }
            setIsLoadingPrev(false);
          }, 100);
      };

      if (scrollTop + clientHeight >= scrollHeight - 300 && !isLoadingNext) {
          loadNextDay();
      }
      if (scrollTop <= 300 && !isLoadingPrev) {
          loadPreviousDay();
      }
  }, [isLoadingNext, isLoadingPrev, latestDate, earliestDate, fetchFixtures, scrollPositions, scrollHeights]);


  useEffect(() => {
    const allMatchesContainer = allMatchesContainerRef.current;
    const myResultsContainer = myResultsContainerRef.current;

    const allMatchesScrollHandler = () => handleScroll(allMatchesContainer, 'all');
    const myResultsScrollHandler = () => handleScroll(myResultsContainer, 'my');

    if (allMatchesContainer) {
        allMatchesContainer.addEventListener('scroll', allMatchesScrollHandler);
        allMatchesContainer.scrollTop = scrollPositions.all;
    }
    if (myResultsContainer) {
        myResultsContainer.addEventListener('scroll', myResultsScrollHandler);
        myResultsContainer.scrollTop = scrollPositions.my;
    }
    
    return () => {
        if (allMatchesContainer) {
            allMatchesContainer.removeEventListener('scroll', allMatchesScrollHandler);
        }
        if (myResultsContainer) {
            myResultsContainer.removeEventListener('scroll', myResultsScrollHandler);
        }
    };
  }, [handleScroll, scrollPositions]);

  const sortedDates = useMemo(() => Object.keys(groupedFixtures).sort((a, b) => new Date(a).getTime() - new Date(b).getTime()), [groupedFixtures]);

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
     <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-64">
        <p className="font-bold text-lg">{title}</p>
        <p className="text-sm">{description}</p>
    </div>
  )

  const renderFixturesForDate = (dateString: string) => {
    const fixturesForDate = groupedFixtures[dateString];
    if (!fixturesForDate) {
        return (
            <div key={`${dateString}-loading`} className="p-4">
                <h2 className="font-bold text-lg sticky top-0 bg-background/95 backdrop-blur-sm z-10 p-4 py-3 border-b -mx-4">
                  <Skeleton className="h-6 w-1/2" />
                </h2>
                <div className="space-y-3 pt-4">
                    {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
                </div>
            </div>
        );
    }
     if (fixturesForDate.length === 0) return null;
        
     return (
        <div key={dateString}>
            <h2 className="font-bold text-lg sticky top-0 bg-background/95 backdrop-blur-sm z-10 p-4 py-3 border-b -mx-4">
              {getDayLabel(dateString)}
              <span className="text-sm font-normal text-muted-foreground ml-2">{format(parseISO(dateString), "d MMMM yyyy", { locale: ar })}</span>
            </h2>
            <div className="space-y-3 pt-4">
                {fixturesForDate.map(renderFixture)}
            </div>
        </div>
    )
  }
  
  const renderAllMatches = () => {
    if (sortedDates.length === 0 && (isLoadingPrev || isLoadingNext)) {
        return (
            <div className="px-4 space-y-3 pt-4">
                <Skeleton className="h-6 w-1/2 mb-4" />
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
        );
    }
    
    if (sortedDates.every(date => (groupedFixtures[date] || []).length === 0)) {
        return renderEmptyState("لا توجد مباريات متاحة.", "حاول مرة أخرى في وقت لاحق أو تأكد من اتصالك بالإنترنت.");
    }
    
    return (
        <div className="p-4">
            {isLoadingPrev && <div className="py-4"><Skeleton className="h-24 w-full" /></div>}
            {sortedDates.map(renderFixturesForDate)}
            {isLoadingNext && <div className="py-4"><Skeleton className="h-24 w-full" /></div>}
        </div>
    );
  }
  
  const renderMyResults = () => {
      let hasFavorites = false;

      const content = sortedDates.map(dateString => {
        const fixturesForDate = groupedFixtures[dateString] || [];
        if (fixturesForDate.length === 0) return null;

        const favoriteTeamFixtures = fixturesForDate.filter(f =>
            favoriteTeams.has(f.teams.home.id) || favoriteTeams.has(f.teams.away.id)
        );

        const favoriteLeagueFixtures = fixturesForDate.filter(f =>
            favoriteLeagues.has(f.league.id) && !favoriteTeamFixtures.some(fav => fav.fixture.id === f.fixture.id)
        );

        if (favoriteTeamFixtures.length === 0 && favoriteLeagueFixtures.length === 0) {
            return null;
        }

        hasFavorites = true;

        return (
            <div key={dateString}>
                 <h2 className="font-bold text-lg sticky top-0 bg-background/95 backdrop-blur-sm z-10 p-4 py-3 border-b -mx-4">
                  {getDayLabel(dateString)}
                  <span className="text-sm font-normal text-muted-foreground ml-2">{format(parseISO(dateString), "d MMMM yyyy", { locale: ar })}</span>
                </h2>
                <div className="pt-4 space-y-4">
                   {favoriteTeamFixtures.length > 0 && (
                        <div>
                            <h3 className="font-bold text-base my-2">الفرق المفضلة</h3>
                            <div className="space-y-3">
                                {favoriteTeamFixtures.map(renderFixture)}
                            </div>
                        </div>
                   )}
                   {favoriteLeagueFixtures.length > 0 && (
                        <div>
                            <h3 className="font-bold text-base my-2">البطولات المفضلة</h3>
                            <div className="space-y-3">
                                {favoriteLeagueFixtures.map(renderFixture)}
                            </div>
                        </div>
                   )}
                </div>
            </div>
        );
      }).filter(Boolean);

    if (sortedDates.length === 0 && (isLoadingPrev || isLoadingNext)) {
        return (
             <div className="px-4 space-y-3 pt-4">
                <Skeleton className="h-6 w-1/2 mb-4" />
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
        )
    }

    if (!hasFavorites && !isLoadingPrev && !isLoadingNext) {
        return renderEmptyState("لا توجد مباريات في مفضلتك", "أضف فرقا أو بطولات للمفضلة لترى مبارياتها هنا. اسحب للأسفل أو الأعلى لعرض أيام أخرى.");
    }
    
    return (
        <div className="p-4">
            {isLoadingPrev && <div className="py-4"><Skeleton className="h-24 w-full" /></div>}
            {content}
            {isLoadingNext && <div className="py-4"><Skeleton className="h-24 w-full" /></div>}
        </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader title="المباريات" onBack={goBack} canGoBack={canGoBack} />
      <div className="flex-1 flex flex-col">
        <Tabs defaultValue="my-results" className="w-full flex-1 flex flex-col">
          <div className="p-4 border-b">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="my-results">نتائجي</TabsTrigger>
              <TabsTrigger value="all-matches">كل المباريات</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent 
            value="my-results" 
            className="mt-0 flex-1 overflow-y-auto"
            ref={myResultsContainerRef}
          >
             {renderMyResults()}
          </TabsContent>
          <TabsContent 
            value="all-matches" 
            className="mt-0 flex-1 overflow-y-auto"
            ref={allMatchesContainerRef}
          >
            {renderAllMatches()}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
