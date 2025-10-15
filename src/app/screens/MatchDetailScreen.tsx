

"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ScreenProps } from '@/app/page';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import type { Fixture, Standing, LineupData, MatchEvent, MatchStatistics, PlayerWithStats, Player as PlayerType } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Shirt, ArrowRight, ArrowLeft, Square, Clock, Loader2, Users, BarChart, ShieldCheck, ArrowUp, ArrowDown } from 'lucide-react';
import { FootballIcon } from '@/components/icons/FootballIcon';
import { Progress } from '@/components/ui/progress';
import { LiveMatchStatus } from '@/components/LiveMatchStatus';
import { CURRENT_SEASON } from '@/lib/constants';

// --- PlayerCard Component ---
const PlayerCard = ({ player, navigate }: { player: PlayerWithStats, navigate: ScreenProps['navigate'] }) => {
  const fallbackImage = "https://media.api-sports.io/football/players/0.png";
  
  const playerInfo = player.player;
  const playerStats = player.statistics?.[0];

  const playerImage = playerInfo?.photo || fallbackImage;
  const playerNumber = playerInfo?.number ?? playerStats?.games?.number;
  
  const ratingValue = playerStats?.games?.rating ?? playerInfo?.rating;
  
  const rating = ratingValue && !isNaN(parseFloat(ratingValue)) 
    ? parseFloat(ratingValue).toFixed(1) 
    : null;

  const getRatingColor = (r: string | null) => {
    if (!r) return 'bg-gray-500';
    const val = parseFloat(r);
    if (val >= 8) return 'bg-green-600';
    if (val >= 7) return 'bg-yellow-600';
    return 'bg-red-600';
  };

  return (
    <div className="relative flex flex-col items-center cursor-pointer" onClick={() => playerInfo.id && navigate('PlayerDetails', { playerId: playerInfo.id })}>
      <div className="relative w-12 h-12">
        <img 
          src={playerImage} 
          alt={playerInfo?.name || "Player"} 
          className="rounded-full w-12 h-12 object-cover border-2 border-white/50" 
          onError={(e) => (e.currentTarget.src = fallbackImage)} 
        />
        {playerNumber && (
          <div className="absolute -top-1 -left-1 bg-gray-800 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center border-2 border-background">
            {playerNumber}
          </div>
        )}
        {rating && (
          <div className={cn(
            `absolute -top-1 -right-1 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center border-2 border-background`,
            getRatingColor(rating)
          )}>
            {rating}
          </div>
        )}
      </div>
      <span className="mt-1 text-[11px] font-semibold text-center truncate w-16">{playerInfo?.name || "غير معروف"}</span>
    </div>
  );
};


// --- Reusable Components ---

const MatchHeaderCard = ({ fixture, navigate }: { fixture: Fixture, navigate: ScreenProps['navigate'] }) => {
    return (
        <Card className="mb-4 bg-card/80 backdrop-blur-sm">
            <CardContent className="p-4">
                <div className="flex justify-between items-center text-xs text-muted-foreground mb-3">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('CompetitionDetails', { leagueId: fixture.league.id })}>
                        <Avatar className="h-5 w-5"><AvatarImage src={fixture.league.logo} /></Avatar>
                        <span>{fixture.league.name}</span>
                    </div>
                    <span>{format(new Date(fixture.fixture.date), 'd MMMM yyyy', { locale: ar })}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-col items-center gap-2 flex-1 justify-end truncate cursor-pointer" onClick={() => navigate('TeamDetails', { teamId: fixture.teams.home.id })}>
                        <Avatar className="h-12 w-12 border-2 border-primary/50"><AvatarImage src={fixture.teams.home.logo} /></Avatar>
                        <span className="font-bold text-sm text-center truncate w-full">{fixture.teams.home.name}</span>
                    </div>
                     <div className="flex flex-col items-center justify-center min-w-[120px] text-center">
                        <LiveMatchStatus fixture={fixture} large />
                    </div>
                    <div className="flex flex-col items-center gap-2 flex-1 truncate cursor-pointer" onClick={() => navigate('TeamDetails', { teamId: fixture.teams.away.id })}>
                         <Avatar className="h-12 w-12 border-2 border-primary/50"><AvatarImage src={fixture.teams.away.logo} /></Avatar>
                        <span className="font-bold text-sm text-center truncate w-full">{fixture.teams.away.name}</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};


