
"use client";

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import type { ScreenProps } from '@/app/page';
import type { Fixture, LineupData, MatchEvent, Standing, MatchStatistics, Player, PlayerWithStats } from '@/lib/types';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { FootballIcon } from '@/components/icons/FootballIcon';
import { Flame, Shield, Shirt, Users, GanttChartSquare, Redo, Undo } from 'lucide-react';
import { cn } from '@/lib/utils';


// ====================================================================
// ========================= HELPER COMPONENTS ========================
// ====================================================================

const MatchHeader = ({ fixture }: { fixture: Fixture }) => {
    const { status, date } = fixture.fixture;
    const isLive = ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE'].includes(status.short);
    const isFinished = ['FT', 'AET', 'PEN'].includes(status.short);
    const isUpcoming = !isLive && !isFinished;

    return (
        <Card className="shadow-lg">
            <CardContent className="p-4">
                <div className="flex justify-between items-center text-xs text-muted-foreground mb-3">
                    <div className="flex items-center gap-1.5">
                        <img src={fixture.league.logo} alt={fixture.league.name} className="w-4 h-4" />
                        <span>{fixture.league.name}</span>
                    </div>
                    <span>{new Date(date).toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'short' })}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-col items-center gap-2 flex-1 text-center">
                        <Avatar className="w-16 h-16 border-2 border-primary/20"><AvatarImage src={fixture.teams.home.logo} /></Avatar>
                        <span className="font-bold text-sm truncate">{fixture.teams.home.name}</span>
                    </div>
                    <div className="flex-1 text-center">
                        {isUpcoming ? (
                            <div className="text-2xl font-bold">{new Date(date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</div>
                        ) : (
                            <div className="text-4xl font-extrabold tracking-tighter">{fixture.goals.home} - {fixture.goals.away}</div>
                        )}
                        <div className={cn(
                            "text-xs font-bold px-2 py-0.5 rounded-full inline-block mt-1",
                            isLive && "bg-red-500 text-white animate-pulse",
                            isFinished && "bg-secondary",
                            isUpcoming && "bg-amber-500 text-white"
                        )}>
                            {isLive && status.elapsed ? `${status.elapsed}'` : status.long}
                        </div>
                    </div>
                    <div className="flex flex-col items-center gap-2 flex-1 text-center">
                        <Avatar className="w-16 h-16 border-2 border-primary/20"><AvatarImage src={fixture.teams.away.logo} /></Avatar>
                        <span className="font-bold text-sm truncate">{fixture.teams.away.name}</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

const Timeline = ({ events, homeTeamId }: { events: MatchEvent[], homeTeamId: number }) => {
    if (events.length === 0) {
        return <div className="text-center text-muted-foreground py-8">لم تبدأ المباراة بعد.</div>
    }

    const eventIcons: Record<string, { icon: React.ReactNode, className: string }> = {
        'Goal': { icon: <FootballIcon className="w-4 h-4" />, className: 'bg-green-500' },
        'Card-Yellow': { icon: <div className="w-2.5 h-3.5 bg-yellow-400 rounded-sm" />, className: 'bg-yellow-500/20' },
        'Card-Red': { icon: <div className="w-2.5 h-3.5 bg-red-500 rounded-sm" />, className: 'bg-red-500/20' },
        'subst': { icon: <Users className="w-4 h-4" />, className: 'bg-blue-500/20' },
        'Var': { icon: <Shield className="w-4 h-4" />, className: 'bg-gray-500/20' },
    };

    const getEventKey = (event: MatchEvent) => {
        let key = event.type;
        if(event.type === 'Card') {
            key += `-${event.detail.includes('Yellow') ? 'Yellow' : 'Red'}`;
        }
        return key;
    }

    return (
        <div className="space-y-4">
            {events.sort((a,b) => b.time.elapsed - a.time.elapsed).map((event, i) => {
                const isHomeEvent = event.team.id === homeTeamId;
                const eventInfo = eventIcons[getEventKey(event)] || { icon: '•', className: 'bg-secondary' };
                
                return (
                    <div key={`${event.time.elapsed}-${i}`} className="flex items-start gap-3">
                        {isHomeEvent && (
                            <div className="w-1/4 text-xs text-right">
                                <p className="font-semibold">{event.player.name}</p>
                                {event.type === 'subst' && <p className="text-muted-foreground">{event.assist.name}</p>}
                            </div>
                        )}
                        <div className="flex flex-col items-center">
                            <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-white", eventInfo.className)}>
                                {eventInfo.icon}
                            </div>
                            <div className="text-xs font-bold mt-1">{event.time.elapsed}'</div>
                        </div>
                         {!isHomeEvent && (
                            <div className="w-1/4 text-xs text-left">
                                <p className="font-semibold">{event.player.name}</p>
                                {event.type === 'subst' && <p className="text-muted-foreground">{event.assist.name}</p>}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

const PitchPlayer = ({ player, rating }: { player: Player, rating: string | null }) => {
    const ratingValue = rating ? parseFloat(rating) : 0;
    const ratingColor = ratingValue >= 8 ? 'bg-green-500' : ratingValue >= 7 ? 'bg-green-400' : ratingValue >= 6 ? 'bg-yellow-400' : 'bg-red-500';

    return (
        <div className="flex flex-col items-center text-center">
            <div className="relative">
                <Avatar className="w-12 h-12 border-2 border-background">
                    <AvatarImage src={player.photo} alt={player.name} />
                    <AvatarFallback>{player.name.slice(0,2)}</AvatarFallback>
                </Avatar>
                {rating && (
                    <span className={cn("absolute -bottom-1 -right-1 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-background", ratingColor)}>
                        {parseFloat(rating).toFixed(1)}
                    </span>
                )}
            </div>
            <p className="text-xs font-semibold mt-1 truncate w-20 bg-black/20 rounded-full px-1">{player.name}</p>
            <p className="text-[10px] text-muted-foreground -mt-0.5">{player.number}</p>
        </div>
    );
};

const Lineups = ({ home, away }: { home?: LineupData, away?: LineupData }) => {
     if (!home || !away) return <div className="text-center text-muted-foreground py-8">التشكيلات غير متاحة حاليا.</div>;

    const renderFormation = (lineup: LineupData) => {
        const formation = lineup.formation.split('-').map(Number);
        const playersByRow: Player[][] = [[]]; // GK
        formation.forEach(() => playersByRow.push([]));
        playersByRow.push([]); // Attackers

        lineup.startXI.forEach(p => {
            const gridY = p.player.grid ? parseInt(p.player.grid.split(':')[0]) : 0;
            if (gridY === 1) playersByRow[0].push(p.player); // GK
            else if (gridY <= formation[0] + 1) playersByRow[1].push(p.player); // DEF
            else if (gridY <= formation[0] + formation[1] + 1) playersByRow[2].push(p.player); // MID
            else playersByRow[3].push(p.player); // FWD
        });
        
        // Reverse for away team to show from top to bottom
        if (lineup.team.id === away.team.id) {
            return playersByRow.reverse();
        }
        
        return playersByRow;
    };

    const homeFormation = renderFormation(home);
    const awayFormation = renderFormation(away);

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">{home.team.name} ({home.formation})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 bg-green-900/50 rounded-b-lg p-2">
                     {homeFormation.map((row, i) => (
                        <div key={`home-row-${i}`} className="flex justify-around items-center">
                            {row.map(player => <PitchPlayer key={player.id} player={player} rating={(player as any).rating} />)}
                        </div>
                    ))}
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">{away.team.name} ({away.formation})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 bg-green-900/50 rounded-b-lg p-2">
                     {awayFormation.map((row, i) => (
                        <div key={`away-row-${i}`} className="flex justify-around items-center">
                            {row.map(player => <PitchPlayer key={player.id} player={player} rating={(player as any).rating} />)}
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    )
}

const MatchStats = ({ homeStats, awayStats }: { homeStats?: StatisticItem[], awayStats?: StatisticItem[] }) => {
    if (!homeStats || !awayStats) return <div className="text-center text-muted-foreground py-8">الإحصائيات غير متاحة.</div>;

    const statOrder = ["Ball Possession", "Total Shots", "Shots on Goal", "Corner Kicks", "Fouls", "Offsides", "Yellow Cards", "Red Cards"];
    const statLabels: Record<string, string> = {
        "Ball Possession": "الاستحواذ", "Total Shots": "التسديدات", "Shots on Goal": "على المرمى", "Corner Kicks": "ركنيات", "Fouls": "أخطاء", "Offsides": "تسلل", "Yellow Cards": "بطاقات صفراء", "Red Cards": "بطاقات حمراء"
    };

    const combinedStats = statOrder.map(type => {
        const home = homeStats.find(s => s.type === type)?.value ?? '0';
        const away = awayStats.find(s => s.type === type)?.value ?? '0';
        const homeVal = parseInt(String(home).replace('%',''));
        const awayVal = parseInt(String(away).replace('%',''));
        return { type: statLabels[type], home, away, homeVal, awayVal };
    });

    return (
        <Card>
            <CardContent className="p-4 space-y-3">
                {combinedStats.map(stat => (
                    <div key={stat.type}>
                        <div className="flex justify-between items-center text-sm font-bold mb-1">
                            <span>{stat.home}</span>
                            <span className="text-muted-foreground">{stat.type}</span>
                            <span>{stat.away}</span>
                        </div>
                        <div className="flex items-center gap-1">
                           <Progress value={stat.homeVal} className="h-2 [&>div]:bg-cyan-400" indicatorClassName="bg-cyan-400" dir="rtl" />
                           <Progress value={stat.awayVal} className="h-2 [&>div]:bg-amber-400" indicatorClassName="bg-amber-400" />
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
};

const StandingsTable = ({ standings, homeId, awayId }: { standings: Standing[], homeId: number, awayId: number }) => {
    if (standings.length === 0) return <div className="text-center text-muted-foreground py-8">الترتيب غير متاح.</div>;

    return (
         <Table>
            <TableHeader>
                <TableRow>
                    <TableHead className="w-[50px]">#</TableHead>
                    <TableHead>الفريق</TableHead>
                    <TableHead className="text-center">لعب</TableHead>
                    <TableHead className="text-center">فارق</TableHead>
                    <TableHead className="text-center">نقاط</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {standings.map((s) => (
                    <TableRow key={s.team.id} className={cn((s.team.id === homeId || s.team.id === awayId) && 'bg-primary/10')}>
                        <TableCell className="font-medium">{s.rank}</TableCell>
                        <TableCell>
                            <div className="flex items-center gap-2">
                                <Avatar className="w-5 h-5"><AvatarImage src={s.team.logo}/></Avatar>
                                {s.team.name}
                            </div>
                        </TableCell>
                        <TableCell className="text-center">{s.all.played}</TableCell>
                        <TableCell className="text-center">{s.goalsDiff}</TableCell>
                        <TableCell className="text-center font-bold">{s.points}</TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
};


// ====================================================================
// ========================= MAIN PAGE COMPONENT ======================
// ====================================================================

export function MatchDetailScreen({ fixtureId, goBack, canGoBack }: ScreenProps & { fixtureId: number }) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchAllData = useCallback(async () => {
        if (!fixtureId) return;

        try {
            const [fixtureRes, lineupsRes, eventsRes, statsRes, playersRes] = await Promise.all([
                fetch(`/api/football/fixtures?id=${fixtureId}`),
                fetch(`/api/football/fixtures/lineups?fixture=${fixtureId}`),
                fetch(`/api/football/fixtures/events?fixture=${fixtureId}`),
                fetch(`/api/football/fixtures/statistics?fixture=${fixtureId}`),
                fetch(`/api/football/players?fixture=${fixtureId}`),
            ]);

            const fixtureData = await fixtureRes.json();
            const currentFixture = fixtureData.response?.[0];
            if (!currentFixture) throw new Error('لم يتم العثور على المباراة');

            const standingsRes = await fetch(`/api/football/standings?league=${currentFixture.league.id}&season=${currentFixture.league.season}`);
            const standingsData = await standingsRes.json();
            const lineupsData = await lineupsRes.json();
            const eventsData = await eventsRes.json();
            const statsData = await statsRes.json();
            const playersData = await playersRes.json();

             const playersRatingsMap = new Map<number, PlayerWithStats>();
             playersData.response.forEach((item: {player: Player, statistics: any[]}) => {
                 playersRatingsMap.set(item.player.id, item as PlayerWithStats);
             });
             
             const fullLineups = lineupsData.response || [];
             fullLineups.forEach((lineup: LineupData) => {
                 const processPlayerList = (list: PlayerWithStats[]) => {
                     list.forEach(p => {
                         const ratedPlayer = playersRatingsMap.get(p.player.id);
                         if (ratedPlayer) {
                             (p.player as any).rating = ratedPlayer.statistics?.[0]?.games?.rating;
                         }
                     });
                 };
                 processPlayerList(lineup.startXI);
                 processPlayerList(lineup.substitutes);
             });


            setData({
                fixture: currentFixture,
                lineups: fullLineups,
                events: eventsData.response || [],
                statistics: statsData.response || [],
                standings: standingsData.response?.[0]?.league?.standings?.[0] || [],
            });
            

        } catch (err: any) {
            setError(err.message || 'حدث خطأ غير متوقع');
        } finally {
            setLoading(false);
        }
    }, [fixtureId]);
    
    useEffect(() => {
        fetchDataWithInterval();
    }, [fixtureId]);

    const fetchDataWithInterval = () => {
        fetchAllData();
        const intervalId = setInterval(fetchAllData, 30000);
        return () => clearInterval(intervalId);
    };

    if (loading || !data) {
        return (
            <div className="flex flex-col bg-background h-full">
                <ScreenHeader title="جاري التحميل..." onBack={goBack} canGoBack={canGoBack} />
                <div className="p-4 space-y-4">
                    <Skeleton className="h-40 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-64 w-full" />
                </div>
            </div>
        );
    }
    
    const { fixture, lineups, events, statistics, standings } = data;
    const homeTeam = fixture.teams.home;
    const awayTeam = fixture.teams.away;
    const homeLineup = lineups.find((l: LineupData) => l.team.id === homeTeam.id);
    const awayLineup = lineups.find((l: LineupData) => l.team.id === awayTeam.id);
    const homeStats = statistics.find((s: MatchStatistics) => s.team.id === homeTeam.id)?.statistics;
    const awayStats = statistics.find((s: MatchStatistics) => s.team.id === awayTeam.id)?.statistics;

    return (
        <div className="flex flex-col bg-background h-full">
            <ScreenHeader title="" onBack={goBack} canGoBack={canGoBack} />
            <div className="flex-1 overflow-y-auto p-2 sm:p-4">
                <MatchHeader fixture={fixture} />
                 <Tabs defaultValue="details" className="w-full mt-4">
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="standings">الترتيب</TabsTrigger>
                        <TabsTrigger value="lineup">التشكيل</TabsTrigger>
                        <TabsTrigger value="timeline">مُجريات</TabsTrigger>
                        <TabsTrigger value="details">تفاصيل</TabsTrigger>
                    </TabsList>
                    <TabsContent value="details" className="py-4">
                        <MatchStats homeStats={homeStats} awayStats={awayStats} />
                    </TabsContent>
                    <TabsContent value="timeline" className="py-4">
                        <Timeline events={events} homeTeamId={homeTeam.id} />
                    </TabsContent>
                    <TabsContent value="lineup" className="py-4">
                        <Lineups home={homeLineup} away={awayLineup} />
                    </TabsContent>
                     <TabsContent value="standings" className="py-4">
                        <StandingsTable standings={standings} homeId={homeTeam.id} awayId={awayTeam.id} />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
