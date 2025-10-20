
"use client";

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import type { ScreenProps } from '@/app/page';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProfileButton } from '../AppContentWrapper';
import { Button } from '@/components/ui/button';
import { Crown, Search, X, Loader2, Trophy, BarChart, Users as UsersIcon } from 'lucide-react';
import { SearchSheet } from '@/components/SearchSheet';
import { useAuth, useFirestore } from '@/firebase/provider';
import type { CrownedTeam, Favorites, Fixture, CrownedLeague, Standing, TopScorer, Prediction, Team, Player } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { collection, onSnapshot, doc, updateDoc, deleteField, setDoc, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { useToast } from '@/hooks/use-toast';
import { FixtureItem } from '@/components/FixtureItem';
import { isMatchLive } from '@/lib/matchStatus';
import { CURRENT_SEASON } from '@/lib/constants';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, addDays } from 'date-fns';
import { ar } from 'date-fns/locale';
import PredictionCard from '@/components/PredictionCard';
import { FootballIcon } from '@/components/icons/FootballIcon';

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
            className="relative flex flex-col items-center gap-1 w-20 text-center cursor-pointer group"
            onClick={() => onSelectTeam(team.teamId)}
          >
            <Avatar className={`h-12 w-12 border-2 ${selectedTeamId === team.teamId ? 'border-primary' : 'border-yellow-400'}`}>
              <AvatarImage src={team.logo} />
              <AvatarFallback>{team.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <span className="text-[11px] font-medium truncate w-full">{team.name}</span>
            <p className="text-[9px] text-muted-foreground truncate w-full">{team.note}</p>
            <button 
              onClick={(e) => { e.stopPropagation(); onRemove(team.teamId); }}
              className="absolute top-0 left-0 h-5 w-5 bg-background/80 rounded-full flex items-center justify-center border border-destructive"
            >
              <X className="h-3 w-3 text-destructive"/>
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

const DoreenaTabContent = ({ activeTab, league, navigate, user, db }: { activeTab: string, league: CrownedLeague, navigate: ScreenProps['navigate'], user: any, db: any }) => {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        const fetchData = async () => {
            if (!activeTab || !league?.leagueId) return;

            setLoading(true);
            setData(null);

            let url = '';
            try {
                switch (activeTab) {
                    case 'matches':
                        const fromDate = format(new Date(), 'yyyy-MM-dd');
                        const toDate = format(addDays(new Date(), 14), 'yyyy-MM-dd');
                        url = `/api/football/fixtures?league=${league.leagueId}&season=${CURRENT_SEASON}&from=${fromDate}&to=${toDate}`;
                        break;
                    case 'standings':
                        url = `/api/football/standings?league=${league.leagueId}&season=${CURRENT_SEASON}`;
                        break;
                    case 'scorers':
                        url = `/api/football/players/topscorers?league=${league.leagueId}&season=${CURRENT_SEASON}`;
                        break;
                    case 'predictions':
                        // Fetch today's matches for predictions
                        const today = format(new Date(), 'yyyy-MM-dd');
                        url = `/api/football/fixtures?league=${league.leagueId}&season=${CURRENT_SEASON}&date=${today}`;
                        break;
                }
                
                if (url) {
                    const res = await fetch(url);
                    if (!res.ok) throw new Error('Failed to fetch data');
                    const result = await res.json();
                    
                    if (activeTab === 'standings') {
                        setData(result.response[0]?.league?.standings[0] || []);
                    } else {
                        setData(result.response || []);
                    }
                }

            } catch (error) {
                console.error(`Error fetching ${activeTab}:`, error);
                toast({ variant: 'destructive', title: 'خطأ', description: `فشل في جلب بيانات ${activeTab}` });
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [activeTab, league, toast]);

    const handleSavePrediction = useCallback(async (fixtureId: number, homeGoalsStr: string, awayGoalsStr: string) => {
        if (!user || homeGoalsStr === '' || awayGoalsStr === '' || !db) return;
        const homeGoals = parseInt(homeGoalsStr, 10);
        const awayGoals = parseInt(awayGoalsStr, 10);
        if (isNaN(homeGoals) || isNaN(awayGoals)) return;

        const predictionRef = doc(db, 'predictions', `${user.uid}_${fixtureId}`);
        const predictionData: Prediction = {
            userId: user.uid,
            fixtureId,
            homeGoals,
            awayGoals,
            points: 0,
            timestamp: new Date().toISOString()
        };
        setDoc(predictionRef, predictionData, { merge: true }).catch(error => {
            const permissionError = new FirestorePermissionError({
              path: predictionRef.path,
              operation: 'create',
              requestResourceData: predictionData
            });
            errorEmitter.emit('permission-error', permissionError);
        });
    }, [user, db]);
    
    const [predictions, setPredictions] = useState<{ [key: number]: Prediction }>({});

    useEffect(() => {
        if (activeTab === 'predictions' && data && user && db) {
            const fixtureIds = (data as Fixture[]).map(f => f.fixture.id);
            if (fixtureIds.length === 0) return;

            const q = query(collection(db, 'predictions'), where('userId', '==', user.uid), where('fixtureId', 'in', fixtureIds));
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const userPredictions: { [key: number]: Prediction } = {};
                snapshot.forEach(doc => {
                    const pred = doc.data() as Prediction;
                    userPredictions[pred.fixtureId] = pred;
                });
                setPredictions(userPredictions);
            });
            return () => unsubscribe();
        }
    }, [activeTab, data, user, db]);


    if (loading) {
        return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
    }
    
    if (!data || data.length === 0) {
        return <div className="text-center text-muted-foreground py-10">لا توجد بيانات متاحة حاليًا.</div>;
    }

    if (activeTab === 'matches') {
        return (
            <div className="space-y-2">
                {(data as Fixture[]).map((fixture) => <FixtureItem key={fixture.fixture.id} fixture={fixture} navigate={navigate} />)}
            </div>
        );
    }

    if (activeTab === 'standings') {
        return (
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="text-center">نقاط</TableHead>
                        <TableHead className="text-center">لعب</TableHead>
                        <TableHead className="w-1/2 text-right">الفريق</TableHead>
                        <TableHead>#</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {(data as Standing[]).map((s) => (
                        <TableRow key={s.team.id} onClick={() => navigate('TeamDetails', { teamId: s.team.id })} className="cursor-pointer">
                            <TableCell className="text-center font-bold">{s.points}</TableCell>
                            <TableCell className="text-center">{s.all.played}</TableCell>
                            <TableCell>
                                <div className="flex items-center gap-2 justify-end">
                                    <span>{s.team.name}</span>
                                    <Avatar className="h-6 w-6"><AvatarImage src={s.team.logo} /></Avatar>
                                </div>
                            </TableCell>
                            <TableCell className="font-bold">{s.rank}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        );
    }
    
    if (activeTab === 'scorers') {
        return (
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="text-left w-12">الأهداف</TableHead>
                        <TableHead className="text-right">اللاعب</TableHead>
                        <TableHead>#</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {(data as TopScorer[]).map(({ player, statistics }, index) => (
                        <TableRow key={player.id} onClick={() => navigate('PlayerDetails', { playerId: player.id })} className="cursor-pointer">
                            <TableCell className="font-bold text-lg text-left">{statistics[0]?.goals.total}</TableCell>
                            <TableCell>
                                <div className="flex items-center gap-3 justify-end">
                                    <div className="text-right">
                                        <p className="font-semibold">{player.name}</p>
                                        <p className="text-xs text-muted-foreground">{statistics[0]?.team.name}</p>
                                    </div>
                                    <Avatar className="h-10 w-10"><AvatarImage src={player.photo} /></Avatar>
                                </div>
                            </TableCell>
                            <TableCell className="font-bold">{index + 1}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        );
    }

    if (activeTab === 'predictions') {
         return (
             <Tabs defaultValue="voting" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="prizes">الجوائز</TabsTrigger>
                    <TabsTrigger value="leaderboard">الترتيب</TabsTrigger>
                    <TabsTrigger value="voting">تصويت</TabsTrigger>
                </TabsList>
                <TabsContent value="voting" className="mt-4 space-y-4">
                     {(data as Fixture[]).length > 0 ? (
                        (data as Fixture[]).map(fixture => (
                            <PredictionCard 
                                key={fixture.fixture.id}
                                fixture={fixture}
                                userPrediction={predictions[fixture.fixture.id]}
                                onSave={(home, away) => handleSavePrediction(fixture.fixture.id, home, away)}
                            />
                        ))
                    ) : (
                        <div className="text-center text-muted-foreground pt-10">
                            <p>لا توجد مباريات متاحة للتوقع لهذا اليوم.</p>
                        </div>
                    )}
                </TabsContent>
                <TabsContent value="leaderboard" className="mt-4">
                    <Card>
                       <CardContent className="p-10 text-center text-muted-foreground">
                            <p className="text-lg font-bold">قريبًا...</p>
                            <p>سيتم عرض لوحة الصدارة الخاصة بتوقعات هذا الدوري هنا.</p>
                       </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="prizes" className="mt-4">
                    <Card>
                       <CardContent className="p-10 text-center text-muted-foreground">
                            <p className="text-lg font-bold">قريبًا...</p>
                            <p>سيتم الإعلان عن جوائز دورينا هنا.</p>
                       </CardContent>
                    </Card>
                </TabsContent>
             </Tabs>
         );
    }

    return null;
};



