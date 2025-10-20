

"use client";

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ScreenProps } from '@/app/page';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { collection, getDocs, doc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { useFirestore, useAdmin, useAuth } from '@/firebase/provider';
import type { Fixture, Standing, TopScorer, PinnedMatch, Favorites, Team } from '@/lib/types';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { Button } from '@/components/ui/button';
import { Search, Pin, Edit, Loader2 } from 'lucide-react';
import { SearchSheet } from '@/components/SearchSheet';
import { ProfileButton } from '../AppContentWrapper';
import { FixtureItem } from '@/components/FixtureItem';
import { CURRENT_SEASON } from '@/lib/constants';
import { Card, CardContent } from '@/components/ui/card';
import { isMatchLive } from '@/lib/matchStatus';
import { getLocalFavorites } from '@/lib/local-favorites';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

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
    const { db } = useFirestore();
    const [loading, setLoading] = useState(true);
    const [fixtures, setFixtures] = useState<Fixture[]>([]);
    const [standings, setStandings] = useState<Standing[]>([]);
    const [topScorers, setTopScorers] = useState<TopScorer[]>([]);
    
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

    }, [ourLeague]);
    
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
            {topScorers.length > 0 ? (
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
                        {topScorers.map((scorer, index) => {
                            const { player, statistics } = scorer;
                            const teamName = statistics[0].team.name;
                            const goals = statistics[0]?.goals.total || 0;
                            const rank = index + 1;
                           return (
                            <TableRow key={player.id}>
                                <TableCell className="text-center font-bold text-lg">{goals}</TableCell>
                                <TableCell>
                                     <p className="text-xs text-muted-foreground text-right">{teamName}</p>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-3 justify-end">
                                        <p className="font-semibold">{player.name}</p>
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={player.photo} />
                                            <AvatarFallback>{player.name?.charAt(0)}</AvatarFallback>
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

const TeamFixturesList = ({ teamId, navigate }: { teamId: number; navigate: ScreenProps['navigate'] }) => {
    const [fixtures, setFixtures] = useState<Fixture[]>([]);
    const [loading, setLoading] = useState(true);
    const listRef = useRef<HTMLDivElement>(null);
    const firstUpcomingMatchRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!teamId) {
            setFixtures([]);
            setLoading(false);
            return;
        }
        
        setLoading(true);
        const fetchFixtures = async () => {
            try {
                const res = await fetch(`/api/football/fixtures?team=${teamId}&season=${CURRENT_SEASON}&last=30`);
                const data = await res.json();
                const sortedFixtures = (data.response || []).sort((a: Fixture, b: Fixture) => a.fixture.timestamp - b.fixture.timestamp);
                setFixtures(sortedFixtures);
            } catch (error) {
                console.error("Error fetching fixtures:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchFixtures();
    }, [teamId]);
    
    useEffect(() => {
        if (!loading && fixtures.length > 0 && listRef.current) {
            const firstUpcomingIndex = fixtures.findIndex(f => isMatchLive(f.fixture.status) || new Date(f.fixture.timestamp * 1000) > new Date());
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
    }, [loading, fixtures]);
    
    if(loading) {
        return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>;
    }
    
    if(fixtures.length === 0) {
        return <p className="text-center text-muted-foreground p-8">لا توجد مباريات متاحة لهذا الفريق.</p>
    }

    return (
        <div ref={listRef} className="h-full overflow-y-auto space-y-3 px-4 pb-4">
            {fixtures.map((fixture, index) => {
                const isUpcomingOrLive = isMatchLive(fixture.fixture.status) || new Date(fixture.fixture.timestamp * 1000) > new Date();
                const isFirstUpcoming = isUpcomingOrLive && !fixtures.slice(0, index).some(f => isMatchLive(f.fixture.status) || new Date(f.fixture.timestamp * 1000) > new Date());
                            
                return (
                    <div key={fixture.fixture.id} ref={isFirstUpcoming ? firstUpcomingMatchRef : null}>
                        <FixtureItem fixture={fixture} navigate={navigate} />
                    </div>
                );
            })}
        </div>
    );
};


function OurBallTab({ navigate, ourBallTeams }: { navigate: ScreenProps['navigate'], ourBallTeams: Team[] }) {
    const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);

    useEffect(() => {
        if (ourBallTeams.length > 0 && !ourBallTeams.some(t => t.id === selectedTeamId)) {
            setSelectedTeamId(ourBallTeams[0].id);
        } else if (ourBallTeams.length === 0) {
            setSelectedTeamId(null);
        }
    }, [ourBallTeams, selectedTeamId]);
    

    if (ourBallTeams.length === 0) {
        return (
            <div className="text-center text-muted-foreground py-10 px-4">
                <p className="text-lg font-semibold">قسم "كرتنا" فارغ</p>
                <p>أضف فرقك ومنتخباتك المفضلة هنا بالضغط على القلب ❤️ في صفحة "كل البطولات".</p>
                <Button className="mt-4" onClick={() => navigate('AllCompetitions')}>استكشف البطولات</Button>
            </div>
        );
    }
    
    return (
        <div className="flex flex-col h-full pt-4">
            <ScrollArea className="w-full whitespace-nowrap border-b">
                <div className="flex w-max space-x-4 px-4 pb-3 flex-row-reverse">
                    {ourBallTeams.map((team) => (
                        <div
                            key={team.id}
                            className={cn(
                                "flex flex-col items-center gap-1 w-16 text-center cursor-pointer transition-opacity opacity-60",
                                selectedTeamId === team.id && "opacity-100"
                            )}
                            onClick={() => setSelectedTeamId(team.id)}
                        >
                            <Avatar className={cn(
                                "h-12 w-12 border-2",
                                selectedTeamId === team.id ? "border-primary" : "border-border"
                            )}>
                                <AvatarImage src={team.logo} />
                                <AvatarFallback>{team.name.substring(0, 2)}</AvatarFallback>
                            </Avatar>
                            <span className="text-xs font-medium truncate w-full">{team.name}</span>
                        </div>
                    ))}
                </div>
                 <ScrollBar orientation="horizontal" className="h-1.5" />
            </ScrollArea>
             <div className="flex-1 overflow-y-auto mt-4">
                {selectedTeamId && <TeamFixturesList teamId={selectedTeamId} navigate={navigate} />}
             </div>
        </div>
    );
}

export function MyCountryScreen({ navigate, goBack, canGoBack }: ScreenProps) {
    const { user, db } = useAuth();
    const { isAdmin } = useAdmin();
    
    const [favorites, setFavorites] = useState<Partial<Favorites>>({});
    const [loading, setLoading] = useState(true);

    const [pinnedMatches, setPinnedMatches] = useState<PinnedMatch[]>([]);
    
    useEffect(() => {
        setLoading(true);
        let unsubscribe: (() => void) | null = null;

        if (user && db) {
            const favsRef = doc(db, 'users', user.uid, 'favorites', 'data');
            unsubscribe = onSnapshot(favsRef, (docSnap) => {
                setFavorites(docSnap.exists() ? (docSnap.data() as Favorites) : {});
                setLoading(false);
            }, (error) => {
                if (user) { 
                    const permissionError = new FirestorePermissionError({ path: favsRef.path, operation: 'get' });
                    errorEmitter.emit('permission-error', permissionError);
                }
                setFavorites(getLocalFavorites());
                setLoading(false);
            });
        } else {
            setFavorites(getLocalFavorites());
            setLoading(false);
        }
        
        return () => {
            if (unsubscribe) unsubscribe();
        };

    }, [user, db]);

    const ourLeagueData = useMemo(() => {
        const leagueId = favorites?.ourLeagueId;
        if (!leagueId) return null;
        
        const leagueDetails = favorites?.leagues?.[leagueId];
        return leagueDetails ? { id: leagueId, name: leagueDetails.name, logo: leagueDetails.logo } : null;

    }, [favorites.ourLeagueId, favorites.leagues]);


    useEffect(() => {
        if (!db) { return; }
        const pinnedMatchesRef = collection(db, 'pinnedIraqiMatches');
        const q = query(pinnedMatchesRef);
        const unsub = onSnapshot(q, (snapshot) => {
            const matches = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PinnedMatch));
            setPinnedMatches(matches);
        }, (serverError) => {
            const permissionError = new FirestorePermissionError({ path: 'pinnedIraqiMatches', operation: 'list' });
            errorEmitter.emit('permission-error', permissionError);
        });
        return () => unsub();
    }, [db]);
    
    const ourBallTeams = useMemo(() => Object.values(favorites.ourBallTeams || {}).sort((a,b) => a.name.localeCompare(b.name)), [favorites.ourBallTeams]);

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
            <div className="flex-1 flex flex-col min-h-0">
                 <div className="px-4 pt-4">
                    {pinnedMatches.map(match => (
                        <PinnedMatchCard
                            key={match.id}
                            match={match}
                            onManage={() => navigate('ManagePinnedMatch', { matchId: match.id })}
                            isAdmin={isAdmin}
                        />
                    ))}
                    {isAdmin && pinnedMatches.filter(m => m.isEnabled).length === 0 && (
                        <Button className="w-full mb-2" onClick={() => navigate('ManagePinnedMatch', { matchId: null })}>
                            <Pin className="ml-2 h-4 w-4" />
                            إضافة مباراة للتثبيت
                        </Button>
                    )}
                 </div>

                <Tabs defaultValue="our-ball" className="w-full flex-1 flex flex-col min-h-0">
                    <div className="sticky top-0 bg-background z-10 px-1 pt-1">
                        <div className="bg-card text-card-foreground rounded-b-lg border-x border-b shadow-md">
                            <TabsList className="grid w-full grid-cols-2 flex-row-reverse h-11 bg-transparent p-0">
                                <TabsTrigger value="our-ball">كرتنا</TabsTrigger>
                                <TabsTrigger value="our-league">دورينا</TabsTrigger>
                            </TabsList>
                        </div>
                    </div>
                    <TabsContent value="our-league" className="pt-4 px-4 flex-1">
                        {loading ? (
                             <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                        ) : (
                            <OurLeagueTab
                                navigate={navigate}
                                ourLeague={ourLeagueData}
                            />
                        )}
                    </TabsContent>
                    <TabsContent value="our-ball" className="pt-0 flex-1 flex flex-col min-h-0">
                         {loading ? (
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
