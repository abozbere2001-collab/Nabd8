
"use client";

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import type { ScreenProps } from '@/app/page';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProfileButton } from '../AppContentWrapper';
import { Button } from '@/components/ui/button';
import { Crown, Search, X, Loader2 } from 'lucide-react';
import { SearchSheet } from '@/components/SearchSheet';
import { useAuth, useFirestore } from '@/firebase/provider';
import type { CrownedTeam, Favorites, Fixture, CrownedLeague, Standing, TopScorer } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { collection, onSnapshot, doc, updateDoc, deleteField } from 'firebase/firestore';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { useToast } from '@/hooks/use-toast';
import { FixtureItem } from '@/components/FixtureItem';
import { isMatchLive } from '@/lib/matchStatus';
import { CURRENT_SEASON } from '@/lib/constants';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, addDays } from 'date-fns';

const CrownedTeamScroller = ({
  crownedTeams,
  onSelectTeam,
  onRemove,
  selectedTeamId,
}: {
  crownedTeams: CrownedTeam[];
  onSelectTeam: (teamId: number) => void;
  onRemove: (teamId: number) => void;
  selectedTeamId: number | null;
}) => {
  if (crownedTeams.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-4 px-4">
        <p>لم تتوج أي فريق بعد. اضغط على التاج 👑 بجانب أي فريق لتبدأ!</p>
      </div>
    );
  }

  return (
    <ScrollArea className="w-full whitespace-nowrap">
      <div className="flex w-max space-x-4 px-4 flex-row-reverse">
        {crownedTeams.map(team => (
          <div
            key={team.teamId}
            className="relative flex flex-col items-center gap-2 w-24 text-center cursor-pointer group"
            onClick={() => onSelectTeam(team.teamId)}
          >
            <Avatar className={`h-16 w-16 border-2 ${selectedTeamId === team.teamId ? 'border-primary' : 'border-yellow-400'}`}>
              <AvatarImage src={team.logo} />
              <AvatarFallback>{team.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <span className="text-xs font-medium truncate w-full">{team.name}</span>
            <p className="text-[10px] text-muted-foreground truncate w-full h-8">{team.note}</p>
            <button 
              onClick={(e) => { e.stopPropagation(); onRemove(team.teamId); }}
              className="absolute top-0 left-0 h-6 w-6 bg-background/80 rounded-full flex items-center justify-center border border-destructive"
            >
              <X className="h-4 w-4 text-destructive"/>
            </button>
          </div>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
};

const TeamFixturesDisplay = ({ teamId, navigate }: { teamId: number; navigate: ScreenProps['navigate'] }) => {
    const [allFixtures, setAllFixtures] = useState<Fixture[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();
    const listRef = useRef<HTMLDivElement>(null);
    const firstUpcomingMatchRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchFixtures = async () => {
            if (!teamId) return;
            setLoading(true);
            try {
                const url = `/api/football/fixtures?team=${teamId}&season=${CURRENT_SEASON}`;
                const res = await fetch(url);
                if (!res.ok) throw new Error(`API fetch failed with status: ${res.status}`);
                
                const data = await res.json();
                const fixtures: Fixture[] = data.response || [];
                fixtures.sort((a, b) => a.fixture.timestamp - b.fixture.timestamp);
                setAllFixtures(fixtures);
            } catch (error) {
                console.error("Error fetching fixtures:", error);
                toast({
                    variant: "destructive",
                    title: "خطأ في الشبكة",
                    description: "فشل في جلب المباريات. يرجى التحقق من اتصالك بالإنترنت.",
                });
            } finally {
                setLoading(false);
            }
        };
        fetchFixtures();
    }, [teamId, toast]);

    useEffect(() => {
        if (!loading && allFixtures.length > 0 && listRef.current) {
            const firstUpcomingIndex = allFixtures.findIndex(f => isMatchLive(f.fixture.status) || new Date(f.fixture.timestamp * 1000) > new Date());
            if (firstUpcomingIndex !== -1 && firstUpcomingMatchRef.current) {
                setTimeout(() => {
                    if (firstUpcomingMatchRef.current && listRef.current) {
                        const listTop = listRef.current.offsetTop;
                        const itemTop = firstUpcomingMatchRef.current.offsetTop;
                        listRef.current.scrollTop = itemTop - listTop;
                    }
                }, 100);
            }
        }
    }, [loading, allFixtures]);

    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }

    if (allFixtures.length === 0) {
      return (
        <Card className="mt-4">
            <CardContent className="p-6">
                <p className="text-center text-muted-foreground">لا توجد مباريات متاحة لهذا الفريق.</p>
            </CardContent>
        </Card>
      );
    }

    return (
        <div ref={listRef} className="space-y-2">
            {allFixtures.map((fixture, index) => {
                 const isUpcomingOrLive = isMatchLive(fixture.fixture.status) || new Date(fixture.fixture.timestamp * 1000) > new Date();
                 const isFirstUpcoming = isUpcomingOrLive && !allFixtures.slice(0, index).some(f => isMatchLive(f.fixture.status) || new Date(f.fixture.timestamp * 1000) > new Date());
                
                return (
                    <div key={fixture.fixture.id} ref={isFirstUpcoming ? firstUpcomingMatchRef : null}>
                        <FixtureItem fixture={fixture} navigate={navigate} />
                    </div>
                );
            })}
        </div>
    );
};


const CrownedLeagueCard = ({ league, navigate }: { league: CrownedLeague, navigate: ScreenProps['navigate'] }) => {
    const [fixtures, setFixtures] = useState<Fixture[]>([]);
    const [standings, setStandings] = useState<Standing[]>([]);
    const [topScorers, setTopScorers] = useState<TopScorer[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const today = new Date();
                const twoWeeksFromNow = addDays(today, 14);
                const fromDate = format(today, 'yyyy-MM-dd');
                const toDate = format(twoWeeksFromNow, 'yyyy-MM-dd');

                const [fixturesRes, standingsRes, scorersRes] = await Promise.all([
                    fetch(`/api/football/fixtures?league=${league.leagueId}&season=${CURRENT_SEASON}&from=${fromDate}&to=${toDate}`),
                    fetch(`/api/football/standings?league=${league.leagueId}&season=${CURRENT_SEASON}`),
                    fetch(`/api/football/players/topscorers?league=${league.leagueId}&season=${CURRENT_SEASON}`)
                ]);

                const fixturesData = await fixturesRes.json();
                const standingsData = await standingsRes.json();
                const scorersData = await scorersRes.json();
                
                setFixtures(fixturesData.response || []);
                setStandings(standingsData.response?.[0]?.league?.standings?.[0] || []);
                setTopScorers(scorersData.response || []);

            } catch (error) {
                console.error(`Failed to fetch data for league ${league.leagueId}`, error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [league.leagueId]);

    return (
        <Card>
            <CardHeader className="flex flex-row items-center gap-3">
                <Avatar className="h-10 w-10"><AvatarImage src={league.logo} className="object-contain p-1" /></Avatar>
                <div>
                    <CardTitle>{league.name}</CardTitle>
                    {league.note && <p className="text-sm text-muted-foreground">{league.note}</p>}
                </div>
            </CardHeader>
            <CardContent>
                {loading ? <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin"/></div> : (
                    <Tabs defaultValue="matches" className="w-full">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="matches">المباريات</TabsTrigger>
                            <TabsTrigger value="standings">الترتيب</TabsTrigger>
                            <TabsTrigger value="scorers">الهدافين</TabsTrigger>
                        </TabsList>
                        <TabsContent value="matches" className="mt-4 space-y-2">
                            {fixtures.length > 0 ? fixtures.map(f => <FixtureItem key={f.fixture.id} fixture={f} navigate={navigate} />) : <p className="text-center text-sm text-muted-foreground p-4">لا توجد مباريات قادمة خلال الأسبوعين المقبلين.</p>}
                        </TabsContent>
                        <TabsContent value="standings" className="mt-4">
                             {standings.length > 0 ? (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="text-center">نقاط</TableHead>
                                            <TableHead className="w-1/2 text-right">الفريق</TableHead>
                                            <TableHead className="w-[40px]">#</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {standings.slice(0, 5).map(s => (
                                             <TableRow key={s.team.id} className="cursor-pointer" onClick={() => navigate('TeamDetails', { teamId: s.team.id })}>
                                                <TableCell className="text-center font-bold">{s.points}</TableCell>
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
                             ) : <p className="text-center text-sm text-muted-foreground p-4">الترتيب غير متاح حاليًا.</p>}
                        </TabsContent>
                        <TabsContent value="scorers" className="mt-4">
                            {topScorers.length > 0 ? (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-12 text-center">أهداف</TableHead>
                                            <TableHead className="text-right">اللاعب</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                         {topScorers.slice(0, 5).map(({ player, statistics }) => (
                                            <TableRow key={player.id} className="cursor-pointer" onClick={() => navigate('PlayerDetails', { playerId: player.id })}>
                                                <TableCell className="font-bold text-lg text-center">{statistics[0]?.goals.total}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-3 justify-end">
                                                        <div className="text-right">
                                                            <p className="font-semibold truncate">{player.name}</p>
                                                            <p className="text-xs text-muted-foreground truncate">{statistics[0]?.team.name}</p>
                                                        </div>
                                                        <Avatar className="h-10 w-10">
                                                            <AvatarImage src={player.photo} />
                                                        </Avatar>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                         ))}
                                    </TableBody>
                                </Table>
                            ) : <p className="text-center text-sm text-muted-foreground p-4">قائمة الهدافين غير متاحة حاليًا.</p>}
                        </TabsContent>
                    </Tabs>
                )}
            </CardContent>
        </Card>
    );
};


export function KhaltakScreen({ navigate, goBack, canGoBack }: ScreenProps) {
  const { user } = useAuth();
  const { db } = useFirestore();
  const [favorites, setFavorites] = useState<Partial<Favorites>>({});
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);

  useEffect(() => {
    if (!user || !db) return;
    const favRef = doc(db, 'users', user.uid, 'favorites', 'data');
    const unsubscribe = onSnapshot(favRef, 
      (doc) => {
        setFavorites(doc.exists() ? doc.data() as Favorites : {});
      },
      (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: favRef.path, operation: 'get' }));
      }
    );
    return () => unsubscribe();
  }, [user, db]);

  const crownedTeams = useMemo(() => {
    if (!favorites.crownedTeams) return [];
    return Object.values(favorites.crownedTeams);
  }, [favorites.crownedTeams]);

  const crownedLeague = useMemo(() => {
    if (!favorites.crownedLeagues || Object.keys(favorites.crownedLeagues).length === 0) return null;
    const leagueId = Object.keys(favorites.crownedLeagues)[0];
    return favorites.crownedLeagues[Number(leagueId)] || null;
  }, [favorites.crownedLeagues]);
  
  useEffect(() => {
    if(crownedTeams.length > 0 && !selectedTeamId) {
      setSelectedTeamId(crownedTeams[0].teamId);
    }
    if (crownedTeams.length === 0) {
      setSelectedTeamId(null);
    }
  }, [crownedTeams, selectedTeamId]);


  const handleRemoveCrowned = (type: 'team' | 'league', id: number) => {
    if (!user || !db) return;
    const favRef = doc(db, 'users', user.uid, 'favorites', 'data');
    const fieldPath = type === 'team' ? `crownedTeams.${id}` : `crownedLeagues`;
    const updateData = type === 'team' ? { [fieldPath]: deleteField() } : { crownedLeagues: {} };
    
    updateDoc(favRef, updateData)
      .catch(err => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: favRef.path, operation: 'update', requestResourceData: { [fieldPath]: 'DELETED' } }));
      });
  };
  
  const handleSelectTeam = (teamId: number) => {
    setSelectedTeamId(teamId);
  }
  
  if (!user) {
    return (
       <div className="flex h-full flex-col bg-background">
          <ScreenHeader title="دورينا" onBack={goBack} canGoBack={canGoBack} />
           <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <Crown className="h-16 w-16 text-muted-foreground mb-4"/>
              <h2 className="text-xl font-bold">ميزة حصرية للمستخدمين المسجلين</h2>
              <p className="text-muted-foreground mb-6">
                قم بتسجيل الدخول لتتويج فرقك وبطولاتك المفضلة.
              </p>
              <Button onClick={() => navigate('Login')}>تسجيل الدخول</Button>
           </div>
       </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader
        title="دورينا"
        onBack={goBack}
        canGoBack={canGoBack}
        actions={
          <div className="flex items-center gap-1">
              <SearchSheet navigate={navigate}>
                  <Button variant="ghost" size="icon">
                      <Search className="h-5 w-5" />
                  </Button>
              </SearchSheet>
              <ProfileButton />
          </div>
        }
      />
      <Tabs defaultValue="kurratna" className="w-full flex-1 flex flex-col min-h-0">
        <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="doreena">دورينا</TabsTrigger>
            <TabsTrigger value="kurratna">كرتنا</TabsTrigger>
        </TabsList>
        
        <TabsContent value="kurratna" className="flex-1 flex flex-col min-h-0 mt-0 data-[state=inactive]:hidden">
           <div className="py-4 border-b">
                <CrownedTeamScroller 
                    crownedTeams={crownedTeams} 
                    onSelectTeam={handleSelectTeam}
                    onRemove={(id) => handleRemoveCrowned('team', id)} 
                    selectedTeamId={selectedTeamId}
                />
            </div>
            <div className="flex-1 overflow-y-auto p-4">
                {selectedTeamId ? (
                    <TeamFixturesDisplay teamId={selectedTeamId} navigate={navigate} />
                ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-center p-4">
                        <p>اختر فريقًا من الأعلى لعرض مبارياته.</p>
                    </div>
                )}
            </div>
        </TabsContent>

        <TabsContent value="doreena" className="flex-1 overflow-y-auto p-4 mt-0 data-[state=inactive]:hidden">
            {crownedLeague ? (
                <CrownedLeagueCard key={crownedLeague.leagueId} league={crownedLeague} navigate={navigate} />
            ) : (
                <div className="text-center text-muted-foreground pt-10">
                    <p className="font-bold text-lg">لم تقم بتتويج أي بطولة بعد</p>
                    <p>اذهب إلى البطولات واضغط على أيقونة التاج 👑</p>
                </div>
            )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