// --- Tabs ---

const DetailsTab = ({ fixture, statistics }: { fixture: Fixture | null, statistics: MatchStatistics[] | null }) => {
    if (!fixture) return <Skeleton className="h-40 w-full" />;

    const homeStats = statistics?.find(s => s.team.id === fixture.teams.home.id)?.statistics || [];
    const awayStats = statistics?.find(s => s.team.id === fixture.teams.away.id)?.statistics || [];

    const findStat = (stats: any[], type: string) => stats.find(s => s.type === type)?.value ?? '0';

    const statMapping: { label: string; type: string; isProgress?: boolean }[] = [
      { label: "الاستحواذ", type: "Ball Possession", isProgress: true },
      { label: "التسديدات", type: "Total Shots" },
      { label: "تسديدات على المرمى", type: "Shots on Goal" },
      { label: "الأخطاء", type: "Fouls" },
      { label: "البطاقات الصفراء", type: "Yellow Cards" },
      { label: "البطاقات الحمراء", type: "Red Cards" },
      { label: "الركنيات", type: "Corner Kicks" },
    ];

    return (
        <div className="space-y-4">
            <Card>
                <CardContent className="p-4 text-sm">
                    <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">الملعب</span>
                        <span className="font-semibold">{fixture.fixture.venue.name || 'غير محدد'}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">الجولة</span>
                        <span className="font-semibold">{fixture.league.round}</span>
                    </div>
                    <div className="flex justify-between py-2">
                        <span className="text-muted-foreground">الحالة</span>
                        <span className="font-semibold">{fixture.fixture.status.long}</span>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-4 space-y-4">
                    <h3 className="font-bold text-center">إحصائيات المباراة</h3>
                    {statistics === null ? (
                        <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                    ) : statistics.length > 0 ? (
                        statMapping.map(stat => {
                            const homeValueRaw = findStat(homeStats, stat.type);
                            const awayValueRaw = findStat(awayStats, stat.type);
                            
                            if (stat.isProgress) {
                                const homeVal = parseInt(String(homeValueRaw).replace('%','')) || 0;
                                const awayVal = parseInt(String(awayValueRaw).replace('%','')) || 0;
                                return (
                                    <div key={stat.type} className="space-y-2">
                                        <div className="flex justify-between items-center text-xs font-bold">
                                            <span>{homeValueRaw}</span>
                                            <span className="text-muted-foreground">{stat.label}</span>
                                            <span>{awayValueRaw}</span>
                                        </div>
                                        <div className="flex items-center gap-1" dir="ltr">
                                            <Progress value={homeVal} indicatorClassName="bg-primary rounded-l-full" className="rounded-l-full"/>
                                            <Progress value={awayVal} indicatorClassName="bg-accent rounded-r-full" className="rounded-r-full"/>
                                        </div>
                                    </div>
                                )
                            }
                            return (
                                <div key={stat.type} className="flex justify-between items-center text-sm font-bold">
                                    <span>{homeValueRaw}</span>
                                    <span className="text-muted-foreground font-normal">{stat.label}</span>
                                    <span>{awayValueRaw}</span>
                                </div>
                            )
                        })
                    ) : (
                       <p className="text-center text-muted-foreground p-4">الإحصائيات غير متاحة لهذه المباراة.</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};


const TimelineTabContent = ({ events, homeTeamId, highlightsOnly }: { events: MatchEvent[] | null, homeTeamId: number, highlightsOnly: boolean }) => {
    if (!events) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
    
    const filteredEvents = useMemo(() => {
        if (!highlightsOnly) return events;
        return events.filter(e => e.type === 'Goal' || (e.type === 'Card' && e.detail.includes('Red')));
    }, [events, highlightsOnly]);

    if (filteredEvents.length === 0) {
        const message = highlightsOnly ? "لا توجد أهداف أو بطاقات حمراء." : "لا توجد أحداث رئيسية في المباراة بعد.";
        return <p className="text-center text-muted-foreground p-8">{message}</p>;
    }

    const getEventIcon = (event: MatchEvent) => {
        if (event.type === 'Goal') return <FootballIcon className="w-5 h-5 text-green-500" />;
        if (event.type === 'Card' && event.detail.includes('Yellow')) return <Square className="w-5 h-5 text-yellow-400 fill-current" />;
        if (event.type === 'Card' && event.detail.includes('Red')) return <Square className="w-5 h-5 text-red-500 fill-current" />;
        if (event.type === 'subst') return <Users className="w-4 h-4 text-blue-500" />;
        return <Clock className="w-5 h-5 text-muted-foreground" />;
    }

    const sortedEvents = [...filteredEvents].sort((a, b) => a.time.elapsed - b.time.elapsed);

    return (
        <div className="relative px-2 py-8">
            <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-border -translate-x-1/2"></div>
            <div className="flex flex-col-reverse">
                {sortedEvents.map((event, index) => {
                    const isHomeEvent = event.team.id === homeTeamId;
                    return (
                        <div key={`${event.time.elapsed}-${event.player.name}-${index}`} className={cn("relative flex my-4", isHomeEvent ? "flex-row-reverse" : "flex-row")}>
                            <div className="flex-1 px-4">
                                <div className={cn("flex items-center gap-3 bg-card p-2 rounded-md border w-full", isHomeEvent ? "flex-row-reverse" : "flex-row")}>
                                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-background">
                                        {getEventIcon(event)}
                                    </div>
                                    <div className={cn("flex-1 text-sm", isHomeEvent ? "text-right" : "text-left")}>
                                        <p className="font-semibold">{event.player.name}</p>
                                        {event.type === 'subst' && event.assist.name ? (
                                            <p className="text-xs text-muted-foreground">تبديل بـ {event.assist.name}</p>
                                        ) : (
                                            <p className="text-xs text-muted-foreground">{event.detail}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2 z-10 bg-background border rounded-full h-8 w-8 flex items-center justify-center font-bold text-xs">
                                {event.time.elapsed}'
                            </div>
                            <div className="flex-1" />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const TimelineTab = ({ events, homeTeamId }: { events: MatchEvent[] | null; homeTeamId: number }) => {
    return (
        <Tabs defaultValue="highlights" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="highlights">الأبرز</TabsTrigger>
                <TabsTrigger value="all">كل الأحداث</TabsTrigger>
            </TabsList>
            <TabsContent value="highlights">
                <TimelineTabContent events={events} homeTeamId={homeTeamId} highlightsOnly={true} />
            </TabsContent>
            <TabsContent value="all">
                <TimelineTabContent events={events} homeTeamId={homeTeamId} highlightsOnly={false} />
            </TabsContent>
        </Tabs>
    );
}

const LineupsTab = ({ initialLineups, events, navigate, season }: { initialLineups: LineupData[] | null; events: MatchEvent[] | null; navigate: ScreenProps['navigate']; season: number }) => {
    const [activeTeamTab, setActiveTeamTab] = useState<'home' | 'away'>('home');
    const [loading, setLoading] = useState(!initialLineups);
    
    // We only need to enrich the initial lineups, so we can do this once.
    const [enrichedLineups, setEnrichedLineups] = useState<LineupData[] | null>(null);

    useEffect(() => {
        if (!initialLineups || initialLineups.length < 2) {
            setLoading(false);
            setEnrichedLineups(initialLineups)
            return;
        }

        const enrichLineups = async () => {
            setLoading(true);
            const allPlayerIds = initialLineups.flatMap(l => [...l.startXI, ...l.substitutes]).map(p => p.player.id).filter(id => id);

            if (allPlayerIds.length === 0) {
                setEnrichedLineups(initialLineups);
                setLoading(false);
                return;
            }
            
            try {
                // Fetch all player stats in batches of 20
                const BATCH_SIZE = 20;
                const playerStatsMap = new Map<number, any>();
                
                for (let i = 0; i < allPlayerIds.length; i += BATCH_SIZE) {
                    const batchIds = allPlayerIds.slice(i, i + BATCH_SIZE);
                    const playerStatsRes = await fetch(`/api/football/players?id=${batchIds.join('-')}&season=${season}`);
                    const playerStatsData = await playerStatsRes.json();
                    
                    if (playerStatsData.response) {
                        playerStatsData.response.forEach((p: any) => {
                            playerStatsMap.set(p.player.id, p);
                        });
                    }
                }
                
                // Create new lineup data with enriched player info
                const newEnrichedLineups = initialLineups.map(lineup => {
                    const enrichPlayerList = (list: PlayerWithStats[]) => list.map(playerWrapper => {
                        const extraStats = playerStatsMap.get(playerWrapper.player.id);
                        if (extraStats) {
                            // Smart merge: Combine the original player object with the new data
                             return {
                                ...playerWrapper,
                                player: {
                                    ...playerWrapper.player,
                                    ...extraStats.player, // This will add/overwrite photo, etc.
                                },
                                statistics: extraStats.statistics,
                            };
                        }
                        return playerWrapper;
                    });

                    return {
                        ...lineup,
                        startXI: enrichPlayerList(lineup.startXI),
                        substitutes: enrichPlayerList(lineup.substitutes),
                    };
                });
                
                setEnrichedLineups(newEnrichedLineups);

            } catch (error) {
                console.error("Error enriching lineups:", error);
                setEnrichedLineups(initialLineups); // Fallback to initial data on error
            } finally {
                setLoading(false);
            }
        };

        enrichLineups();
    }, [initialLineups, season]);
    

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
    if (!enrichedLineups || enrichedLineups.length < 2) return <p className="text-center text-muted-foreground p-8">التشكيلات غير متاحة حاليًا.</p>;

    const home = enrichedLineups.find(l => l.team.id === enrichedLineups[0].team.id);
    const away = enrichedLineups.find(l => l.team.id === enrichedLineups[1].team.id);
    
    if (!home || !away) return <p className="text-center text-muted-foreground p-8">التشكيلات غير كاملة.</p>;

    const activeLineup = activeTeamTab === 'home' ? home : away;

    const renderPitch = (lineup: LineupData) => {
        const formationGrid: { [key: number]: PlayerWithStats[] } = {};
        const ungriddedPlayers: PlayerWithStats[] = [];

        lineup.startXI.forEach(p => {
            if (p.player.grid) {
                const [row] = p.player.grid.split(':').map(Number);
                if (!formationGrid[row]) formationGrid[row] = [];
                formationGrid[row].push(p);
            } else {
                ungriddedPlayers.push(p);
            }
        });

        // Sort columns within each row
        Object.keys(formationGrid).forEach(rowKey => {
            const row = Number(rowKey);
            formationGrid[row].sort((a, b) => {
                const colA = Number(a.player.grid?.split(':')[1] || 0);
                const colB = Number(b.player.grid?.split(':')[1] || 0);
                return colA - colB;
            });
        });
        
        const sortedRows = Object.keys(formationGrid).map(Number).sort((a, b) => a - b);

        return (
             <div className="relative w-full max-w-sm mx-auto aspect-[3/4] bg-green-700 bg-[url('/pitch.svg')] bg-cover bg-center rounded-lg overflow-hidden border-4 border-green-900/50 flex flex-col-reverse justify-around p-2">
                {sortedRows.map(row => (
                    <div key={row} className="flex justify-around items-center">
                        {formationGrid[row]?.map(p => <PlayerCard key={p.player.id || p.player.name} player={p} navigate={navigate} />)}
                    </div>
                ))}
                 {ungriddedPlayers.length > 0 && (
                    <div className="flex justify-around items-center">
                        {ungriddedPlayers.map(p => <PlayerCard key={p.player.id || p.player.name} player={p} navigate={navigate}/>)}
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <Tabs value={activeTeamTab} onValueChange={(val) => setActiveTeamTab(val as 'home' | 'away')} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="home">{home.team.name}</TabsTrigger>
                    <TabsTrigger value="away">{away.team.name}</TabsTrigger>
                </TabsList>
            </Tabs>
            
            <div className="font-bold text-center text-muted-foreground text-sm">التشكيلة: {activeLineup.formation}</div>
            
            {renderPitch(activeLineup)}
            
            <Card>
                <CardContent className="p-2">
                    <h3 className="font-bold text-center p-2 text-sm">الاحتياط والتبديلات</h3>
                     <div className="grid grid-cols-1 divide-y">
                        {activeLineup.substitutes.map(p => {
                             const subbedInEvent = events?.find(e => e.type === 'subst' && e.player.id === p.player.id);
                             const subbedOutPlayer = subbedInEvent ? activeLineup.startXI.find(starter => starter.player.id === subbedInEvent.assist.id) : null;

                            return (
                                <div key={p.player.id || p.player.name} className="flex items-center justify-between p-1.5 text-xs">
                                     <div className="flex-1 flex items-center gap-2">
                                        {subbedInEvent && subbedOutPlayer && (
                                            <div className="flex items-center gap-1 text-muted-foreground">
                                                 <ArrowUp className="h-3 w-3 text-green-500"/>
                                                  <span className="text-[10px]">({subbedInEvent.time.elapsed}')</span>
                                                 <ArrowDown className="h-3 w-3 text-red-500"/>
                                                 <span className="line-through">{subbedOutPlayer.player.name}</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-muted-foreground">{p.player.name}</span>
                                        <PlayerCard player={p} navigate={navigate} />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-3 text-center">
                    <h3 className="font-bold text-sm mb-2">المدرب</h3>
                    <div className="flex flex-col items-center gap-1">
                        <Avatar className="h-12 w-12">
                            <AvatarImage src={activeLineup.coach.photo} />
                            <AvatarFallback>{activeLineup.coach.name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="font-semibold text-xs">{activeLineup.coach.name}</span>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};


const StandingsTab = ({ standings, fixture, navigate }: { standings: Standing[] | null, fixture: Fixture, navigate: ScreenProps['navigate'] }) => {
    if (!standings) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
    if (standings.length === 0) return <p className="text-center text-muted-foreground p-8">جدول الترتيب غير متاح لهذه البطولة.</p>;
    
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead className="text-center">نقاط</TableHead>
                    <TableHead className="text-center">ف/ت/خ</TableHead>
                    <TableHead className="text-center">لعب</TableHead>
                    <TableHead className="w-1/2 text-right">الفريق</TableHead>
                    <TableHead className="w-[40px]">#</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {standings.map((s) => {
                    const isRelevantTeam = s.team.id === fixture.teams.home.id || s.team.id === fixture.teams.away.id;
                    return (
                        <TableRow key={s.team.id} className={cn(isRelevantTeam && "bg-primary/10", "cursor-pointer")} onClick={() => navigate('TeamDetails', { teamId: s.team.id })}>
                            <TableCell className="text-center font-bold">{s.points}</TableCell>
                            <TableCell className="text-center text-xs">{`${s.all.win}/${s.all.draw}/${s.all.lose}`}</TableCell>
                            <TableCell className="text-center">{s.all.played}</TableCell>
                            <TableCell className="font-medium">
                                <div className="flex items-center gap-2 justify-end">
                                    <span className="truncate">{s.team.name}</span>
                                    <Avatar className="h-6 w-6"><AvatarImage src={s.team.logo} /></Avatar>
                                </div>
                            </TableCell>
                            <TableCell className="font-bold">{s.rank}</TableCell>
                        </TableRow>
                    );
                })}
            </TableBody>
        </Table>
    );
};


// --- Main Screen ---

export function MatchDetailScreen({ navigate, goBack, canGoBack, fixtureId, fixture: initialFixture }: ScreenProps & { fixtureId: number, fixture?: Fixture }) {
    const [fixture, setFixture] = useState<Fixture | null>(initialFixture || null);
    const [lineups, setLineups] = useState<LineupData[] | null>(null);
    const [events, setEvents] = useState<MatchEvent[] | null>(null);
    const [statistics, setStatistics] = useState<MatchStatistics[] | null>(null);
    const [standings, setStandings] = useState<Standing[] | null>(null);
    const [loading, setLoading] = useState(!initialFixture);

    const fetchData = useCallback(async (isInitialLoad: boolean) => {
         if (!fixtureId) return;
        if (isInitialLoad) {
            setLoading(true);
            setLineups(null);
            setEvents(null);
            setStatistics(null);
            setStandings(null);
        }

        try {
            const fixtureRes = await fetch(`/api/football/fixtures?id=${fixtureId}`);
            const fixtureData = await fixtureRes.json();
            const currentFixture = fixtureData.response?.[0];

            if (!currentFixture) {
                throw new Error("Fixture not found");
            }
            setFixture(currentFixture);
            
            const currentLeagueId = currentFixture.league.id;
            const currentSeason = currentFixture.league.season || CURRENT_SEASON;
            
            const endpoints = [
                `fixtures/lineups?fixture=${fixtureId}`,
                `fixtures/events?fixture=${fixtureId}`,
                `fixtures/statistics?fixture=${fixtureId}`,
                `standings?league=${currentLeagueId}&season=${currentSeason}`
            ];

            const responses = await Promise.all(
                endpoints.map(endpoint => fetch(`/api/football/${endpoint}`).then(res => res.json()))
            );
            
            const [lineupsData, eventsData, statisticsData, standingsData] = responses;

            if (lineupsData.response) setLineups(lineupsData.response);
            if (eventsData.response) setEvents(eventsData.response);
            if (statisticsData.response) setStatistics(statisticsData.response);
            if (standingsData?.response?.[0]?.league?.standings[0]) setStandings(standingsData.response[0].league.standings[0]);

        } catch (error) {
            console.error("Failed to fetch match details:", error);
        } finally {
            if (isInitialLoad) {
                setLoading(false);
            }
        }
    }, [fixtureId]);

    useEffect(() => {
        fetchData(true); 
        const interval = setInterval(() => fetchData(false), 30000); 
        return () => clearInterval(interval);
    }, [fetchData]);


    if (loading && !fixture) {
        return (
            <div className="flex h-full flex-col bg-background">
                <ScreenHeader title="تفاصيل المباراة" onBack={goBack} canGoBack={canGoBack} />
                <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
            </div>
        );
    }
    
    if (!fixture) {
         return (
            <div className="flex h-full flex-col bg-background">
                <ScreenHeader title="خطأ" onBack={goBack} canGoBack={canGoBack} />
                <p className="text-center p-8">لم يتم العثور على تفاصيل المباراة.</p>
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col bg-background">
            <ScreenHeader title="" onBack={goBack} canGoBack={canGoBack} />
            <div className="flex-1 overflow-y-auto p-1">
                <MatchHeaderCard fixture={fixture} navigate={navigate} />
                <Tabs defaultValue="lineups" className="w-full">
                    <TabsList className="grid w-full grid-cols-4 rounded-lg h-auto p-1 bg-card">
                        <TabsTrigger value="details"><ShieldCheck className="w-4 h-4 ml-1" />تفاصيل</TabsTrigger>
                        <TabsTrigger value="events"><Clock className="w-4 h-4 ml-1" />مُجريات</TabsTrigger>
                        <TabsTrigger value="lineups"><Users className="w-4 h-4 ml-1" />التشكيل</TabsTrigger>
                        <TabsTrigger value="standings"><BarChart className="w-4 h-4 ml-1" />الترتيب</TabsTrigger>
                    </TabsList>
                    <TabsContent value="details" className="mt-4"><DetailsTab fixture={fixture} statistics={statistics} /></TabsContent>
                    <TabsContent value="events" className="mt-4"><TimelineTab events={events} homeTeamId={fixture.teams.home.id} /></TabsContent>
                    <TabsContent value="lineups" className="mt-4"><LineupsTab initialLineups={lineups} events={events} navigate={navigate} season={fixture.league.season || CURRENT_SEASON} /></TabsContent>
                    <TabsContent value="standings" className="mt-4"><StandingsTab standings={standings} fixture={fixture} navigate={navigate} /></TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
