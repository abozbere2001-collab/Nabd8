

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
  navigate,
}: {
  crownedTeams: CrownedTeam[];
  onSelectTeam: (teamId: number) => void;
  onRemove: (teamId: number) => void;
  selectedTeamId: number | null;
  navigate: ScreenProps['navigate'];
}) => {
  if (crownedTeams.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-4 px-4">
        <p className="mb-4">
          قم بتتويج فريقك المفضل بالضغط على أيقونة التاج 👑 في صفحة تفاصيل الفريق لتبقى على اطلاع دائم بآخر أخباره ومبارياته هنا.
        </p>
        <Button onClick={() => navigate('AllCompetitions')}>استكشف</Button>
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


const formatDateKey = (date: Date): string => format(date, 'yyyy-MM-dd');

const getDayLabel = (dateKey: string) => {
    const date = new Date(dateKey);
    if (isToday(date)) return 'اليوم';
    if (isYesterday(date)) return 'الأمس';
    if (isTomorrow(date)) return 'غداً';
    return format(date, 'EEEE, d MMM', { locale: ar });
};

const DateScroller = ({ selectedDateKey, onDateSelect }: {selectedDateKey: string, onDateSelect: (dateKey: string) => void}) => {
    const dates = useMemo(() => {
        const today = new Date();
        return Array.from({ length: 30 }, (_, i) => addDays(today, i - 15));
    }, []);
    
    const scrollerRef = useRef<HTMLDivElement>(null);
    const selectedButtonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        const scroller = scrollerRef.current;
        const selectedButton = selectedButtonRef.current;

        if (scroller && selectedButton) {
            const scrollerRect = scroller.getBoundingClientRect();
            const selectedRect = selectedButton.getBoundingClientRect();
            const scrollOffset = selectedRect.left - scrollerRect.left - (scrollerRect.width / 2) + (selectedRect.width / 2);
            scroller.scrollTo({ left: scroller.scrollLeft + scrollOffset, behavior: 'smooth' });
        }
    }, [selectedDateKey]);

    return (
        <div className="relative bg-card py-2 border-x border-b rounded-b-lg shadow-md -mt-1">
             <div ref={scrollerRef} className="flex flex-row-reverse overflow-x-auto pb-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                {dates.map(date => {
                    const dateKey = formatDateKey(date);
                    const isSelected = dateKey === selectedDateKey;
                    return (
                         <button
                            key={dateKey}
                            ref={isSelected ? selectedButtonRef : null}
                            className={cn(
                                "relative flex flex-col items-center justify-center h-auto py-1 px-2 min-w-[40px] rounded-lg transition-colors ml-2",
                                "text-foreground/80 hover:text-primary",
                                isSelected && "text-primary"
                            )}
                            onClick={() => onDateSelect(dateKey)}
                        >
                            <span className="text-[10px] font-normal">{format(date, "EEE", { locale: ar })}</span>
                            <span className="font-semibold text-sm">{format(date, 'd')}</span>
                            {isSelected && <span className="absolute bottom-0 h-0.5 w-3 rounded-full bg-primary" />}
                        </button>
                    )
                })}
            </div>
             <Button 
                variant="ghost" 
                size="icon" 
                className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => onDateSelect(formatDateKey(new Date()))}
                disabled={isToday(new Date(selectedDateKey))}
             >
                <CalendarDays className="h-4 w-4"/>
             </Button>
        </div>
    );
}