export function KhaltakScreen({ navigate, goBack, canGoBack }: ScreenProps) {
  const { user } = useAuth();
  const { db } = useFirestore();
  const [favorites, setFavorites] = useState<Partial<Favorites>>({});
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [mainTab, setMainTab] = useState('doreena');
  const [doreenaSubTab, setDoreenaSubTab] = useState('predictions');

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
          <ScreenHeader title="بلدي" onBack={goBack} canGoBack={canGoBack} />
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
        title="بلدي"
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
      <Tabs value={mainTab} onValueChange={setMainTab} className="flex flex-1 flex-col min-h-0">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="kurratna">كرتنا</TabsTrigger>
          <TabsTrigger value="doreena">دورينا</TabsTrigger>
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

        <TabsContent value="doreena" className="flex-1 flex flex-col min-h-0 mt-0 data-[state=inactive]:hidden">
          {crownedLeague ? (
             <Tabs value={doreenaSubTab} onValueChange={setDoreenaSubTab} className="flex flex-1 flex-col min-h-0 p-1">
                 <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="scorers">الهدافين</TabsTrigger>
                    <TabsTrigger value="standings">الترتيب</TabsTrigger>
                    <TabsTrigger value="matches">المباريات</TabsTrigger>
                    <TabsTrigger value="predictions">التوقعات</TabsTrigger>
                 </TabsList>
                 <div className="flex-1 overflow-y-auto mt-2">
                    <DoreenaTabContent 
                        activeTab={doreenaSubTab} 
                        league={crownedLeague} 
                        navigate={navigate} 
                        user={user}
                        db={db}
                    />
                 </div>
             </Tabs>
          ) : (
            <div className="text-center text-muted-foreground pt-10 flex flex-col items-center gap-4">
              <p className="font-bold text-lg">لم تقم بتتويج أي بطولة بعد</p>
              <p>اذهب إلى البطولات واضغط على أيقونة التاج 👑</p>
              <Button onClick={() => navigate('AllCompetitions')}>استكشف البطولات</Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

    