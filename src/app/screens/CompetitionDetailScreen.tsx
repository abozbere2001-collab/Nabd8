"use client";

import React, { useEffect, useState } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ScreenProps } from '@/app/page';
import { useAdmin } from '@/firebase/provider';
import { Button } from '@/components/ui/button';
import { Star, Pencil, Shield, Users, Trophy, BarChart2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useFirebase } from '@/firebase/provider';
import { db } from '@/lib/firebase-client';
import { doc, setDoc, onSnapshot, updateDoc, deleteField } from 'firebase/firestore';


// Interfaces for API data
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
  teams: {
    home: { id: number; name: string; logo: string; winner: boolean };
    away: { id: number; name: string; logo: string; winner: boolean };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
}

interface Standing {
  rank: number;
  team: {
    id: number;
    name: string;
    logo: string;
  };
  points: number;
  goalsDiff: number;
  all: {
    played: number;
    win: number;
    draw: number;
    lose: number;
  };
}

interface TopScorer {
    player: {
        id: number;
        name: string;
        photo: string;
    };
    statistics: {
        team: {
            name: string;
        };
        goals: {
            total: number;
        };
        penalty: {
            scored: number;
        }
    }[];
}

interface Team {
  team: {
    id: number;
    name: string;
    logo: string;
  };
}

interface Favorites {
    leagues: { [key: number]: any };
    teams: { [key: number]: any };
}

const CURRENT_SEASON = 2024;

