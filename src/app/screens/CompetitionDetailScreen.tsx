

"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ScreenProps } from '@/app/page';
import { useAdmin, useAuth, useFirestore } from '@/firebase/provider';
import { Button } from '@/components/ui/button';
import { Star, Pencil, Shield, Users, Trophy, BarChart2, Heart, Copy } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { doc, setDoc, onSnapshot, updateDoc, deleteField, getDocs, collection } from 'firebase/firestore';
import { RenameDialog } from '@/components/RenameDialog';
import { NoteDialog } from '@/components/NoteDialog';
import { cn } from '@/lib/utils';
import type { Fixture, Standing, TopScorer, Team, Favorites } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';


type RenameType = 'league' | 'team' | 'player';

const CURRENT_SEASON = new Date().getFullYear();

export function CompetitionDetailScreen({ navigate, goBack, canGoBack, title: initialTitle, leagueId, logo, headerActions }: ScreenProps & { title?: string, leagueId?: number, logo?: string, headerActions?: React.ReactNode }) {
  const { isAdmin } = useAdmin();
  const { user } = useAuth();
  const { db } = useFirestore();
  const { toast } = useToast();

  const [favorites, setFavorites] = useState<Favorites>({ userId: user?.uid || '', leagues: {}, teams: {}, players: {} });

  const [loading, setLoading] = useState(true);
  const [displayTitle, setDisplayTitle] = useState(initialTitle);
  const [isRenameOpen, setRenameOpen] = useState(false);
  const [renameItem, setRenameItem] = useState<{ id: string | number, name: string, type: RenameType } | null>(null);

  const [noteTeam, setNoteTeam] = useState<{id: number, name: string, logo: string} | null>(null);
  const [isNoteOpen, setIsNoteOpen] = useState(false);

  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [topScorers, setTopScorers] = useState<TopScorer[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [customNames, setCustomNames] = useState<{ teams: Map<number, string>, players: Map<number, string> }>({ teams: new Map(), players: new Map() });

  
  const getDisplayName = useCallback((type: 'team' | 'player', id: number, defaultName: string) => {
    const key = `${type}s` as 'teams' | 'players';
    return customNames[key]?.get(id) || defaultName;
  }, [customNames]);

  
  const isFavorited = leagueId && favorites?.leagues?.[leagueId];

  const handleCopy = (url: string | null) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    toast({ title: "تم نسخ الرابط", description: url });
  };

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'favorites', user.uid), (doc) => {
        setFavorites(doc.data() as Favorites || { userId: user.uid, leagues: {}, teams: {}, players: {} });
    });
    return () => unsub();
  }, [user, db]);

 useEffect(() => {
    if (leagueId) {
        const unsub = onSnapshot(doc(db, "leagueCustomizations", String(leagueId)), (doc) => {
            if (doc.exists()) {
                setDisplayTitle(doc.data().customName);
            } else {
                setDisplayTitle(initialTitle);
            }
        });
        return () => unsub();
    }
  }, [leagueId, initialTitle, db]);


  useEffect(() => {
    async function fetchData() {
      if (!leagueId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const [teamsSnapshot, playersSnapshot] = await Promise.all([
             getDocs(collection(db, 'teamCustomizations')),
             getDocs(collection(db, 'playerCustomizations'))
        ]);
        
        const teamNames = new Map<number, string>();
        teamsSnapshot.forEach(doc => teamNames.set(Number(doc.id), doc.data().customName));
        const playerNames = new Map<number, string>();
        playersSnapshot.forEach(doc => playerNames.set(Number(doc.id), doc.data().customName));
        setCustomNames({ teams: teamNames, players: playerNames });


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
        
        if(fixturesData.response) {
            setFixtures(fixturesData.response);
            if(!initialTitle && fixturesData.response.length > 0) {
                 setDisplayTitle(fixturesData.response[0].league.name);
            }
        }
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
  }, [leagueId, initialTitle, db]);

  const handleFavorite = async (type: 'league' | 'team' | 'player', item: any) => {
    if (!user) return;
    const favRef = doc(db, 'favorites', user.uid);
    
    let fieldPath = '';
    let isFavoritedCurrent = false;
    let favoriteData: any = { userId: user.uid };
    const displayName = getDisplayName((type === 'player' ? 'player' : 'team'), item.id, item.name);


    if (type === 'league' && leagueId) {
        fieldPath = `leagues.${leagueId}`;
        isFavoritedCurrent = !!favorites?.leagues?.[leagueId];
        favoriteData.leagues = { [leagueId]: { leagueId, name: displayTitle, logo }};
    } else if (type === 'team') {
        fieldPath = `teams.${item.id}`;
        isFavoritedCurrent = !!favorites?.teams?.[item.id];
        favoriteData.teams = { [item.id]: { teamId: item.id, name: displayName, logo: item.logo }};
    } else if (type === 'player') {
        fieldPath = `players.${item.id}`;
        isFavoritedCurrent = !!favorites?.players?.[item.id];
        favoriteData.players = { [item.id]: { playerId: item.id, name: displayName, photo: item.photo }};
    }

    if (isFavoritedCurrent) {
        await updateDoc(favRef, { [fieldPath]: deleteField() });
    } else {
        await setDoc(favRef, favoriteData, { merge: true });
    }
  };
  
  const handleOpenRename = (type: RenameType, id: string | number, name: string) => {
    setRenameItem({ id, name, type });
    setRenameOpen(true);
  };

  const handleSaveRename = async (newName: string) => {
    if (!renameItem) return;
    const { id, type } = renameItem;
    let collectionName = '';
    switch(type) {
        case 'league': collectionName = 'leagueCustomizations'; break;
        case 'team': collectionName = 'teamCustomizations'; break;
        case 'player': collectionName = 'playerCustomizations'; break;
    }
    await setDoc(doc(db, collectionName, String(id)), { customName: newName });
    // Manually update local custom names state to reflect change immediately
    setCustomNames(prev => {
        const newNames = new Map(prev[type === 'player' ? 'players' : 'teams']);
        newNames.set(Number(id), newName);
        if (type === 'team') return { ...prev, teams: newNames };
        if (type === 'player') return { ...prev, players: newNames };
        return prev;
    });

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

  const secondaryActions = (
    <div className="flex items-center gap-1">
      {isAdmin && leagueId && (
         <Button
          variant="ghost"
          size="icon"
          onClick={() => handleOpenRename('league', leagueId, displayTitle || '')}
        >
          <Pencil className="h-5 w-5" />
        </Button>
      )}
      {leagueId &&
        <Button variant="ghost" size="icon" onClick={() => handleFavorite('league', {})}>
            <Star className={cn("h-5 w-5 opacity-80", isFavorited ? "text-yellow-400 fill-current" : "text-muted-foreground")} />
        </Button>
      }
    </div>
  );

  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader title={displayTitle || ''} onBack={goBack} canGoBack={canGoBack} actions={headerActions} secondaryActions={secondaryActions} />
      {renameItem && <RenameDialog 
          isOpen={isRenameOpen}
          onOpenChange={setRenameOpen}
          currentName={renameItem.name}
          onSave={handleSaveRename}
          itemType="العنصر"
        />}
      {noteTeam && <NoteDialog
        isOpen={isNoteOpen}
        onOpenChange={setIsNoteOpen}
        onSave={handleSaveNote}
        teamName={noteTeam.name}
      />}
       <div className="flex-1 overflow-y-auto">
        <Tabs defaultValue="matches" className="w-full">
           <div className="sticky top-0 bg-background z-10 border-b">
             <p className="text-center text-xs text-muted-foreground pt-2 pb-2">جميع البيانات تخص موسم {CURRENT_SEASON}</p>
             <TabsList className="grid w-full grid-cols-4 rounded-none h-auto p-0 border-t">
              <TabsTrigger value="matches" className='rounded-none data-[state=active]:rounded-md'><Shield className="w-4 h-4 ml-1"/>المباريات</TabsTrigger>
              <TabsTrigger value="standings" className='rounded-none data-[state=active]:rounded-md'><Trophy className="w-4 h-4 ml-1"/>الترتيب</TabsTrigger>
              <TabsTrigger value="scorers" className='rounded-none data-[state=active]:rounded-md'><BarChart2 className="w-4 h-4 ml-1"/>الهدافين</TabsTrigger>
              <TabsTrigger value="teams" className='rounded-none data-[state=active]:rounded-md'><Users className="w-4 h-4 ml-1"/>الفرق</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="matches" className="p-4 mt-0">
             {loading ? (
                <div className="space-y-4">
                    {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
                </div>
            ) : fixtures.length > 0 ? (
                <div className="space-y-3">
                    {fixtures.map(({ fixture, teams, goals }) => (
                        <div key={fixture.id} className="rounded-lg border bg-card p-3 text-sm cursor-pointer" onClick={() => navigate('MatchDetails', { fixtureId: fixture.id, fixture })}>
                           <div className="flex justify-between items-center text-xs text-muted-foreground mb-2">
                                <span>{new Date(fixture.date).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                <span>{fixture.status.short}</span>
                           </div>
                           <div className="flex items-center justify-between gap-2">
                               <div className="flex items-center gap-2 flex-1 justify-end truncate cursor-pointer" onClick={(e) => {e.stopPropagation(); navigate('TeamDetails', { teamId: teams.home.id })}}>
                                   <span className="font-semibold truncate">{getDisplayName('team', teams.home.id, teams.home.name)}</span>
                                   <Avatar className="h-8 w-8">
                                       <AvatarImage src={teams.home.logo} alt={teams.home.name} />
                                       <AvatarFallback>{teams.home.name.substring(0, 2)}</AvatarFallback>
                                   </Avatar>
                               </div>
                               <div className="font-bold text-lg px-2 bg-muted rounded-md">
                                   {goals.home !== null ? `${goals.home} - ${goals.away}` : new Date(fixture.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                               </div>
                               <div className="flex items-center gap-2 flex-1 truncate cursor-pointer" onClick={(e) => {e.stopPropagation(); navigate('TeamDetails', { teamId: teams.away.id })}}>
                                    <Avatar className="h-8 w-8">
                                       <AvatarImage src={teams.away.logo} alt={teams.away.name} />
                                       <AvatarFallback>{teams.away.name.substring(0, 2)}</AvatarFallback>
                                   </Avatar>
                                   <span className="font-semibold truncate">{getDisplayName('team', teams.away.id, teams.away.name)}</span>
                               </div>
                           </div>
                        </div>
                    ))}
                </div>
            ) : <p className="pt-4 text-center text-muted-foreground">لا توجد مباريات متاحة لهذا الموسم.</p>}
          </TabsContent>
          <TabsContent value="standings" className="p-0 mt-0">
            {loading ? (
                 <div className="space-y-px p-4">
                    {Array.from({ length: 18 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
            ) : standings.length > 0 ? (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="text-right w-1/2">الفريق</TableHead>
                            <TableHead className="text-center">لعب</TableHead>
                            <TableHead className="text-center">ف</TableHead>
                            <TableHead className="text-center">ت</TableHead>
                            <TableHead className="text-center">خ</TableHead>
                            <TableHead className="text-center">نقاط</TableHead>
                            <TableHead className="text-left w-[120px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {standings.map((s) => (
                            <TableRow key={s.team.id} className="cursor-pointer" onClick={() => navigate('TeamDetails', { teamId: s.team.id })}>
                                <TableCell className="font-medium">
                                    <div className="flex items-center gap-2 justify-end">
                                        <span>{s.rank}</span>
                                         <div className="relative">
                                            <Avatar className="h-6 w-6">
                                                <AvatarImage src={s.team.logo} alt={s.team.name} />
                                                <AvatarFallback>{s.team.name.substring(0,1)}</AvatarFallback>
                                            </Avatar>
                                            {isAdmin && <Button variant="ghost" size="icon" className="absolute -top-2 -right-2 h-6 w-6" onClick={(e) => { e.stopPropagation(); handleCopy(s.team.logo); }}><Copy className="h-3 w-3 text-muted-foreground" /></Button>}
                                        </div>
                                        <p className="truncate">
                                            {getDisplayName('team', s.team.id, s.team.name)}
                                            {isAdmin && <span className="text-xs text-muted-foreground ml-2">(ID: {s.team.id})</span>}
                                        </p>
                                    </div>
                                </TableCell>
                                <TableCell className="text-center">{s.all.played}</TableCell>
                                <TableCell className="text-center">{s.all.win}</TableCell>
                                <TableCell className="text-center">{s.all.draw}</TableCell>
                                <TableCell className="text-center">{s.all.lose}</TableCell>
                                <TableCell className="text-center font-bold">{s.points}</TableCell>
                                <TableCell onClick={e => e.stopPropagation()}>
                                     <div className='flex items-center justify-start opacity-80'>
                                        {isAdmin && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenRename('team', s.team.id, getDisplayName('team', s.team.id, s.team.name))}>
                                            <Pencil className="h-4 w-4 text-muted-foreground" />
                                        </Button>}
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleFavorite('team', {...s.team, name: getDisplayName('team', s.team.id, s.team.name)})}>
                                            <Star className={cn("h-5 w-5", favorites?.teams?.[s.team.id] ? "text-yellow-400 fill-current" : "text-muted-foreground/50")} />
                                        </Button>
                                        {isAdmin && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenNote({...s.team, name: getDisplayName('team', s.team.id, s.team.name)})}>
                                            <Heart className="h-4 w-4 text-muted-foreground" />
                                        </Button>}
                                     </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            ): <p className="pt-4 text-center text-muted-foreground">جدول الترتيب غير متاح حاليًا.</p>}
          </TabsContent>
           <TabsContent value="scorers" className="p-0 mt-0">
            {loading ? (
                <div className="space-y-px p-4">
                    {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
            ) : topScorers.length > 0 ? (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="text-right">اللاعب</TableHead>
                            <TableHead className="text-right">الفريق</TableHead>
                            <TableHead className="text-center">الأهداف</TableHead>
                            <TableHead className="text-left w-[90px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {topScorers.map(({ player, statistics }) => (
                            <TableRow key={player.id}>
                                <TableCell>
                                    <div className="flex items-center gap-3 justify-end">
                                        <div className="relative">
                                            <Avatar className="h-10 w-10">
                                                <AvatarImage src={player.photo} alt={player.name} />
                                                <AvatarFallback>{player.name.substring(0, 2)}</AvatarFallback>
                                            </Avatar>
                                            {isAdmin && <Button variant="ghost" size="icon" className="absolute -top-2 -right-2 h-6 w-6" onClick={(e) => { e.stopPropagation(); handleCopy(player.photo); }}><Copy className="h-3 w-3 text-muted-foreground" /></Button>}
                                        </div>
                                        <p className="font-semibold">
                                            {getDisplayName('player', player.id, player.name)}
                                            {isAdmin && <span className="text-xs text-muted-foreground ml-2">(ID: {player.id})</span>}
                                        </p>
                                    </div>
                                </TableCell>
                                <TableCell className="cursor-pointer" onClick={() => navigate('TeamDetails', { teamId: statistics[0]?.team.id })}>
                                     <p className="text-xs text-muted-foreground text-right">{getDisplayName('team', statistics[0]?.team.id, statistics[0]?.team.name)}</p>
                                </TableCell>
                                <TableCell className="text-center font-bold text-lg">{statistics[0]?.goals.total}</TableCell>
                                <TableCell>
                                    <div className='flex items-center justify-start opacity-80'>
                                        {isAdmin && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenRename('player', player.id, getDisplayName('player', player.id, player.name))}>
                                            <Pencil className="h-4 w-4 text-muted-foreground" />
                                        </Button>}
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleFavorite('player', {...player, name: getDisplayName('player', player.id, player.name)})}>
                                            <Star className={cn("h-5 w-5", favorites?.players?.[player.id] ? "text-yellow-400 fill-current" : "text-muted-foreground/50")} />
                                        </Button>
                                     </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            ) : <p className="pt-4 text-center text-muted-foreground">قائمة الهدافين غير متاحة حاليًا.</p>}
          </TabsContent>
          <TabsContent value="teams" className="p-4 mt-0">
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
                        <div key={team.id} className="relative flex flex-col items-center gap-2 rounded-lg border bg-card p-4 text-center cursor-pointer" onClick={() => navigate('TeamDetails', { teamId: team.id })}>
                            <div className='relative'>
                                <Avatar className="h-16 w-16">
                                    <AvatarImage src={team.logo} alt={team.name} />
                                    <AvatarFallback>{team.name.substring(0, 2)}</AvatarFallback>
                                </Avatar>
                                {isAdmin && <Button variant="ghost" size="icon" className="absolute -top-2 -left-2 h-6 w-6" onClick={(e) => { e.stopPropagation(); handleCopy(team.logo); }}><Copy className="h-3 w-3 text-muted-foreground" /></Button>}
                            </div>
                            <span className="font-semibold text-sm">
                                {getDisplayName('team', team.id, team.name)}
                                {isAdmin && <span className="block text-xs text-muted-foreground">(ID: {team.id})</span>}
                            </span>
                            <div className="absolute top-1 left-1 flex opacity-80">
                                {isAdmin && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleOpenRename('team', team.id, getDisplayName('team', team.id, team.name))}}>
                                    <Pencil className="h-4 w-4 text-muted-foreground" />
                                </Button>}
                                 <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleFavorite('team', {...team, name: getDisplayName('team', team.id, team.name)});}}>
                                    <Star className={cn("h-5 w-5", favorites?.teams?.[team.id] ? "text-yellow-400 fill-current" : "text-muted-foreground/50")} />
                                </Button>
                                {isAdmin && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleOpenNote({...team, name: getDisplayName('team', team.id, team.name)});}}>
                                    <Heart className="h-4 w-4 text-muted-foreground" />
                                </Button>}
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

    