
"use client";

import React, { useEffect, useState } from 'react';
import type { ScreenProps } from '@/app/page';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Fixture, Standing } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from 'date-fns';

// --- TYPE DEFINITIONS ---
interface Player {
    id: number;
    name: string;
    number: number | null;
    pos: string;
    grid: string | null;
    photo: string;
}

interface PlayerOnPitch {
    player: Player;
}

interface Lineup {
    team: { id: number; name: string; logo: string; };
    coach: { id: number; name: string; photo: string; };
    formation: string;
    startXI: PlayerOnPitch[];
    substitutes: PlayerOnPitch[];
}

interface MatchEvent {
    time: { elapsed: number; extra: number | null; };
    team: { id: number; name: string; logo: string; };
    player: { id: number; name: string; };
    assist: { id: number | null; name: string | null; };
    type: 'Goal' | 'Card' | 'subst' | 'Var';
    detail: string;
    comments: string | null;
}

interface MatchStat {
    type: string;
    value: number | string | null;
}

interface TeamStats {
    team: { id: number; name: string; logo: string; };
    statistics: MatchStat[];
}

// --- HOOKS ---
function useMatchData(fixture?: Fixture) {
    const [data, setData] = useState<{
        lineups: Lineup[];
        events: MatchEvent[];
        stats: TeamStats[];
        standings: Standing[];
        loading: boolean;
        error: string | null;
    }>({ lineups: [], events: [], stats: [], standings: [], loading: true, error: null });

    useEffect(() => {
        if (!fixture) {
            setData(prev => ({ ...prev, loading: false }));
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
                    fetch(`/api/football/standings?league=${leagueId}&season=${new Date(fixture.fixture.date).getFullYear()}`),
                ]);

                const parseResult = async (res: PromiseSettledResult<Response>) => {
                    if (res.status === 'fulfilled' && res.value.ok) {
                        const json = await res.value.json();
                        return json.response || [];
                    }
                    return [];
                };
                
                const lineups = await parseResult(lineupsRes);
                const events = await parseResult(eventsRes);
                const stats = await parseResult(statsRes);
                const standingsData = await parseResult(standingsRes);

                setData({
                    lineups,
                    events,
                    stats,
                    standings: standingsData[0]?.league?.standings[0] || [],
                    loading: false,
                    error: null,
                });

            } catch (error: any) {
                console.error("❌ Match data fetch error:", error);
                setData({
                    lineups: [], events: [], stats: [], standings: [], loading: false,
                    error: error.message || "Unknown error",
                });
            }
        };

        fetchData();
    }, [fixture]);

    return data;
}

// --- CHILD COMPONENTS ---

const PlayerOnPitch = ({ player, number, name, photo, rating }: { player: PlayerOnPitch['player'], number: number|null, name:string, photo:string, rating:string|null}) => {
    return (
        <div className="flex flex-col items-center justify-center text-white text-xs">
            <div className="relative w-12 h-12">
                <Avatar className="w-12 h-12 border-2 border-white/50 bg-black/30">
                    <AvatarImage src={photo} alt={name} />
                    <AvatarFallback>{name ? name.charAt(0) : '?'}</AvatarFallback>
                </Avatar>
                {number && (
                    <div className="absolute -top-1 -left-1 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center border-2 border-background bg-gray-800 z-10">
                        {number}
                    </div>
                )}
                 {rating && parseFloat(rating) > 0 && (
                    <div className="absolute -top-1 -right-1 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center border-2 border-background bg-blue-600 z-10">
                        {rating}
                    </div>
                 )}
            </div>
            <span className="mt-1 bg-black/50 px-1.5 py-0.5 rounded font-semibold text-center truncate w-20 text-[11px]">{name}</span>
        </div>
    );
};


