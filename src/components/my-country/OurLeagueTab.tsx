"use client";

import React, { useEffect, useState, useMemo, useRef } from 'react';
import type { ScreenProps } from '@/app/page';
import { useAdmin, useFirestore } from '@/firebase/provider';
import type { Fixture, Standing, TopScorer } from '@/lib/types';
import { CURRENT_SEASON } from '@/lib/constants';
import { FixtureItem } from '@/components/FixtureItem';
import { isMatchLive } from '@/lib/matchStatus';
import { Loader2, Users } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { collection, query, orderBy, onSnapshot, getDoc, doc } from 'firebase/firestore';

const IRAQI_LEAGUE_ID = 542;

interface OurLeagueTabProps {
    navigate: ScreenProps['navigate'];
    ourLeagueId: number | undefined;
}

export function OurLeagueTab({ navigate, ourLeagueId }: OurLeagueTabProps) {
    const { isAdmin, db } = useAdmin();
    const [loading, setLoading] = useState(true);
    const [leagueDetails, setLeagueDetails] = useState<{ id: number; name: string; logo: string; } | null>(null);
    const [fixtures, setFixtures] = useState<Fixture[]>([]);
    const [standings, setStandings] = useState<Standing[]>([]);
    const [topScorers, setTopScorers] = useState<TopScorer[]>([]);
    const [manualTopScorers, setManualTopScorers] = useState<any[]>([]);

    const listRef = useRef<HTMLDivElement>(null);

    const sortedFixtures = useMemo(() => {
        return [...fixtures].sort((a, b) => a.fixture.timestamp - b.fixture.timestamp);
    }, [fixtures]);
    
    useEffect(() => {
        if (!ourLeagueId) {
            setLoading(false);
            setLeagueDetails(null);
            return;
        }

        let isMounted = true;
        setLoading(true);

        const fetchAllLeagueData = async () => {
            try {
                // Fetch all data in parallel
                const [leagueRes, fixturesRes, standingsRes, scorersRes] = await Promise.all([
                    fetch(`/api/football/leagues?id=${ourLeagueId}`),
                    fetch(`/api/football/fixtures?league=${ourLeagueId}&season=${CURRENT_SEASON}`),
                    fetch(`/api/football/standings?league=${ourLeagueId}&season=${CURRENT_SEASON}`),
                    fetch(`/api/football/players/topscorers?league=${ourLeagueId}&season=${CURRENT_SEASON}`),
                ]);

                if (!isMounted) return;

                const leagueData = await leagueRes.json();
                const fixturesData = await fixturesRes.json();
                const standingsData = await standingsRes.json();
                const scorersData = await scorersRes.json();

                if (leagueData.response?.[0]) {
                    const league = leagueData.response[0].league;
                    setLeagueDetails({ id: league.id, name: league.name, logo: league.logo });
                }

                setFixtures(fixturesData.response || []);
                setStandings(standingsData.response?.[0]?.league?.standings?.[0] || []);
                setTopScorers(scorersData.response || []);
            } catch (error) {
                console.error("Failed to fetch league data:", error);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchAllLeagueData();
        
        let unsubscribe: (() => void) | null = null;
        if (db && ourLeagueId === IRAQI_LEAGUE_ID) {
            const scorersRef = collection(db, 'iraqiLeagueTopScorers');
            const q = query(scorersRef, orderBy('rank', 'asc'));
            unsubscribe = onSnapshot(q, (snapshot) => {
              if (isMounted) setManualTopScorers(snapshot.docs.map((doc) => doc.data()));
            }, error => {
                const permissionError = new FirestorePermissionError({ path: 'iraqiLeagueTopScorers', operation: 'list' });
                errorEmitter.emit('permission-error', permissionError);
            });
        } else {
            if (isMounted) setManualTopScorers([]);
        }

        return () => {
            isMounted = false;
            if (unsubscribe) unsubscribe();
        };

    }, [ourLeagueId, db]);
    
    useEffect(() => {
        if (!loading && listRef.current && sortedFixtures.length > 0) {
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
         return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary"/></div>;
    }

    if (!ourLeagueId || !leagueDetails) {
         return (
            <div className="text-center text-muted-foreground py-10 px-4">
                <p className="text-lg font-semibold">اختر دوريك المفضل</p>
                <p>اذهب إلى "كل البطولات" واضغط على القلب ❤️ بجانب دوريك المفضل ليظهر هنا.</p>
                <Button className="mt-4" onClick={() => navigate('AllCompetitions')}>استكشف البطولات</Button>
            </div>
        );
    }
    
    const showManualScorers = ourLeagueId === IRAQI_LEAGUE_ID && manualTopScorers.length > 0;
    const finalScorers = showManualScorers ? manualTopScorers : topScorers;


    return (
      <div className="flex flex-col px-4">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-card border mb-4 cursor-pointer" onClick={() => navigate('CompetitionDetails', { leagueId: leagueDetails.id, title: leagueDetails.name, logo: leagueDetails.logo })}>
             <Avatar className="h-10 w-10 p-1 border">
                <AvatarImage src={leagueDetails.logo} className="object-contain" />
                <AvatarFallback>{leagueDetails.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
                <p className="font-bold text-lg">{leagueDetails.name}</p>
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
            {isAdmin && ourLeagueId === IRAQI_LEAGUE_ID && (
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
