

"use client";

import React, { useEffect, useState, useCallback, useRef } from 'react';
import type { ScreenProps } from '@/app/page';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useAdmin, useAuth, useFirestore } from '@/firebase/provider';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { Loader2, Pencil, Shirt } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { RenameDialog } from '@/components/RenameDialog';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { Team, Player, Fixture, Standing, TeamStatistics } from '@/lib/types';
import { CURRENT_SEASON } from '@/lib/constants';
import { FixtureItem } from '@/components/FixtureItem';
import { Skeleton } from '@/components/ui/skeleton';
import { hardcodedTranslations } from '@/lib/hardcoded-translations';
import { isMatchLive } from '@/lib/matchStatus';

interface TeamData {
    team: Team;
    venue: {
        id: number;
        name: string;
        address: string;
        city: string;
        capacity: number;
        surface: string;
        image: string;
    };
}

const TeamHeader = ({ team, venue }: { team: Team, venue: TeamData['venue'] }) => (
    <Card className="mb-4 overflow-hidden">
        <div className="relative h-24 bg-gradient-to-r from-primary/20 to-accent/20" style={{backgroundImage: `url(${venue?.image})`, backgroundSize: 'cover', backgroundPosition: 'center'}}>
            <div className="absolute inset-0 bg-black/50" />
            <Avatar className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 h-24 w-24 border-4 border-background">
                <AvatarImage src={team.logo} alt={team.name} />
                <AvatarFallback>{team.name.charAt(0)}</AvatarFallback>
            </Avatar>
        </div>
        <CardContent className="pt-16 text-center">
            <h1 className="text-2xl font-bold">{team.name}</h1>
            <p className="text-muted-foreground">{venue?.name}</p>
        </CardContent>
    </Card>
);

