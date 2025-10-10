
"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import type { ScreenProps } from '@/app/page';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from '@/lib/utils';
import type { Fixture as FixtureType, Standing, Team, Favorites, Player as PlayerType, MatchEvent, TopScorer } from '@/lib/types';
import { useAdmin, useAuth, useFirestore } from '@/firebase/provider';
import { doc, onSnapshot, setDoc, getDocs, collection, updateDoc, deleteField, getDoc } from 'firebase/firestore';
import { RenameDialog } from '@/components/RenameDialog';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { useToast } from '@/hooks/use-toast';
import { Star, Pencil, Goal, ArrowLeftRight, RectangleVertical, Copy, Heart, User, ShieldCheck, Repeat, AlertTriangle, Calendar, Clock, MapPin } from 'lucide-react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { NoteDialog } from '@/components/NoteDialog';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import MatchTimeline from '@/components/MatchTimeline';
import MatchStatistics from '@/components/MatchStatistics';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { LineupField } from '@/components/LineupField';


// --- TYPE DEFINITIONS ---
interface PlayerWithStats {
    player: PlayerType & { pos?: string };
    statistics?: { games?: { rating?: string } }[];
}
interface LineupData {
    team: Team;
    coach: { id: number; name: string; photo: string; };
    formation: string;
    startXI: PlayerWithStats[];
    substitutes: PlayerWithStats[];
}

interface H2HData {
    fixture: { id: number; status: { long: string }, date: string };
    teams: { home: Team, away: Team };
    goals: { home: number | null, away: number | null };
}

interface MatchData {
    lineups: LineupData[];
    expectedLineups: LineupData[];
    events: MatchEvent[];
    stats: { team: Team, statistics: { type: string, value: string | number | null }[] }[];
    standings: Standing[];
    h2h: H2HData[];
    scorers: TopScorer[];
    loading: boolean;
    error: string | null;
}
type RenameType = 'league' | 'team' | 'player' | 'coach' | 'statistic';


