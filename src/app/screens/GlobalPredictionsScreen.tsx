
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import type { ScreenProps } from '@/app/page';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';
import { format, isPast } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useAuth, useFirestore, useAdmin } from '@/firebase/provider';
import type { Fixture, UserScore, Prediction, DailyGlobalPredictions } from '@/lib/types';
import { collection, query, orderBy, onSnapshot, doc, getDoc, setDoc, where, getDocs } from 'firebase/firestore';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { useDebounce } from '@/hooks/use-debounce';


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
                        <span className='font-bold'>-</span>
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
                    <span>{fixture.league.name}</span> - <span>{format(new Date(fixture.fixture.date), "EEE, d MMM, HH:mm", { locale: ar })}</span>
                </div>
                {isPredictionDisabled && userPrediction?.points !== undefined && (
                     <p className="text-center text-primary font-bold text-sm mt-2">
                        +{userPrediction.points} نقاط
                    </p>
                )}
                {userPrediction && !isPredictionDisabled && <p className="text-center text-green-600 text-xs mt-2">تم حفظ توقعك</p>}
                {isPredictionDisabled && !userPrediction && <p className="text-center text-red-600 text-xs mt-2">أغلق باب التوقع</p>}
            </CardContent>
        </Card>
    );
};


export function GlobalPredictionsScreen({ navigate, goBack, canGoBack, headerActions }: ScreenProps) {
    const { isAdmin } = useAdmin();
    const { user } = useAuth();
    const { db } = useFirestore();
    const [loading, setLoading] = useState(true);
    const [selectedMatches, setSelectedMatches] = useState<Fixture[]>([]);
    const [leaderboard, setLeaderboard] = useState<UserScore[]>([]);
    const [predictions, setPredictions] = useState<{ [key: number]: Prediction }>({});
    
    // Fetch Leaderboard
    useEffect(() => {
        if (!db) return;
        const leaderboardRef = query(collection(db, 'leaderboard'), orderBy('totalPoints', 'desc'));
        const unsubscribeLeaderboard = onSnapshot(leaderboardRef, (snapshot) => {
            const scores: UserScore[] = [];
            snapshot.forEach(doc => scores.push(doc.data() as UserScore));
            setLeaderboard(scores);
        }, (error) => {
            const permissionError = new FirestorePermissionError({ path: 'leaderboard', operation: 'list' });
            errorEmitter.emit('permission-error', permissionError);
        });
        return () => unsubscribeLeaderboard();
    }, [db]);

    // Fetch Daily Matches and then user predictions for those matches
    useEffect(() => {
        if (!db || !user) {
            setLoading(false);
            return;
        }

        const fetchDailyMatchesAndPredictions = async () => {
            setLoading(true);
            try {
                // 1. Fetch today's global matches from Firestore
                const today = format(new Date(), 'yyyy-MM-dd');
                const dailyDocRef = doc(db, 'dailyGlobalPredictions', today);
                const docSnap = await getDoc(dailyDocRef);
                
                let fixtureIds: number[] = [];
                if (docSnap.exists()) {
                    const dailyData = docSnap.data() as DailyGlobalPredictions;
                    if (dailyData.selectedMatches && dailyData.selectedMatches.length > 0) {
                        fixtureIds = dailyData.selectedMatches.map(m => m.fixtureId);
                    }
                } else {
                    setSelectedMatches([]);
                    setLoading(false);
                    return; // No matches for today, exit early.
                }
                
                if (fixtureIds.length === 0) {
                    setSelectedMatches([]);
                    setLoading(false);
                    return; // No matches for today, exit early.
                }

                // 2. Fetch details for those fixtures from the API
                const res = await fetch(`/api/football/fixtures?ids=${fixtureIds.join('-')}`);
                const data = await res.json();
                const fetchedFixtures = data.response || [];
                setSelectedMatches(fetchedFixtures);
                
                // 3. Fetch ALL of the user's predictions with a simple query
                const predsRef = collection(db, 'predictions');
                const userPredsQuery = query(predsRef, where('userId', '==', user.uid));
                const userPredsSnapshot = await getDocs(userPredsQuery);

                const allUserPredictions: { [key: number]: Prediction } = {};
                userPredsSnapshot.forEach(doc => {
                    const pred = doc.data() as Prediction;
                    allUserPredictions[pred.fixtureId] = pred;
                });
                
                // 4. Filter allUserPredictions locally to only include today's matches
                const todaysFixtureIds = new Set(fixtureIds);
                const todaysPredictions: { [key: number]: Prediction } = {};
                for (const fixtureId in allUserPredictions) {
                    if (todaysFixtureIds.has(Number(fixtureId))) {
                        todaysPredictions[fixtureId] = allUserPredictions[fixtureId];
                    }
                }
                setPredictions(todaysPredictions);

            } catch (error) {
                 // This will catch getDoc and getDocs permission errors
                 const permissionError = new FirestorePermissionError({ path: `dailyGlobalPredictions or predictions where userId == ${user.uid}`, operation: 'list' });
                 errorEmitter.emit('permission-error', permissionError);
            } finally {
                setLoading(false);
            }
        };

        fetchDailyMatchesAndPredictions();

    }, [db, user]);


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
            <ScreenHeader title="التوقعات العالمية" onBack={goBack} canGoBack={canGoBack} actions={headerActions} />
            <div className="flex-1 overflow-y-auto p-4 space-y-6">

                {isAdmin && <AdminMatchSelector navigate={navigate} />}

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
                                <p className="text-xs">سيقوم النظام باختيار مباريات مهمة قريبًا أو يمكن للمدير اختيارها يدويًا.</p>
                           </CardContent>
                        </Card>
                    )}
                </div>

                <div>
                    <h3 className="text-xl font-bold mb-3">لوحة الصدارة العالمية</h3>
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
                                {leaderboard.length === 0 && loading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                            <TableCell className="text-center"><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : leaderboard.length > 0 ? (
                                     leaderboard.map((score, index) => (
                                        <TableRow key={score.userId}>
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
                    </Card>
                </div>
            </div>
        </div>
    );
}
