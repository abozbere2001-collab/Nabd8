"use client";

import React, { useEffect, useState } from 'react';
import type { ScreenProps } from '@/app/page';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Star, Pencil, Shirt, Users, Trophy, BarChart2 } from 'lucide-react';
import { useAdmin, useFirebase } from '@/firebase/provider';
import { doc, onSnapshot, setDoc, updateDoc, deleteField } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import { RenameDialog } from '@/components/RenameDialog';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from 'date-fns';
import { cn } from '@/lib/utils';


// --- TYPE DEFINITIONS ---
interface TeamInfo {
    team: { id: number; name: string; logo: string; country: string; founded: number; };
    venue: { name: string; city: string; capacity: number; image: string; };
}
interface Player {
    id: number;
    name: string;
    age: number;
    number: number | null;
    position: string;
    photo: string;
}
interface PlayerInfoFromApi {
    player: Player;
    statistics: any[];
}
interface Fixture {
  fixture: { id: number; date: string; status: { short: string; }; };
  teams: { home: { id: number; name: string; logo: string; }; away: { id: number; name: string; logo: string; }; };
  goals: { home: number | null; away: number | null; };
  league: any;
}
interface Standing {
  rank: number;
  team: { id: number; name: string; logo: string; };
  points: number; all: { played: number; win: number; draw: number; lose: number; };
}
interface TopScorer {
    player: { id: number; name: string; photo: string; };
    statistics: { team: { id: number; name: string;}; goals: { total: number; }; assists: number | null; }[];
}

interface Favorites {
    teams?: { [key: number]: any };
    players?: { [key: number]: any };
}
type RenameType = 'team' | 'player';

const CURRENT_SEASON = new Date().getFullYear();