function LineupField({ lineup }: { lineup: Lineup | undefined }) {
    if (!lineup || !lineup.startXI || lineup.startXI.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-center text-muted-foreground py-6 bg-card rounded-lg">
                التشكيلة غير متاحة حاليًا
            </div>
        );
    }
    
    const { startXI, formation, coach, substitutes } = lineup;

    const formationArr = formation.split('-').map(Number);
    const playersByRow = {
        goalkeeper: startXI.filter(p => p.player.pos === 'G'),
        defenders: startXI.filter(p => p.player.pos === 'D'),
        midfielders: startXI.filter(p => p.player.pos === 'M'),
        forwards: startXI.filter(p => p.player.pos === 'F'),
        others: startXI.filter(p => !['G', 'D', 'M', 'F'].includes(p.player.pos)),
    };
    
    // Sort players within each line based on grid position
    const sortPlayers = (players: PlayerOnPitch[]) => {
        return players.sort((a, b) => {
            const gridA = a.player.grid ? parseInt(a.player.grid.split(':')[1]) : 0;
            const gridB = b.player.grid ? parseInt(b.player.grid.split(':')[1]) : 0;
            return gridA - gridB;
        });
    };

    const rows = [
        sortPlayers(playersByRow.forwards),
        sortPlayers(playersByRow.midfielders),
        sortPlayers(playersByRow.defenders),
        sortPlayers(playersByRow.goalkeeper),
    ].filter(row => row.length > 0);


    return (
        <Card className="p-3 bg-card/80">
            <div 
                className="relative w-full aspect-[2/3] max-h-[700px] bg-cover bg-center bg-no-repeat rounded-lg overflow-hidden border border-green-500/20"
                style={{ backgroundImage: `url('/football-pitch-vertical.svg')` }}
            >
                <div className="absolute inset-0 flex flex-col justify-around p-2">
                    {rows.map((row, rowIndex) => (
                        <div key={rowIndex} className="flex justify-around items-center">
                            {row.map(({ player }) => (
                                <PlayerOnPitch 
                                    key={player.id} 
                                    player={player} 
                                    name={player.name}
                                    photo={player.photo}
                                    number={player.number}
                                    rating={null} // Rating is not in lineup data
                                />
                            ))}
                        </div>
                    ))}
                </div>
            </div>
            
             {/* Coach Section */}
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

            {/* Substitutes Section */}
            {substitutes && substitutes.length > 0 && (
                 <div className="mt-4 pt-4 border-t border-border">
                    <h4 className="font-bold text-center mb-3">الاحتياط</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                         {substitutes.map(({ player }) => (
                            <div key={player.id} className="flex items-center gap-2 p-2 rounded-lg bg-background/50 border">
                                <Avatar className="h-8 w-8">
                                    <AvatarImage src={player.photo} alt={player.name} />
                                    <AvatarFallback>{player.name ? player.name.charAt(0) : '?'}</AvatarFallback>
                                </Avatar>
                                <span className="text-xs font-medium truncate">{player.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </Card>
    );
}

// --- MAIN SCREEN COMPONENT ---
export function MatchDetailScreen({ goBack, canGoBack, fixture, headerActions }: ScreenProps & { fixtureId: number; fixture: Fixture, headerActions?: React.ReactNode }) {
    const { lineups, events, stats, standings, loading } = useMatchData(fixture);
    const [activeLineup, setActiveLineup] = useState<'home' | 'away'>('home');

    if (loading) {
        return (
            <div className="flex h-full flex-col bg-background">
                <ScreenHeader title="تفاصيل المباراة" onBack={goBack} canGoBack={canGoBack} actions={headerActions} />
                <div className="flex-1 p-4 space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-96 w-full" />
                </div>
            </div>
        );
    }
    
    const homeLineup = lineups.find(l => l.team.id === fixture.teams.home.id);
    const awayLineup = lineups.find(l => l.team.id === fixture.teams.away.id);
    const lineupToShow = activeLineup === 'home' ? homeLineup : awayLineup;
    

    return (
        <div className="flex h-full flex-col bg-background">
            <ScreenHeader title="تفاصيل المباراة" onBack={goBack} canGoBack={canGoBack} actions={headerActions} />
            <div className="p-4 flex-1 overflow-y-auto">
                 <div className="text-center mb-4">
                     <h2 className="text-xl font-bold">{fixture.teams.home.name} vs {fixture.teams.away.name}</h2>
                     <p className="text-muted-foreground text-sm">{fixture.league.name} - {format(new Date(fixture.fixture.date), 'd MMM yyyy')}</p>
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
                        <LineupField lineup={lineupToShow} />
                    </TabsContent>
                    <TabsContent value="details" className="mt-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>أحداث المباراة</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {events.length > 0 ? (
                                    <div className="space-y-4">
                                        {events.map((event, index) => (
                                            <div key={index} className="flex items-center gap-3 text-sm">
                                                <span className="font-bold w-12 text-center">{event.time.elapsed}'</span>
                                                <Avatar className="h-6 w-6"><AvatarImage src={event.team.logo} /></Avatar>
                                                <div className="flex-1">
                                                    <p><span className="font-semibold">{event.player.name}</span> ({event.detail})</p>
                                                    {event.assist.name && <p className="text-xs text-muted-foreground">صناعة: {event.assist.name}</p>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : <p className="text-muted-foreground">لا توجد أحداث مسجلة.</p>}
                            </CardContent>
                        </Card>
                        
                         {stats.length === 2 && (
                            <Card className="mt-4">
                                <CardHeader><CardTitle>الإحصائيات</CardTitle></CardHeader>
                                <CardContent className="space-y-2">
                                    {stats[0].statistics.map((stat, index) => (
                                        <div key={index} className="flex items-center justify-between gap-2">
                                            <span className="font-bold">{stats[0].statistics[index].value ?? 0}</span>
                                            <span className="text-muted-foreground text-sm">{stat.type}</span>
                                            <span className="font-bold">{stats[1].statistics[index].value ?? 0}</span>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                         )}

                         {standings.length > 0 && (
                             <Card className="mt-4">
                                <CardHeader><CardTitle>الترتيب</CardTitle></CardHeader>
                                <CardContent>
                                     <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="text-right w-1/2">الفريق</TableHead>
                                                <TableHead className="text-center">لعب</TableHead>
                                                <TableHead className="text-center">ف</TableHead>
                                                <TableHead className="text-center">ت</TableHead>
                                                <TableHead className="text-center">خ</TableHead>
                                                <TableHead className="text-center">نقاط</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {standings.map((s) => (
                                                <TableRow key={s.team.id} className={cn(s.team.id === fixture.teams.home.id || s.team.id === fixture.teams.away.id ? 'bg-primary/10' : '')}>
                                                    <TableCell className="font-medium">
                                                        <div className="flex items-center gap-2">
                                                            <span>{s.rank}</span>
                                                            <Avatar className="h-6 w-6"><AvatarImage src={s.team.logo} /></Avatar>
                                                            <span>{s.team.name}</span>
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
                                </CardContent>
                            </Card>
                         )}
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
