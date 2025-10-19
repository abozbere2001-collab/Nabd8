

"use client";

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ScreenProps } from '@/app/page';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { collection, getDocs, doc, query, orderBy, onSnapshot, updateDoc, deleteField } from 'firebase/firestore';
import { useFirestore, useAdmin, useAuth } from '@/firebase/provider';
import type { Fixture, Standing, TopScorer, PinnedMatch, Favorites, Team } from '@/lib/types';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { Button } from '@/components/ui/button';
import { Users, Search, Pin, Edit, Trash2, Loader2, Trophy } from 'lucide-react';
import { SearchSheet } from '@/components/SearchSheet';
import { ProfileButton } from '../AppContentWrapper';
import { FixtureItem } from '@/components/FixtureItem';
import { CURRENT_SEASON } from '@/lib/constants';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { isMatchLive } from '@/lib/matchStatus';
import { getLocalFavorites, setLocalFavorites } from '@/lib/local-favorites';

const IRAQI_LEAGUE_ID = 542;

function PinnedMatchCard({ match, onManage, isAdmin }: { match: PinnedMatch, onManage: () => void, isAdmin: boolean}) {
    if (!match.isEnabled) return null;

    return (
        <Card className="mb-4 border-primary/50 border-2">
            <CardContent className="p-3 relative">
                <div className="flex items-center justify-center text-center mb-2">
                     <Pin className="h-4 w-4 text-primary mr-2" />
                    <p className="text-sm font-bold text-primary">مباراة مثبتة</p>
                </div>
                 <div className="flex-1 flex items-center justify-between gap-1">
                    <div className="flex items-center gap-2 flex-1 justify-end truncate">
                        <span className="font-semibold text-sm truncate">{match.homeTeamName}</span>
                        <Avatar className={'h-8 w-8'}><AvatarImage src={match.homeTeamLogo} alt={match.homeTeamName} /></Avatar>
                    </div>
                    <div className="flex flex-col items-center justify-center min-w-[90px] text-center">
                        <div className="font-bold text-lg">{match.matchTime}</div>
                        <div className="text-xs text-muted-foreground mt-1">{match.matchDate}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-1 truncate">
                        <Avatar className={'h-8 w-8'}><AvatarImage src={match.awayTeamLogo} alt={match.awayTeamName} /></Avatar>
                        <span className="font-semibold text-sm truncate">{match.awayTeamName}</span>
                    </div>
                 </div>
                 <p className="text-center text-xs text-muted-foreground mt-2">{match.competitionName}</p>
                 {isAdmin && (
                     <Button variant="ghost" size="sm" className="absolute top-1 left-1" onClick={onManage}>
                         <Edit className="h-4 w-4 mr-1"/>
                         تعديل
                     </Button>
                 )}
            </CardContent>
        </Card>
    );
}

