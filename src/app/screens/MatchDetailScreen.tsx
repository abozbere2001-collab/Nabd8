

"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import type { ScreenProps } from '@/app/page';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from "@/components/ui/button";
import { cn } from '@/lib/utils';
import type { Fixture, Standing, Player as PlayerType, Team, Favorites } from '@/lib/types';
import { useAdmin, useAuth, useFirestore } from '@/firebase/provider';
import { doc, onSnapshot, setDoc, getDocs, collection, updateDoc, deleteField, getDoc } from 'firebase/firestore';
import { RenameDialog } from '@/components/RenameDialog';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { useToast } from '@/hooks/use-toast';
import { Star, Pencil, Goal, ArrowLeftRight, RectangleVertical, Copy } from 'lucide-react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { NoteDialog } from '@/components/NoteDialog';
import { Progress } from '@/components/ui/progress';


// --- TYPE DEFINITIONS ---
interface PlayerWithStats {
    player: PlayerType;
    statistics?: any[];
}
interface LineupData {
    team: Team;
    coach: any;
    formation: string;
    startXI: PlayerWithStats[];
    substitutes: PlayerWithStats[];
}
interface MatchEvent {
    time: { elapsed: number; extra: number | null };
    team: { id: number; name: string; logo: string };
    player: { id: number; name: string };
    assist: { id: number | null; name: string | null };
    type: 'Goal' | 'Card' | 'subst' | 'Var';
    detail: string;
    comments: string | null;
}
interface MatchData {
    lineups: LineupData[];
    events: MatchEvent[];
    stats: any[];
    standings: Standing[];
    loading: boolean;
    error: string | null;
}
type RenameType = 'team' | 'player' | 'coach';

