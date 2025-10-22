

"use client";

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import type { ScreenProps } from '@/app/page';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProfileButton } from '../AppContentWrapper';
import { Button } from '@/components/ui/button';
import { Crown, Search, X, Loader2, Trophy, BarChart, Users as UsersIcon, RefreshCw, CalendarDays, ThumbsUp } from 'lucide-react';
import { SearchSheet } from '@/components/SearchSheet';
import { useAdmin, useAuth, useFirestore } from '@/firebase/provider';
import type { CrownedTeam, Favorites, Fixture, Standing, TopScorer, Prediction, Team, Player, UserScore, PredictionMatch } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { collection, onSnapshot, doc, updateDoc, deleteField, setDoc, query, where, getDocs, writeBatch, getDoc, orderBy, limit } from 'firebase/firestore';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { useToast } from '@/hooks/use-toast';
import { FixtureItem } from '@/components/FixtureItem';
import { isMatchLive } from '@/lib/matchStatus';
import { CURRENT_SEASON } from '@/lib/constants';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, addDays, subDays, isToday, isYesterday, isTomorrow } from 'date-fns';
import { ar } from 'date-fns/locale';
import PredictionCard from '@/components/PredictionCard';
import { FootballIcon } from '@/components/icons/FootballIcon';
import { cn } from '@/lib/utils';
import {Skeleton} from "@/components/ui/skeleton";


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
            <p className="text-[10px] text-muted-foreground truncate w-full">{team.note}</p>
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

const calculatePoints = (prediction: Prediction, fixture: Fixture): number => {
    if (fixture.goals.home === null || fixture.goals.away === null) return 0;

    const actualHome = fixture.goals.home;
    const actualAway = fixture.goals.away;
    const predHome = prediction.homeGoals;
    const predAway = prediction.awayGoals;

    if (actualHome === predHome && actualAway === predAway) {
        return 5;
    }

    const actualWinner = actualHome > actualAway ? 'home' : actualHome < actualAway ? 'away' : 'draw';
    const predWinner = predHome > predAway ? 'home' : predHome < predAway ? 'away' : 'draw';
    
    if (actualWinner === predWinner) {
        return 3;
    }

    return 0;
};

