
"use client";

import React, { useEffect, useState } from 'react';
import type { ScreenProps } from '@/app/page';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Star, Pencil, Shirt, Users, Trophy, BarChart2, Heart } from 'lucide-react';
import { useAdmin, useAuth, useFirestore } from '@/firebase/provider';
import { doc, onSnapshot, setDoc, updateDoc, deleteField, getDoc } from 'firebase/firestore';
import { RenameDialog } from '@/components/RenameDialog';
import { NoteDialog } from '@/components/NoteDialog';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Fixture, Standing, TopScorer, Favorites } from '@/lib/types';


// --- TYPE DEFINITIONS ---
interface TeamInfo {
    team: { id: number; name: string; logo: string; country: string; founded: number; type: string; };
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
    if (!teamId) {
      setLoading(false);
      return;
    };

    const fetchData = async () => {
      setLoading(true);
      try {
        const teamRes = await fetch(`/api/football/teams?id=${teamId}`);
        const teamData = await teamRes.json();
        const teamInfo: TeamInfo | null = teamData.response?.[0] || null;

        // Fetch all pages of players
        let allPlayers: PlayerInfoFromApi[] = [];
        let currentPage = 1;
        let totalPages = 1;
        if(teamId) {
          do {
              const playersRes = await fetch(`/api/football/players?team=${teamId}&season=${CURRENT_SEASON}&page=${currentPage}`);
              const playersData = await playersRes.json();
              if (playersData.response) {
                  allPlayers = allPlayers.concat(playersData.response);
              }
              if (playersData.paging && playersData.paging.current < playersData.paging.total) {
                  currentPage++;
                  totalPages = playersData.paging.total;
              } else {
                  totalPages = currentPage; // stop loop
              }
          } while (currentPage < totalPages);
        }
        
        // Fetch all fixtures for the team, regardless of season
        const fixturesRes = await fetch(`/api/football/fixtures?team=${teamId}`);
        const fixturesData = await fixturesRes.json();
        const fixtures: Fixture[] = fixturesData.response || [];
        
        // Intelligent league selection for standings
        const worldCupFixture = fixtures.find(f => f.league.name.includes('World Cup'));
        const continentalFixture = fixtures.find(f => f.league.name.includes('AFC Champions League') || f.league.name.includes('UEFA'));
        const primaryLeagueFixture = fixtures.find(f => f.league.name.includes('League'));
        
        let leagueIdForStandings = null;
        if (worldCupFixture) {
            leagueIdForStandings = worldCupFixture.league.id;
        } else if (continentalFixture) {
            leagueIdForStandings = continentalFixture.league.id;
        } else if (primaryLeagueFixture) {
            leagueIdForStandings = primaryLeagueFixture.league.id;
        } else if (fixtures.length > 0) {
            leagueIdForStandings = fixtures[0].league.id;
        }

        let standingsData = { response: [] };
        let scorersData = { response: [] };
        if (leagueIdForStandings) {
            const standingsSeason = teamInfo?.team.type === 'National' ? (new Date(worldCupFixture?.fixture.date || Date.now()).getFullYear()) : CURRENT_SEASON;
            const [standingsRes, scorersRes] = await Promise.all([
                 fetch(`/api/football/standings?league=${leagueIdForStandings}&season=${standingsSeason}`),
                 fetch(`/api/football/players/topscorers?league=${leagueIdForStandings}&season=${CURRENT_SEASON}`)
            ]);
            standingsData = await standingsRes.json();
            scorersData = await scorersRes.json();
        }
        
        setData({
          teamInfo: teamInfo,
          players: allPlayers,
          fixtures: fixtures,
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
  const { isAdmin } = useAdmin();
  const { user } = useAuth();
  const { db } = useFirestore();
  const [favorites, setFavorites] = useState<Favorites>({ userId: user?.uid || '' });
  const [renameItem, setRenameItem] = useState<{ id: number; name: string; type: RenameType } | null>(null);
  const [isRenameOpen, setRenameOpen] = useState(false);
  const [noteTeam, setNoteTeam] = useState<{id: number, name: string, logo: string} | null>(null);
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [displayTitle, setDisplayTitle] = useState(teamInfo?.team.name || "الفريق");

  const fetchCustomTeamName = React.useCallback(async () => {
    if (teamId) {
        try {
            const docRef = doc(db, "teamCustomizations", String(teamId));
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                setDisplayTitle(docSnap.data().customName);
            } else if (teamInfo?.team.name) {
                setDisplayTitle(teamInfo.team.name);
            }
        } catch (error) {
            console.error("Error fetching custom team name:", error);
             if (teamInfo?.team.name) {
                setDisplayTitle(teamInfo.team.name);
            }
        }
    }
  }, [db, teamId, teamInfo?.team.name]);


  useEffect(() => {
    fetchCustomTeamName();
  }, [fetchCustomTeamName]);


  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'favorites', user.uid), (doc) => {
        setFavorites(doc.data() as Favorites || { userId: user.uid });
    });
    return () => unsub();
  }, [user, db]);

  const handleOpenRename = (type: RenameType, id: number, name: string) => {
    setRenameItem({ id, name, type });
    setRenameOpen(true);
  };

  const handleSaveRename = async (newName: string) => {
    if (!renameItem) return;
    const { id, type } = renameItem;
    const collectionName = type === 'player' ? 'playerCustomizations' : 'teamCustomizations';
    await setDoc(doc(db, collectionName, String(id)), { customName: newName });
    if(type === 'team') {
        fetchCustomTeamName();
    }
  };

  const handleFavorite = async (type: 'team' | 'player', item: any) => {
    if (!user) return;
    const favRef = doc(db, 'favorites', user.uid);
    const itemPath = type === 'team' ? 'teams' : 'players';
    const fieldPath = `${itemPath}.${item.id}`;
    const isFavorited = !!favorites?.[itemPath]?.[item.id];
    
    let favoriteData: Partial<Favorites> = { userId: user.uid };
    if (type === 'team') {
       favoriteData.teams = { [item.id]: { teamId: item.id, name: item.name, logo: item.logo }};
    } else {
       favoriteData.players = { [item.id]: { playerId: item.id, name: item.name, photo: item.photo }};
    }

    if (isFavorited) {
        await updateDoc(favRef, { [fieldPath]: deleteField() });
    } else {
        await setDoc(favRef, favoriteData, { merge: true });
    }
  };
  
  const handleOpenNote = (team: {id: number, name: string, logo: string}) => {
    setNoteTeam(team);
    setIsNoteOpen(true);
  }

  const handleSaveNote = async (note: string) => {
    if (!noteTeam) return;
    await setDoc(doc(db, "adminFavorites", String(noteTeam.id)), {
      teamId: noteTeam.id,
      name: noteTeam.name,
      logo: noteTeam.logo,
      note: note
    });
  }

  const isTeamFavorited = !!favorites?.teams?.[teamId];

  const secondaryActions = teamInfo && (
    <div className="flex items-center gap-1">
      {isAdmin && (
        <>
          <Button variant="ghost" size="icon" onClick={() => handleOpenNote(teamInfo.team)}>
            <Heart className="h-5 w-5 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => handleOpenRename('team', teamId, displayTitle)}>
            <Pencil className="h-5 w-5" />
          </Button>
        </>
      )}
        <Button variant="ghost" size="icon" onClick={() => handleFavorite('team', teamInfo.team)}>
            <Star className={cn("h-5 w-5 opacity-80", isTeamFavorited ? "text-yellow-400 fill-current" : "text-muted-foreground")} />
        </Button>
    </div>
  );

  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader title={displayTitle} onBack={goBack} canGoBack={canGoBack} actions={headerActions} secondaryActions={secondaryActions} />
      {renameItem && <RenameDialog isOpen={isRenameOpen} onOpenChange={setRenameOpen} currentName={renameItem.name} onSave={handleSaveRename} itemType={renameItem.type === 'team' ? 'الفريق' : 'اللاعب'} />}
      {noteTeam && <NoteDialog
        isOpen={isNoteOpen}
        onOpenChange={setIsNoteOpen}
        onSave={handleSaveNote}
        teamName={noteTeam.name}
      />}
      
      {loading ? <div className="p-4 space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div> : teamInfo ? (
        <div className="flex-1 overflow-y-auto">
            <Tabs defaultValue="details" className="w-full">
                 <div className="bg-card sticky top-0 z-10 border-b">
                    <div className="p-4 flex items-center gap-4">
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
                    <TabsList className="grid w-full grid-cols-2 h-auto p-0 rounded-none">
                        <TabsTrigger value="players" className='data-[state=active]:rounded-none'>اللاعبون</TabsTrigger>
                        <TabsTrigger value="details" className='data-[state=active]:rounded-none'>التفاصيل</TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="players" className="p-4">
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
                                    <Pencil className="h-5 w-5 text-muted-foreground" />
                                </Button>}
                            </div>
                         </div>
                     ))}
                   </div>
                </TabsContent>
                <TabsContent value="details" className="p-0">
                     <Tabs defaultValue="scorers" className="w-full">
                         <div className="bg-card sticky top-[152px] z-10 border-b">
                            <TabsList className="grid w-full grid-cols-3 h-auto p-0 rounded-none flex-row-reverse">
                                <TabsTrigger value="matches" className='data-[state=active]:rounded-none'><Shirt className="w-4 h-4 ml-1"/>المباريات</TabsTrigger>
                                <TabsTrigger value="standings" className='data-[state=active]:rounded-none'><Trophy className="w-4 h-4 ml-1"/>الترتيب</TabsTrigger>
                                <TabsTrigger value="scorers" className='data-[state=active]:rounded-none'><BarChart2 className="w-4 h-4 ml-1"/>الإحصائيات</TabsTrigger>
                            </TabsList>
                         </div>
                         <TabsContent value="matches" className="p-4">
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
                                    <TableHeader><TableRow>
                                        <TableHead className="text-center">ن</TableHead><TableHead className="text-center">خ</TableHead><TableHead className="text-center">ت</TableHead><TableHead className="text-center">ف</TableHead><TableHead className="text-center">ل</TableHead><TableHead className="w-1/2 text-right">الفريق</TableHead>
                                    </TableRow></TableHeader>
                                    <TableBody>
                                    {standings.map((s) => (
                                        <TableRow key={s.team.id} className={cn("cursor-pointer", s.team.id === teamId ? 'bg-primary/10' : '')} onClick={() => navigate('TeamDetails', {teamId: s.team.id})}>
                                            <TableCell className="text-center font-bold">{s.points}</TableCell>
                                            <TableCell className="text-center">{s.all.lose}</TableCell>
                                            <TableCell className="text-center">{s.all.draw}</TableCell>
                                            <TableCell className="text-center">{s.all.win}</TableCell>
                                            <TableCell className="text-center">{s.all.played}</TableCell>
                                            <TableCell className="font-medium"><div className="flex items-center gap-2 justify-end">
                                                <span className="truncate">{s.team.name}</span>
                                                <Avatar className="h-6 w-6"><AvatarImage src={s.team.logo} /></Avatar>
                                                <span>{s.rank}</span>
                                            </div></TableCell>
                                        </TableRow>
                                    ))}
                                    </TableBody>
                                </Table>
                            ) : <p className="text-center py-8 text-muted-foreground">الترتيب غير متاح حاليًا.</p>}
                         </TabsContent>
                         <TabsContent value="scorers" className="p-0">
                             {scorers && scorers.length > 0 ? (
                                <Table>
                                    <TableHeader><TableRow>
                                        <TableHead className="text-center">صناعة</TableHead>
                                        <TableHead className="text-center">الأهداف</TableHead>
                                        <TableHead className="text-right">اللاعب</TableHead>
                                        </TableRow></TableHeader>
                                    <TableBody>
                                    {scorers.filter(scorer => scorer.statistics[0].team.id === teamId).map(({ player, statistics }) => (
                                        <TableRow key={player.id}>
                                            <TableCell className="text-center font-bold text-lg">{statistics[0]?.assists || 0}</TableCell>
                                            <TableCell className="text-center font-bold text-lg">{statistics[0]?.goals.total || 0}</TableCell>
                                            <TableCell><div className="flex items-center gap-3 justify-end"><p className="font-semibold">{player.name}</p><Avatar className="h-10 w-10"><AvatarImage src={player.photo} /></Avatar></div></TableCell>
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

    