export function CompetitionDetailScreen({ navigate, goBack, canGoBack, title, leagueId, logo }: ScreenProps & { title?: string, leagueId?: number, logo?: string }) {
  const { isAdmin } = useAdmin();
  const { user } = useFirebase();

  const [favorites, setFavorites] = useState<Favorites>({ leagues: {}, teams: {} });

  const [loading, setLoading] = useState(true);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [topScorers, setTopScorers] = useState<TopScorer[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  
  const isFavorited = leagueId ? favorites.leagues[leagueId] : false;

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'favorites', user.uid), (doc) => {
        setFavorites(doc.data() as Favorites || { leagues: {}, teams: {} });
    });
    return () => unsub();
  }, [user]);


  useEffect(() => {
    async function fetchData() {
      if (!leagueId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const [fixturesRes, standingsRes, scorersRes, teamsRes] = await Promise.all([
          fetch(`/api/football/fixtures?league=${leagueId}&season=${CURRENT_SEASON}`),
          fetch(`/api/football/standings?league=${leagueId}&season=${CURRENT_SEASON}`),
          fetch(`/api/football/players/topscorers?league=${leagueId}&season=${CURRENT_SEASON}`),
          fetch(`/api/football/teams?league=${leagueId}&season=${CURRENT_SEASON}`)
        ]);

        const fixturesData = await fixturesRes.json();
        const standingsData = await standingsRes.json();
        const scorersData = await scorersRes.json();
        const teamsData = await teamsRes.json();

        if (fixturesData.response) setFixtures(fixturesData.response);
        if (standingsData.response[0]?.league?.standings[0]) setStandings(standingsData.response[0].league.standings[0]);
        if (scorersData.response) setTopScorers(scorersData.response);
        if (teamsData.response) setTeams(teamsData.response);

      } catch (error) {
        console.error("Failed to fetch competition details:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [leagueId]);

  const handleFavoriteLeague = async () => {
    if (!user || !leagueId) return;
    const favRef = doc(db, 'favorites', user.uid);
    const fieldPath = `leagues.${leagueId}`;

    if (isFavorited) {
        await updateDoc(favRef, { [fieldPath]: deleteField() });
    } else {
        await setDoc(favRef, { 
            leagues: { 
                [leagueId]: { 
                    leagueId: leagueId, 
                    name: title, 
                    logo: logo || teams[0]?.team?.logo
                } 
            } 
        }, { merge: true });
    }
  };
  
  const toggleTeamFavorite = async (team: {id: number, name: string, logo: string}) => {
    if (!user) return;
    const favRef = doc(db, 'favorites', user.uid);
    const fieldPath = `teams.${team.id}`;
    const isTeamFavorited = favorites.teams[team.id];

    if (isTeamFavorited) {
        await updateDoc(favRef, { [fieldPath]: deleteField() });
    } else {
        await setDoc(favRef, {
             teams: { 
                [team.id]: {
                    teamId: team.id,
                    name: team.name,
                    logo: team.logo,
                } 
            }
        }, { merge: true });
    }
  };
  
  const headerActions = (
    <div className="flex items-center gap-1">
      {isAdmin && (
         <Button
          variant="ghost"
          size="icon"
          onClick={() => console.log('Rename clicked for', title)}
        >
          <Pencil className="h-5 w-5" />
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        onClick={handleFavoriteLeague}
      >
        <Star className={isFavorited ? "h-5 w-5 text-yellow-400 fill-current" : "h-5 w-5 text-muted-foreground/80"} />
      </Button>
    </div>
  );

  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader title={title || "البطولة"} onBack={goBack} canGoBack={canGoBack} actions={headerActions} />
       <div className="flex-1 overflow-y-auto">
        <p className="text-center text-xs text-muted-foreground py-2">جميع البيانات تخص موسم {CURRENT_SEASON}</p>
        <Tabs defaultValue="matches" className="w-full">
          <div className="p-4 pb-0 sticky top-0 bg-background z-10">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="matches"><Shield className="w-4 h-4 ml-1"/>المباريات</TabsTrigger>
              <TabsTrigger value="standings"><Trophy className="w-4 h-4 ml-1"/>الترتيب</TabsTrigger>
              <TabsTrigger value="scorers"><BarChart2 className="w-4 h-4 ml-1"/>الهدافين</TabsTrigger>
              <TabsTrigger value="teams"><Users className="w-4 h-4 ml-1"/>الفرق</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="matches" className="p-4">
             {loading ? (
                <div className="space-y-4">
                    {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
                </div>
            ) : fixtures.length > 0 ? (
                <div className="space-y-3">
                    {fixtures.map(({ fixture, teams, goals }) => (
                        <div key={fixture.id} className="rounded-lg border bg-card p-3 text-sm">
                           <div className="flex justify-between items-center text-xs text-muted-foreground mb-2">
                                <span>{new Date(fixture.date).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                <span>{fixture.status.short}</span>
                           </div>
                           <div className="flex items-center justify-between gap-2">
                               <div className="flex items-center gap-2 flex-1 justify-end truncate">
                                   <span className="font-semibold truncate">{teams.home.name}</span>
                                   <Avatar className="h-8 w-8">
                                       <AvatarImage src={teams.home.logo} alt={teams.home.name} />
                                       <AvatarFallback>{teams.home.name.substring(0, 2)}</AvatarFallback>
                                   </Avatar>
                               </div>
                               <div className="font-bold text-lg px-2 bg-muted rounded-md">
                                   {goals.home !== null ? `${goals.home} - ${goals.away}` : new Date(fixture.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                               </div>
                               <div className="flex items-center gap-2 flex-1 truncate">
                                    <Avatar className="h-8 w-8">
                                       <AvatarImage src={teams.away.logo} alt={teams.away.name} />
                                       <AvatarFallback>{teams.away.name.substring(0, 2)}</AvatarFallback>
                                   </Avatar>
                                   <span className="font-semibold truncate">{teams.away.name}</span>
                               </div>
                           </div>
                        </div>
                    ))}
                </div>
            ) : <p className="pt-4 text-center text-muted-foreground">لا توجد مباريات متاحة لهذا الموسم.</p>}
          </TabsContent>
          <TabsContent value="standings" className="p-4">
            {loading ? (
                 <div className="space-y-4">
                    {Array.from({ length: 18 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
            ) : standings.length > 0 ? (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="text-right w-[50px]"></TableHead>
                            <TableHead className="text-right w-1/2">الفريق</TableHead>
                            <TableHead className="text-center">لعب</TableHead>
                            <TableHead className="text-center">ف</TableHead>
                            <TableHead className="text-center">ت</TableHead>
                            <TableHead className="text-center">خ</TableHead>
                            <TableHead className="text-center">نقاط</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {standings.map((s) => (
                            <TableRow key={s.team.id}>
                                 <TableCell>
                                     <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleTeamFavorite(s.team);
                                        }}
                                    >
                                        <Star className={favorites.teams[s.team.id] ? "h-5 w-5 text-yellow-400 fill-current" : "h-5 w-5 text-muted-foreground/50"} />
                                    </Button>
                                </TableCell>
                                <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                        <span>{s.rank}</span>
                                        <Avatar className="h-6 w-6">
                                            <AvatarImage src={s.team.logo} alt={s.team.name} />
                                            <AvatarFallback>{s.team.name.substring(0,1)}</AvatarFallback>
                                        </Avatar>
                                        <span className="truncate">{s.team.name}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-center">{s.all.played}</TableCell>
                                <TableCell className="text-center">{s.all.win}</TableCell>
                                <TableCell className="text-center">{s.all.draw}</TableCell>
                                <TableCell className="text-center">{s.all.lose}</TableCell>
                                <TableCell className="text-center font-bold">{s.points}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            ): <p className="pt-4 text-center text-muted-foreground">جدول الترتيب غير متاح حاليًا.</p>}
          </TabsContent>
           <TabsContent value="scorers" className="p-4">
            {loading ? (
                <div className="space-y-4">
                    {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
            ) : topScorers.length > 0 ? (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="text-right">اللاعب</TableHead>
                            <TableHead className="text-center">الأهداف</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {topScorers.map(({ player, statistics }) => (
                            <TableRow key={player.id}>
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-10 w-10">
                                            <AvatarImage src={player.photo} alt={player.name} />
                                            <AvatarFallback>{player.name.substring(0, 2)}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="font-semibold">{player.name}</p>
                                            <p className="text-xs text-muted-foreground">{statistics[0]?.team.name}</p>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="text-center font-bold text-lg">{statistics[0]?.goals.total}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            ) : <p className="pt-4 text-center text-muted-foreground">قائمة الهدافين غير متاحة حاليًا.</p>}
          </TabsContent>
          <TabsContent value="teams" className="p-4">
            {loading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {Array.from({ length: 12 }).map((_, i) => (
                        <div key={i} className="flex flex-col items-center gap-2 rounded-lg border bg-card p-4">
                            <Skeleton className="h-16 w-16 rounded-full" />
                            <Skeleton className="h-4 w-24" />
                        </div>
                    ))}
                </div>
            ) : teams.length > 0 ? (
                 <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {teams.map(({ team }) => (
                        <div key={team.id} className="relative flex flex-col items-center gap-2 rounded-lg border bg-card p-4 text-center">
                            <Avatar className="h-16 w-16">
                                <AvatarImage src={team.logo} alt={team.name} />
                                <AvatarFallback>{team.name.substring(0, 2)}</AvatarFallback>
                            </Avatar>
                            <span className="font-semibold text-sm">{team.name}</span>
                            <div className="absolute top-1 right-1 flex">
                                 <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleTeamFavorite(team);
                                    }}
                                >
                                    <Star className={favorites.teams[team.id] ? "h-5 w-5 text-yellow-400 fill-current" : "h-5 w-5 text-muted-foreground/50"} />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : <p className="pt-4 text-center text-muted-foreground">قائمة الفرق غير متاحة حاليًا.</p>}
        </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