const TeamPlayersTab = ({ teamId, navigate }: { teamId: number, navigate: ScreenProps['navigate'] }) => {
    const [players, setPlayers] = useState<Player[]>([]);
    const [loading, setLoading] = useState(true);
    const { isAdmin } = useAdmin();
    const { toast } = useToast();
    const { db } = useFirestore();
    const [customNames, setCustomNames] = useState<Map<number, string>>(new Map());
    const [renameItem, setRenameItem] = useState<{ id: number, name: string, originalName: string } | null>(null);

    const getDisplayName = useCallback((id: number, defaultName: string) => {
        return customNames.get(id) || defaultName;
    }, [customNames]);

     const fetchCustomNames = useCallback(async () => {
        if (!db) return;
        try {
            const snapshot = await getDocs(collection(db, 'playerCustomizations'));
            const names = new Map<number, string>();
            snapshot.forEach(doc => names.set(Number(doc.id), doc.data().customName));
            setCustomNames(names);
        } catch (error) {
            const permissionError = new FirestorePermissionError({
                path: 'playerCustomizations',
                operation: 'list',
            });
            errorEmitter.emit('permission-error', permissionError);
        }
    }, [db]);

    useEffect(() => {
        const fetchPlayers = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/football/players?team=${teamId}&season=${CURRENT_SEASON}`);
                const data = await res.json();
                if (data.response) {
                    setPlayers(data.response.map((p: any) => p.player));
                }
                await fetchCustomNames();
            } catch (error) {
                toast({ variant: 'destructive', title: "خطأ", description: "فشل في جلب قائمة اللاعبين." });
            } finally {
                setLoading(false);
            }
        };
        fetchPlayers();
    }, [teamId, toast, fetchCustomNames]);

    const handleSaveRename = (type: string, id: number, newName: string, originalName: string) => {
        if (!renameItem || !db) return;
        const docRef = doc(db, 'playerCustomizations', String(id));
        
        if (newName && newName !== originalName) {
            const data = { customName: newName };
            setDoc(docRef, data).then(() => {
                fetchCustomNames();
                toast({ title: "نجاح", description: "تم تحديث اسم اللاعب." });
            }).catch(serverError => {
                const permissionError = new FirestorePermissionError({
                    path: docRef.path,
                    operation: 'create',
                    requestResourceData: data
                });
                errorEmitter.emit('permission-error', permissionError);
            });
        }
         setRenameItem(null);
    };


    if (loading) {
        return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
    }
    
    return (
        <div className="space-y-2">
            {renameItem && <RenameDialog isOpen={!!renameItem} onOpenChange={(isOpen) => !isOpen && setRenameItem(null)} item={{...renameItem, type: 'player'}} onSave={(type, id, name) => handleSaveRename(type, Number(id), name, renameItem.originalName)} />}
            {players.map(player => (
                <Card key={player.id} className="p-2">
                    <div className="flex items-center gap-3">
                         <div className="flex-1 flex items-center gap-3 cursor-pointer" onClick={() => navigate('PlayerDetails', { playerId: player.id })}>
                            <Avatar className="h-10 w-10">
                                <AvatarImage src={player.photo} />
                                <AvatarFallback>{player.name?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="font-semibold">{getDisplayName(player.id, player.name)}</p>
                                <p className="text-xs text-muted-foreground">{player.position}</p>
                            </div>
                        </div>
                        {player.number && (
                           <div className="relative flex items-center justify-center text-primary-foreground">
                               <Shirt className="h-10 w-10 text-primary" />
                               <span className="absolute text-xs font-bold">{player.number}</span>
                           </div>
                        )}
                        {isAdmin && (
                            <Button variant="ghost" size="icon" onClick={() => setRenameItem({ id: player.id, name: getDisplayName(player.id, player.name), originalName: player.name })}>
                                <Pencil className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </Card>
            ))}
        </div>
    );
};

const TeamDetailsTabs = ({ teamId, navigate }: { teamId: number, navigate: ScreenProps['navigate']}) => {
    const [fixtures, setFixtures] = useState<Fixture[]>([]);
    const [standings, setStandings] = useState<Standing[]>([]);
    const [stats, setStats] = useState<TeamStatistics | null>(null);
    const [loading, setLoading] = useState(true);
    const { db } = useFirestore();
    const [customNames, setCustomNames] = useState<{leagues: Map<number, string>, teams: Map<number, string>} | null>(null);

    const fixturesListRef = useRef<HTMLDivElement>(null);
    const firstUpcomingMatchRef = useRef<HTMLDivElement>(null);


     const fetchAllCustomNames = useCallback(async () => {
        if (!db) {
            setCustomNames({ leagues: new Map(), teams: new Map() });
            return;
        }
        try {
            const [leaguesSnapshot, teamsSnapshot] = await Promise.all([
                getDocs(collection(db, 'leagueCustomizations')),
                getDocs(collection(db, 'teamCustomizations'))
            ]);
            
            const leagueNames = new Map<number, string>();
            leaguesSnapshot?.forEach(doc => leagueNames.set(Number(doc.id), doc.data().customName));
            
            const teamNames = new Map<number, string>();
            teamsSnapshot?.forEach(doc => teamNames.set(Number(doc.id), doc.data().customName));
            
            setCustomNames({ leagues: leagueNames, teams: teamNames });
        } catch(error) {
             console.warn("Could not fetch custom names, this is expected for non-admins", error);
             setCustomNames({ leagues: new Map(), teams: new Map() });
        }
    }, [db]);
    
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            await fetchAllCustomNames();
            try {
                const [fixturesRes, statsRes] = await Promise.all([
                    fetch(`/api/football/fixtures?team=${teamId}&season=${CURRENT_SEASON}`),
                    fetch(`/api/football/teams/statistics?team=${teamId}&season=${CURRENT_SEASON}`)
                ]);

                const fixturesData = await fixturesRes.json();
                const statsData = await statsRes.json();
                
                const sortedFixtures = (fixturesData.response || []).sort((a: Fixture, b: Fixture) => a.fixture.timestamp - b.fixture.timestamp);
                setFixtures(sortedFixtures);
                setStats(statsData.response);

                const leagueId = sortedFixtures[0]?.league?.id || statsData?.response?.league?.id;

                if (leagueId) {
                    const standingsRes = await fetch(`/api/football/standings?league=${leagueId}&season=${CURRENT_SEASON}`);
                    const standingsData = await standingsRes.json();
                    setStandings(standingsData.response?.[0]?.league?.standings?.[0] || []);
                }

            } catch (error) {
                console.error("Error fetching team details tabs:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [teamId, fetchAllCustomNames]);

    useEffect(() => {
        if (!loading && fixtures.length > 0 && fixturesListRef.current) {
            setTimeout(() => {
                if (firstUpcomingMatchRef.current && fixturesListRef.current) {
                    const listTop = fixturesListRef.current.offsetTop;
                    const itemTop = firstUpcomingMatchRef.current.offsetTop;
                    fixturesListRef.current.scrollTop = itemTop - listTop;
                }
            }, 300);
        }
    }, [loading, fixtures]);

    const getDisplayName = useCallback((type: 'team' | 'league', id: number, defaultName: string) => {
        if (!customNames) return defaultName;
        const key = `${type}s` as 'teams' | 'leagues';
        const firestoreMap = customNames[key];
        const customName = firestoreMap.get(id);
        if (customName) return customName;

        const hardcodedMap = hardcodedTranslations[key];
        const hardcodedName = hardcodedMap[id];
        if (hardcodedName) return hardcodedName;

        return defaultName;
    }, [customNames]);
    
    
    if (loading || customNames === null) {
         return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
    }

    const processedFixtures = fixtures.map(fixture => ({
        ...fixture,
        league: {
            ...fixture.league,
            name: getDisplayName('league', fixture.league.id, fixture.league.name),
        },
        teams: {
            home: { ...fixture.teams.home, name: getDisplayName('team', fixture.teams.home.id, fixture.teams.home.name) },
            away: { ...fixture.teams.away, name: getDisplayName('team', fixture.teams.away.id, fixture.teams.away.name) },
        }
    }));

     const processedStandings = standings.map(s => ({
        ...s,
        team: {
            ...s.team,
            name: getDisplayName('team', s.team.id, s.team.name),
        }
    }));


    return (
        <Tabs defaultValue="matches" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="matches">المباريات</TabsTrigger>
                <TabsTrigger value="standings">الترتيب</TabsTrigger>
                <TabsTrigger value="stats">الإحصائيات</TabsTrigger>
            </TabsList>
            <TabsContent value="matches" className="mt-4">
                <div ref={fixturesListRef} className="h-full overflow-y-auto space-y-3">
                    {processedFixtures.length > 0 ? processedFixtures.map((fixture, index) => {
                        const isUpcomingOrLive = isMatchLive(fixture.fixture.status) || !['FT', 'AET', 'PEN', 'PST'].includes(fixture.fixture.status.short);
                        const isFirstUpcoming = isUpcomingOrLive && !processedFixtures.slice(0, index).some(f => isMatchLive(f.fixture.status) || !['FT', 'AET', 'PEN', 'PST'].includes(f.fixture.status.short));
                        return (
                            <div key={fixture.fixture.id} ref={isFirstUpcoming ? firstUpcomingMatchRef : null}>
                                <FixtureItem fixture={fixture} navigate={navigate} />
                            </div>
                        )
                    }) : <p className="text-center text-muted-foreground p-8">لا توجد مباريات متاحة.</p>}
                </div>
            </TabsContent>
            <TabsContent value="standings" className="mt-4">
                 {processedStandings.length > 0 ? (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="text-center">نقاط</TableHead>
                                <TableHead className="text-center">ف/ت/خ</TableHead>
                                <TableHead className="text-center">لعب</TableHead>
                                <TableHead className="w-1/2 text-right">الفريق</TableHead>
                                <TableHead className="w-[40px]">#</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {processedStandings.map(s => (
                                <TableRow key={s.team.id} className={cn(s.team.id === teamId && 'bg-primary/10')}>
                                    <TableCell className="text-center font-bold">{s.points}</TableCell>
                                    <TableCell className="text-center text-xs">{`${s.all.win}/${s.all.draw}/${s.all.lose}`}</TableCell>
                                    <TableCell className="text-center">{s.all.played}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2 justify-end">
                                            <span className="font-semibold truncate">{s.team.name}</span>
                                            <Avatar className="h-6 w-6"><AvatarImage src={s.team.logo} /></Avatar>
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-bold">{s.rank}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                ) : <p className="text-center text-muted-foreground p-8">الترتيب غير متاح.</p>}
            </TabsContent>
            <TabsContent value="stats" className="mt-4">
                 {stats && stats.league ? (
                    <Card>
                        <CardHeader>
                            <CardTitle>إحصائيات موسم {stats.league.season || CURRENT_SEASON}</CardTitle>
                        </CardHeader>
                        <CardContent>
                             <div className="grid grid-cols-2 gap-4 text-center">
                                 <div className="p-4 bg-card-foreground/5 rounded-lg">
                                    <p className="font-bold text-2xl">{stats.fixtures?.played?.total || 0}</p>
                                    <p className="text-sm text-muted-foreground">مباريات</p>
                                 </div>
                                  <div className="p-4 bg-card-foreground/5 rounded-lg">
                                    <p className="font-bold text-2xl">{stats.fixtures?.wins?.total || 0}</p>
                                    <p className="text-sm text-muted-foreground">فوز</p>
                                 </div>
                                  <div className="p-4 bg-card-foreground/5 rounded-lg">
                                    <p className="font-bold text-2xl">{stats.fixtures?.draws?.total || 0}</p>
                                    <p className="text-sm text-muted-foreground">تعادل</p>
                                 </div>
                                  <div className="p-4 bg-card-foreground/5 rounded-lg">
                                    <p className="font-bold text-2xl">{stats.fixtures?.loses?.total || 0}</p>
                                    <p className="text-sm text-muted-foreground">خسارة</p>
                                 </div>
                                  <div className="p-4 bg-card-foreground/5 rounded-lg col-span-2">
                                    <p className="font-bold text-2xl">{stats.goals?.for?.total?.total || 0}</p>
                                    <p className="text-sm text-muted-foreground">أهداف</p>
                                 </div>
                             </div>
                        </CardContent>
                    </Card>
                ) : <p className="text-center text-muted-foreground p-8">الإحصائيات غير متاحة.</p>}
            </TabsContent>
        </Tabs>
    );
};


export function TeamDetailScreen({ navigate, goBack, canGoBack, teamId }: ScreenProps & { teamId: number }) {
  const { db } = useFirestore();
  const [displayTitle, setDisplayTitle] = useState<string | undefined>(undefined);
  const [teamData, setTeamData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teamId) return;

    const getTeamInfo = async () => {
        setLoading(true);
        try {
            const teamRes = await fetch(`/api/football/teams?id=${teamId}`);
            if (teamRes.ok) {
                const data = await teamRes.json();
                if (data.response?.[0]) {
                    const teamInfo = data.response[0];
                    setTeamData(teamInfo);
                    const name = teamInfo.team.name;
                    if (db) {
                        const customNameDocRef = doc(db, "teamCustomizations", String(teamId));
                        try {
                            const customNameDocSnap = await getDoc(customNameDocRef);
                            if (customNameDocSnap.exists()) {
                                setDisplayTitle(customNameDocSnap.data().customName);
                            } else {
                                setDisplayTitle(name);
                            }
                        } catch (error) {
                           // This can fail for non-admins due to security rules, which is fine.
                           // We just fall back to the default name.
                           setDisplayTitle(name);
                        }
                    } else {
                         setDisplayTitle(name);
                    }
                }
            }
        } catch (error) {
            console.error("Error fetching team info:", error);
        } finally {
            setLoading(false);
        }
    };
    
    getTeamInfo();
    
  }, [db, teamId]);


  if(loading) {
    return (
        <div className="flex h-full flex-col bg-background">
            <ScreenHeader title="جاري التحميل..." onBack={goBack} canGoBack={canGoBack} />
            <div className="p-4 space-y-4">
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        </div>
    );
  }
  
  if(!teamData) {
     return (
        <div className="flex h-full flex-col bg-background">
            <ScreenHeader title="خطأ" onBack={goBack} canGoBack={canGoBack} />
            <p className="text-center p-8">لم يتم العثور على بيانات الفريق.</p>
        </div>
    );
  }

  return (
    <div className="flex flex-col bg-background h-full">
      <ScreenHeader 
        title={displayTitle}
        onBack={goBack} 
        canGoBack={canGoBack} 
      />
      <div className="flex-1 overflow-y-auto p-1">
        <TeamHeader team={{...teamData.team, name: displayTitle || teamData.team.name}} venue={teamData.venue} />
         <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">التفاصيل</TabsTrigger>
            <TabsTrigger value="players">اللاعبون</TabsTrigger>
          </TabsList>
          <TabsContent value="details" className="mt-4">
            <TeamDetailsTabs teamId={teamId} navigate={navigate} />
          </TabsContent>
          <TabsContent value="players" className="mt-4">
            <TeamPlayersTab teamId={teamId} navigate={navigate} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