const LeaderboardDisplay = React.memo(({ leaderboard, loadingLeaderboard, userScore, userId }: { leaderboard: UserScore[], loadingLeaderboard: boolean, userScore: UserScore | null, userId: string | undefined }) => {
    if (loadingLeaderboard) {
        return (
            <div className="space-y-2 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 p-2">
                        <Skeleton className="h-4 w-4" />
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <div className="flex-1"><Skeleton className="h-4 w-3/4" /></div>
                        <Skeleton className="h-4 w-8" />
                    </div>
                ))}
            </div>
        );
    }

    if (leaderboard.length === 0) {
        return <p className="text-center text-muted-foreground p-8">لا يوجد مشاركون في لوحة الصدارة بعد.</p>;
    }
    
    const isUserInTop100 = leaderboard.some(s => s.userId === userId);

    return (
        <div className="space-y-2">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>الترتيب</TableHead>
                        <TableHead className="text-right">المستخدم</TableHead>
                        <TableHead className="text-center">النقاط</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {leaderboard.map(score => (
                        <TableRow key={score.userId} className={cn(score.userId === userId && "bg-primary/10")}>
                            <TableCell>{score.rank}</TableCell>
                            <TableCell className="text-right">
                                <div className="flex items-center gap-2 justify-end">
                                    {score.userName}
                                    <Avatar className="h-6 w-6"><AvatarImage src={score.userPhoto}/></Avatar>
                                </div>
                            </TableCell>
                            <TableCell className="text-center font-bold">{score.totalPoints}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
            {userScore && !isUserInTop100 && (
                 <Card className="bg-primary/10 mt-4">
                    <CardContent className="p-0">
                         <Table>
                             <TableBody>
                                <TableRow className="border-t-2 border-primary/50">
                                    <TableCell>{userScore.rank || '-'}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center gap-2 justify-end">
                                            {userScore.userName}
                                            <Avatar className="h-6 w-6"><AvatarImage src={userScore.userPhoto}/></Avatar>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center font-bold">{userScore.totalPoints}</TableCell>
                                </TableRow>
                             </TableBody>
                         </Table>
                    </CardContent>
                 </Card>
            )}
        </div>
    );
});
LeaderboardDisplay.displayName = 'LeaderboardDisplay';


const PredictionsTabContent = ({ user, db }: { user: any, db: any }) => {
    const [mainTab, setMainTab] = useState('voting');
    const [calculatingPoints, setCalculatingPoints] = useState(false);
    const { toast } = useToast();
    
    const [leaderboard, setLeaderboard] = useState<UserScore[]>([]);
    const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
    const [currentUserScore, setCurrentUserScore] = useState<UserScore | null>(null);

    const [pinnedMatches, setPinnedMatches] = useState<PredictionMatch[]>([]);
    const [loadingMatches, setLoadingMatches] = useState(true);

    const [userPredictions, setUserPredictions] = useState<{ [key: number]: Prediction }>({});

    // Fetch Leaderboard and current user's score
    const fetchLeaderboard = useCallback(async () => {
        if (!db) return;
        setLoadingLeaderboard(true);
        const leaderboardRef = collection(db, 'leaderboard');
        
        try {
            // Fetch top 100
            const q = query(leaderboardRef, orderBy('totalPoints', 'desc'), limit(100));
            const top100Snapshot = await getDocs(q);
            let rank = 1;
            const top100Scores = top100Snapshot.docs.map(doc => ({ userId: doc.id, ...(doc.data() as Omit<UserScore, 'userId'>), rank: rank++ }));
            setLeaderboard(top100Scores);
            
            // Fetch current user's score if they exist
            if (user) {
                const userScoreRef = doc(db, 'leaderboard', user.uid);
                const userScoreSnap = await getDoc(userScoreRef);
                if (userScoreSnap.exists()) {
                    // To get the rank, we need to count how many users have more points
                    const higherRankQuery = query(leaderboardRef, where('totalPoints', '>', userScoreSnap.data().totalPoints || 0));
                    const higherRankSnap = await getDocs(higherRankQuery);
                    const userRank = higherRankSnap.size + 1;
                    setCurrentUserScore({ userId: user.uid, ...userScoreSnap.data(), rank: userRank } as UserScore);
                } else {
                    setCurrentUserScore(null);
                }
            }
        } catch (error) {
            console.error("Error fetching leaderboard:", error);
        } finally {
            setLoadingLeaderboard(false);
        }
    }, [db, user]);
    
    // Fetch Pinned Matches
    useEffect(() => {
        if (!db) return;
        setLoadingMatches(true);
        const unsub = onSnapshot(collection(db, 'predictions'), snapshot => {
            const matches = snapshot.docs.map(doc => doc.data() as PredictionMatch);
            // Defensive sort: filter out items that don't have the required data
            const validMatches = matches.filter(m => m && m.fixtureData && m.fixtureData.fixture);
            validMatches.sort((a, b) => a.fixtureData.fixture.timestamp - b.fixtureData.fixture.timestamp);
            setPinnedMatches(validMatches);
            setLoadingMatches(false);
        }, error => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({path: 'predictions', operation: 'list'}));
            setLoadingMatches(false);
        });
        return () => unsub();
    }, [db]);


    // Fetch user's predictions for the visible pinned matches
    useEffect(() => {
        if (!user || !db || pinnedMatches.length === 0) return;
        
        const fixtureIds = pinnedMatches.map(m => m.fixtureData.fixture.id);
        const userPredsRef = collection(db, 'users', user.uid, 'predictions');
        const q = query(userPredsRef, where('fixtureId', 'in', fixtureIds));
        
        const unsub = onSnapshot(q, snapshot => {
            const predictions: { [key: number]: Prediction } = {};
            snapshot.forEach(doc => {
                const pred = doc.data() as Prediction;
                predictions[pred.fixtureId] = pred;
            });
            setUserPredictions(predictions);
        });
        return () => unsub();
    }, [user, db, pinnedMatches]);


    useEffect(() => {
        if (mainTab === 'leaderboard') {
            fetchLeaderboard();
        }
    }, [mainTab, fetchLeaderboard]);


    const handleSavePrediction = useCallback(async (fixtureId: number, homeGoalsStr: string, awayGoalsStr: string) => {
        if (!user || homeGoalsStr === '' || awayGoalsStr === '' || !db) return;
        const homeGoals = parseInt(homeGoalsStr, 10);
        const awayGoals = parseInt(awayGoalsStr, 10);
        if (isNaN(homeGoals) || isNaN(awayGoals)) return;
    
        const predictionRef = doc(db, 'users', user.uid, 'predictions', String(fixtureId));
        
        const predictionData: Prediction = {
            userId: user.uid,
            fixtureId,
            homeGoals,
            awayGoals,
            points: 0,
            timestamp: new Date().toISOString()
        };
        
        setDoc(predictionRef, predictionData, { merge: true }).catch(serverError => {
             const permissionError = new FirestorePermissionError({
                path: predictionRef.path,
                operation: 'write',
                requestResourceData: predictionData
            });
            errorEmitter.emit('permission-error', permissionError);
        });
    }, [user, db]);

     const handleCalculatePoints = useCallback(async () => {
        if (!db) return;
        setCalculatingPoints(true);
        toast({ title: 'بدء احتساب النقاط', description: 'يتم الآن احتساب نقاط مباريات الأمس...' });

        try {
            const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
            const fixturesRes = await fetch(`/api/football/fixtures?date=${yesterday}`);
            const fixturesData = await fixturesRes.json();
            const finishedFixtures: Fixture[] = (fixturesData.response || []).filter((f: Fixture) => ['FT', 'AET', 'PEN'].includes(f.fixture.status.short));

            if (finishedFixtures.length === 0) {
                toast({ title: 'لا توجد مباريات', description: 'لا توجد مباريات منتهية من الأمس لاحتساب نقاطها.' });
                setCalculatingPoints(false);
                return;
            }

            // Get all users who have made predictions for yesterday's matches
            const usersRef = collection(db, 'users');
            const usersSnap = await getDocs(usersRef);
            
            const batch = writeBatch(db);
            const userTotalPoints: {[key: string]: number} = {};

            for (const userDoc of usersSnap.docs) {
                const userId = userDoc.id;
                userTotalPoints[userId] = 0;
                
                const userPredictionsRef = collection(db, 'users', userId, 'predictions');
                const userPredictionsSnap = await getDocs(userPredictionsRef);
                
                userPredictionsSnap.forEach(predDoc => {
                    const prediction = predDoc.data() as Prediction;
                    const fixture = finishedFixtures.find(f => f.fixture.id === prediction.fixtureId);
                    
                    if (fixture) {
                        const points = calculatePoints(prediction, fixture);
                        if (prediction.points !== points) {
                           batch.update(predDoc.ref, { points });
                        }
                        userTotalPoints[userId] += points;
                    } else if (prediction.points) {
                         userTotalPoints[userId] += prediction.points;
                    }
                });
            }

            // Update leaderboard
            for (const userId in userTotalPoints) {
                const userDoc = usersSnap.docs.find(d => d.id === userId);
                if (userDoc) {
                    const leaderboardRef = doc(db, 'leaderboard', userId);
                    batch.set(leaderboardRef, {
                        totalPoints: userTotalPoints[userId],
                        userName: userDoc.data().displayName,
                        userPhoto: userDoc.data().photoURL,
                    }, { merge: true });
                }
            }

            await batch.commit();
            
            toast({ title: 'اكتمل الاحتساب', description: 'تم تحديث جميع النقاط في لوحة الصدارة.' });
            fetchLeaderboard(); // Refetch after calculation
        } catch (error: any) {
            console.error("Error calculating points:", error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل احتساب النقاط.' });
        } finally {
            setCalculatingPoints(false);
        }
    }, [db, toast, fetchLeaderboard]);

    const groupedMatches = useMemo(() => {
        return pinnedMatches.reduce((acc, match) => {
            const date = format(new Date(match.fixtureData.fixture.timestamp * 1000), 'yyyy-MM-dd');
            if (!acc[date]) {
                acc[date] = [];
            }
            acc[date].push(match);
            return acc;
        }, {} as Record<string, PredictionMatch[]>);
    }, [pinnedMatches]);

    const getDayLabel = (dateKey: string) => {
        const date = new Date(dateKey);
        if (isToday(date)) return 'اليوم';
        if (isYesterday(date)) return 'الأمس';
        if (isTomorrow(date)) return 'غداً';
        return format(date, 'EEEE, d MMM', { locale: ar });
    };

    return (
        <Tabs value={mainTab} onValueChange={setMainTab} className="w-full flex-1 flex flex-col">
           <TabsList className="grid w-full grid-cols-2">
               <TabsTrigger value="leaderboard"><BarChart className="ml-2 h-4 w-4" />الترتيب</TabsTrigger>
               <TabsTrigger value="voting"><ThumbsUp className="ml-2 h-4 w-4" />تصويت</TabsTrigger>
           </TabsList>
           <TabsContent value="voting" className="flex-1 overflow-y-auto mt-4 space-y-4">
                {loadingMatches ? (
                     <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : Object.keys(groupedMatches).length > 0 ? (
                    Object.keys(groupedMatches).sort().map(dateKey => (
                        <div key={dateKey}>
                             <h3 className="font-bold mb-2 text-center text-muted-foreground">{getDayLabel(dateKey)}</h3>
                            {groupedMatches[dateKey].map(match => (
                                <PredictionCard 
                                    key={match.fixtureData.fixture.id}
                                    predictionMatch={match}
                                    userPrediction={userPredictions[match.fixtureData.fixture.id]}
                                    onSave={handleSavePrediction}
                                />
                            ))}
                        </div>
                    ))
                ) : (
                    <div className="text-center text-muted-foreground pt-10">
                        <p>لا توجد مباريات متاحة للتوقع حاليًا.</p>
                        <p className="text-xs">سيقوم المدير بإضافتها قريبًا.</p>
                    </div>
                )}
           </TabsContent>
           <TabsContent value="leaderboard" className="mt-4">
               <Card>
                  <CardHeader className="flex-row items-center justify-between">
                       <CardTitle>لوحة الصدارة</CardTitle>
                       <Button onClick={handleCalculatePoints} disabled={calculatingPoints} size="sm">
                           {calculatingPoints ? <Loader2 className="h-4 w-4 animate-spin"/> : "احتساب النقاط"}
                       </Button>
                  </CardHeader>
                  <CardContent className="p-0">
                       <LeaderboardDisplay leaderboard={leaderboard} loadingLeaderboard={loadingLeaderboard} userScore={currentUserScore} userId={user?.uid}/>
                  </CardContent>
               </Card>
           </TabsContent>
        </Tabs>
    );
};


export function KhaltakScreen({ navigate, goBack, canGoBack }: ScreenProps) {
  const { user } = useAuth();
  const { isAdmin, db } = useAdmin();
  const [favorites, setFavorites] = useState<Partial<Favorites>>({});
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [mainTab, setMainTab] = useState<'predictions' | 'kurratna'>('kurratna');

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
  
  useEffect(() => {
    if(crownedTeams.length > 0 && !selectedTeamId) {
      setSelectedTeamId(crownedTeams[0].teamId);
    }
    if (crownedTeams.length === 0) {
      setSelectedTeamId(null);
    }
  }, [crownedTeams, selectedTeamId]);


  const handleRemoveCrowned = (teamId: number) => {
    if (!user || !db) return;
    const favRef = doc(db, 'users', user.uid, 'favorites', 'data');
    const fieldPath = `crownedTeams.${teamId}`;
    
    updateDoc(favRef, { [fieldPath]: deleteField() })
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
              <Button onClick={() => navigate('Welcome')}>تسجيل الدخول</Button>
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
      <Tabs value={mainTab} onValueChange={(value) => setMainTab(value as any)} className="flex flex-1 flex-col min-h-0">
        <TabsList className="grid w-full grid-cols-2">
           <TabsTrigger value="predictions"><Trophy className="ml-2 h-4 w-4" />التوقعات</TabsTrigger>
           <TabsTrigger value="kurratna"><FootballIcon className="ml-2 h-4 w-4" />كرتنا</TabsTrigger>
        </TabsList>
        
        <TabsContent value="kurratna" className="flex-1 flex flex-col min-h-0 mt-0 data-[state=inactive]:hidden">
          <div className="py-4 border-b">
            <CrownedTeamScroller 
              crownedTeams={crownedTeams} 
              onSelectTeam={handleSelectTeam}
              onRemove={handleRemoveCrowned} 
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

        <TabsContent value="predictions" className="flex-1 flex flex-col min-h-0 mt-0 data-[state=inactive]:hidden p-1">
          <PredictionsTabContent user={user} db={db} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