// --- HOOKS ---
function useMatchData(fixture?: FixtureType): MatchData {
    const { toast } = useToast();
    const [data, setData] = useState<MatchData>({
        lineups: [], expectedLineups: [], events: [], stats: [], standings: [], h2h: [], scorers: [], loading: true, error: null,
    });
    
    const CURRENT_SEASON = useMemo(() => {
        if (!fixture) return new Date().getFullYear();
        if (fixture.league && fixture.league.round) {
            const seasonYearMatch = fixture.league.round.match(/(\d{4})/);
            if (seasonYearMatch) {
              const year = parseInt(seasonYearMatch[0], 10);
              if (!isNaN(year)) return year;
            }
        }
        return new Date(fixture.fixture.date).getFullYear();
    }, [fixture]);


    useEffect(() => {
        if (!fixture) {
            setData(prev => ({ ...prev, loading: false, error: "No fixture data provided" }));
            return;
        }

        const fetchData = async () => {
            setData(prev => ({ ...prev, loading: true, error: null }));
            const fixtureId = fixture.fixture.id;
            const leagueId = fixture.league.id;
            const homeTeamId = fixture.teams.home.id;
            const awayTeamId = fixture.teams.away.id;

            try {
                const [lineupsRes, expectedLineupsRes, eventsRes, statsRes, standingsRes, h2hRes, scorersRes] = await Promise.allSettled([
                    fetch(`/api/football/fixtures/lineups?fixture=${fixtureId}`),
                    fetch(`/api/football/fixtures/lineups?fixture=${fixtureId}&type=expected`),
                    fetch(`/api/football/fixtures/events?fixture=${fixtureId}`),
                    fetch(`/api/football/fixtures/statistics?fixture=${fixtureId}`),
                    fetch(`/api/football/standings?league=${leagueId}&season=${CURRENT_SEASON}`),
                    fetch(`/api/football/fixtures/headtohead?h2h=${homeTeamId}-${awayTeamId}`),
                    fetch(`/api/football/players/topscorers?league=${leagueId}&season=${CURRENT_SEASON}`),
                ]);

                const parseResult = async (res: PromiseSettledResult<Response>) => {
                    if (res.status === 'fulfilled' && res.value.ok) {
                        try {
                            const json = await res.value.json();
                            return json.response || [];
                        } catch (e) { return []; }
                    }
                    return [];
                };
                
                const fetchedLineups: LineupData[] = await parseResult(lineupsRes);
                const fetchedExpectedLineups: LineupData[] = await parseResult(expectedLineupsRes);
                const fetchedEvents: MatchEvent[] = await parseResult(eventsRes);
                const fetchedStats: any[] = await parseResult(statsRes);
                const fetchedStandings: Standing[] = (await parseResult(standingsRes))[0]?.league?.standings[0] || [];
                const fetchedH2H: H2HData[] = await parseResult(h2hRes);
                const fetchedScorers: TopScorer[] = await parseResult(scorersRes);

                const finalLineups = fetchedLineups.length > 0 ? fetchedLineups : fetchedExpectedLineups;

                setData({
                    lineups: finalLineups,
                    expectedLineups: fetchedExpectedLineups,
                    events: fetchedEvents,
                    stats: fetchedStats,
                    standings: fetchedStandings,
                    h2h: fetchedH2H,
                    scorers: fetchedScorers,
                    loading: false,
                    error: null,
                });

            } catch (error: any) {
                console.error("❌ Match data fetch error:", error);
                toast({
                    variant: "destructive",
                    title: "خطأ في الشبكة",
                    description: "فشل في جلب بيانات المباراة. يرجى التحقق من اتصالك بالإنترنت.",
                });
                setData({
                    lineups: [], expectedLineups: [], events: [], stats: [], standings: [], h2h: [], scorers: [], loading: false,
                    error: error.message || "Unknown error",
                });
            }
        };

        fetchData();
    }, [fixture, toast, CURRENT_SEASON]);

    return data;
}

