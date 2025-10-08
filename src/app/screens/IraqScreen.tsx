

"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ScreenProps } from '@/app/page';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from '@/lib/utils';
import { format, isPast } from 'date-fns';
import { ar } from 'date-fns/locale';
import { collection, getDocs, doc, setDoc, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { useFirestore, useAdmin, useAuth } from '@/firebase/provider';
import type { Fixture, Standing, TopScorer as ApiTopScorer, AdminFavorite, Prediction, UserScore, ManualTopScorer } from '@/lib/types';
import { CommentsButton } from '@/components/CommentsButton';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Users, Search } from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';
import { SearchSheet } from '@/components/SearchSheet';
import { ProfileButton } from '../AppContentWrapper';


const IRAQI_LEAGUE_ID = 542;
const CURRENT_SEASON = 2025;


const FixtureItem = React.memo(({ fixture, navigate }: { fixture: Fixture, navigate: ScreenProps['navigate'] }) => {
    return (
      <div 
        key={fixture.fixture.id} 
        className="rounded-lg bg-card border p-3 text-sm transition-all duration-300"
      >
        <div 
          className="hover:bg-accent/50 cursor-pointer -m-3 p-3"
          onClick={() => navigate('MatchDetails', { fixtureId: fixture.fixture.id, fixture })}
        >
         <div className="flex justify-between items-center text-xs text-muted-foreground mb-2">
              <div className="flex items-center gap-2">
                  <Avatar className="h-4 w-4">
                      <AvatarImage src={fixture.league.logo} alt={fixture.league.name} />
                      <AvatarFallback>{fixture.league.name.substring(0,1)}</AvatarFallback>
                  </Avatar>
                  <span className="truncate">{fixture.league.name}</span>
              </div>
         </div>
         <div className="flex items-center justify-between gap-2">
             <div className="flex items-center gap-2 flex-1 justify-end truncate">
                 <span className="font-semibold truncate">{fixture.teams.home.name}</span>
                 <Avatar className="h-8 w-8">
                     <AvatarImage src={fixture.teams.home.logo} alt={fixture.teams.home.name} />
                     <AvatarFallback>{fixture.teams.home.name.substring(0, 2)}</AvatarFallback>
                 </Avatar>
             </div>
             <div className={cn(
                "font-bold text-lg px-2 rounded-md min-w-[80px] text-center",
                 ['NS', 'TBD', 'PST', 'CANC'].includes(fixture.fixture.status.short) ? "bg-muted" : "bg-card"
                )}>
                 {['FT', 'AET', 'PEN', 'LIVE', 'HT', '1H', '2H'].includes(fixture.fixture.status.short) || (fixture.goals.home !== null)
                   ? `${fixture.goals.home ?? 0} - ${fixture.goals.away ?? 0}`
                   : format(new Date(fixture.fixture.date), "HH:mm")}
             </div>
             <div className="flex items-center gap-2 flex-1 truncate">
                  <Avatar className="h-8 w-8">
                     <AvatarImage src={fixture.teams.away.logo} alt={fixture.teams.away.name} />
                     <AvatarFallback>{fixture.teams.away.name.substring(0, 2)}</AvatarFallback>
                  </Avatar>
                 <span className="font-semibold truncate">{fixture.teams.away.name}</span>
             </div>
         </div>
         </div>
         <div className="mt-2 pt-2 border-t border-border/50">
            <CommentsButton matchId={fixture.fixture.id} navigate={navigate} />
         </div>
      </div>
    );
});
FixtureItem.displayName = 'FixtureItem';