// --- HOOKS ---
function useMatchData(fixture?: Fixture): MatchData {
    const { toast } = useToast();
    const [data, setData] = useState<MatchData>({
        lineups: [], events: [], stats: [], standings: [], loading: true, error: null,
    });
    
    const CURRENT_SEASON = useMemo(() => {
        if (!fixture) return new Date().getFullYear();
        // Extract season year from the league name if available (e.g., "Premier League - 2023/2024")
        const match = fixture.league.round.match(/(\d{4})/);
        return match ? parseInt(match[0], 10) : new Date(fixture.fixture.date).getFullYear();
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

            try {
                const [lineupsRes, eventsRes, statsRes, standingsRes] = await Promise.allSettled([
                    fetch(`/api/football/fixtures/lineups?fixture=${fixtureId}`),
                    fetch(`/api/football/fixtures/events?fixture=${fixtureId}`),
                    fetch(`/api/football/statistics?fixture=${fixtureId}`),
                    fetch(`/api/football/standings?league=${leagueId}&season=${CURRENT_SEASON}`),
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

                let fetchedLineups: LineupData[] = await parseResult(lineupsRes);
                const fetchedEvents: MatchEvent[] = await parseResult(eventsRes);
                const fetchedStats: any[] = await parseResult(statsRes);
                const fetchedStandings: Standing[] = (await parseResult(standingsRes))[0]?.league?.standings[0] || [];

                // "Double-attack" strategy for player photos if missing
                if (fetchedLineups.length > 0) {
                     for (let i = 0; i < fetchedLineups.length; i++) {
                        const lineup = fetchedLineups[i];
                        
                        const teamPlayersRes = await fetch(`/api/football/players?team=${lineup.team.id}&season=${CURRENT_SEASON}`);
                        if (teamPlayersRes.ok) {
                            const teamPlayersData = await teamPlayersRes.json();
                            const teamPlayersList: PlayerWithStats[] = teamPlayersData.response || [];
                            const photoMap = new Map<number, string>();
                            teamPlayersList.forEach(p => { if (p.player.photo) photoMap.set(p.player.id, p.player.photo); });

                            lineup.startXI.forEach(p => { 
                                if (!p.player.photo && photoMap.has(p.player.id)) { 
                                    p.player.photo = photoMap.get(p.player.id)!; 
                                } 
                            });
                            lineup.substitutes.forEach(p => { 
                                if (!p.player.photo && photoMap.has(p.player.id)) { 
                                    p.player.photo = photoMap.get(p.player.id)!; 
                                } 
                            });
                        }
                    }
                }
                
                setData({
                    lineups: fetchedLineups,
                    events: fetchedEvents,
                    stats: fetchedStats,
                    standings: fetchedStandings,
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
                    lineups: [], events: [], stats: [], standings: [], loading: false,
                    error: error.message || "Unknown error",
                });
            }
        };

        fetchData();
    }, [fixture, toast, CURRENT_SEASON]);

    return data;
}

// --- CHILD COMPONENTS ---

const PlayerOnPitch = ({ player }: { player: PlayerWithStats }) => {
    const { player: playerData, statistics } = player;
    const rating = (statistics && statistics[0]?.games?.rating) ? parseFloat(statistics[0].games.rating).toFixed(1) : null;

    return (
        <div className="relative flex flex-col items-center justify-center text-white text-xs w-16 text-center">
            <div className="relative w-12 h-12">
                 <Avatar className="w-12 h-12 border-2 border-white/50 bg-black/30">
                    <AvatarImage src={playerData.photo} alt={playerData.name} />
                    <AvatarFallback>{playerData.name ? playerData.name.charAt(0) : '?'}</AvatarFallback>
                </Avatar>
                {playerData.number && (
                    <div className="absolute -top-1 -left-1 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center border-2 border-background bg-gray-800 z-10">
                        {playerData.number}
                    </div>
                )}
                 {rating && parseFloat(rating) > 0 && (
                    <div className="absolute -top-1 -right-1 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center border-2 border-background bg-blue-600 z-10">
                        {rating}
                    </div>
                 )}
            </div>
            <span className="mt-1 bg-black/50 px-1.5 py-0.5 rounded font-semibold truncate w-full text-[11px]">{playerData.name}</span>
        </div>
    );
};

function LineupField({ lineup, onRename, isAdmin, getPlayerName }: { lineup: LineupData | undefined, onRename: (type: RenameType, id: number, name: string) => void, isAdmin: boolean, getPlayerName: (id: number, defaultName: string) => string }) {
    if (!lineup || !lineup.startXI || lineup.startXI.length === 0) {
        return <div className="flex items-center justify-center h-full text-center text-muted-foreground py-6 bg-card rounded-lg">التشكيلة غير متاحة حاليًا</div>;
    }
    
    const { startXI, coach, substitutes } = lineup;

    const goalkeeper = startXI.find(p => p.player.pos === 'G');
    const defenders = startXI.filter(p => p.player.pos === 'D').reverse();
    const midfielders = startXI.filter(p => p.player.pos === 'M').reverse();
    const attackers = startXI.filter(p => p.player.pos === 'F').reverse();
    
    const rows: PlayerWithStats[][] = [];
    if(attackers.length > 0) rows.push(attackers);
    if(midfielders.length > 0) rows.push(midfielders);
    if(defenders.length > 0) rows.push(defenders);
    if(goalkeeper) rows.push([goalkeeper]);
    
    return (
        <Card className="p-3 bg-card/80">
             <div className="relative w-full aspect-[2/3] max-h-[700px] bg-cover bg-center bg-no-repeat rounded-lg overflow-hidden border border-green-500/20" style={{ backgroundImage: `url('/football-pitch-vertical.svg')` }}>
                 <div className="absolute inset-0 flex flex-col-reverse justify-around p-2">
                    {rows.map((row, rowIndex) => (
                        <div key={rowIndex} className="flex justify-around items-center w-full">
                            {row.map((player) => (
                                <div key={player.player.id} className="relative">
                                     {isAdmin && (
                                        <Button variant="ghost" size="icon" className="absolute -top-2 -right-2 h-6 w-6 z-20 text-white/70 hover:bg-black/50" onClick={() => onRename('player', player.player.id, getPlayerName(player.player.id, player.player.name))}>
                                            <Pencil className="h-3 w-3" />
                                        </Button>
                                    )}
                                    <PlayerOnPitch player={{...player, player: {...player.player, name: getPlayerName(player.player.id, player.player.name)}}} />
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
            
            {coach && (
                <div className="mt-4 pt-4 border-t border-border">
                    <h4 className="font-bold text-center mb-2">المدرب</h4>
                    <div className="flex flex-col items-center gap-2">
                         <Avatar className="h-16 w-16">
                            <AvatarImage src={coach.photo} alt={coach.name} />
                            <AvatarFallback>{coach.name ? coach.name.charAt(0) : 'C'}</AvatarFallback>
                        </Avatar>
                        <span className="font-semibold">{coach.name}</span>
                    </div>
                </div>
            )}
            {substitutes && substitutes.length > 0 && (
                 <div className="mt-4 pt-4 border-t border-border">
                    <h4 className="font-bold text-center mb-3">الاحتياط</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                         {substitutes.map((player) => (
                            <div key={player.player.id} className="relative flex items-center gap-2 p-2 rounded-lg bg-background/50 border">
                                {isAdmin && <Button variant="ghost" size="icon" className="absolute top-0 right-0 h-6 w-6 z-10" onClick={() => onRename('player', player.player.id, getPlayerName(player.player.id, player.player.name))}><Pencil className="h-3 w-3" /></Button>}
                                <Avatar className="h-8 w-8"><AvatarImage src={player.player.photo} alt={player.player.name} /><AvatarFallback>{player.player.name ? player.player.name.charAt(0) : '?'}</AvatarFallback></Avatar>
                                <span className="text-xs font-medium truncate">{getPlayerName(player.player.id, player.player.name)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </Card>
    );
}

const EventIcon = ({ event }: { event: MatchEvent }) => {
    if (event.type === 'Goal') {
        return <Goal className="h-5 w-5 text-foreground" />;
    }
    if (event.type === 'Card' && event.detail === 'Yellow Card') {
        return <RectangleVertical className="h-5 w-5 text-yellow-400 fill-current" />;
    }
    if (event.type === 'Card' && (event.detail === 'Red Card' || event.detail === 'Second Yellow card')) {
        return <RectangleVertical className="h-5 w-5 text-red-500 fill-current" />;
    }
    if (event.type === 'subst') {
        return <ArrowLeftRight className="h-4 w-4 text-blue-400" />;
    }
    return null;
};

const STATS_TRANSLATIONS: { [key: string]: string } = {
    "Shots on Goal": "تسديدات على المرمى", "Shots off Goal": "تسديدات خارج المرمى", "Total Shots": "إجمالي التسديدات",
    "Blocked Shots": "تسديدات تم صدها", "Shots insidebox": "تسديدات من الداخل", "Shots outsidebox": "تسديدات من الخارج",
    "Fouls": "أخطاء", "Corner Kicks": "ركلات ركنية", "Offsides": "تسلل", "Ball Possession": "الاستحواذ",
    "Yellow Cards": "بطاقات صفراء", "Red Cards": "بطاقات حمراء", "Goalkeeper Saves": "تصديات الحارس",
    "Total passes": "إجمالي التمريرات", "Passes accurate": "تمريرات صحيحة", "Passes %": "دقة التمرير",
};

const EventsView = ({ events, homeTeamId, getPlayerName }: { events: MatchEvent[], homeTeamId: number, getPlayerName: (id: number, defaultName: string) => string }) => {
    const [filter, setFilter] = useState<'highlights' | 'all'>('all');
    
    const sortedEvents = useMemo(() => {
        return [...events].sort((a, b) => a.time.elapsed - b.time.elapsed);
    }, [events]);

    const filteredEvents = useMemo(() => {
        if (filter === 'highlights') {
            return sortedEvents.filter(e => e.type === 'Goal');
        }
        return sortedEvents;
    }, [sortedEvents, filter]);

    if (!events || events.length === 0) {
        return <div className="text-muted-foreground text-center py-4">لا توجد أحداث متاحة لعرضها.</div>
    }

    return (
        <Card>
            <CardContent className="p-4">
                 <Tabs value={filter} onValueChange={(value) => setFilter(value as any)} className="w-full mb-4">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="all">كل الأحداث</TabsTrigger>
                        <TabsTrigger value="highlights">الأبرز</TabsTrigger>
                    </TabsList>
                </Tabs>
                <div className="relative flex flex-col items-center">
                    <div className="absolute top-0 bottom-0 w-px bg-border/50"></div>
                    {filteredEvents.map((event, index) => {
                        const isHomeEvent = event.team.id === homeTeamId;
                        return (
                            <div key={index} className="relative flex w-full justify-center items-center my-3">
                                {isHomeEvent ? (
                                    <>
                                        <div className="w-1/2 p-2 text-sm text-right pr-12">
                                            <div className="flex items-center justify-end gap-2">
                                                <div className="flex-1">
                                                    <p className="font-bold">{getPlayerName(event.player.id, event.player.name)}</p>
                                                    {event.assist.name && <p className="text-xs text-muted-foreground">صناعة: {getPlayerName(event.assist.id!, event.assist.name)}</p>}
                                                </div>
                                                <EventIcon event={event} />
                                            </div>
                                        </div>
                                        <div className="absolute left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-card border flex items-center justify-center text-xs font-bold z-10">
                                            {event.time.elapsed}{event.time.extra ? `+${event.time.extra}` : ''}'
                                        </div>
                                        <div className="w-1/2 p-2"></div>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-1/2 p-2"></div>
                                        <div className="absolute left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-card border flex items-center justify-center text-xs font-bold z-10">
                                            {event.time.elapsed}{event.time.extra ? `+${event.time.extra}` : ''}'
                                        </div>
                                        <div className="w-1/2 p-2 text-sm text-left pl-12">
                                            <div className="flex items-center justify-start gap-2">
                                                <EventIcon event={event} />
                                                <div className="flex-1">
                                                    <p className="font-bold">{getPlayerName(event.player.id, event.player.name)}</p>
                                                    {event.assist.name && <p className="text-xs text-muted-foreground">صناعة: {getPlayerName(event.assist.id!, event.assist.name)}</p>}
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    )
}

const StatsView = ({ stats, fixture }: { stats: any[], fixture: Fixture }) => {
    if (stats.length < 2) return <p className="text-muted-foreground text-center py-4">الإحصائيات غير متاحة</p>;

    const homeStats = stats.find(s => s.team.id === fixture.teams.home.id)?.statistics || [];
    const awayStats = stats.find(s => s.team.id === fixture.teams.away.id)?.statistics || [];

    const combinedStats = homeStats.map((stat: any) => {
        const awayStat = awayStats.find((s: any) => s.type === stat.type);
        return {
            type: stat.type,
            homeValue: stat.value,
            awayValue: awayStat ? awayStat.value : null
        };
    }).filter((s: any) => STATS_TRANSLATIONS[s.type]); // Filter only for stats we can translate

    return (
        <Card>
            <CardContent className="p-4 space-y-3">
                {combinedStats.map((stat, index) => {
                    const homeVal = typeof stat.homeValue === 'string' ? parseInt(stat.homeValue.replace('%', '')) : (stat.homeValue || 0);
                    const awayVal = typeof stat.awayValue === 'string' ? parseInt(stat.awayValue.replace('%', '')) : (stat.awayValue || 0);
                    const total = homeVal + awayVal;
                    const homePercentage = total > 0 ? (homeVal / total) * 100 : 50;

                    return (
                        <div key={index} className="space-y-1">
                             <div className="flex justify-between items-center text-sm font-bold">
                                <span>{stat.homeValue ?? 0}</span>
                                <span className="text-muted-foreground text-xs">{STATS_TRANSLATIONS[stat.type] || stat.type}</span>
                                <span>{stat.awayValue ?? 0}</span>
                            </div>
                            <Progress value={homePercentage} className="h-2 [&>div]:bg-primary" />
                        </div>
                    )
                })}
            </CardContent>
        </Card>
    );
};


// --- MAIN SCREEN COMPONENT ---
export function MatchDetailScreen({ navigate, goBack, canGoBack, fixture, headerActions }: ScreenProps & { fixtureId: number; fixture: Fixture, headerActions?: React.ReactNode }) {
    const { lineups, events, stats, loading, error } = useMatchData(fixture);
    const [activeLineup, setActiveLineup] = useState<'home' | 'away'>('home');
    const { isAdmin } = useAdmin();
    const { db } = useFirestore();
    const [renameItem, setRenameItem] = useState<{ id: number; name: string; type: RenameType } | null>(null);
    const [isRenameOpen, setRenameOpen] = useState(false);
    const [customPlayerNames, setCustomPlayerNames] = useState<Map<number, string>>(new Map());

    const fetchCustomNames = useCallback(async () => {
        if (!db) return;
        const playersColRef = collection(db, 'playerCustomizations');
        try {
            const playersSnapshot = await getDocs(playersColRef);
            const playerNames = new Map<number, string>();
            playersSnapshot.forEach(doc => playerNames.set(Number(doc.id), doc.data().customName));
            setCustomPlayerNames(playerNames);
        } catch (error) {
             const permissionError = new FirestorePermissionError({ path: 'playerCustomizations', operation: 'list' });
             errorEmitter.emit('permission-error', permissionError);
        }
    }, [db]);

    useEffect(() => { fetchCustomNames(); }, [fetchCustomNames]);
    
    const getPlayerName = useCallback((id: number, defaultName: string) => {
        return customPlayerNames.get(id) || defaultName;
    }, [customPlayerNames]);

    const handleOpenRename = (type: RenameType, id: number, name: string) => {
        setRenameItem({ id, name, type });
        setRenameOpen(true);
    };

    const handleSaveRename = async (newName: string) => {
        if (!renameItem || !db) return;
        const collectionName = `${renameItem.type}Customizations`;
        const docRef = doc(db, collectionName, String(renameItem.id));
        await setDoc(docRef, { customName: newName });
        fetchCustomNames();
    };

    if (loading && lineups.length === 0) {
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
    
    return (
        <div className="flex h-full flex-col bg-background">
            {renameItem && <RenameDialog isOpen={isRenameOpen} onOpenChange={setRenameOpen} currentName={renameItem.name} onSave={handleSaveRename} itemType={renameItem.type === 'player' ? 'اللاعب' : 'الفريق'} />}
            <ScreenHeader title={fixture.league.name} onBack={goBack} canGoBack={canGoBack} actions={headerActions} />
            <div className="p-4 flex-1 overflow-y-auto">
                 <div className="text-center mb-4">
                    <div className="flex justify-around items-center">
                        <div className="flex flex-col items-center gap-2 w-1/3">
                            <Avatar className="h-16 w-16"><AvatarImage src={fixture.teams.home.logo} /></Avatar>
                            <h2 className="text-lg font-bold">{fixture.teams.home.name}</h2>
                        </div>
                        <div className="text-4xl font-bold">
                            {fixture.goals.home ?? '-'} - {fixture.goals.away ?? '-'}
                        </div>
                         <div className="flex flex-col items-center gap-2 w-1/3">
                            <Avatar className="h-16 w-16"><AvatarImage src={fixture.teams.away.logo} /></Avatar>
                            <h2 className="text-lg font-bold">{fixture.teams.away.name}</h2>
                        </div>
                    </div>
                     <p className="text-muted-foreground text-sm mt-2">{fixture.fixture.status.long}</p>
                 </div>
                 
                <Tabs defaultValue="lineups">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="lineups">التشكيلة</TabsTrigger>
                        <TabsTrigger value="details">تفاصيل</TabsTrigger>
                    </TabsList>
                    <TabsContent value="lineups" className="mt-4">
                        <div className="flex justify-center gap-4 mb-4">
                             <Button onClick={() => setActiveLineup('home')} variant={activeLineup === 'home' ? 'default' : 'outline'}>{fixture.teams.home.name}</Button>
                             <Button onClick={() => setActiveLineup('away')} variant={activeLineup === 'away' ? 'default' : 'outline'}>{fixture.teams.away.name}</Button>
                        </div>
                        <LineupField lineup={lineupToShow} onRename={handleOpenRename} isAdmin={isAdmin} getPlayerName={getPlayerName} />
                    </TabsContent>
                    <TabsContent value="details" className="mt-4 space-y-4">
                       <EventsView events={events} homeTeamId={fixture.teams.home.id} getPlayerName={getPlayerName} />
                       <StatsView stats={stats} fixture={fixture} />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}





    