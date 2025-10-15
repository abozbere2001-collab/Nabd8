

"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ScreenProps } from '@/app/page';
import { useAdmin, useAuth, useFirestore } from '@/firebase/provider';
import { Button } from '@/components/ui/button';
import { Star, Pencil, Shield, Users, Trophy, BarChart2, Heart, Copy, Trash2, Loader2 } from 'lucide-react';
import { Crown } from '@/components/icons/Crown';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { doc, setDoc, onSnapshot, updateDoc, deleteField, getDocs, collection, deleteDoc, getDoc } from 'firebase/firestore';
import { RenameDialog } from '@/components/RenameDialog';
import { NoteDialog } from '@/components/NoteDialog';
import { cn } from '@/lib/utils';
import type { Fixture, Standing, TopScorer, Team, Favorites } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { FixtureItem } from '@/components/FixtureItem';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { CURRENT_SEASON } from '@/lib/constants';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from '@/components/LanguageProvider';


type RenameType = 'league' | 'team' | 'player';

function SeasonSelector({ season, onSeasonChange, isAdmin }: { season: number, onSeasonChange: (newSeason: number) => void, isAdmin: boolean }) {
    const { t } = useTranslation();
    if (!isAdmin) {
        return <p className="text-center text-xs text-muted-foreground pt-2 pb-1">{t('data_for_season')} {season}</p>;
    }

    const seasons = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() + 2 - i);

    return (
        <div className="flex items-center justify-center gap-2 px-4 pt-2 pb-1 text-xs text-muted-foreground">
            <span>{t('view_data_for_season')}</span>
            <Select value={String(season)} onValueChange={(value) => onSeasonChange(Number(value))}>
                <SelectTrigger className="w-[100px] h-7 text-xs">
                    <SelectValue placeholder={t('select_season')} />
                </SelectTrigger>
                <SelectContent>
                    {seasons.map(s => (
                        <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}


export function CompetitionDetailScreen({ navigate, goBack, canGoBack, title: initialTitle, leagueId, logo, headerActions }: ScreenProps & { title?: string, leagueId?: number, logo?: string, headerActions?: React.ReactNode }) {
  const { isAdmin } = useAdmin();
  const { user } = useAuth();
  const { db } = useFirestore();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [favorites, setFavorites] = useState<Favorites>({ userId: user?.uid || '', leagues: {}, teams: {}, players: {} });
  const [isTopCompetition, setIsTopCompetition] = useState(false);
  const [topTeamIds, setTopTeamIds] = useState<Set<number>>(new Set());

  const [loading, setLoading] = useState(true);
  const [displayTitle, setDisplayTitle] = useState(initialTitle);
  const [isRenameOpen, setRenameOpen] = useState(false);
  const [renameItem, setRenameItem] = useState<{ id: string | number, name: string, type: RenameType } | null>(null);

  const [noteTeam, setNoteTeam] = useState<{id: number, name: string, logo: string} | null>(null);
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  
  const [isDeleteAlertOpen, setDeleteAlertOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);


  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [topScorers, setTopScorers] = useState<TopScorer[]>([]);
  const [teams, setTeams] = useState<{team: Team}[]>([]);
  const [customNames, setCustomNames] = useState<{ teams: Map<number, string>, players: Map<number, string> }>({ teams: new Map(), players: new Map() });
  const [season, setSeason] = useState<number>(CURRENT_SEASON);

  
  const fetchAllCustomNames = useCallback(async () => {
    if (!db) return;
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
    } catch (error) {
        // This might fail for regular users, which is okay. Admin features will be hidden.
        console.warn("Could not fetch custom names, this is expected for non-admins:", error);
    }
  }, [db]);
  
  useEffect(() => {
    if (!db || !leagueId) return;
      const checkTopStatus = async () => {
          const topLeagueDocRef = doc(db, "topCompetitions", String(leagueId));
          try {
            const docSnap = await getDoc(topLeagueDocRef);
            setIsTopCompetition(docSnap.exists());
          } catch(e) {
            // This is expected to fail for non-admins if rules are strict
            console.warn("Could not check top competition status, this is expected for non-admins");
            setIsTopCompetition(false);
          }
      };
      if (isAdmin) {
        checkTopStatus();
      }

      // For top teams, we can still listen as it's a broader list
      const unsubTopTeams = onSnapshot(collection(db, "topTeams"), (snapshot) => {
          const teamIds = new Set(snapshot.docs.map(doc => Number(doc.id)));
          setTopTeamIds(teamIds);
      }, (error) => {
          console.warn("Could not listen to top teams, this is expected for non-admins:", error);
      });
      
      return () => {
        unsubTopTeams();
      }

  }, [db, leagueId, isAdmin]);

  const getDisplayName = useCallback((type: 'team' | 'player', id: number, defaultName: string) => {
    const key = `${type}s` as 'teams' | 'players';
    return customNames[key]?.get(id) || defaultName;
  }, [customNames]);

  
  const isFavorited = leagueId && favorites?.leagues?.[leagueId];

  const handleCopy = (url: string | null) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    toast({ title: t('link_copied'), description: url });
  };

  useEffect(() => {
    if (!user || !db) return;
    const favDocRef = doc(db, 'users', user.uid, 'favorites', 'data');
    const unsub = onSnapshot(favDocRef, (doc) => {
        setFavorites(doc.data() as Favorites || { userId: user.uid, leagues: {}, teams: {}, players: {} });
    }, (error) => {
        const permissionError = new FirestorePermissionError({
            path: favDocRef.path,
            operation: 'get',
        });
        errorEmitter.emit('permission-error', permissionError);
    });
    return () => unsub();
  }, [user, db]);

 useEffect(() => {
    if (leagueId && db) {
        const leagueDocRef = doc(db, "leagueCustomizations", String(leagueId));
        const unsub = onSnapshot(leagueDocRef, (doc) => {
            if (doc.exists()) {
                setDisplayTitle(doc.data().customName);
            } else {
                setDisplayTitle(initialTitle);
            }
        }, (error) => {
            console.warn("Could not listen to league customizations, this is expected for non-admins:", error);
            setDisplayTitle(initialTitle);
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
        await fetchAllCustomNames();

        const [fixturesRes, standingsRes, scorersRes, teamsRes] = await Promise.all([
          fetch(`/api/football/fixtures?league=${leagueId}&season=${season}`),
          fetch(`/api/football/standings?league=${leagueId}&season=${season}`),
          fetch(`/api/football/players/topscorers?league=${leagueId}&season=${season}`),
          fetch(`/api/football/teams?league=${leagueId}&season=${season}`)
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
  }, [leagueId, initialTitle, fetchAllCustomNames, season]);

  const handleFavorite = (type: 'league' | 'team' | 'player', item: any) => {
    if (!user || !db) return;
    const favRef = doc(db, 'users', user.uid, 'favorites', 'data');
    
    let fieldPath = '';
    let isFavoritedCurrent = false;
    let favoriteData: any = { userId: user.uid };
    const displayName = getDisplayName((type === 'player' ? 'player' : 'team'), item.id, item.name);


    if (type === 'league' && leagueId) {
        fieldPath = `leagues.${leagueId}`;
        isFavoritedCurrent = !!favorites?.leagues?.[leagueId];
        favoriteData.leagues = { [leagueId]: { leagueId, name: displayTitle, logo: logo || '' }};
    } else if (type === 'team') {
        fieldPath = `teams.${item.id}`;
        isFavoritedCurrent = !!favorites?.teams?.[item.id];
        favoriteData.teams = { [item.id]: { teamId: item.id, name: displayName, logo: item.logo }};
    } else if (type === 'player') {
        fieldPath = `players.${item.id}`;
        isFavoritedCurrent = !!favorites?.players?.[item.id];
        favoriteData.players = { [item.id]: { playerId: item.id, name: displayName, photo: item.photo }};
    }

    const operation = isFavoritedCurrent
      ? updateDoc(favRef, { [fieldPath]: deleteField() })
      : setDoc(favRef, favoriteData, { merge: true });

    operation.catch(serverError => {
      const permissionError = new FirestorePermissionError({
          path: favRef.path,
          operation: 'update',
          requestResourceData: favoriteData,
      });
      errorEmitter.emit('permission-error', permissionError);
    });
  };
  
  const handleToggleTopItem = (type: 'league' | 'team', item: {id: number, name: string, logo: string}) => {
      if (!isAdmin || !db) return;
      
      const collectionName = type === 'league' ? 'topCompetitions' : 'topTeams';
      const docId = String(item.id);
      const docRef = doc(db, collectionName, docId);

      const isCurrentlyTop = type === 'league' ? isTopCompetition : topTeamIds.has(item.id);

      const operation = isCurrentlyTop
        ? deleteDoc(docRef)
        : setDoc(docRef, item);
      
      operation
      .then(() => {
        if(type === 'league') setIsTopCompetition(!isCurrentlyTop);
      })
      .catch(serverError => {
        const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: isCurrentlyTop ? 'delete' : 'create',
            requestResourceData: isCurrentlyTop ? undefined : item,
        });
        errorEmitter.emit('permission-error', permissionError);
      });
  }

  const handleOpenRename = (type: RenameType, id: string | number, name: string) => {
    setRenameItem({ id, name, type });
    setRenameOpen(true);
  };

  const handleSaveRename = (newName: string) => {
    if (!renameItem || !db) return;
    const { id, type } = renameItem;
    let collectionName = '';
    switch(type) {
        case 'league': collectionName = 'leagueCustomizations'; break;
        case 'team': collectionName = 'teamCustomizations'; break;
        case 'player': collectionName = 'playerCustomizations'; break;
    }
    const docRef = doc(db, collectionName, String(id));
    const data = { customName: newName };
    setDoc(docRef, data)
      .then(() => fetchAllCustomNames())
      .catch(serverError => {
        const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'create',
            requestResourceData: data,
        });
        errorEmitter.emit('permission-error', permissionError);
      });
  };
  
  const handleOpenNote = (team: {id: number, name: string, logo: string}) => {
    setNoteTeam(team);
    setIsNoteOpen(true);
  }

  const handleSaveNote = (note: string) => {
    if (!noteTeam || !db) return;
    const docRef = doc(db, "adminFavorites", String(noteTeam.id));
    const data = {
      teamId: noteTeam.id,
      name: noteTeam.name,
      logo: noteTeam.logo,
      note: note
    };
    setDoc(docRef, data)
     .catch(serverError => {
       const permissionError = new FirestorePermissionError({
          path: docRef.path,
          operation: 'create',
          requestResourceData: data
      });
      errorEmitter.emit('permission-error', permissionError);
    });
  }

  const handleDeleteCompetition = () => {
    if (!isAdmin || !db || !leagueId) return;
    setIsDeleting(true);
    const docRef = doc(db, 'managedCompetitions', String(leagueId));

    deleteDoc(docRef)
      .then(() => {
        toast({ title: t('success_title'), description: t('delete_competition_success_desc') });
        goBack();
      })
      .catch(serverError => {
        const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
      })
      .finally(() => {
        setIsDeleting(false);
        setDeleteAlertOpen(false);
      });
  }


  const secondaryActions = (
    <div className="flex items-center gap-1">
      {isAdmin && leagueId && (
        <>
            <AlertDialog open={isDeleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => { e.stopPropagation(); setDeleteAlertOpen(true); }}
                >
                    <Trash2 className="h-5 w-5 text-destructive" />
                </Button>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('are_you_sure')}</AlertDialogTitle>
                        <AlertDialogDescription>
                           {t('delete_competition_confirm_desc')}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive hover:bg-destructive/90"
                            onClick={handleDeleteCompetition}
                            disabled={isDeleting}
                        >
                            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : t('delete')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <Button
                variant="ghost"
                size="icon"
                onClick={() => handleOpenRename('league', leagueId, displayTitle || '')}
            >
                <Pencil className="h-5 w-5" />
            </Button>
        </>
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
      <ScreenHeader title={displayTitle || ''} onBack={goBack} canGoBack={canGoBack} actions={secondaryActions} />
      {renameItem && <RenameDialog 
          isOpen={isRenameOpen}
          onOpenChange={setRenameOpen}
          currentName={renameItem.name}
          onSave={handleSaveRename}
          itemType={t('the_item')}
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
             <SeasonSelector season={season} onSeasonChange={setSeason} isAdmin={isAdmin} />
             <TabsList className="grid w-full grid-cols-4 rounded-none h-auto p-0 border-t">
              <TabsTrigger value="matches" className='rounded-none data-[state=active]:rounded-md'><Shield className="w-4 h-4 ml-1"/>{t('matches')}</TabsTrigger>
              <TabsTrigger value="standings" className='rounded-none data-[state=active]:rounded-md'><Trophy className="w-4 h-4 ml-1"/>{t('standings')}</TabsTrigger>
              <TabsTrigger value="scorers" className='rounded-none data-[state=active]:rounded-md'><BarChart2 className="w-4 h-4 ml-1"/>{t('top_scorers')}</TabsTrigger>
              <TabsTrigger value="teams" className='rounded-none data-[state=active]:rounded-md'><Users className="w-4 h-4 ml-1"/>{t('teams')}</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="matches" className="p-0 mt-0">
             {loading ? (
                <div className="space-y-4 p-4">
                    {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
                </div>
            ) : fixtures.length > 0 ? (
                <div className="space-y-3 p-1">
                    {fixtures.map((fixture) => (
                       <FixtureItem key={fixture.fixture.id} fixture={fixture} navigate={navigate} />
                    ))}
                </div>
            ) : <p className="pt-4 text-center text-muted-foreground">{t('no_matches_for_season')}</p>}
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
                            <TableHead className="w-[120px] text-right"></TableHead>
                            <TableHead className="text-center">{t('points')}</TableHead>
                            <TableHead className="text-center">{t('loss_short')}</TableHead>
                            <TableHead className="text-center">{t('draw_short')}</TableHead>
                            <TableHead className="text-center">{t('win_short')}</TableHead>
                            <TableHead className="text-center">{t('played_short')}</TableHead>
                            <TableHead className="text-right w-1/2">{t('team')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {standings.map((s) => {
                            const isFavoritedTeam = !!favorites?.teams?.[s.team.id];
                            return (
                            <TableRow key={s.team.id} className="cursor-pointer" onClick={() => navigate('TeamDetails', { teamId: s.team.id })}>
                                <TableCell onClick={e => e.stopPropagation()}>
                                     <div className='flex items-center justify-start opacity-80'>
                                        {isAdmin && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenRename('team', s.team.id, getDisplayName('team', s.team.id, s.team.name))}>
                                            <Pencil className="h-4 w-4 text-muted-foreground" />
                                        </Button>}
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleFavorite('team', {...s.team, name: getDisplayName('team', s.team.id, s.team.name)})}>
                                            <Star className={cn("h-5 w-5", isFavoritedTeam ? "text-yellow-400 fill-current" : "text-muted-foreground/50")} />
                                        </Button>
                                        {isAdmin && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenNote({...s.team, name: getDisplayName('team', s.team.id, s.team.name)})}>
                                            <Heart className="h-4 w-4 text-muted-foreground" />
                                        </Button>}
                                     </div>
                                </TableCell>
                                <TableCell className="text-center font-bold">{s.points}</TableCell>
                                <TableCell className="text-center">{s.all.lose}</TableCell>
                                <TableCell className="text-center">{s.all.draw}</TableCell>
                                <TableCell className="text-center">{s.all.win}</TableCell>
                                <TableCell className="text-center">{s.all.played}</TableCell>
                                <TableCell className="font-medium">
                                    <div className="flex items-center gap-2 justify-end">
                                        
                                        <p className="truncate">
                                            {getDisplayName('team', s.team.id, s.team.name)}
                                            {isAdmin && <span className="text-xs text-muted-foreground ml-2">(ID: {s.team.id})</span>}
                                        </p>
                                        <div className="relative">
                                            <Avatar className="h-6 w-6">
                                                <AvatarImage src={s.team.logo} alt={s.team.name} />
                                                <AvatarFallback>{s.team.name.substring(0,1)}</AvatarFallback>
                                            </Avatar>
                                            {isAdmin && <Button variant="ghost" size="icon" className="absolute -top-2 -right-2 h-6 w-6" onClick={(e) => { e.stopPropagation(); handleCopy(s.team.logo); }}><Copy className="h-3 w-3 text-muted-foreground" /></Button>}
                                        </div>
                                        <span>{s.rank}</span>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )})}
                    </TableBody>
                </Table>
            ): <p className="pt-4 text-center text-muted-foreground">{t('standings_not_available')}</p>}
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
                            <TableHead className="text-right">{t('player')}</TableHead>
                            <TableHead className="text-right">{t('team')}</TableHead>
                            <TableHead className="text-center">{t('goals')}</TableHead>
                            <TableHead className="text-left w-[90px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {topScorers.map(({ player, statistics }) => (
                            <TableRow key={player.id} className="cursor-pointer" onClick={() => navigate('PlayerDetails', { playerId: player.id })}>
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
                                <TableCell onClick={(e) => { e.stopPropagation(); navigate('TeamDetails', { teamId: statistics[0]?.team.id })}}>
                                     <p className="text-xs text-muted-foreground text-right">{getDisplayName('team', statistics[0]?.team.id, statistics[0]?.team.name)}</p>
                                </TableCell>
                                <TableCell className="text-center font-bold text-lg">{statistics[0]?.goals.total}</TableCell>
                                <TableCell>
                                    <div className='flex items-center justify-start opacity-80' onClick={e => e.stopPropagation()}>
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
            ) : <p className="pt-4 text-center text-muted-foreground">{t('top_scorers_not_available')}</p>}
          </TabsContent>
          <TabsContent value="teams" className="mt-0">
            {loading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
                    {Array.from({ length: 12 }).map((_, i) => (
                        <div key={i} className="flex flex-col items-center gap-2 rounded-lg border bg-card p-4">
                            <Skeleton className="h-16 w-16 rounded-full" />
                            <Skeleton className="h-4 w-24" />
                        </div>
                    ))}
                </div>
            ) : teams.length > 0 ? (
                 <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4">
                    {teams.map(({ team }) => {
                        const isFavoritedTeam = !!favorites?.teams?.[team.id];
                        return (
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
                                    <Star className={cn("h-5 w-5", isFavoritedTeam ? "text-yellow-400 fill-current" : "text-muted-foreground/50")} />
                                </Button>
                                {isAdmin && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleOpenNote({...team, name: getDisplayName('team', team.id, team.name)});}}>
                                    <Heart className="h-4 w-4 text-muted-foreground" />
                                </Button>}
                            </div>
                        </div>
                    )})}
                </div>
            ) : <p className="pt-4 text-center text-muted-foreground">{t('teams_not_available')}</p>}
        </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
