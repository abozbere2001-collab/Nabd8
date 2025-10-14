

"use client";

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import type { ScreenProps } from '@/app/page';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useAdmin, useAuth, useFirestore } from '@/firebase/provider';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { Loader2, Pencil, Star } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { RenameDialog } from '@/components/RenameDialog';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { Team, Player, Fixture, Standing, TeamStatistics } from '@/lib/types';
import { CURRENT_SEASON, PREVIOUS_SEASON } from '@/lib/constants';
import { FixtureItem } from '@/components/FixtureItem';

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

const PlayersTab = ({ teamId, navigate }: { teamId: number, navigate: ScreenProps['navigate'] }) => {
    const [players, setPlayers] = useState<Player[]>([]);
    const [loading, setLoading] = useState(true);
    const { isAdmin } = useAdmin();
    const { toast } = useToast();
    const { db } = useFirestore();
    const [customNames, setCustomNames] = useState<Map<number, string>>(new Map());
    const [renameItem, setRenameItem] = useState<{ id: number, name: string } | null>(null);

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
            console.error("Error fetching custom player names:", error);
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

    const handleSaveRename = async (newName: string) => {
        if (!renameItem || !db) return;
        const { id } = renameItem;
        const docRef = doc(db, 'playerCustomizations', String(id));
        const data = { customName: newName };
        try {
            await setDoc(docRef, data);
            await fetchCustomNames();
            toast({ title: "نجاح", description: "تم تحديث اسم اللاعب." });
        } catch (error) {
            const permissionError = new FirestorePermissionError({
                path: docRef.path,
                operation: 'create',
                requestResourceData: data
            });
            errorEmitter.emit('permission-error', permissionError);
        }
    };


    if (loading) {
        return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
    }
    
    return (
        <div className="space-y-2">
            {renameItem && <RenameDialog isOpen={!!renameItem} onOpenChange={(isOpen) => !isOpen && setRenameItem(null)} currentName={renameItem.name} onSave={handleSaveRename} itemType="اللاعب" />}
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
                        {isAdmin && (
                            <Button variant="ghost" size="icon" onClick={() => setRenameItem({ id: player.id, name: getDisplayName(player.id, player.name) })}>
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
    
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch stats first to get league ID
                const statsRes = await fetch(`/api/football/teams/statistics?team=${teamId}&season=${PREVIOUS_SEASON}`);
                const statsData = await statsRes.json();
                const leagueId = statsData?.response?.league?.id;

                if (leagueId) {
                    const [fixturesRes, standingsRes] = await Promise.all([
                        fetch(`/api/football/fixtures?team=${teamId}&season=${CURRENT_SEASON}`),
                        fetch(`/api/football/standings?league=${leagueId}&season=${CURRENT_SEASON}`)
                    ]);

                    const fixturesData = await fixturesRes.json();
                    const standingsData = await standingsRes.json();

                    setFixtures(fixturesData.response || []);
                    setStandings(standingsData.response?.[0]?.league?.standings?.[0] || []);
                }
                 setStats(statsData.response);
            } catch (error) {
                console.error("Error fetching team details tabs:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [teamId]);
    
    if (loading) {
         return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
    }

    return (
        <Tabs defaultValue="matches" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="matches">المباريات</TabsTrigger>
                <TabsTrigger value="standings">الترتيب</TabsTrigger>
                <TabsTrigger value="stats">الإحصائيات</TabsTrigger>
            </TabsList>
            <TabsContent value="matches" className="mt-4 space-y-3">
                {fixtures.length > 0 ? fixtures.map(fixture => (
                    <FixtureItem key={fixture.fixture.id} fixture={fixture} navigate={navigate} />
                )) : <p className="text-center text-muted-foreground p-8">لا توجد مباريات متاحة.</p>}
            </TabsContent>
            <TabsContent value="standings" className="mt-4">
                 {standings.length > 0 ? (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[40px]">#</TableHead>
                                <TableHead>الفريق</TableHead>
                                <TableHead className="text-center">لعب</TableHead>
                                <TableHead className="text-center">ف</TableHead>
                                <TableHead className="text-center">ت</TableHead>
                                <TableHead className="text-center">خ</TableHead>
                                <TableHead className="text-center">نقاط</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {standings.map(s => (
                                <TableRow key={s.team.id} className={cn(s.team.id === teamId && 'bg-primary/10')}>
                                    <TableCell>{s.rank}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Avatar className="h-6 w-6"><AvatarImage src={s.team.logo} /></Avatar>
                                            <span className="font-semibold">{s.team.name}</span>
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
                ) : <p className="text-center text-muted-foreground p-8">جدول الترتيب غير متاح.</p>}
            </TabsContent>
            <TabsContent value="stats" className="mt-4">
                {stats ? (
                    <Card>
                        <CardHeader>
                            <CardTitle>إحصائيات موسم {stats.league?.season || PREVIOUS_SEASON}</CardTitle>
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
                                    <p className="text-sm text-muted-foreground">الأهداف المسجلة</p>
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
  const [displayTitle, setDisplayTitle] = useState("الفريق");
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
                    setTeamData(data.response[0]);
                    const name = data.response[0].team.name;
                    // Check for a custom name in Firestore
                    if (db) {
                        const customNameDocRef = doc(db, "teamCustomizations", String(teamId));
                        const customNameDocSnap = await getDoc(customNameDocRef);
                        if (customNameDocSnap.exists()) {
                            setDisplayTitle(customNameDocSnap.data().customName);
                        } else {
                            setDisplayTitle(name);
                        }
                    } else {
                         setDisplayTitle(name);
                    }
                }
            }
        } catch (error) {
            console.error("Error fetching team info:", error);
            if (db) {
                const permissionError = new FirestorePermissionError({
                    path: `teamCustomizations/${teamId}`,
                    operation: 'get',
                });
                errorEmitter.emit('permission-error', permissionError);
            }
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
        <TeamHeader team={teamData.team} venue={teamData.venue} />
         <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">التفاصيل</TabsTrigger>
            <TabsTrigger value="players">اللاعبون</TabsTrigger>
          </TabsList>
          <TabsContent value="details" className="mt-4">
            <TeamDetailsTabs teamId={teamId} navigate={navigate} />
          </TabsContent>
          <TabsContent value="players" className="mt-4">
            <PlayersTab teamId={teamId} navigate={navigate} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

    