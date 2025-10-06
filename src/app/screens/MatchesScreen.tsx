"use client";

import React, { useEffect, useState } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import type { ScreenProps } from '@/app/page';

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

export function MatchesScreen({ navigate, goBack, canGoBack }: ScreenProps) {
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchFixtures() {
      setLoading(true);
      try {
        const today = new Date().toISOString().split('T')[0];
        const response = await fetch(`/api/football/fixtures?date=${today}`);
        const data = await response.json();
        if (data.response) {
          setFixtures(data.response);
        }
      } catch (error) {
        console.error("Failed to fetch fixtures:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchFixtures();
  }, []);

  const favoriteTeamFixtures = fixtures.filter(f =>
    TEMP_FAVORITE_TEAMS.has(f.teams.home.id) || TEMP_FAVORITE_TEAMS.has(f.teams.away.id)
  );

  const favoriteLeagueFixtures = fixtures.filter(f =>
    TEMP_FAVORITE_LEAGUES.has(f.league.id) && !favoriteTeamFixtures.some(fav => fav.fixture.id === f.fixture.id)
  );
  
  const todayString = new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

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
               {fixture.goals.home !== null ? `${fixture.goals.home} - ${fixture.goals.away}` : new Date(fixture.fixture.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
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

  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader title="المباريات" onBack={goBack} canGoBack={canGoBack} />
      <div className="flex-1 overflow-y-auto">
        <Tabs defaultValue="my-results" className="w-full">
          <div className="p-4 sticky top-0 bg-background z-10">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="my-results">نتائجي</TabsTrigger>
              <TabsTrigger value="all-matches">كل المباريات</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="my-results" className="p-4 pt-0 space-y-4">
             {loading ? (
                Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
             ) : favoriteTeamFixtures.length === 0 && favoriteLeagueFixtures.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-64">
                    <p className="font-bold text-lg">لا توجد مباريات في مفضلتك اليوم</p>
                    <p className="text-sm">أضف فرقا أو بطولات للمفضلة لترى مبارياتها هنا.</p>
                </div>
             ) : (
                <>
                  {favoriteTeamFixtures.length > 0 && (
                    <div>
                      <h3 className="font-bold text-lg mb-2">الفرق المفضلة</h3>
                      <div className="space-y-3">
                        {favoriteTeamFixtures.map(renderFixture)}
                      </div>
                    </div>
                  )}
                  {favoriteLeagueFixtures.length > 0 && (
                    <div>
                      <h3 className="font-bold text-lg mt-4 mb-2">البطولات المفضلة</h3>
                      <div className="space-y-3">
                        {favoriteLeagueFixtures.map(renderFixture)}
                      </div>
                    </div>
                  )}
                </>
             )}
          </TabsContent>
          <TabsContent value="all-matches" className="space-y-4 p-4 pt-0">
            <p className="text-sm text-muted-foreground text-center py-2">{todayString}</p>
            {loading ? (
                 Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
            ) : fixtures.length > 0 ? (
                <div className="space-y-3">
                    {fixtures.map(renderFixture)}
                </div>
            ) : (
                <p className="text-center text-muted-foreground pt-10">لا توجد مباريات متاحة لهذا اليوم.</p>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
