"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import type { ScreenProps } from '@/app/page';
import { addDays, format, isToday, isYesterday, isTomorrow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

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

// NOTE: These are temporary, will be replaced by Firebase
const TEMP_FAVORITE_TEAMS = new Set([50, 529]); // Example: Man City, Real Madrid
const TEMP_FAVORITE_LEAGUES = new Set([39, 140]); // Example: Premier League, La Liga

const DateSelector = ({ selectedDate, onDateChange }: { selectedDate: Date, onDateChange: (date: Date) => void}) => {
  const dates = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 30 }).map((_, i) => addDays(today, i - 15));
  }, []);

  const getDayLabel = (date: Date) => {
    if (isToday(date)) return "اليوم";
    if (isYesterday(date)) return "الأمس";
    if (isTomorrow(date)) return "غداً";
    return format(date, "E", { locale: ar });
  }

  return (
    <div className="p-2 border-b">
        <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex w-max space-x-2">
            {dates.map(date => {
                const isSelected = format(date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
                return (
                <button 
                    key={date.toISOString()}
                    onClick={() => onDateChange(date)}
                    className={cn(
                        "flex flex-col items-center justify-center rounded-md p-2 w-16 h-16 transition-colors",
                        isSelected ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent"
                    )}
                >
                    <span className="text-sm font-semibold">{getDayLabel(date)}</span>
                    <span className="text-xl font-bold">{format(date, "dd")}</span>
                    <span className="text-xs">{format(date, "MMM", { locale: ar })}</span>
                </button>
                )
            })}
            </div>
            <ScrollBar orientation="horizontal" />
        </ScrollArea>
    </div>
  )
}

export function MatchesScreen({ navigate, goBack, canGoBack }: ScreenProps) {
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const fetchFixtures = useCallback(async (date: Date) => {
    setLoading(true);
    try {
      const dateString = format(date, 'yyyy-MM-dd');
      const response = await fetch(`/api/football/fixtures?date=${dateString}`);
      const data = await response.json();
      if (data.response) {
        setFixtures(data.response);
      } else {
        setFixtures([]);
      }
    } catch (error) {
      console.error("Failed to fetch fixtures:", error);
      setFixtures([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    console.log("MatchesScreen: init or date changed");
    fetchFixtures(selectedDate);
  }, [selectedDate, fetchFixtures]);

  const favoriteTeamFixtures = useMemo(() => fixtures.filter(f =>
    TEMP_FAVORITE_TEAMS.has(f.teams.home.id) || TEMP_FAVORITE_TEAMS.has(f.teams.away.id)
  ), [fixtures]);

  const favoriteLeagueFixtures = useMemo(() => fixtures.filter(f =>
    TEMP_FAVORITE_LEAGUES.has(f.league.id) && !favoriteTeamFixtures.some(fav => fav.fixture.id === f.fixture.id)
  ), [fixtures, favoriteTeamFixtures]);
  
  const otherFixtures = useMemo(() => fixtures.filter(f => 
    !favoriteTeamFixtures.some(fav => fav.fixture.id === f.fixture.id) &&
    !favoriteLeagueFixtures.some(favL => favL.fixture.id === f.fixture.id)
  ), [fixtures, favoriteTeamFixtures, favoriteLeagueFixtures]);


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

  const renderSection = (title: string, data: Fixture[]) => {
    if (data.length === 0) return null;
    return (
        <div>
            <h3 className="font-bold text-lg my-4 px-4">{title}</h3>
            <div className="space-y-3 px-4">
                {data.map(renderFixture)}
            </div>
        </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader title="المباريات" onBack={goBack} canGoBack={canGoBack} />
       <DateSelector selectedDate={selectedDate} onDateChange={setSelectedDate} />
      <div className="flex-1 overflow-y-auto">
        <Tabs defaultValue="my-results" className="w-full">
          <div className="p-4 sticky top-0 bg-background z-10">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="my-results">نتائجي</TabsTrigger>
              <TabsTrigger value="all-matches">كل المباريات</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="my-results" className="p-0 pt-0 space-y-4">
             {loading ? (
                 <div className="px-4 space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
                 </div>
             ) : favoriteTeamFixtures.length === 0 && favoriteLeagueFixtures.length === 0 ? (
                renderEmptyState("لا توجد مباريات في مفضلتك لهذا اليوم", "أضف فرقا أو بطولات للمفضلة لترى مبارياتها هنا.")
             ) : (
                <>
                  {renderSection("الفرق المفضلة", favoriteTeamFixtures)}
                  {renderSection("البطولات المفضلة", favoriteLeagueFixtures)}
                </>
             )}
          </TabsContent>
          <TabsContent value="all-matches" className="p-0 pt-0 space-y-4">
            {loading ? (
                 <div className="px-4 space-y-3">
                    {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
                 </div>
            ) : fixtures.length > 0 ? (
                <div className="space-y-3 px-4 pb-4">
                    {fixtures.map(renderFixture)}
                </div>
            ) : (
                renderEmptyState("لا توجد مباريات متاحة لهذا اليوم.", "حاول مرة أخرى في وقت لاحق أو تأكد من اتصالك بالإنترنت.")
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

    