function OurLeagueTab({ navigate }: { navigate: ScreenProps['navigate'] }) {
    const [loading, setLoading] = useState(true);
    const [fixtures, setFixtures] = useState<Fixture[]>([]);
    const [standings, setStandings] = useState<Standing[]>([]);
    const [topScorers, setTopScorers] = useState<ManualTopScorer[]>([]);
    const { isAdmin } = useAdmin();
    const { db } = useFirestore();

    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            try {
                const [fixturesRes, standingsRes] = await Promise.all([
                    fetch(`/api/football/fixtures?league=${IRAQI_LEAGUE_ID}&season=${CURRENT_SEASON}`),
                    fetch(`/api/football/standings?league=${IRAQI_LEAGUE_ID}&season=${CURRENT_SEASON}`),
                ]);

                const fixturesData = await fixturesRes.json();
                const standingsData = await standingsRes.json();
                
                if (fixturesData.response) setFixtures(fixturesData.response);
                if (standingsData.response[0]?.league?.standings[0]) setStandings(standingsData.response[0].league.standings[0]);

            } catch (error) {
                console.error("Failed to fetch Iraqi league details:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchData();

        if (db) {
            const scorersRef = collection(db, 'iraqiLeagueTopScorers');
            const q = query(scorersRef, orderBy('rank', 'asc'));
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const fetchedScorers = snapshot.docs.map(doc => doc.data() as ManualTopScorer);
                setTopScorers(fetchedScorers);
            }, (error) => {
                const permissionError = new FirestorePermissionError({ path: 'iraqiLeagueTopScorers', operation: 'list' });
                errorEmitter.emit('permission-error', permissionError);
            });
             return () => unsubscribe();
        }
    }, [db]);

    return (
        <Tabs defaultValue="matches" className="w-full">
            <div className="sticky top-0 bg-background z-10 border-b -mx-4 px-4">
                <TabsList className="grid w-full grid-cols-3 rounded-none h-auto p-0 border-t flex-row-reverse">
                    <TabsTrigger value="scorers" className='rounded-none data-[state=active]:rounded-md'>الهدافين</TabsTrigger>
                    <TabsTrigger value="standings" className='rounded-none data-[state=active]:rounded-md'>الترتيب</TabsTrigger>
                    <TabsTrigger value="matches" className='rounded-none data-[state=active]:rounded-md'>المباريات</TabsTrigger>
                </TabsList>
            </div>
            <TabsContent value="matches" className="p-4 mt-0 -mx-4">
             {loading ? (
                <div className="space-y-4">
                    {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
                </div>
            ) : fixtures.length > 0 ? (
                <div className="space-y-3">
                    {fixtures.map((fixture) => (
                        <FixtureItem key={fixture.fixture.id} fixture={fixture} navigate={navigate} />
                    ))}
                </div>
            ) : <p className="pt-4 text-center text-muted-foreground">لا توجد مباريات متاحة لهذا الموسم.</p>}
          </TabsContent>
          <TabsContent value="standings" className="p-0 mt-0 -mx-4">
            {loading ? (
                 <div className="space-y-px p-4">
                    {Array.from({ length: 18 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
            ) : standings.length > 0 ? (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-1/2 text-right">الفريق</TableHead>
                            <TableHead className="text-center">لعب</TableHead>
                            <TableHead className="text-center">ف</TableHead>
                            <TableHead className="text-center">ت</TableHead>
                            <TableHead className="text-center">خ</TableHead>
                            <TableHead className="text-center">نقاط</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {standings.map((s) => (
                            <TableRow key={`${s.rank}-${s.team.id}`} className="cursor-pointer" onClick={() => navigate('TeamDetails', { teamId: s.team.id })}>
                                <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                        <span>{s.rank}</span>
                                        <Avatar className="h-6 w-6">
                                            <AvatarImage src={s.team.logo} alt={s.team.name} />
                                            <AvatarFallback>{s.team.name.substring(0,1)}</AvatarFallback>
                                        </Avatar>
                                        <span className="truncate">{s.team.name}</span>
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
            ): <p className="pt-4 text-center text-muted-foreground">جدول الترتيب غير متاح حاليًا.</p>}
          </TabsContent>
           <TabsContent value="scorers" className="p-0 mt-0 -mx-4">
            {isAdmin && (
                <div className="p-4">
                    <Button className="w-full" onClick={() => navigate('ManageTopScorers')}>
                        <Users className="ml-2 h-4 w-4" />
                        إدارة الهدافين
                    </Button>
                </div>
            )}
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
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {topScorers.map((scorer) => (
                            <TableRow key={scorer.rank}>
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={scorer.playerPhoto} />
                                            <AvatarFallback>{scorer.playerName.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <p className="font-semibold">{scorer.playerName}</p>
                                    </div>
                                </TableCell>
                                <TableCell>
                                     <p className="text-xs text-muted-foreground text-right">{scorer.teamName}</p>
                                </TableCell>
                                <TableCell className="text-center font-bold text-lg">{scorer.goals}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            ) : <p className="pt-4 text-center text-muted-foreground">قائمة الهدافين غير متاحة حاليًا.</p>}
          </TabsContent>
        </Tabs>
    );
}

function OurBallTab({ navigate }: { navigate: ScreenProps['navigate'] }) {
    const [teams, setTeams] = useState<AdminFavorite[]>([]);
    const [loading, setLoading] = useState(true);
    const { db } = useFirestore();

    useEffect(() => {
        if (!db) return;
        const fetchAdminFavorites = async () => {
            setLoading(true);
            const favsRef = collection(db, 'adminFavorites');
            try {
                const snapshot = await getDocs(favsRef);
                const fetchedTeams: AdminFavorite[] = [];
                snapshot.forEach((doc) => {
                    fetchedTeams.push(doc.data() as AdminFavorite);
                });
                setTeams(fetchedTeams);
            } catch (error) {
                const permissionError = new FirestorePermissionError({ path: favsRef.path, operation: 'list' });
                errorEmitter.emit('permission-error', permissionError);
            } finally {
                setLoading(false);
            }
        };
        fetchAdminFavorites();
    }, [db]);

    if (loading) {
        return (
             <div className="space-y-4 pt-4">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
        )
    }

    if (teams.length === 0) {
        return <p className="pt-4 text-center text-muted-foreground">لم يتم إضافة فرق خاصة من قبل المدير بعد.</p>
    }

    return (
        <div className="space-y-3 pt-4">
            {teams.map(team => (
                <div key={team.teamId} onClick={() => navigate('AdminFavoriteTeamDetails', { teamId: team.teamId, teamName: team.name })} className="p-3 rounded-lg border bg-card cursor-pointer">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                            <AvatarImage src={team.logo} alt={team.name} />
                            <AvatarFallback>{team.name.substring(0, 2)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="font-bold">{team.name}</p>
                            <p className="text-xs text-muted-foreground">{team.note}</p>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

const PredictionCard = ({ fixture, userPrediction, onSave }: { fixture: Fixture, userPrediction?: Prediction, onSave: (home: string, away: string) => void }) => {
    const isPredictionDisabled = isPast(new Date(fixture.fixture.date));
    const [homeValue, setHomeValue] = useState(userPrediction?.homeGoals?.toString() ?? '');
    const [awayValue, setAwayValue] = useState(userPrediction?.awayGoals?.toString() ?? '');
    
    const debouncedHome = useDebounce(homeValue, 500);
    const debouncedAway = useDebounce(awayValue, 500);

    const isMatchLiveOrFinished = ['FT', 'AET', 'PEN', 'LIVE', 'HT', '1H', '2H'].includes(fixture.fixture.status.short);
    const isMatchFinished = ['FT', 'AET', 'PEN'].includes(fixture.fixture.status.short);

    const getPredictionStatusColors = () => {
        if (!isMatchLiveOrFinished || !userPrediction) {
            return "bg-card text-foreground";
        }

        const actualHome = fixture.goals.home;
        const actualAway = fixture.goals.away;
        const predHome = userPrediction.homeGoals;
        const predAway = userPrediction.awayGoals;
        
        if (actualHome === null || actualAway === null) return "bg-card text-foreground";

        // Exact score prediction
        if (actualHome === predHome && actualAway === predAway) {
            return "bg-green-500/20 text-green-500";
        }

        // Correct outcome (winner or draw)
        const actualWinner = actualHome > actualAway ? 'home' : actualHome < actualAway ? 'away' : 'draw';
        const predWinner = predHome > predAway ? 'home' : predHome < predAway ? 'away' : 'draw';
        
        if (actualWinner === predWinner) {
            return "bg-yellow-500/20 text-yellow-500";
        }

        // Incorrect prediction
        return "bg-destructive/20 text-destructive";
    };

    const getPointsColor = () => {
        if (!isMatchFinished || userPrediction?.points === undefined) return 'text-primary';
        if (userPrediction.points === 5) return 'text-green-500';
        if (userPrediction.points === 3) return 'text-yellow-500';
        return 'text-destructive';
    };
    
    useEffect(() => {
        if (debouncedHome !== '' && debouncedAway !== '' && (debouncedHome !== userPrediction?.homeGoals?.toString() || debouncedAway !== userPrediction?.awayGoals?.toString())) {
            onSave(debouncedHome, debouncedAway);
        }
    }, [debouncedHome, debouncedAway, onSave, userPrediction]);

    const handleHomeChange = (e: React.ChangeEvent<HTMLInputElement>) => setHomeValue(e.target.value);
    const handleAwayChange = (e: React.ChangeEvent<HTMLInputElement>) => setAwayValue(e.target.value);
    
    useEffect(() => {
        setHomeValue(userPrediction?.homeGoals?.toString() ?? '');
        setAwayValue(userPrediction?.awayGoals?.toString() ?? '');
    }, [userPrediction]);

    return (
        <Card>
            <CardContent className="p-3">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 justify-end truncate">
                        <span className="font-semibold truncate">{fixture.teams.home.name}</span>
                        <Avatar className="h-8 w-8"><AvatarImage src={fixture.teams.home.logo} /></Avatar>
                    </div>
                    <div className="flex items-center gap-1">
                        <Input type="number" className="w-12 h-10 text-center text-lg font-bold" min="0" value={homeValue} onChange={handleHomeChange} id={`home-${fixture.fixture.id}`} disabled={isPredictionDisabled} />
                        <div className={cn(
                            "font-bold text-lg px-2 rounded-md min-w-[70px] text-center transition-colors",
                             isMatchLiveOrFinished ? getPredictionStatusColors() : "text-sm",
                            )}>
                             {isMatchLiveOrFinished
                               ? `${fixture.goals.home ?? 0} - ${fixture.goals.away ?? 0}`
                               : format(new Date(fixture.fixture.date), "HH:mm")}
                         </div>
                        <Input type="number" className="w-12 h-10 text-center text-lg font-bold" min="0" value={awayValue} onChange={handleAwayChange} id={`away-${fixture.fixture.id}`} disabled={isPredictionDisabled} />
                    </div>
                    <div className="flex items-center gap-2 flex-1 truncate">
                        <Avatar className="h-8 w-8"><AvatarImage src={fixture.teams.away.logo} /></Avatar>
                        <span className="font-semibold truncate">{fixture.teams.away.name}</span>
                    </div>
                </div>
                 <div className="text-center text-xs text-muted-foreground mt-2">
                    {format(new Date(fixture.fixture.date), "EEE, d MMM", { locale: ar })}
                </div>
                {isMatchFinished && userPrediction?.points !== undefined && (
                     <p className={cn("text-center font-bold text-sm mt-2", getPointsColor())}>
                        +{userPrediction.points} نقاط
                    </p>
                )}
                {!isMatchFinished && userPrediction && <p className="text-center text-green-600 text-xs mt-2">تم حفظ توقعك</p>}
                {isPredictionDisabled && !userPrediction && !isMatchFinished && <p className="text-center text-red-600 text-xs mt-2">أغلق باب التوقع</p>}
            </CardContent>
        </Card>
    );
};


function PredictionsTab({ navigate }: { navigate: ScreenProps['navigate'] }) {
    const [fixtures, setFixtures] = useState<Fixture[]>([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();
    const { db } = useFirestore();
    const [predictions, setPredictions] = useState<{ [key: number]: Prediction }>({});
    const [leaderboard, setLeaderboard] = useState<UserScore[]>([]);
    
    const fetchFixtures = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/football/fixtures?league=${IRAQI_LEAGUE_ID}&season=${CURRENT_SEASON}`);
            const data = await res.json();
            if (data.response) {
                setFixtures(data.response);
            }
        } catch (error) {
             console.error("Failed to fetch fixtures for predictions:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchFixtures();
    }, [fetchFixtures]);

    useEffect(() => {
        if (!db) return;

        let unsubPreds = () => {};
        if (user) {
            const predsRef = collection(db, 'predictions');
            const q = query(predsRef, where('userId', '==', user.uid));
            unsubPreds = onSnapshot(q, (snapshot) => {
                const userPredictions: { [key: number]: Prediction } = {};
                snapshot.forEach(doc => {
                    const pred = doc.data() as Prediction;
                    userPredictions[pred.fixtureId] = pred;
                });
                setPredictions(userPredictions);
            }, (error) => {
                const permissionError = new FirestorePermissionError({ path: `predictions where userId == ${user.uid}`, operation: 'list' });
                errorEmitter.emit('permission-error', permissionError);
            });
        }
        
        const leaderboardRef = query(collection(db, 'leaderboard'), orderBy('totalPoints', 'desc'));
        const unsubLeaderboard = onSnapshot(leaderboardRef, (snapshot) => {
           const scores: UserScore[] = [];
           snapshot.forEach(doc => scores.push(doc.data() as UserScore));
           setLeaderboard(scores);
        }, (error) => {
           const permissionError = new FirestorePermissionError({ path: 'leaderboard', operation: 'list' });
           errorEmitter.emit('permission-error', permissionError);
        });

        return () => {
            unsubPreds();
            unsubLeaderboard();
        };
    }, [user, db]);

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
        setDoc(predictionRef, predictionData, { merge: true }).catch(serverError => {
            const permissionError = new FirestorePermissionError({
              path: predictionRef.path,
              operation: 'create',
              requestResourceData: predictionData
            });
            errorEmitter.emit('permission-error', permissionError);
        });
    }, [user, db]);
    
    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    const upcomingFixtures = fixtures.filter(f => f.fixture.status.short === 'NS' || f.fixture.status.short === 'TBD');
    
    return (
        <div className="space-y-4 pt-4">
             <h3 className="text-lg font-bold">لوحة الصدارة</h3>
              <Card>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>الترتيب</TableHead>
                            <TableHead>المستخدم</TableHead>
                            <TableHead className="text-center">النقاط</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {leaderboard.length > 0 ? leaderboard.map((score, index) => (
                            <TableRow key={`${score.userId}-${index}`}>
                                <TableCell>{index + 1}</TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <Avatar className="h-6 w-6">
                                            <AvatarImage src={score.userPhoto}/>
                                            <AvatarFallback>{score.userName.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        {score.userName}
                                    </div>
                                </TableCell>
                                <TableCell className="text-center font-bold">{score.totalPoints}</TableCell>
                            </TableRow>
                        )) : (
                             <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">لا توجد بيانات بعد.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
              </Card>

            <h3 className="text-lg font-bold mt-6">المباريات القادمة</h3>
            {upcomingFixtures.length > 0 ? upcomingFixtures.map(fixture => (
                <PredictionCard 
                    key={fixture.fixture.id}
                    fixture={fixture}
                    userPrediction={predictions[fixture.fixture.id]}
                    onSave={(home, away) => handleSavePrediction(fixture.fixture.id, home, away)}
                />
            )) : <p className="text-center text-muted-foreground pt-4">لا توجد مباريات قادمة للتوقع.</p>}
        </div>
    );
}

export function IraqScreen({ navigate, goBack, canGoBack, ...props }: ScreenProps) {
  
  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader 
        title="العراق" 
        onBack={goBack} 
        canGoBack={canGoBack} 
        actions={
          <div className="flex items-center gap-1">
              <SearchSheet navigate={navigate}>
                  <Button variant="ghost" size="icon">
                      <Search className="h-5 w-5" />
                  </Button>
              </SearchSheet>
              <ProfileButton onProfileClick={() => navigate('Profile')} />
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto px-4">
        <Tabs defaultValue="our-league" className="w-full">
          <div className="sticky top-0 bg-background z-10">
            <TabsList className="grid w-full grid-cols-3 flex-row-reverse">
              <TabsTrigger value="our-ball">كرتنا</TabsTrigger>
              <TabsTrigger value="predictions">التوقعات</TabsTrigger>
              <TabsTrigger value="our-league">دورينا</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="our-league" className="pt-0">
            <OurLeagueTab navigate={navigate} />
          </TabsContent>
          <TabsContent value="our-ball" className="pt-0">
             <OurBallTab navigate={navigate} />
          </TabsContent>
          <TabsContent value="predictions" className="pt-0">
            <PredictionsTab navigate={navigate} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
