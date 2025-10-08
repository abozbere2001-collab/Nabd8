
"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { ScreenProps } from '@/app/page';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';
import { format, isPast, subDays, addDays, isToday, isYesterday, isTomorrow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useAuth, useFirestore, useAdmin } from '@/firebase/provider';
import type { Fixture, UserScore, Prediction, DailyGlobalPredictions, UserProfile, Team, TopScorer, SeasonPrediction } from '@/lib/types';
import { collection, query, orderBy, onSnapshot, doc, getDoc, setDoc, where, getDocs, limit, startAfter, type DocumentData, type QueryDocumentSnapshot, writeBatch } from 'firebase/firestore';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { useDebounce } from '@/hooks/use-debounce';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


const formatDateKey = (date: Date): string => format(date, 'yyyy-MM-dd');

const getDayLabel = (date: Date) => {
    if (isToday(date)) return "اليوم";
    if (isYesterday(date)) return "الأمس";
    if (isTomorrow(date)) return "غداً";
    return format(date, "EEE", { locale: ar });
};

const DateScroller = ({ selectedDateKey, onDateSelect }: {selectedDateKey: string, onDateSelect: (dateKey: string) => void}) => {
    const dates = React.useMemo(() => {
        const today = new Date();
        const days = [];
        for (let i = -365; i <= 365; i++) {
            days.push(addDays(today, i));
        }
        return days;
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
        <div ref={scrollerRef} className="flex flex-row-reverse overflow-x-auto pb-2 px-4" style={{ scrollbarWidth: 'none' }}>
            {dates.map(date => {
                const dateKey = formatDateKey(date);
                const isSelected = dateKey === selectedDateKey;
                return (
                     <button
                        key={dateKey}
                        ref={isSelected ? selectedButtonRef : null}
                        className={cn(
                            "relative flex flex-col items-center justify-center h-auto py-1 px-2.5 min-w-[48px] rounded-lg transition-colors ml-2",
                            isSelected ? "text-primary bg-primary/10" : "text-foreground/80 hover:text-primary"
                        )}
                        onClick={() => onDateSelect(dateKey)}
                    >
                        <span className="text-xs font-normal">{getDayLabel(date)}</span>
                        <span className="font-bold text-sm">{format(date, 'd')}</span>
                    </button>
                )
            })}
        </div>
    );
}

const AdminMatchSelector = ({ navigate }: { navigate: ScreenProps['navigate'] }) => {
    return (
        <Card>
            <CardContent className="p-4">
                <div className="flex justify-between items-center">
                    <div>
                        <h3 className="font-bold text-lg mb-2">لوحة تحكم المدير</h3>
                        <p className="text-sm text-muted-foreground">
                            اختر مباريات اليوم المتاحة للمستخدمين للتوقع.
                        </p>
                    </div>
                    <Button onClick={() => navigate('AdminMatchSelection')}>إدارة المباريات</Button>
                </div>
            </CardContent>
        </Card>
    )
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
        if (userPrediction.points === 5) return 'text-green-500'; // Correct score
        if (userPrediction.points === 3) return 'text-yellow-500'; // Correct winner
        return 'text-destructive'; // Wrong prediction
    };

    useEffect(() => {
        // Only save if the fields are not empty and a change was made
        if (debouncedHome !== '' && debouncedAway !== '' && (debouncedHome !== userPrediction?.homeGoals?.toString() || debouncedAway !== userPrediction?.awayGoals?.toString())) {
            onSave(debouncedHome, debouncedAway);
        }
    }, [debouncedHome, debouncedAway, onSave, userPrediction]);

    const handleHomeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setHomeValue(e.target.value);
    }

    const handleAwayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setAwayValue(e.target.value);
    }
    
    useEffect(() => {
        setHomeValue(userPrediction?.homeGoals?.toString() ?? '');
        setAwayValue(userPrediction?.awayGoals?.toString() ?? '');
    },[userPrediction]);

    return (
        <Card>
            <CardContent className="p-3">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 justify-end truncate">
                        <span className="font-semibold truncate">{fixture.teams.home.name}</span>
                        <Avatar className="h-8 w-8">
                            <AvatarImage src={fixture.teams.home.logo} />
                        </Avatar>
                    </div>
                    <div className="flex items-center gap-1">
                        <Input 
                            type="number" 
                            className="w-12 h-10 text-center text-lg font-bold" 
                            min="0" 
                            value={homeValue}
                            onChange={handleHomeChange}
                            id={`home-${fixture.fixture.id}`}
                            disabled={isPredictionDisabled}
                        />
                         <div className={cn(
                            "font-bold text-lg px-2 rounded-md min-w-[70px] text-center transition-colors",
                             isMatchLiveOrFinished ? getPredictionStatusColors() : "text-sm",
                            )}>
                             {isMatchLiveOrFinished
                               ? `${fixture.goals.home ?? 0} - ${fixture.goals.away ?? 0}`
                               : format(new Date(fixture.fixture.date), "HH:mm")}
                         </div>
                        <Input 
                            type="number" 
                            className="w-12 h-10 text-center text-lg font-bold" 
                            min="0"
                            value={awayValue}
                            onChange={handleAwayChange}
                            id={`away-${fixture.fixture.id}`}
                            disabled={isPredictionDisabled}
                        />
                    </div>
                    <div className="flex items-center gap-2 flex-1 truncate">
                        <Avatar className="h-8 w-8">
                            <AvatarImage src={fixture.teams.away.logo} />
                        </Avatar>
                        <span className="font-semibold truncate">{fixture.teams.away.name}</span>
                    </div>
                </div>
                 <div className="text-center text-xs text-muted-foreground mt-2">
                    <span>{fixture.league.name}</span> - <span>{format(new Date(fixture.fixture.date), "EEE, d MMM", { locale: ar })}</span>
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

const calculatePoints = (prediction: Prediction, fixture: Fixture): number => {
    if (fixture.goals.home === null || fixture.goals.away === null) return 0;

    const actualHome = fixture.goals.home;
    const actualAway = fixture.goals.away;
    const predHome = prediction.homeGoals;
    const predAway = prediction.awayGoals;

    // Exact score
    if (actualHome === predHome && actualAway === predAway) {
        return 5;
    }

    // Correct outcome (winner or draw)
    const actualWinner = actualHome > actualAway ? 'home' : actualHome < actualAway ? 'away' : 'draw';
    const predWinner = predHome > predAway ? 'home' : predHome < predAway ? 'away' : 'draw';
    
    if (actualWinner === predWinner) {
        return 3;
    }

    return 0;
};

// Season Predictions Components
const PREMIER_LEAGUE_ID = 39;
const LALIGA_ID = 140;
const SERIE_A_ID = 135;
const BUNDESLIGA_ID = 78;
const CURRENT_SEASON = 2025;

const seasonLeagues = [
    { id: PREMIER_LEAGUE_ID, name: "الدوري الإنجليزي الممتاز" },
    { id: LALIGA_ID, name: "الدوري الإسباني" },
    { id: SERIE_A_ID, name: "الدوري الإيطالي" },
    { id: BUNDESLIGA_ID, name: "الدوري الألماني" },
];

interface LeagueData {
    teams: { team: Team }[];
    scorers: TopScorer[];
}

interface AllLeaguesData {
    [leagueId: number]: LeagueData;
}

const LeaguePredictionCard = ({ 
    league, 
    userId, 
    leagueData,
    getCustomTeamName,
    getCustomPlayerName
}: { 
    league: { id: number, name: string }, 
    userId: string, 
    leagueData: LeagueData,
    getCustomTeamName: (id: number, defaultName: string) => string,
    getCustomPlayerName: (id: number, defaultName: string) => string
}) => {
    const { teams, scorers } = leagueData;
    const { db } = useFirestore();
    const { toast } = useToast();
    
    const [championId, setChampionId] = useState<string | undefined>();
    const [scorerId, setScorerId] = useState<string | undefined>();
    const [saving, setSaving] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);


    const predictionDocRef = useMemo(() => {
        if (!db) return null;
        return doc(db, 'seasonPredictions', `${userId}_${league.id}_${CURRENT_SEASON}`);
    }, [db, userId, league.id]);

    useEffect(() => {
        if (!predictionDocRef) return;
        
        setInitialLoading(true);
        getDoc(predictionDocRef).then(docSnap => {
            if (docSnap.exists()) {
                const data = docSnap.data() as SeasonPrediction;
                setChampionId(String(data.predictedChampionId));
                setScorerId(String(data.predictedTopScorerId));
            }
        }).catch(error => {
            const permissionError = new FirestorePermissionError({ path: predictionDocRef.path, operation: 'get' });
            errorEmitter.emit('permission-error', permissionError);
        }).finally(() => {
            setInitialLoading(false);
        });
    }, [predictionDocRef]);

    const handleSave = async () => {
        if (!championId || !scorerId || !predictionDocRef) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'يرجى اختيار البطل والهداف.' });
            return;
        }
        setSaving(true);
        const predictionData: SeasonPrediction = {
            userId,
            leagueId: league.id,
            season: CURRENT_SEASON,
            predictedChampionId: Number(championId),
            predictedTopScorerId: Number(scorerId),
            championPoints: 0,
            topScorerPoints: 0
        };
        
        setDoc(predictionDocRef, predictionData)
            .then(() => {
                toast({ title: 'تم الحفظ', description: `تم حفظ توقعاتك لـ ${league.name}.` });
            })
            .catch(serverError => {
                 const permissionError = new FirestorePermissionError({ path: predictionDocRef.path, operation: 'create', requestResourceData: predictionData });
                 errorEmitter.emit('permission-error', permissionError);
            })
            .finally(() => {
                setSaving(false);
            });
    };
    
    if (initialLoading) {
        return (
            <div className="p-4 border rounded-lg bg-card space-y-4">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
            </div>
        )
    }

    return (
        <div className="p-4 border rounded-lg bg-card">
            <h3 className="font-bold mb-4">{league.name}</h3>
            <div className="space-y-4">
                <div>
                    <label className="text-sm font-medium mb-1 block">توقع البطل</label>
                     <Select value={championId} onValueChange={setChampionId} dir="rtl">
                        <SelectTrigger><SelectValue placeholder="اختر الفريق البطل..." /></SelectTrigger>
                        <SelectContent>
                            {teams.map(({ team }) => (
                                <SelectItem key={team.id} value={String(team.id)}>
                                    {getCustomTeamName(team.id, team.name)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <label className="text-sm font-medium mb-1 block">توقع الهداف</label>
                     <Select value={scorerId} onValueChange={setScorerId} dir="rtl">
                        <SelectTrigger><SelectValue placeholder="اختر الهداف..." /></SelectTrigger>
                        <SelectContent>
                            {scorers.map(({ player }) => (
                                <SelectItem key={player.id} value={String(player.id)}>
                                     {getCustomPlayerName(player.id, player.name)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                 <Button onClick={handleSave} disabled={saving} className="w-full">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'حفظ'}
                </Button>
            </div>
        </div>
    );
};

const SeasonPredictionsTab = () => {
    const { user } = useAuth();
    const { db } = useFirestore();
    const [allLeaguesData, setAllLeaguesData] = useState<AllLeaguesData>({});
    const [loading, setLoading] = useState(true);
    const [customNames, setCustomNames] = useState<{ teams: Map<number, string>, players: Map<number, string> }>({ teams: new Map(), players: new Map() });


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
            const permissionError = new FirestorePermissionError({ path: 'customizations collections', operation: 'list' });
            errorEmitter.emit('permission-error', permissionError);
        }
    }, [db]);


    useEffect(() => {
        const fetchAllData = async () => {
            setLoading(true);
            await fetchAllCustomNames();

            const dataPromises = seasonLeagues.map(async (league) => {
                try {
                    const [teamsRes, scorersRes] = await Promise.all([
                        fetch(`/api/football/teams?league=${league.id}&season=${CURRENT_SEASON}`),
                        fetch(`/api/football/players/topscorers?league=${league.id}&season=${CURRENT_SEASON - 1}`)
                    ]);
                    const teamsData = await teamsRes.json();
                    const scorersData = await scorersRes.json();
                    return {
                        leagueId: league.id,
                        data: {
                            teams: teamsData.response || [],
                            scorers: scorersData.response || []
                        }
                    };
                } catch (error) {
                    console.error(`Failed to fetch data for league ${league.id}`, error);
                    return { leagueId: league.id, data: { teams: [], scorers: [] } };
                }
            });

            const results = await Promise.all(dataPromises);
            const dataByLeague: AllLeaguesData = {};
            results.forEach(result => {
                dataByLeague[result.leagueId] = result.data;
            });
            
            setAllLeaguesData(dataByLeague);
            setLoading(false);
        };

        fetchAllData();
    }, [fetchAllCustomNames]);
    
    const getCustomTeamName = (id: number, defaultName: string) => customNames.teams.get(id) || defaultName;
    const getCustomPlayerName = (id: number, defaultName: string) => customNames.players.get(id) || defaultName;


    return (
        <Card>
            <CardHeader>
                <CardTitle>توقع بطل الموسم وهداف الدوري</CardTitle>
                <CardDescription>
                    سيتم منح 50 نقطة لتوقع البطل الصحيح و 25 نقطة لتوقع الهداف الصحيح في نهاية الموسم لكل دوري.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
            {loading ? <Loader2 className="mx-auto h-8 w-8 animate-spin" /> :
             !user ? <p>الرجاء تسجيل الدخول للمشاركة.</p> :
             seasonLeagues.map(league => (
                <LeaguePredictionCard 
                    key={league.id} 
                    league={league} 
                    userId={user.uid}
                    leagueData={allLeaguesData[league.id] || { teams: [], scorers: [] }}
                    getCustomTeamName={getCustomTeamName}
                    getCustomPlayerName={getCustomPlayerName}
                />
            ))}
            </CardContent>
        </Card>
    );
};

// --- Main Screen ---
export function GlobalPredictionsScreen({ navigate, goBack, canGoBack, headerActions }: ScreenProps) {
    const { isAdmin } = useAdmin();
    const { user } = useAuth();
    const { db } = useFirestore();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [selectedMatches, setSelectedMatches] = useState<Fixture[]>([]);
    
    const [leaderboard, setLeaderboard] = useState<UserScore[]>([]);
    const [loadingLeaderboard, setLoadingLeaderboard] = useState(true);
    const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    const [predictions, setPredictions] = useState<{ [key: number]: Prediction }>({});

    const [calculatingPoints, setCalculatingPoints] = useState(false);
    
    const LEADERBOARD_PAGE_SIZE = 20;

    const [selectedDateKey, setSelectedDateKey] = useState(formatDateKey(new Date()));

    const handleCalculatePoints = async () => {
        if (!db) return;
        setCalculatingPoints(true);
        toast({ title: 'بدء احتساب النقاط', description: 'يتم الآن احتساب نقاط مباريات الأمس...' });

        try {
            const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
            
            const fixturesRes = await fetch(`/api/football/fixtures?date=${yesterday}`);
            const fixturesData = await fixturesRes.json();
            const finishedFixtures: Fixture[] = (fixturesData.response || []).filter((f: Fixture) => ['FT', 'AET', 'PEN'].includes(f.fixture.status.short));

            if (finishedFixtures.length === 0) {
                toast({ title: 'لا توجد مباريات', description: 'لا توجد مباريات منتهية لاحتساب نقاطها.' });
                setCalculatingPoints(false);
                return;
            }

            const fixtureIds = finishedFixtures.map(f => f.fixture.id);
            if (fixtureIds.length === 0) {
                setCalculatingPoints(false);
                return;
            }
            
            const chunkSize = 30;
            const chunks = [];
            for (let i = 0; i < fixtureIds.length; i += chunkSize) {
                chunks.push(fixtureIds.slice(i, i + chunkSize));
            }

            const predictionsRef = collection(db, 'predictions');
            const predictionPromises = chunks.map(chunk => getDocs(query(predictionsRef, where('fixtureId', 'in', chunk))));
            const predictionSnapshots = await Promise.all(predictionPromises);

            const predictionsToUpdate: { ref: DocumentData, points: number, userId: string }[] = [];

            predictionSnapshots.forEach(snapshot => {
                 snapshot.forEach(doc => {
                    const prediction = { ...doc.data() } as Prediction;
                    const fixture = finishedFixtures.find(f => f.fixture.id === prediction.fixtureId);

                    if (fixture) {
                        const points = calculatePoints(prediction, fixture);
                        if (prediction.points !== points) {
                            predictionsToUpdate.push({ ref: doc.ref, points, userId: prediction.userId });
                        }
                    }
                });
            })

            const batch = writeBatch(db);
            predictionsToUpdate.forEach(p => batch.update(p.ref, { points: p.points }));
            
            const allUsersSnapshot = await getDocs(collection(db, 'users'));
            const allUsers = allUsersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as UserProfile }));
            
            const allPredictionsSnapshot = await getDocs(collection(db, 'predictions'));
            const totalUserScores: { [userId: string]: number } = {};

            allPredictionsSnapshot.forEach(predDoc => {
                const pred = predDoc.data() as Prediction;
                if(pred.points && pred.points > 0) {
                    totalUserScores[pred.userId] = (totalUserScores[pred.userId] || 0) + pred.points;
                }
            });
            
            for (const u of allUsers) {
                const leaderboardRef = doc(db, 'leaderboard', u.id);
                const totalPoints = totalUserScores[u.id] || 0;
                
                const existingLeaderboardEntry = await getDoc(leaderboardRef);

                if (existingLeaderboardEntry.exists()) {
                     if (existingLeaderboardEntry.data().totalPoints !== totalPoints) {
                        batch.update(leaderboardRef, { totalPoints: totalPoints });
                     }
                } else {
                     batch.set(leaderboardRef, {
                        userId: u.id,
                        userName: u.displayName,
                        userPhoto: u.photoURL,
                        totalPoints: totalPoints
                    });
                }
            }
            
            await batch.commit();

            toast({ title: 'اكتمل الاحتساب', description: 'تم تحديث جميع النقاط ولوحة الصدارة بنجاح.' });

        } catch (error: any) {
            console.error("Error calculating points:", error);
            const permissionError = new FirestorePermissionError({ 
                path: `predictions or leaderboard`,
                operation: 'update',
            });
            errorEmitter.emit('permission-error', permissionError);
            toast({ variant: 'destructive', title: 'خطأ', description: error.message || 'فشل احتساب النقاط.' });
        } finally {
            setCalculatingPoints(false);
        }
    };


    useEffect(() => {
        if (!db) return;
        setLoadingLeaderboard(true);
        const leaderboardRef = collection(db, 'leaderboard');
        const q = query(leaderboardRef, orderBy('totalPoints', 'desc'), limit(LEADERBOARD_PAGE_SIZE));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const scores = snapshot.docs.map(doc => doc.data() as UserScore);
            const lastDoc = snapshot.docs[snapshot.docs.length - 1];
            setLeaderboard(scores);
            setLastVisible(lastDoc);
            setHasMore(snapshot.docs.length === LEADERBOARD_PAGE_SIZE);
            setLoadingLeaderboard(false);
        }, (error) => {
            const permissionError = new FirestorePermissionError({ path: 'leaderboard', operation: 'list' });
            errorEmitter.emit('permission-error', permissionError);
            setLoadingLeaderboard(false);
        });

        return () => unsubscribe();
    }, [db]);
    
    const fetchMoreLeaderboard = async () => {
        if (!db || !lastVisible || !hasMore || loadingMore) return;
        setLoadingMore(true);
        
        const leaderboardRef = collection(db, 'leaderboard');
        const q = query(leaderboardRef, orderBy('totalPoints', 'desc'), startAfter(lastVisible), limit(LEADERBOARD_PAGE_SIZE));

        try {
            const snapshot = await getDocs(q);
            const newScores = snapshot.docs.map(doc => doc.data() as UserScore);
            const lastDoc = snapshot.docs[snapshot.docs.length - 1];

            setLeaderboard(prev => [...prev, ...newScores]);
            setLastVisible(lastDoc);
            setHasMore(snapshot.docs.length === LEADERBOARD_PAGE_SIZE);
        } catch (error) {
             const permissionError = new FirestorePermissionError({ path: 'leaderboard', operation: 'list' });
             errorEmitter.emit('permission-error', permissionError);
        } finally {
            setLoadingMore(false);
        }
    }


    const fetchDailyMatchesAndPredictions = useCallback(async (dateKey: string) => {
        if (!db || !user) {
            setLoading(false);
            return;
        }
        setLoading(true);
        setSelectedMatches([]);
        setPredictions({});
    
        try {
            // 1. Get fixture IDs for the selected date
            const dailyDocRef = doc(db, 'dailyGlobalPredictions', dateKey);
            const docSnap = await getDoc(dailyDocRef);
            
            let fixtureIds: number[] = [];
            if (docSnap.exists()) {
                const dailyData = docSnap.data() as DailyGlobalPredictions;
                if (dailyData.selectedMatches && dailyData.selectedMatches.length > 0) {
                    fixtureIds = dailyData.selectedMatches.map(m => m.fixtureId);
                }
            }
    
            if (fixtureIds.length === 0) {
                setLoading(false);
                return;
            }
    
            // 2. Fetch fixture details from API
            const res = await fetch(`/api/football/fixtures?ids=${fixtureIds.join('-')}`);
            if (!res.ok) throw new Error('Failed to fetch fixtures');
            const data = await res.json();
            const fetchedFixtures = data.response || [];
            setSelectedMatches(fetchedFixtures);
    
            // 3. Fetch user's predictions ONLY for these specific fixtures
            const predsRef = collection(db, 'predictions');
            const userPredsQuery = query(predsRef, where('userId', '==', user.uid), where('fixtureId', 'in', fixtureIds));
            const userPredsSnapshot = await getDocs(userPredsQuery);
    
            const userPredictionsForDay: { [key: number]: Prediction } = {};
            userPredsSnapshot.forEach(doc => {
                const pred = doc.data() as Prediction;
                userPredictionsForDay[pred.fixtureId] = pred;
            });
            setPredictions(userPredictionsForDay);
    
        } catch (error) {
             const permissionError = new FirestorePermissionError({ path: `dailyGlobalPredictions or predictions for user ${user.uid}`, operation: 'list' });
             errorEmitter.emit('permission-error', permissionError);
        } finally {
            setLoading(false);
        }
    }, [db, user]);

    useEffect(() => {
        fetchDailyMatchesAndPredictions(selectedDateKey);
    }, [selectedDateKey, fetchDailyMatchesAndPredictions]);


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


    return (
        <div className="flex h-full flex-col bg-background">
            <ScreenHeader title="التوقعات" onBack={goBack} canGoBack={canGoBack} actions={headerActions} />
            <div className="flex-1 overflow-y-auto">
                <Tabs defaultValue="predictions" className="w-full">
                    <div className="sticky top-0 bg-background z-10 border-b">
                       <TabsList className="grid w-full grid-cols-4">
                           <TabsTrigger value="prizes">الجوائز</TabsTrigger>
                           <TabsTrigger value="leaderboard">الترتيب</TabsTrigger>
                           <TabsTrigger value="season_predictions">الموسم</TabsTrigger>
                           <TabsTrigger value="predictions">التصويت</TabsTrigger>
                       </TabsList>
                    </div>

                    <TabsContent value="predictions" className="mt-0 space-y-6">
                         <div className="border-b bg-card py-2">
                            <DateScroller selectedDateKey={selectedDateKey} onDateSelect={setSelectedDateKey} />
                        </div>
                        <div className="p-4 space-y-4">
                            {isAdmin && isToday(new Date(selectedDateKey)) && <AdminMatchSelector navigate={navigate} />}
                            <div>
                                <h3 className="text-xl font-bold mb-3">مباريات اليوم للتوقع</h3>
                                {loading ? (
                                    <div className="space-y-4">
                                        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
                                    </div>
                                ) : selectedMatches.length > 0 ? (
                                    <div className="space-y-4">
                                    {selectedMatches.map(fixture => (
                                        <PredictionCard 
                                        key={fixture.fixture.id}
                                        fixture={fixture}
                                        userPrediction={predictions[fixture.fixture.id]}
                                        onSave={(home, away) => handleSavePrediction(fixture.fixture.id, home, away)}
                                        />
                                    ))}
                                    </div>
                                ) : (
                                    <Card>
                                    <CardContent className="p-6 text-center text-muted-foreground">
                                            <p>لم يتم اختيار أي مباريات للتوقع لهذا اليوم بعد.</p>
                                    </CardContent>
                                    </Card>
                                )}
                            </div>
                        </div>
                    </TabsContent>
                    
                    <TabsContent value="season_predictions" className="p-4 mt-0">
                         <SeasonPredictionsTab />
                    </TabsContent>


                    <TabsContent value="leaderboard" className="p-4 mt-0 space-y-4">
                         {isAdmin && (
                            <Card>
                                <CardContent className="p-4">
                                    <Button onClick={handleCalculatePoints} disabled={calculatingPoints} className="w-full">
                                        {calculatingPoints ? <Loader2 className="h-4 w-4 animate-spin" /> : "احتساب نقاط الأمس"}
                                    </Button>
                                    <p className='text-xs text-muted-foreground text-center mt-2'>هذا الإجراء يقوم بحساب نقاط مباريات الأمس المنتهية فقط.</p>
                                </CardContent>
                            </Card>
                         )}
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
                                    {loadingLeaderboard ? (
                                        Array.from({ length: 5 }).map((_, i) => (
                                            <TableRow key={i}>
                                                <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                                                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                                <TableCell className="text-center"><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
                                            </TableRow>
                                        ))
                                    ) : leaderboard.length > 0 ? (
                                        leaderboard.map((score, index) => (
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
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center text-muted-foreground h-24">
                                                لا توجد بيانات لعرضها في لوحة الصدارة بعد.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                            {hasMore && (
                                <div className="p-2">
                                    <Button
                                        variant="outline"
                                        className="w-full"
                                        onClick={fetchMoreLeaderboard}
                                        disabled={loadingMore}
                                    >
                                        {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : "تحميل المزيد"}
                                    </Button>
                                </div>
                            )}
                        </Card>
                    </TabsContent>
                    
                    <TabsContent value="prizes" className="p-4 mt-0">
                         <Card>
                           <CardContent className="p-10 text-center text-muted-foreground">
                                <p className="text-lg font-bold">قريبًا...</p>
                                <p>سيتم الإعلان عن الجوائز وطريقة الفوز بها هنا.</p>
                           </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}


    