// --- HOOKS ---
function useTeamData(teamId?: number) {  
  const [data, setData] = useState<{
    teamInfo: TeamInfo | null;
    players: PlayerInfoFromApi[] | null;
    fixtures: Fixture[] | null;
    standings: Standing[] | null;
    scorers: TopScorer[] | null;
    leagueId: number | null;
  }>({ teamInfo: null, players: null, fixtures: null, standings: null, scorers: null, leagueId: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teamId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const teamRes = await fetch(`/api/football/teams?id=${teamId}`);
        const teamData = await teamRes.json();

        // Fetch all pages of players
        let allPlayers: PlayerInfoFromApi[] = [];
        let currentPage = 1;
        let totalPages = 1;
        do {
            const playersRes = await fetch(`/api/football/players?team=${teamId}&season=${CURRENT_SEASON}&page=${currentPage}`);
            const playersData = await playersRes.json();
            if (playersData.response) {
                allPlayers = allPlayers.concat(playersData.response);
            }
            if (playersData.paging && playersData.paging.current < playersData.paging.total) {
                currentPage = playersData.paging.current + 1;
                totalPages = playersData.paging.total;
            } else {
                totalPages = currentPage; // stop loop
            }
        } while (currentPage < totalPages);


        const fixturesRes = await fetch(`/api/football/fixtures?team=${teamId}&season=${CURRENT_SEASON}`);
        const fixturesData = await fixturesRes.json();
        
        let leagueIdForStandings: number | null = null;
        if(fixturesData.response && fixturesData.response.length > 0) {
            leagueIdForStandings = fixturesData.response[0].league.id;
        }

        let standingsData = { response: [] };
        let scorersData = { response: [] };
        if (leagueIdForStandings) {
            const [standingsRes, scorersRes] = await Promise.all([
                 fetch(`/api/football/standings?league=${leagueIdForStandings}&season=${CURRENT_SEASON}`),
                 fetch(`/api/football/players/topscorers?league=${leagueIdForStandings}&season=${CURRENT_SEASON}`)
            ]);
            standingsData = await standingsRes.json();
            scorersData = await scorersRes.json();
        }
        
        setData({
          teamInfo: teamData.response?.[0] || null,
          players: allPlayers,
          fixtures: fixturesData.response || [],
          standings: standingsData.response?.[0]?.league?.standings?.[0] || [],
          scorers: scorersData.response || [],
          leagueId: leagueIdForStandings,
        });

      } catch (error) {
        console.error("Failed to fetch team details:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [teamId]);

  return { ...data, loading };
}


// --- MAIN SCREEN COMPONENT ---
export function TeamDetailScreen({ navigate, goBack, canGoBack, teamId, headerActions }: ScreenProps & { teamId: number; headerActions?: React.ReactNode }) {
  const { teamInfo, players, fixtures, standings, scorers, loading } = useTeamData(teamId);
  const { isAdmin, user } = useAdmin();
  const [favorites, setFavorites] = useState<Favorites>({});
  const [renameItem, setRenameItem] = useState<{ id: number; name: string; type: RenameType } | null>(null);
  const [isRenameOpen, setRenameOpen] = useState(false);
  const [displayTitle, setDisplayTitle] = useState(teamInfo?.team.name || "الفريق");

  useEffect(() => {
    if (teamId) {
        const unsub = onSnapshot(doc(db, "teamCustomizations", String(teamId)), (doc) => {
            if (doc.exists()) {
                setDisplayTitle(doc.data().customName);
            } else if (teamInfo?.team.name) {
                setDisplayTitle(teamInfo.team.name);
            }
        });
        return () => unsub();
    }
  }, [teamId, teamInfo]);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'favorites', user.uid), (doc) => {
        setFavorites(doc.data() as Favorites || {});
    });
    return () => unsub();
  }, [user]);

  const handleOpenRename = (type: RenameType, id: number, name: string) => {
    setRenameItem({ id, name, type });
    setRenameOpen(true);
  };

  const handleSaveRename = async (newName: string) => {
    if (!renameItem) return;
    const { id, type } = renameItem;
    const collectionName = type === 'player' ? 'playerCustomizations' : 'teamCustomizations';
    await setDoc(doc(db, collectionName, String(id)), { customName: newName });
  };

  const handleFavorite = async (type: 'team' | 'player', item: any) => {
    if (!user) return;
    const favRef = doc(db, 'favorites', user.uid);
    const itemPath = type === 'team' ? 'teams' : 'players';
    const fieldPath = `${itemPath}.${item.id}`;
    const isFavorited = !!favorites?.[itemPath]?.[item.id];
    
    let favoriteData: any = {};
    if (type === 'team') {
       favoriteData = { teams: { [item.id]: { teamId: item.id, name: item.name, logo: item.logo }}};
    } else {
       favoriteData = { players: { [item.id]: { playerId: item.id, name: item.name, photo: item.photo }}};
    }

    if (isFavorited) {
        await updateDoc(favRef, { [fieldPath]: deleteField() });
    } else {
        await setDoc(favRef, favoriteData, { merge: true });
    }
  };
  
  const isTeamFavorited = !!favorites?.teams?.[teamId];

  const localHeaderActions = teamInfo && (
    <div className="flex items-center gap-1">
      {isAdmin && (
         <Button variant="ghost" size="icon" onClick={() => handleOpenRename('team', teamId, displayTitle)}>
          <Pencil className="h-5 w-5" />
        </Button>
      )}
        <Button variant="ghost" size="icon" onClick={() => handleFavorite('team', teamInfo.team)}>
            <Star className={cn("h-5 w-5", isTeamFavorited ? "text-yellow-400 fill-current" : "text-muted-foreground/80")} />
        </Button>
    </div>
  );

  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader title={displayTitle} onBack={goBack} canGoBack={canGoBack} actions={headerActions} secondaryActions={localHeaderActions} />
      {renameItem && <RenameDialog isOpen={isRenameOpen} onOpenChange={setRenameOpen} currentName={renameItem.name} onSave={handleSaveRename} itemType={renameItem.type === 'team' ? 'الفريق' : 'اللاعب'} />}
      
      {loading ? <div className="p-4 space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div> : teamInfo ? (
        <div className="flex-1 overflow-y-auto">
            <Tabs defaultValue="details" className="w-full">
                 <div className="bg-card sticky top-0 z-10 border-b">
                    <div className="px-4 pt-4 pb-2 flex items-center gap-4">
                        <Avatar className="h-20 w-20 border">
                            <AvatarImage src={teamInfo.team.logo} />
                            <AvatarFallback>{teamInfo.team.name.substring(0, 2)}</AvatarFallback>
                        </Avatar>
                        <div className="space-y-1">
                            <h2 className="text-2xl font-bold">{displayTitle}</h2>
                            <p className="text-sm text-muted-foreground">{teamInfo.team.country} - تأسس {teamInfo.team.founded}</p>
                            <p className="text-sm text-muted-foreground">{teamInfo.venue.name} ({teamInfo.venue.city})</p>
                        </div>
                    </div>
                    <div className="px-4">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="details">التفاصيل</TabsTrigger>
                            <TabsTrigger value="players">اللاعبون</TabsTrigger>
                        </TabsList>
                    </div>
                </div>

                <TabsContent value="players" className="px-4 pt-4">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {players?.map(({ player }) => (
                         <div key={player.id} className="flex items-center gap-3 p-2 rounded-lg border bg-card">
                            <Avatar className="h-12 w-12">
                                <AvatarImage src={player.photo} alt={player.name} />
                                <AvatarFallback>{player.name.substring(0, 1)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                                <p className="font-bold">{player.name}</p>
                                <p className="text-sm text-muted-foreground">{player.position}</p>
                            </div>
                            <div className='flex items-center opacity-80'>
                                <Button variant="ghost" size="icon" onClick={() => handleFavorite('player', player)}>
                                    <Star className={cn("h-5 w-5", favorites?.players?.[player.id] ? "text-yellow-400 fill-current" : "text-muted-foreground/60")} />
                                </Button>
                                {isAdmin && <Button variant="ghost" size="icon" onClick={() => handleOpenRename('player', player.id, player.name)}>
                                    <Pencil className="h-5 w-5 text-muted-foreground/60" />
                                </Button>}
                            </div>
                         </div>
                     ))}
                   </div>
                </TabsContent>
                <TabsContent value="details" className="p-0">
                     <Tabs defaultValue="matches" className="w-full">
                         <div className="px-4 py-2 bg-background sticky top-[152px] z-10 border-b">
                            <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="matches"><Shirt className="w-4 h-4 ml-1"/>المباريات</TabsTrigger>
                                <TabsTrigger value="standings"><Trophy className="w-4 h-4 ml-1"/>الترتيب</TabsTrigger>
                                <TabsTrigger value="scorers"><BarChart2 className="w-4 h-4 ml-1"/>الإحصائيات</TabsTrigger>
                            </TabsList>
                         </div>
                         <TabsContent value="matches" className="px-4 pt-4">
                             {fixtures && fixtures.length > 0 ? (
                                <div className="space-y-2">
                                {fixtures.map(({fixture, teams, goals, league}) => (
                                    <div key={fixture.id} className="rounded-lg border bg-card p-3 text-sm cursor-pointer" onClick={() => navigate('MatchDetails', { fixtureId: fixture.id, fixture: { fixture, teams, goals, league } })}>
                                        <div className="flex justify-between items-center text-xs text-muted-foreground mb-2">
                                            <span>{format(new Date(fixture.date), 'EEE, d MMM yyyy')}</span>
                                            <span>{fixture.status.short}</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 flex-1 justify-end truncate">
                                                <span className="font-semibold truncate">{teams.home.name}</span>
                                                <Avatar className="h-6 w-6"><AvatarImage src={teams.home.logo} /></Avatar>
                                            </div>
                                            <div className="font-bold text-base px-2 bg-muted rounded-md">{goals.home ?? ''} - {goals.away ?? ''}</div>
                                            <div className="flex items-center gap-2 flex-1 truncate">
                                                <Avatar className="h-6 w-6"><AvatarImage src={teams.away.logo} /></Avatar>
                                                <span className="font-semibold truncate">{teams.away.name}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                </div>
                             ) : <p className="text-center py-8 text-muted-foreground">لا توجد مباريات متاحة.</p>}
                         </TabsContent>
                         <TabsContent value="standings" className="p-0">
                            {standings && standings.length > 0 ? (
                                <Table>
                                    <TableHeader><TableRow><TableHead className="w-1/2 text-right">الفريق</TableHead><TableHead className="text-center">ل</TableHead><TableHead className="text-center">ف</TableHead><TableHead className="text-center">ت</TableHead><TableHead className="text-center">خ</TableHead><TableHead className="text-center">ن</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                    {standings.map((s) => (
                                        <TableRow key={s.team.id} className={cn("cursor-pointer", s.team.id === teamId ? 'bg-primary/10' : '')} onClick={() => navigate('TeamDetails', {teamId: s.team.id})}>
                                            <TableCell className="font-medium"><div className="flex items-center gap-2"><span>{s.rank}</span><Avatar className="h-6 w-6"><AvatarImage src={s.team.logo} /></Avatar><span className="truncate">{s.team.name}</span></div></TableCell>
                                            <TableCell className="text-center">{s.all.played}</TableCell><TableCell className="text-center">{s.all.win}</TableCell><TableCell className="text-center">{s.all.draw}</TableCell><TableCell className="text-center">{s.all.lose}</TableCell><TableCell className="text-center font-bold">{s.points}</TableCell>
                                        </TableRow>
                                    ))}
                                    </TableBody>
                                </Table>
                            ) : <p className="text-center py-8 text-muted-foreground">الترتيب غير متاح حاليًا.</p>}
                         </TabsContent>
                         <TabsContent value="scorers" className="p-0">
                             {scorers && scorers.length > 0 ? (
                                <Table>
                                    <TableHeader><TableRow><TableHead className="text-right">اللاعب</TableHead><TableHead className="text-center">الأهداف</TableHead><TableHead className="text-center">صناعة</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                    {scorers.filter(scorer => scorer.statistics[0].team.id === teamId).map(({ player, statistics }) => (
                                        <TableRow key={player.id}>
                                            <TableCell><div className="flex items-center gap-3"><Avatar className="h-10 w-10"><AvatarImage src={player.photo} /></Avatar><p className="font-semibold">{player.name}</p></div></TableCell>
                                            <TableCell className="text-center font-bold text-lg">{statistics[0]?.goals.total || 0}</TableCell>
                                            <TableCell className="text-center font-bold text-lg">{statistics[0]?.assists || 0}</TableCell>
                                        </TableRow>
                                    ))}
                                    </TableBody>
                                </Table>
                             ) : <p className="text-center py-8 text-muted-foreground">لا توجد إحصائيات هدافين متاحة.</p>}
                         </TabsContent>
                     </Tabs>
                </TabsContent>
            </Tabs>
        </div>
      ) : (
        <div className="flex items-center justify-center h-full text-muted-foreground">
           فشل تحميل بيانات الفريق.
        </div>
      )}
    </div>
  );
}