// --- CHILD COMPONENTS ---
const H2HView = ({ h2h, fixture, homeName, awayName }: { h2h: H2HData[], fixture: FixtureType, homeName: string, awayName: string }) => {
    if (!h2h || h2h.length === 0) return null;

    let homeWins = 0;
    let awayWins = 0;
    let draws = 0;

    h2h.forEach(match => {
        if (match.goals.home === null || match.goals.away === null) return;
        
        if (match.goals.home === match.goals.away) {
            draws++;
        } else if (match.goals.home > match.goals.away) {
            homeWins++;
        } else { // away wins
            awayWins++;
        }
    });
    
    const total = homeWins + awayWins + draws;
    if (total === 0) return null;
    
    const homeWinPercentage = Math.round((homeWins / total) * 100);
    const awayWinPercentage = Math.round((awayWins / total) * 100);
    const drawPercentage = 100 - homeWinPercentage - awayWinPercentage;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-center text-lg">المواجهات المباشرة (آخر {total} مباريات)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                 <div className="text-center">
                    <div className="flex w-full h-8 rounded-full overflow-hidden bg-muted">
                        <div className="bg-blue-600 h-full flex items-center justify-center text-white font-bold" style={{ width: `${homeWinPercentage}%` }}>{homeWinPercentage}%</div>
                        <div className="bg-gray-400 h-full flex items-center justify-center text-white font-bold" style={{ width: `${drawPercentage}%` }}>{drawPercentage}%</div>
                        <div className="bg-green-600 h-full flex items-center justify-center text-white font-bold" style={{ width: `${awayWinPercentage}%` }}>{awayWinPercentage}%</div>
                    </div>
                     <div className="flex justify-between items-center mt-2 px-2 text-sm">
                        <span className="font-semibold text-blue-600">فوز {homeName}</span>
                        <span className="font-semibold text-gray-500">تعادل</span>
                        <span className="font-semibold text-green-600">فوز {awayName}</span>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                    {h2h.slice(0, 4).map(match => (
                        <div key={match.fixture.id} className="flex justify-between items-center p-2 bg-card-foreground/5 rounded-md">
                            <div className="flex items-center gap-1">
                                <Avatar className="h-4 w-4"><AvatarImage src={match.teams.home.logo} /></Avatar>
                                <span className="font-semibold">{match.teams.home.name}</span>
                            </div>
                             <span className="font-bold">{match.goals.home} - {match.goals.away}</span>
                             <div className="flex items-center gap-1">
                                <span className="font-semibold">{match.teams.away.name}</span>
                                <Avatar className="h-4 w-4"><AvatarImage src={match.teams.away.logo} /></Avatar>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

const MatchInfoView = ({ fixture }: { fixture: FixtureType }) => {
    const infoItems = [
        { icon: Calendar, label: "التاريخ", value: format(new Date(fixture.fixture.date), 'eeee, d MMMM yyyy', { locale: ar }) },
        { icon: Clock, label: "الوقت", value: format(new Date(fixture.fixture.date), 'h:mm a', { locale: ar }) },
        { icon: ShieldCheck, label: "الحكم", value: fixture.fixture.referee || 'غير محدد' },
        { icon: MapPin, label: "الملعب", value: fixture.fixture.venue?.name || 'غير محدد' },
    ];
    
    return (
         <Card>
            <CardHeader><CardTitle className="text-center text-lg">معلومات المباراة</CardTitle></CardHeader>
            <CardContent className="space-y-3">
                {infoItems.map(item => (
                    <div key={item.label} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <item.icon className="h-4 w-4" />
                            <span>{item.label}</span>
                        </div>
                        <span className="font-semibold">{item.value}</span>
                    </div>
                ))}
            </CardContent>
        </Card>
    )
}

const PlayerStatsView = ({ scorers, homeTeamId, awayTeamId }: { scorers: TopScorer[], homeTeamId: number, awayTeamId: number }) => {
    const homeScorers = scorers.filter(s => s.statistics[0].team.id === homeTeamId);
    const awayScorers = scorers.filter(s => s.statistics[0].team.id === awayTeamId);

    const homeAssisters = scorers.filter(s => s.statistics[0].team.id === homeTeamId && (s.statistics[0].goals.assists || 0) > 0).sort((a,b) => (b.statistics[0].goals.assists || 0) - (a.statistics[0].goals.assists || 0));
    const awayAssisters = scorers.filter(s => s.statistics[0].team.id === awayTeamId && (s.statistics[0].goals.assists || 0) > 0).sort((a,b) => (b.statistics[0].goals.assists || 0) - (a.statistics[0].goals.assists || 0));

    if (homeScorers.length === 0 && awayScorers.length === 0) return null;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
                <CardHeader><CardTitle className="text-lg">الهدافون</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader><TableRow><TableHead>أهداف</TableHead><TableHead>اللاعب</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {homeScorers.map(({player, statistics}) => (
                                <TableRow key={player.id} className="bg-blue-600/10">
                                    <TableCell className="font-bold">{statistics[0].goals.total}</TableCell>
                                    <TableCell>{player.name}</TableCell>
                                </TableRow>
                            ))}
                             {awayScorers.map(({player, statistics}) => (
                                <TableRow key={player.id} className="bg-green-600/10">
                                    <TableCell className="font-bold">{statistics[0].goals.total}</TableCell>
                                    <TableCell>{player.name}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
            <Card>
                <CardHeader><CardTitle className="text-lg">صناع الأهداف</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader><TableRow><TableHead>صناعة</TableHead><TableHead>اللاعب</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {homeAssisters.map(({player, statistics}) => (
                                <TableRow key={player.id} className="bg-blue-600/10">
                                    <TableCell className="font-bold">{statistics[0].goals.assists}</TableCell>
                                    <TableCell>{player.name}</TableCell>
                                </TableRow>
                            ))}
                             {awayAssisters.map(({player, statistics}) => (
                                <TableRow key={player.id} className="bg-green-600/10">
                                    <TableCell className="font-bold">{statistics[0].goals.assists}</TableCell>
                                    <TableCell>{player.name}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}

const StandingsView = ({ standings, teamId }: { standings: Standing[] | null, teamId: number }) => {
    if (!standings || standings.length === 0) {
        return <p className="text-center py-8 text-muted-foreground">الترتيب غير متاح حاليًا.</p>
    }
    return (
        <Table>
            <TableHeader><TableRow>
                <TableHead className="text-center">ن</TableHead><TableHead className="text-center">خ</TableHead><TableHead className="text-center">ت</TableHead><TableHead className="text-center">ف</TableHead><TableHead className="text-center">ل</TableHead><TableHead className="w-1/2 text-right">الفريق</TableHead>
            </TableRow></TableHeader>
            <TableBody>
            {standings.map((s) => (
                <TableRow key={s.team.id} className={cn(s.team.id === teamId ? 'bg-primary/10' : '')}>
                    <TableCell className="text-center font-bold">{s.points}</TableCell>
                    <TableCell className="text-center">{s.all.lose}</TableCell>
                    <TableCell className="text-center">{s.all.draw}</TableCell>
                    <TableCell className="text-center">{s.all.win}</TableCell>
                    <TableCell className="text-center">{s.all.played}</TableCell>
                    <TableCell className="font-medium"><div className="flex items-center gap-2 justify-end">
                        <span className="truncate">{s.team.name}</span>
                        <Avatar className="h-6 w-6"><AvatarImage src={s.team.logo} /></Avatar>
                        <span>{s.rank}</span>
                    </div></TableCell>
                </TableRow>
            ))}
            </TableBody>
        </Table>
    );
}

// --- MAIN SCREEN COMPONENT ---
export function MatchDetailScreen({ navigate, goBack, canGoBack, fixture, headerActions }: ScreenProps & { fixtureId: number; fixture: FixtureType, headerActions?: React.ReactNode }) {
    const { lineups, expectedLineups, events, stats, h2h, standings, scorers, loading, error } = useMatchData(fixture);
    const [activeLineup, setActiveLineup] = useState<'home' | 'away'>('home');
    const { isAdmin } = useAdmin();
    const { db } = useFirestore();
    const [renameItem, setRenameItem] = useState<{ id: string | number; name: string; type: RenameType } | null>(null);
    const [isRenameOpen, setRenameOpen] = useState(false);
    
    const [customNames, setCustomNames] = useState<{ [key: string]: Map<string | number, string> }>({
        league: new Map(),
        team: new Map(),
        player: new Map(),
        coach: new Map(),
        statistic: new Map(),
    });

    const fetchCustomNames = useCallback(async () => {
        if (!db) return;
        const collectionsToFetch = ['leagueCustomizations', 'teamCustomizations', 'playerCustomizations', 'coachCustomizations', 'statisticCustomizations'];
        try {
            const snapshots = await Promise.all(collectionsToFetch.map(c => getDocs(collection(db, c))));
            const names = {
                league: new Map<number, string>(),
                team: new Map<number, string>(),
                player: new Map<number, string>(),
                coach: new Map<number, string>(),
                statistic: new Map<string, string>(),
            };
            snapshots[0].forEach(doc => names.league.set(Number(doc.id), doc.data().customName));
            snapshots[1].forEach(doc => names.team.set(Number(doc.id), doc.data().customName));
            snapshots[2].forEach(doc => names.player.set(Number(doc.id), doc.data().customName));
            snapshots[3].forEach(doc => names.coach.set(Number(doc.id), doc.data().customName));
            snapshots[4].forEach(doc => names.statistic.set(doc.id, doc.data().customName));
            
            setCustomNames(names as any);
        } catch (error) {
             const permissionError = new FirestorePermissionError({ path: 'customizations', operation: 'list' });
             errorEmitter.emit('permission-error', permissionError);
        }
    }, [db]);

    useEffect(() => { fetchCustomNames(); }, [fetchCustomNames]);
    
    const getCustomName = useCallback((type: 'league' | 'team' | 'player' | 'coach' | 'statistic', id: string | number, defaultName: string) => {
        return customNames[type]?.get(id) || defaultName;
    }, [customNames]);
    
    const displayName = getCustomName('league', fixture.league.id, fixture.league.name);
    const homeTeamName = getCustomName('team', fixture.teams.home.id, fixture.teams.home.name);
    const awayTeamName = getCustomName('team', fixture.teams.away.id, fixture.teams.away.name);


    const handleOpenRename = (type: RenameType, id: string | number, name: string) => {
        setRenameItem({ id, name, type });
        setRenameOpen(true);
    };

    const handleSaveRename = async (newName: string) => {
        if (!renameItem || !db) return;
        const collectionName = `${renameItem.type}Customizations`;
        const docRef = doc(db, collectionName, String(renameItem.id));
        await setDoc(docRef, { customName: newName });
        fetchCustomNames();
        setRenameOpen(false);
    };
    
    const availableTabs = useMemo(() => {
        const tabs = [];
        tabs.push({ value: 'details', label: 'تفاصيل' });
        if (lineups && lineups.length > 0 && lineups.some(l => l.startXI && l.startXI.length > 0)) {
            tabs.push({ value: 'lineups', label: 'التشكيلة' });
        }
        if (events && events.length > 0) {
            tabs.push({ value: 'events', label: 'الأحداث' });
        }
        if (stats && stats.length > 0) {
            tabs.push({ value: 'stats', label: 'الإحصائيات' });
        }
         if (scorers && scorers.length > 0) {
            tabs.push({ value: 'player-stats', label: 'أرقام اللاعبين' });
        }
        if (standings && standings.length > 0) {
            tabs.push({ value: 'standings', label: 'الترتيب' });
        }
        
        return tabs;
    }, [lineups, events, stats, standings, scorers]);
    

    if (loading && lineups.length === 0 && availableTabs.length === 1) {
        return (
            <div className="flex h-full flex-col bg-background">
                <ScreenHeader title="تفاصيل المباراة" onBack={goBack} canGoBack={canGoBack} actions={headerActions} />
                <div className="flex-1 p-4 space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-96 w-full" /></div>
            </div>
        );
    }
     if (error) {
        return <div className="flex h-full flex-col bg-background"><ScreenHeader title="خطأ" onBack={goBack} canGoBack={canGoBack} /><div className="text-center text-red-500 py-10">حدث خطأ: {error}</div></div>
    }
    
    const homeLineup = lineups.find(l => l.team.id === fixture.teams.home.id);
    const awayLineup = lineups.find(l => l.team.id === fixture.teams.away.id);
    const lineupToShow = activeLineup === 'home' ? homeLineup : awayLineup;
    const isExpected = lineups.length > 0 && expectedLineups.length > 0 && lineups[0].startXI.length === expectedLineups[0].startXI.length;
    
    return (
        <div className="flex h-full flex-col bg-background">
            {renameItem && <RenameDialog isOpen={isRenameOpen} onOpenChange={setRenameOpen} currentName={renameItem.name} onSave={handleSaveRename} itemType={renameItem.type} />}
            <ScreenHeader title={displayName} onBack={goBack} canGoBack={canGoBack} actions={headerActions} />
            <div className="p-4 flex-1 overflow-y-auto">
                 <div className="text-center mb-4">
                    <div className="flex justify-around items-center">
                        <div className="flex flex-col items-center gap-2 w-1/3">
                            <Avatar className="h-16 w-16"><AvatarImage src={fixture.teams.home.logo} /></Avatar>
                            <h2 className="text-lg font-bold">{homeTeamName}</h2>
                        </div>
                        <div className="text-4xl font-bold">
                            {fixture.goals.home ?? '-'} - {fixture.goals.away ?? '-'}
                        </div>
                         <div className="flex flex-col items-center gap-2 w-1/3">
                            <Avatar className="h-16 w-16"><AvatarImage src={fixture.teams.away.logo} /></Avatar>
                            <h2 className="text-lg font-bold">{awayTeamName}</h2>
                        </div>
                    </div>
                     <p className="text-muted-foreground text-sm mt-2">{fixture.fixture.status.long}</p>
                 </div>
                 
                 {availableTabs.length > 0 ? (
                     <Tabs defaultValue={availableTabs[0].value}>
                        <TabsList className={`grid w-full grid-cols-${availableTabs.length > 0 ? availableTabs.length : 1}`}>
                            {availableTabs.map(tab => (
                                <TabsTrigger key={tab.value} value={tab.value}>{tab.label}</TabsTrigger>
                            ))}
                        </TabsList>
                        
                        <TabsContent value="details" className="mt-4 space-y-4">
                           <H2HView h2h={h2h} fixture={fixture} homeName={homeTeamName} awayName={awayTeamName} />
                           <MatchInfoView fixture={fixture} />
                        </TabsContent>

                        {availableTabs.some(t => t.value === 'lineups') && (
                            <TabsContent value="lineups" className="mt-4 space-y-4">
                               {isExpected && <p className="text-center text-sm text-amber-500 font-semibold p-2 bg-amber-500/10 rounded-md">التشكيلة المتوقعة</p>}
                                <div className="flex justify-center gap-4">
                                    <Button onClick={() => setActiveLineup('home')} variant={activeLineup === 'home' ? 'default' : 'outline'}>{homeTeamName}</Button>
                                    <Button onClick={() => setActiveLineup('away')} variant={activeLineup === 'away' ? 'default' : 'outline'}>{awayTeamName}</Button>
                                </div>
                                {lineupToShow && 
                                    <LineupField 
                                        lineup={lineupToShow}
                                        isAdmin={isAdmin}
                                        getPlayerName={(id, name) => getCustomName('player', id, name)}
                                        onRename={(id, name) => handleOpenRename('player', id, name)}
                                    />
                                }
                                {!lineupToShow && !loading && 
                                    <div className="flex items-center justify-center h-64 text-muted-foreground">
                                        التشكيلة غير متاحة حالياً
                                    </div>
                                }
                            </TabsContent>
                        )}
                        
                        {availableTabs.some(t => t.value === 'events') && (
                            <TabsContent value="events" className="mt-4">
                              <MatchTimeline
                                events={events}
                                homeTeamId={fixture.teams.home.id}
                                getPlayerName={(id, name) => getCustomName('player', id, name)}
                                fixture={fixture}
                              />
                            </TabsContent>
                        )}

                        {availableTabs.some(t => t.value === 'stats') && (
                             <TabsContent value="stats" className="mt-4">
                               <MatchStatistics stats={stats} fixture={fixture} isAdmin={isAdmin} onRename={(type, id, name) => handleOpenRename(type, id, name)} getStatName={(id, name) => getCustomName('statistic', id, name)} />
                             </TabsContent>
                        )}
                        
                         {availableTabs.some(t => t.value === 'player-stats') && (
                             <TabsContent value="player-stats" className="mt-4">
                               <PlayerStatsView scorers={scorers} homeTeamId={fixture.teams.home.id} awayTeamId={fixture.teams.away.id} />
                             </TabsContent>
                        )}

                        {availableTabs.some(t => t.value === 'standings') && (
                            <TabsContent value="standings" className="mt-4">
                              <StandingsView standings={standings} teamId={fixture.teams.home.id} />
                            </TabsContent>
                        )}
                    </Tabs>
                ) : !loading && (
                    <div className="text-center py-10 text-muted-foreground">
                        لا توجد تفاصيل إضافية لهذه المباراة حاليًا.
                    </div>
                )}
            </div>
        </div>
    );
}

    