const PredictionsTabContent = ({ user, db }: { user: any, db: any }) => {
    const { isAdmin } = useAdmin();
    const [mainTab, setMainTab] = useState('voting');
    const [calculatingPoints, setCalculatingPoints] = useState(false);
    const { toast } = useToast();
    
    const [leaderboard, setLeaderboard] = useState<UserScore[]>([]);
    const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
    const [currentUserScore, setCurrentUserScore] = useState<UserScore | null>(null);

    const [pinnedMatches, setPinnedMatches] = useState<PredictionMatch[]>([]);
    const [loadingMatches, setLoadingMatches] = useState(true);

    const [userPredictions, setUserPredictions] = useState<{ [key: number]: Prediction }>({});
    const [selectedDateKey, setSelectedDateKey] = useState<string>(formatDateKey(new Date()));

    const fetchLeaderboard = useCallback(async () => {
        if (!db) return;
        setLoadingLeaderboard(true);
        const leaderboardRef = collection(db, 'leaderboard');
        
        try {
            const q = query(leaderboardRef, orderBy('totalPoints', 'desc'), limit(100));
            const top100Snapshot = await getDocs(q);
            let rank = 1;
            const top100Scores = top100Snapshot.docs.map(doc => ({ userId: doc.id, ...(doc.data() as Omit<UserScore, 'userId'>), rank: rank++ }));
            setLeaderboard(top100Scores);
            
            if (user) {
                const userScoreRef = doc(db, 'leaderboard', user.uid);
                const userScoreSnap = await getDoc(userScoreRef);
                if (userScoreSnap.exists()) {
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
    
    useEffect(() => {
        if (!db) return;
        setLoadingMatches(true);
        const unsub = onSnapshot(collection(db, 'predictions'), snapshot => {
            const matches = snapshot.docs.map(doc => doc.data() as PredictionMatch).filter(m => m && m.fixtureData && m.fixtureData.fixture);
            setPinnedMatches(matches);
            setLoadingMatches(false);
        }, error => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({path: 'predictions', operation: 'list'}));
            setLoadingMatches(false);
        });
        return () => unsub();
    }, [db]);


    useEffect(() => {
        if (!user || !db || pinnedMatches.length === 0) return;
        
        const fixtureIds = pinnedMatches.map(m => m.fixtureData.fixture.id);
        if (fixtureIds.length === 0) return;
        
        const userPredsRef = collection(db, 'users', user.uid, 'predictions');
        const q = query(userPredsRef, where('fixtureId', 'in', fixtureIds));
        
        const unsub = onSnapshot(q, snapshot => {
            const predictions: { [key: number]: Prediction } = {};
            snapshot.forEach(doc => {
                const pred = doc.data() as Prediction;
                predictions[pred.fixtureId] = pred;
            });
            setUserPredictions(predictions);
        }, err => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({path: `users/${user.uid}/predictions`, operation: 'list'}));
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

     const handleCalculateAllPoints = useCallback(async () => {
        if (!db) return;
        setCalculatingPoints(true);
        toast({ title: 'بدء تحديث لوحة الصدارة', description: 'سيتم تحديث نقاط جميع المستخدمين. قد تستغرق هذه العملية بعض الوقت.' });

        try {
            const usersSnapshot = await getDocs(collection(db, 'users'));
            if (usersSnapshot.empty) {
                toast({ title: 'لا يوجد مستخدمون', description: 'لا يوجد مستخدمون لحساب نقاطهم.' });
                setCalculatingPoints(false);
                return;
            }

            const batch = writeBatch(db);
            const allUsers = usersSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

            // Fetch all finished fixtures that have been predicted on, to avoid repeated API calls.
            const allPredictionsSnapshot = await getDocs(query(collection(db, 'predictions')));
            const finishedFixtureIds = allPredictionsSnapshot.docs
                .map(doc => doc.data().fixtureData as Fixture)
                .filter(f => ['FT', 'AET', 'PEN'].includes(f.fixture.status.short))
                .map(f => f.fixture.id);
            
            const fixtureResults = new Map<number, Fixture>();
            for (const id of finishedFixtureIds) {
                 const fixturesRes = await fetch(`/api/football/fixtures?id=${id}`);
                 const fixturesData = await fixturesRes.json();
                 const fixture = fixturesData.response?.[0];
                 if(fixture) fixtureResults.set(id, fixture);
            }

            for (const u of allUsers) {
                const userPredictionsRef = collection(db, 'users', u.id, 'predictions');
                const userPredictionsSnap = await getDocs(userPredictionsRef);

                let totalPoints = 0;
                if (!userPredictionsSnap.empty) {
                    for (const predDoc of userPredictionsSnap.docs) {
                        const prediction = predDoc.data() as Prediction;
                        const fixture = fixtureResults.get(prediction.fixtureId);

                        if (fixture) {
                            const points = calculatePoints(prediction, fixture);
                            if (prediction.points !== points) {
                                batch.update(predDoc.ref, { points });
                            }
                            totalPoints += points;
                        } else if (prediction.points) { // If fixture is not finished, keep existing points
                            totalPoints += prediction.points;
                        }
                    }
                }

                const leaderboardRef = doc(db, 'leaderboard', u.id);
                batch.set(leaderboardRef, {
                    totalPoints: totalPoints,
                    userName: u.displayName || 'مستخدم غير معروف',
                    userPhoto: u.photoURL || '',
                }, { merge: true });
            }

            await batch.commit();
            toast({ title: 'اكتمل التحديث الشامل', description: 'تم تحديث لوحة الصدارة بنجاح.' });
            fetchLeaderboard();

        } catch (error: any) {
            console.error("Error calculating all points:", error);
            // This is a complex operation, a generic error is acceptable here.
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل تحديث لوحة الصدارة.' });
        } finally {
            setCalculatingPoints(false);
        }
    }, [db, toast, fetchLeaderboard]);


    const filteredMatches = useMemo(() => {
        return pinnedMatches.filter(match => {
            const matchDateKey = format(new Date(match.fixtureData.fixture.timestamp * 1000), 'yyyy-MM-dd');
            return matchDateKey === selectedDateKey;
        }).sort((a,b) => a.fixtureData.fixture.timestamp - b.fixtureData.fixture.timestamp);
    }, [pinnedMatches, selectedDateKey]);

    return (
        <Tabs value={mainTab} onValueChange={setMainTab} className="w-full flex-1 flex flex-col min-h-0">
           <TabsList className="grid w-full grid-cols-2">
               <TabsTrigger value="leaderboard"><BarChart className="ml-2 h-4 w-4" />الترتيب</TabsTrigger>
               <TabsTrigger value="voting"><ThumbsUp className="ml-2 h-4 w-4" />تصويت</TabsTrigger>
           </TabsList>
           
           <TabsContent value="voting" className="flex-1 flex flex-col mt-0 data-[state=inactive]:hidden min-h-0">
                <DateScroller selectedDateKey={selectedDateKey} onDateSelect={setSelectedDateKey} />
                <div className="flex-1 overflow-y-auto p-1 space-y-4 pt-4">
                    {loadingMatches ? (
                         <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                    ) : filteredMatches.length > 0 ? (
                        filteredMatches.map(match => (
                            <PredictionCard 
                                key={match.fixtureData.fixture.id}
                                predictionMatch={match}
                                userPrediction={userPredictions[match.fixtureData.fixture.id]}
                                onSave={handleSavePrediction}
                            />
                        ))
                    ) : (
                        <div className="text-center text-muted-foreground pt-10">
                            <p>لا توجد مباريات للتوقع في هذا اليوم.</p>
                            <p className="text-xs">سيقوم المدير بإضافتها قريبًا.</p>
                        </div>
                    )}
                </div>
           </TabsContent>

           <TabsContent value="leaderboard" className="mt-4 flex-1 overflow-y-auto">
               <Card>
                  <CardHeader className="flex-row items-center justify-between">
                       <CardTitle>لوحة الصدارة</CardTitle>
                       {isAdmin && (
                           <Button onClick={handleCalculateAllPoints} disabled={calculatingPoints} size="sm">
                               {calculatingPoints ? <Loader2 className="h-4 w-4 animate-spin"/> : "تحديث لوحة الصدارة"}
                           </Button>
                       )}
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
  const [mainTab, setMainTab] = useState<'predictions' | 'myTeams'>('myTeams');

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
          <ScreenHeader title="ملعبي" onBack={goBack} canGoBack={canGoBack} />
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
        title="ملعبي"
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
           <TabsTrigger value="myTeams"><FootballIcon className="ml-2 h-4 w-4" />فرقي</TabsTrigger>
        </TabsList>
        
        <TabsContent value="myTeams" className="flex-1 flex flex-col min-h-0 mt-0 data-[state=inactive]:hidden">
          <div className="py-4 border-b">
            <CrownedTeamScroller 
              crownedTeams={crownedTeams} 
              onSelectTeam={handleSelectTeam}
              onRemove={handleRemoveCrowned} 
              selectedTeamId={selectedTeamId}
              navigate={navigate}
            />
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {selectedTeamId ? (
              <TeamFixturesDisplay teamId={selectedTeamId} navigate={navigate} />
            ) : (
              crownedTeams.length > 0 && (
                 <div className="flex items-center justify-center h-full text-muted-foreground text-center p-4">
                  <p>اختر فريقًا من الأعلى لعرض مبارياته.</p>
                </div>
              )
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