function OurLeagueTab({ 
    navigate,
    ourLeague,
}: { 
    navigate: ScreenProps['navigate'],
    ourLeague: { id: number; name: string; logo: string } | null;
}) {
    const { isAdmin, db } = useAdmin();
    const [loading, setLoading] = useState(true);
    const [fixtures, setFixtures] = useState<Fixture[]>([]);
    const [standings, setStandings] = useState<Standing[]>([]);
    const [topScorers, setTopScorers] = useState<TopScorer[]>([]);
    const [manualTopScorers, setManualTopScorers] = useState<any[]>([]);

    const listRef = useRef<HTMLDivElement>(null);

    const sortedFixtures = useMemo(() => {
        return [...fixtures].sort((a, b) => a.fixture.timestamp - b.fixture.timestamp);
    }, [fixtures]);
    
    useEffect(() => {
        if (!ourLeague) {
            setLoading(false);
            setFixtures([]);
            setStandings([]);
            setTopScorers([]);
            return;
        }

        const fetchLeagueData = async () => {
            setLoading(true);
            try {
                const [fixturesRes, standingsRes, scorersRes] = await Promise.all([
                    fetch(`/api/football/fixtures?league=${ourLeague.id}&season=${CURRENT_SEASON}`),
                    fetch(`/api/football/standings?league=${ourLeague.id}&season=${CURRENT_SEASON}`),
                    fetch(`/api/football/players/topscorers?league=${ourLeague.id}&season=${CURRENT_SEASON}`),
                ]);

                const fixturesData = await fixturesRes.json();
                const standingsData = await standingsRes.json();
                const scorersData = await scorersRes.json();
                
                setFixtures(fixturesData.response || []);
                setStandings(standingsData.response?.[0]?.league?.standings?.[0] || []);
                setTopScorers(scorersData.response || []);

            } catch (error) {
                console.error("Failed to fetch league data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchLeagueData();
        
        if (db && ourLeague?.id === IRAQI_LEAGUE_ID) {
            const scorersRef = collection(db, 'iraqiLeagueTopScorers');
            const q = query(scorersRef, orderBy('rank', 'asc'));
            const unsubscribe = onSnapshot(q, (snapshot) => {
              const fetchedScorers = snapshot.docs.map((doc) => doc.data());
              setManualTopScorers(fetchedScorers);
            }, error => {
                const permissionError = new FirestorePermissionError({ path: 'iraqiLeagueTopScorers', operation: 'list' });
                errorEmitter.emit('permission-error', permissionError);
            });
            return () => unsubscribe();
        } else {
            setManualTopScorers([]);
        }

    }, [ourLeague, db]);
    
    useEffect(() => {
        if (!loading && listRef.current) {
            const firstUpcomingIndex = sortedFixtures.findIndex(f => !isMatchLive(f.fixture.status) && !['FT', 'AET', 'PEN', 'PST'].includes(f.fixture.status.short));
            if (firstUpcomingIndex > 0) {
                 const itemElement = listRef.current?.children[firstUpcomingIndex] as HTMLDivElement;
                 if (itemElement) {
                     itemElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                 }
            }
        }
    }, [loading, sortedFixtures]);
    
    if (loading) {
        return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>;
    }

    if (!ourLeague) {
         return (
            <div className="text-center text-muted-foreground py-10 px-4">
                <p className="text-lg font-semibold">اختر دوريك المفضل</p>
                <p>اذهب إلى "كل البطولات" واضغط على القلب ❤️ بجانب دوريك المفضل ليظهر هنا.</p>
                <Button className="mt-4" onClick={() => navigate('AllCompetitions')}>استكشف البطولات</Button>
            </div>
        );
    }
    
    const showManualScorers = ourLeague.id === IRAQI_LEAGUE_ID && manualTopScorers.length > 0;
    const finalScorers = showManualScorers ? manualTopScorers : topScorers;


    return (
      <div className="flex flex-col">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-card border mb-4 cursor-pointer" onClick={() => navigate('CompetitionDetails', { leagueId: ourLeague.id, title: ourLeague.name, logo: ourLeague.logo })}>
             <Avatar className="h-10 w-10 p-1 border">
                <AvatarImage src={ourLeague.logo} className="object-contain" />
            </Avatar>
            <div>
                <p className="font-bold text-lg">{ourLeague.name}</p>
                <p className="text-sm text-muted-foreground">دورينا المفضل</p>
            </div>
        </div>

        <Tabs defaultValue="matches" className="w-full">
             <div className="sticky top-0 bg-background z-10 -mx-4 px-1">
                <div className="bg-card text-card-foreground rounded-b-lg border-x border-b shadow-md">
                    <TabsList className="grid w-full grid-cols-3 rounded-none h-11 p-0 flex-row-reverse bg-transparent">
                        <TabsTrigger value="scorers">الهدافين</TabsTrigger>
                        <TabsTrigger value="standings">الترتيب</TabsTrigger>
                        <TabsTrigger value="matches">المباريات</TabsTrigger>
                    </TabsList>
                </div>
            </div>
            <TabsContent value="matches" className="mt-0 -mx-4">
                <div ref={listRef} className="h-full overflow-y-auto p-4 space-y-3">
                    {fixtures.length > 0 ? (
                        sortedFixtures.map((fixture) => (
                            <div key={fixture.fixture.id}>
                                <FixtureItem fixture={fixture} navigate={navigate} />
                            </div>
                        ))
                    ) : (
                        <p className="pt-8 text-center text-muted-foreground">لا توجد مباريات متاحة لهذا الموسم.</p>
                    )}
                </div>
            </TabsContent>
          <TabsContent value="standings" className="p-0 mt-0 -mx-4">
            {standings.length > 0 ? (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="text-center">نقاط</TableHead>
                            <TableHead className="text-center">خ</TableHead>
                            <TableHead className="text-center">ت</TableHead>
                            <TableHead className="text-center">ف</TableHead>
                            <TableHead className="text-center">لعب</TableHead>
                            <TableHead className="w-1/2 text-right">الفريق</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {standings.map((s) => (
                            <TableRow key={`${s.rank}-${s.team.id}`} className="cursor-pointer" onClick={() => navigate('TeamDetails', { teamId: s.team.id})}>
                                <TableCell className="text-center font-bold">{s.points}</TableCell>
                                <TableCell className="text-center">{s.all.lose}</TableCell>
                                <TableCell className="text-center">{s.all.draw}</TableCell>
                                <TableCell className="text-center">{s.all.win}</TableCell>
                                <TableCell className="text-center">{s.all.played}</TableCell>
                                <TableCell className="font-medium">
                                    <div className="flex items-center gap-2 justify-end">
                                        <span className="truncate">{s.team.name}</span>
                                        <Avatar className="h-6 w-6">
                                            <AvatarImage src={s.team.logo} alt={s.team.name} />
                                            <AvatarFallback>{s.team.name.substring(0,1)}</AvatarFallback>
                                        </Avatar>
                                        <span>{s.rank}</span>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            ): <p className="pt-4 text-center text-muted-foreground">جدول الترتيب غير متاح حاليًا.</p>}
          </TabsContent>
           <TabsContent value="scorers" className="p-0 mt-0 -mx-4">
            {isAdmin && ourLeague?.id === IRAQI_LEAGUE_ID && (
                <div className="p-4">
                    <Button className="w-full" onClick={() => navigate('ManageTopScorers')}>
                        <Users className="ml-2 h-4 w-4" />
                        إدارة الهدافين
                    </Button>
                </div>
            )}
            {finalScorers.length > 0 ? (
                <Table>
                    <TableHeader>
                        <TableRow>
                             <TableHead className="text-center">الأهداف</TableHead>
                             <TableHead className="text-right">الفريق</TableHead>
                             <TableHead className="flex-1 text-right">اللاعب</TableHead>
                             <TableHead className="text-right w-8">#</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {finalScorers.map((scorer, index) => {
                            const playerData = showManualScorers ? { name: scorer.playerName, photo: scorer.playerPhoto } : scorer.player;
                            const teamName = showManualScorers ? scorer.teamName : scorer.statistics[0].team.name;
                            const goals = showManualScorers ? scorer.goals : scorer.statistics[0]?.goals.total || 0;
                            const rank = showManualScorers ? scorer.rank : index + 1;
                           return (
                            <TableRow key={showManualScorers ? scorer.playerName : scorer.player.id}>
                                <TableCell className="text-center font-bold text-lg">{goals}</TableCell>
                                <TableCell>
                                     <p className="text-xs text-muted-foreground text-right">{teamName}</p>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-3 justify-end">
                                        <p className="font-semibold">{playerData.name}</p>
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={playerData.photo} />
                                            <AvatarFallback>{playerData.name?.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                    </div>
                                </TableCell>
                                <TableCell className="font-bold">{rank}</TableCell>
                            </TableRow>
                        )})}
                    </TableBody>
                </Table>
            ) : <p className="pt-4 text-center text-muted-foreground">قائمة الهدافين غير متاحة حاليًا.</p>}
          </TabsContent>
        </Tabs>
      </div>
    );
}

function OurBallTab({ navigate, ourBallTeams }: { navigate: ScreenProps['navigate'], ourBallTeams: Team[] }) {
    const { user, db } = useAuth();
    const { toast } = useToast();
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const handleDelete = (teamId: number) => {
        if (deletingId) return;
        setDeletingId(teamId);

        if (user && db) {
            const docRef = doc(db, 'users', user.uid, 'favorites', 'data');
            const updateData = { [`ourBallTeams.${teamId}`]: deleteField() };
            updateDoc(docRef, updateData)
                .catch(error => {
                    const permissionError = new FirestorePermissionError({ path: docRef.path, operation: 'update', requestResourceData: updateData });
                    errorEmitter.emit('permission-error', permissionError);
                    toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حذف الفريق.' });
                })
                .finally(() => {
                    setDeletingId(null);
                });
        } else {
            const currentFavorites = getLocalFavorites();
            if (currentFavorites.ourBallTeams) {
                delete currentFavorites.ourBallTeams[teamId];
                setLocalFavorites(currentFavorites);
            }
            setDeletingId(null);
        }
    };
    
    if (ourBallTeams.length === 0) {
        return (
            <div className="text-center text-muted-foreground py-10 px-4">
                <p className="text-lg font-semibold">قسم "كرتنا" فارغ</p>
                <p>أضف فرقك ومنتخباتك المفضلة هنا بالضغط على زر القلب ❤️ في صفحة "كل البطولات".</p>
                <Button className="mt-4" onClick={() => navigate('AllCompetitions')}>استكشف البطولات</Button>
            </div>
        );
    }

    return (
        <div className="space-y-3 pt-4">
            {ourBallTeams.map((team, index) => {
                return (
                    <div key={`${team.id}-${index}`} className="p-3 rounded-lg border bg-card flex items-center gap-3 h-16">
                        <div onClick={() => navigate('TeamDetails', { teamId: team.id })} className="flex-1 flex items-center gap-3 cursor-pointer">
                            <Avatar className="h-10 w-10">
                                <AvatarImage src={team.logo} alt={team.name} />
                                <AvatarFallback>{team.name.substring(0, 2)}</AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="font-bold">{team.name}</p>
                            </div>
                        </div>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" disabled={deletingId === team.id} onClick={(e) => e.stopPropagation()}>
                                    {deletingId === team.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        سيتم حذف فريق "{team.name}" من قائمة "كرتنا".
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(team.id)} className="bg-destructive hover:bg-destructive/90">
                                        حذف
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                );
            })}
        </div>
    );
}

export function MyCountryScreen({ navigate, goBack, canGoBack }: ScreenProps) {
    const { user, db } = useAuth();
    const { isAdmin } = useAdmin();
    
    const [favorites, setFavorites] = useState<Partial<Favorites>>({});
    const [loadingFavorites, setLoadingFavorites] = useState(true);

    const [ourLeagueData, setOurLeagueData] = useState<{ id: number; name: string; logo: string; } | null>(null);
    const [loadingLeague, setLoadingLeague] = useState(true);

    const [pinnedMatches, setPinnedMatches] = useState<PinnedMatch[]>([]);
    const [loadingPinnedMatches, setLoadingPinnedMatches] = useState(true);
    
    useEffect(() => {
        setLoadingFavorites(true);
        if (user && db) {
            const favsRef = doc(db, 'users', user.uid, 'favorites', 'data');
            const unsubscribe = onSnapshot(favsRef, (docSnap) => {
                setFavorites(docSnap.exists() ? (docSnap.data() as Favorites) : {});
                setLoadingFavorites(false);
            }, (error) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({ path: favsRef.path, operation: 'get' }));
                setFavorites({});
                setLoadingFavorites(false);
            });
            return () => unsubscribe();
        } else {
            setFavorites(getLocalFavorites());
            setLoadingFavorites(false);
        }
    }, [user, db]);

    useEffect(() => {
        let isMounted = true;
        const fetchLeagueDetails = async () => {
            if (loadingFavorites) return;

            setLoadingLeague(true);
            const leagueId = favorites?.ourLeagueId;

            if (!leagueId) {
                setOurLeagueData(null);
                setLoadingLeague(false);
                return;
            }

            try {
                const res = await fetch(`/api/football/leagues?id=${leagueId}`);
                const data = await res.json();
                if (isMounted && data.response?.[0]) {
                    const league = data.response[0].league;
                    setOurLeagueData({ id: league.id, name: league.name, logo: league.logo });
                } else if (isMounted) {
                    setOurLeagueData(null);
                }
            } catch (e) {
                if (isMounted) setOurLeagueData(null);
                console.error("Failed to fetch league details", e);
            } finally {
                if (isMounted) setLoadingLeague(false);
            }
        };

        fetchLeagueDetails();
        return () => { isMounted = false; };
    }, [favorites?.ourLeagueId, loadingFavorites]);


    useEffect(() => {
        if (!db) { setLoadingPinnedMatches(false); return; }
        setLoadingPinnedMatches(true);
        const pinnedMatchesRef = collection(db, 'pinnedIraqiMatches');
        const q = query(pinnedMatchesRef);
        const unsub = onSnapshot(q, (snapshot) => {
            const matches = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PinnedMatch));
            setPinnedMatches(matches);
            setLoadingPinnedMatches(false);
        }, (serverError) => {
            const permissionError = new FirestorePermissionError({ path: pinnedMatchesRef.path, operation: 'list' });
            errorEmitter.emit('permission-error', permissionError);
            setLoadingPinnedMatches(false);
        });
        return () => unsub();
    }, [db]);
    
    const ourBallTeams = useMemo(() => Object.values(favorites.ourBallTeams || {}), [favorites.ourBallTeams]);

    return (
        <div className="flex h-full flex-col bg-background">
            <ScreenHeader
                title={"بلدي"}
                onBack={goBack}
                canGoBack={canGoBack}
                actions={
                    <div className="flex items-center gap-1">
                        <SearchSheet navigate={navigate}>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                                <Search className="h-5 w-5" />
                            </Button>
                        </SearchSheet>
                        <ProfileButton />
                    </div>
                }
            />
            <div className="flex-1 overflow-y-auto px-4">
                {loadingPinnedMatches ? (
                    <Skeleton className="h-28 w-full mb-4" />
                ) : (
                    <>
                        {pinnedMatches.map(match => (
                            <PinnedMatchCard
                                key={match.id}
                                match={match}
                                onManage={() => navigate('ManagePinnedMatch', { matchId: match.id })}
                                isAdmin={isAdmin}
                            />
                        ))}
                        {isAdmin && pinnedMatches.filter(m => m.isEnabled).length === 0 && (
                            <Button className="w-full my-2" onClick={() => navigate('ManagePinnedMatch', { matchId: null })}>
                                <Pin className="ml-2 h-4 w-4" />
                                إضافة مباراة للتثبيت
                            </Button>
                        )}
                    </>
                )}

                <Tabs defaultValue="our-league" className="w-full">
                    <div className="sticky top-0 bg-background z-10 px-1 pt-1 -mx-4">
                        <div className="bg-card text-card-foreground rounded-b-lg border-x border-b shadow-md">
                            <TabsList className="grid w-full grid-cols-2 flex-row-reverse h-11 bg-transparent p-0">
                                <TabsTrigger value="our-ball">كرتنا</TabsTrigger>
                                <TabsTrigger value="our-league">دورينا</TabsTrigger>
                            </TabsList>
                        </div>
                    </div>
                    <TabsContent value="our-league" className="pt-4">
                        {loadingLeague ? (
                             <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                        ) : (
                            <OurLeagueTab
                                navigate={navigate}
                                ourLeague={ourLeagueData}
                            />
                        )}
                    </TabsContent>
                    <TabsContent value="our-ball" className="pt-0">
                         {loadingFavorites ? (
                             <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                         ) : (
                            <OurBallTab navigate={navigate} ourBallTeams={ourBallTeams} />
                         )}
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}

