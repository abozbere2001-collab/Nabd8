"use client";

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ScreenProps } from '@/app/page';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import type { Fixture, Standing, LineupData, MatchEvent, MatchStatistics, PlayerWithStats, Player as PlayerType } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shirt, Square, Clock, Loader2, Users, BarChart, ShieldCheck, ArrowUp, ArrowDown, Pencil } from 'lucide-react';
import { FootballIcon } from '@/components/icons/FootballIcon';
import { Progress } from '@/components/ui/progress';
import { LiveMatchStatus } from '@/components/LiveMatchStatus';
import { CURRENT_SEASON } from '@/lib/constants';
import { useAdmin, useFirestore } from '@/firebase/provider';
import { RenameDialog } from '@/components/RenameDialog';
import { doc, setDoc, deleteDoc, getDocs, collection, onSnapshot } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { Button } from '@/components/ui/button';
import { hardcodedTranslations } from '@/lib/hardcoded-translations';

type RenameType = 'player' | 'coach' | 'team' | 'league' | 'continent' | 'country' | 'status';


const PlayerCard = ({ player, navigate, onRename, isAdmin }: { player: PlayerType, navigate: ScreenProps['navigate'], onRename: () => void, isAdmin: boolean }) => {
    const fallbackImage = "https://media.api-sports.io/football/players/0.png";
    const playerImage = player.photo && player.photo.trim() !== '' ? player.photo : fallbackImage;

    const rating = player.rating && !isNaN(parseFloat(player.rating))
        ? parseFloat(player.rating).toFixed(1)
        : null;

    const getRatingColor = (r: string | null) => {
        if (!r) return 'bg-gray-500';
        const val = parseFloat(r);
        if (val >= 8) return 'bg-green-600';
        if (val >= 7) return 'bg-yellow-600';
        return 'bg-red-600';
    };

    return (
        <div className="relative flex flex-col items-center cursor-pointer" onClick={() => player.id && navigate('PlayerDetails', { playerId: player.id })}>
            <div className="relative w-12 h-12">
                <Avatar className="rounded-full w-12 h-12 object-cover border-2 border-white/50">
                    <AvatarImage src={playerImage} alt={player?.name || "Player"} />
                    <AvatarFallback>{player?.name?.charAt(0) || 'P'}</AvatarFallback>
                </Avatar>
                {isAdmin && (
                    <Button variant="ghost" size="icon" className="absolute -bottom-2 -left-2 h-6 w-6 bg-background/80 hover:bg-background rounded-full" onClick={(e) => {e.stopPropagation(); onRename();}}>
                        <Pencil className="h-3 w-3" />
                    </Button>
                )}
                {player.number && (
                    <div className="absolute -top-1 -left-1 bg-gray-800 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center border-2 border-background">
                        {player.number}
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
            <span className="mt-1 text-[10px] font-semibold text-center truncate w-16">{player?.name || "غير معروف"}</span>
        </div>
    );
};


const MatchHeaderCard = ({ fixture, navigate, customStatus }: { fixture: Fixture, navigate: ScreenProps['navigate'], customStatus: string | null }) => {
    return (
        <Card className="mb-4 bg-card/80 backdrop-blur-sm">
            <CardContent className="p-4">
                <div className="flex justify-between items-center text-xs text-muted-foreground mb-3">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('CompetitionDetails', { leagueId: fixture.league.id })}>
                        <Avatar className="h-5 w-5"><AvatarImage src={fixture.league.logo} /></Avatar>
                        <span className="text-[10px]">{fixture.league.name}</span>
                    </div>
                    <span className="text-[10px]">{format(new Date(fixture.fixture.date), 'd MMMM yyyy', { locale: ar })}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-col items-center gap-2 flex-1 justify-end truncate cursor-pointer" onClick={() => navigate('TeamDetails', { teamId: fixture.teams.home.id })}>
                        <Avatar className="h-10 w-10 border-2 border-primary/50"><AvatarImage src={fixture.teams.home.logo} /></Avatar>
                        <span className="font-bold text-sm text-center truncate w-full">{fixture.teams.home.name}</span>
                    </div>
                     <div className="relative flex flex-col items-center justify-center min-w-[120px] text-center">
                        <LiveMatchStatus fixture={fixture} large customStatus={customStatus} />
                    </div>
                    <div className="flex flex-col items-center gap-2 flex-1 truncate cursor-pointer" onClick={() => navigate('TeamDetails', { teamId: fixture.teams.away.id })}>
                         <Avatar className="h-10 w-10 border-2 border-primary/50"><AvatarImage src={fixture.teams.away.logo} /></Avatar>
                        <span className="font-bold text-sm text-center truncate w-full">{fixture.teams.away.name}</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

const DetailsTab = ({ fixture, statistics, loading }: { fixture: Fixture; statistics: MatchStatistics[] | null; loading: boolean }) => {
    const homeStats = statistics?.find(s => s.team.id === fixture.teams.home.id)?.statistics || [];
    const awayStats = statistics?.find(s => s.team.id === fixture.teams.away.id)?.statistics || [];

    const findStat = (stats: any[], type: string) => stats.find(s => s.type === type)?.value ?? '0';

    const statMapping: { labelKey: string; type: string; isProgress?: boolean }[] = [
      { labelKey: "الاستحواذ", type: "Ball Possession", isProgress: true },
      { labelKey: "التسديدات", type: "Total Shots" },
      { labelKey: "تسديدات على المرمى", type: "Shots on Goal" },
      { labelKey: "تسديدات خارج المرمى", type: "Shots off Goal" },
      { labelKey: "تسديدات محجوبة", type: "Blocked Shots"},
      { labelKey: "الأخطاء", type: "Fouls" },
      { labelKey: "البطاقات الصفراء", type: "Yellow Cards" },
      { labelKey: "البطاقات الحمراء", type: "Red Cards" },
      { labelKey: "الركنيات", type: "Corner Kicks" },
      { labelKey: "التسلل", type: "Offsides" },
    ];

    return (
        <div className="space-y-4">
            <Card>
                <CardContent className="p-4 text-sm text-right">
                    <div className="flex justify-between py-2 border-b">
                        <span className="font-semibold">{fixture.fixture.venue.name || "غير محدد"}</span>
                        <span className="text-muted-foreground">الملعب</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                        <span className="font-semibold">{fixture.league.round}</span>
                        <span className="text-muted-foreground">الجولة</span>
                    </div>
                    <div className="flex justify-between py-2">
                        <span className="font-semibold">{fixture.fixture.status.long}</span>
                        <span className="text-muted-foreground">الحالة</span>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-4 space-y-4">
                    <h3 className="font-bold text-center">إحصائيات المباراة</h3>
                    {loading ? (
                        <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                    ) : statistics && statistics.length > 0 ? (
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
                                            <span className="text-muted-foreground">{stat.labelKey}</span>
                                            <span>{awayValueRaw}</span>
                                        </div>
                                        <div className="flex items-center gap-1" dir="ltr">
                                            <Progress value={homeVal} indicatorClassName="bg-primary rounded-l-full" className="rounded-l-full"/>
                                            <Progress value={awayVal} indicatorClassName="bg-accent rounded-r-full" className="rounded-r-full" style={{transform: 'rotate(180deg)'}}/>
                                        </div>
                                    </div>
                                )
                            }
                            return (
                                <div key={stat.type} className="flex justify-between items-center text-sm font-bold">
                                    <span>{homeValueRaw}</span>
                                    <span className="text-muted-foreground font-normal">{stat.labelKey}</span>
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


const TimelineTabContent = ({ events, homeTeam, awayTeam, highlightsOnly }: { events: MatchEvent[] | null, homeTeam: Fixture['teams']['home'], awayTeam: Fixture['teams']['away'], highlightsOnly: boolean }) => {
    if (events === null) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
    
    const filteredEvents = React.useMemo(() => {
        if (!events) return [];
        if (!highlightsOnly) return events;
        return events.filter(e => e.type === 'Goal' || (e.type === 'Card' && e.detail.includes('Red')));
    }, [events, highlightsOnly]);

    if (filteredEvents.length === 0) {
        const message = highlightsOnly ? "لا توجد أهداف أو بطاقات حمراء." : "لا توجد أحداث رئيسية في المباراة بعد.";
        return <p className="text-center text-muted-foreground p-8">{message}</p>;
    }
    
    const sortedEvents = [...filteredEvents].sort((a, b) => b.time.elapsed - a.time.elapsed);

    const getEventIcon = (event: MatchEvent) => {
        if (event.type === 'Goal') return <FootballIcon className="w-5 h-5 text-green-500" />;
        if (event.type === 'Card' && event.detail.includes('Yellow')) return <Square className="w-5 h-5 text-yellow-400 fill-current" />;
        if (event.type === 'Card' && event.detail.includes('Red')) return <Square className="w-5 h-5 text-red-500 fill-current" />;
        if (event.type === 'subst') return <Users className="w-4 h-4 text-blue-500" />;
        return <Clock className="w-5 h-5 text-muted-foreground" />;
    };

    return (
        <div className="space-y-6 pt-4">
             <div className="flex justify-between items-center px-4">
                <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8"><AvatarImage src={awayTeam.logo} /></Avatar>
                    <span className="font-bold">{awayTeam.name}</span>
                </div>
                 <div className="flex items-center gap-2">
                    <span className="font-bold">{homeTeam.name}</span>
                    <Avatar className="h-8 w-8"><AvatarImage src={homeTeam.logo} /></Avatar>
                </div>
            </div>
            
            <div className="relative px-2">
                <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-border -translate-x-1/2"></div>
                {sortedEvents.map((event, index) => {
                    const isHomeEvent = event.team.id === homeTeam.id;
                    const playerOut = event.player;
                    const playerIn = event.assist;

                    return (
                        <div key={`${event.time.elapsed}-${event.player.name}-${index}`} className={cn("relative flex my-4 items-center", !isHomeEvent ? "flex-row" : "flex-row-reverse")}>
                           <div className="flex-1 px-4">
                                <div className={cn("flex items-center gap-3 w-full", !isHomeEvent ? "flex-row text-left" : "flex-row-reverse text-right")}>
                                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-background flex-shrink-0">
                                        {getEventIcon(event)}
                                    </div>
                                    <div className="flex-1 text-sm min-w-0">
                                        {event.type === 'subst' && event.assist.name ? (
                                            <div className="flex flex-col gap-1 text-xs">
                                                <div className='flex items-center gap-1 font-semibold text-green-500'><ArrowUp className="h-3 w-3"/><span>{playerIn.name}</span></div>
                                                <div className='flex items-center gap-1 font-semibold text-red-500'><ArrowDown className="h-3 w-3"/><span>{playerOut.name}</span></div>
                                            </div>
                                        ) : (
                                            <>
                                                <p className="font-semibold truncate">{event.player.name}</p>
                                                <p className="text-xs text-muted-foreground truncate">{event.detail}</p>
                                            </>
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

const TimelineTab = ({ events, homeTeam, awayTeam }: { events: MatchEvent[] | null; homeTeam: Fixture['teams']['home'], awayTeam: Fixture['teams']['away'] }) => {
    return (
        <Tabs defaultValue="highlights" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="highlights">الأبرز</TabsTrigger>
                <TabsTrigger value="all">كل الأحداث</TabsTrigger>
            </TabsList>
            <TabsContent value="highlights">
                <TimelineTabContent events={events} homeTeam={homeTeam} awayTeam={awayTeam} highlightsOnly={true} />
            </TabsContent>
            <TabsContent value="all">
                <TimelineTabContent events={events} homeTeam={homeTeam} awayTeam={awayTeam} highlightsOnly={false} />
            </TabsContent>
        </Tabs>
    );
}

const LineupsTab = ({ lineups, events, navigate, isAdmin, onRename, homeTeamId, awayTeamId }: { lineups: LineupData[] | null; events: MatchEvent[] | null; navigate: ScreenProps['navigate'], isAdmin: boolean, onRename: (type: RenameType, id: number, name: string, originalName: string) => void, homeTeamId: number, awayTeamId: number }) => {
    if (lineups === null) {
        return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
    }
    
    if (lineups.length < 2) {
        return <p className="text-center text-muted-foreground p-8">التشكيلات غير متاحة حاليًا.</p>;
    }
    
    const home = lineups.find(l => l.team.id === homeTeamId);
    const away = lineups.find(l => l.team.id === awayTeamId);

    if (!home || !away) {
         return <p className="text-center text-muted-foreground p-8">خطأ في بيانات التشكيلة.</p>;
    }

    const [activeTeamTab, setActiveTeamTab] = useState<'home' | 'away'>('home');
    
    const activeLineup = activeTeamTab === 'home' ? home : away;
    
    const substitutionEvents = events?.filter(e => e.type === 'subst' && e.team.id === activeLineup.team.id) || [];
    
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
             <div className="relative w-full max-w-sm mx-auto aspect-[3/4] bg-green-700 bg-cover bg-center rounded-lg overflow-hidden border-4 border-green-900/50 flex flex-col-reverse justify-around p-2" style={{backgroundImage: "url('/pitch-vertical.svg')"}}>
                {[...sortedRows].reverse().map(row => (
                    <div key={row} className="flex justify-around items-center">
                        {formationGrid[row]?.map(p => <PlayerCard key={p.player.id || p.player.name} player={p.player} navigate={navigate} isAdmin={isAdmin} onRename={() => onRename('player', p.player.id, p.player.name, p.player.name)} />)}
                    </div>
                ))}
                 {ungriddedPlayers.length > 0 && (
                     <div className="flex justify-around items-center">
                        {ungriddedPlayers.map(p => <PlayerCard key={p.player.id || p.player.name} player={p.player} navigate={navigate} isAdmin={isAdmin} onRename={() => onRename('player', p.player.id, p.player.name, p.player.name)} />)}
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
                <CardContent className="p-3 text-center">
                    <h3 className="font-bold text-sm mb-2">المدرب</h3>
                     <div className="relative inline-flex flex-col items-center gap-1">
                        <Avatar className="h-12 w-12">
                            <AvatarImage src={activeLineup.coach.photo} />
                            <AvatarFallback>{activeLineup.coach.name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="font-semibold text-xs">{activeLineup.coach.name}</span>
                        {isAdmin && (
                            <Button variant="ghost" size="icon" className="absolute -top-1 -right-8 h-6 w-6" onClick={(e) => {e.stopPropagation(); onRename('coach', activeLineup.coach.id, activeLineup.coach.name, activeLineup.coach.name);}}>
                                <Pencil className="h-3 w-3" />
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {substitutionEvents.length > 0 && (
                <Card>
                    <CardHeader><CardTitle className="text-base text-center">التبديلات</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                        {substitutionEvents.map((event, index) => (
                            <div key={index} className="flex items-center justify-between text-xs p-1 border-b last:border-b-0">
                                <div className='font-bold w-10 text-center'>{event.time.elapsed}'</div>
                                <div className='flex-1 flex items-center justify-end gap-1 font-semibold text-red-500'>
                                    <span>{event.player.name}</span>
                                    <ArrowDown className="h-3 w-3"/>
                                </div>
                                <div className='flex-1 flex items-center justify-start gap-1 font-semibold text-green-500 ml-4'>
                                    <ArrowUp className="h-3 w-3"/>
                                    <span>{event.assist.name}</span>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}
            
            <div className="pt-4">
                <h3 className="text-center text-base font-bold mb-2">الاحتياط</h3>
                <div className="space-y-2">
                    {activeLineup.substitutes.map(p => (
                         <Card key={p.player.id || p.player.name} className="p-2 cursor-pointer" onClick={() => p.player.id && navigate('PlayerDetails', { playerId: p.player.id })}>
                            <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                    <AvatarImage src={p.player.photo} />
                                    <AvatarFallback>{p.player.name?.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-semibold text-sm">{p.player.name}</p>
                                    <p className="text-xs text-muted-foreground">{p.player.position}</p>
                                </div>
                                 {isAdmin && <Button variant="ghost" size="icon" className="mr-auto" onClick={(e) => {e.stopPropagation(); onRename('player', p.player.id, p.player.name, p.player.name)}}><Pencil className="h-4 w-4" /></Button>}
                            </div>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    );
};


const StandingsTab = ({ standings, homeTeamId, awayTeamId, navigate, loading }: { standings: Standing[] | null, homeTeamId: number, awayTeamId: number, navigate: ScreenProps['navigate'], loading: boolean }) => {
    if (loading) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
    if (!standings || standings.length === 0) return <p className="text-center text-muted-foreground p-8">الترتيب غير متاح لهذه البطولة حاليًا.</p>;
    
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead className="w-[40px]">#</TableHead>
                    <TableHead className="w-1/2 text-right">الفريق</TableHead>
                    <TableHead className="text-center">لعب</TableHead>
                    <TableHead className="text-center">ف/ت/خ</TableHead>
                    <TableHead className="text-center">نقاط</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {standings.map((s) => {
                    const isRelevantTeam = s.team.id === homeTeamId || s.team.id === awayTeamId;
                    return (
                        <TableRow key={s.team.id} className={cn(isRelevantTeam && "bg-primary/10", "cursor-pointer")} onClick={() => navigate('TeamDetails', { teamId: s.team.id })}>
                            <TableCell className="font-bold">{s.rank}</TableCell>
                            <TableCell>
                                <div className="flex items-center gap-2">
                                    <Avatar className="h-6 w-6"><AvatarImage src={s.team.logo} /></Avatar>
                                    <span className="font-semibold truncate">{s.team.name}</span>
                                </div>
                            </TableCell>
                            <TableCell className="text-center">{s.all.played}</TableCell>
                            <TableCell className="text-center text-xs">{`${s.all.win}/${s.all.draw}/${s.all.lose}`}</TableCell>
                            <TableCell className="text-center font-bold">{s.points}</TableCell>
                        </TableRow>
                    );
                })}
            </TableBody>
        </Table>
    );
};

const mergePlayerData = (baseLineups: LineupData[], detailedPlayers: { player: Player, statistics: any[] }[]): LineupData[] => {
    if (!detailedPlayers || detailedPlayers.length === 0 || !baseLineups || baseLineups.length === 0) {
        return baseLineups || [];
    }

    const playersMap = new Map<number, { player: Player, statistics: any[] }>();
    detailedPlayers.forEach(p => {
        if (p.player.id) {
            playersMap.set(p.player.id, p);
        }
    });

    const updatePlayerInList = (playerList: PlayerWithStats[]): PlayerWithStats[] => {
        if (!playerList) return [];
        return playerList.map(pWithStats => {
            if (!pWithStats || !pWithStats.player) return pWithStats;

            const lineupPlayer = pWithStats.player;
            if (lineupPlayer.id && playersMap.has(lineupPlayer.id)) {
                const detailedPlayerInfo = playersMap.get(lineupPlayer.id)!;
                const rating = detailedPlayerInfo.statistics?.[0]?.games?.rating;
                
                const mergedPlayer: PlayerType = {
                    ...lineupPlayer,
                    name: detailedPlayerInfo.player.name || lineupPlayer.name,
                    photo: detailedPlayerInfo.player.photo || lineupPlayer.photo,
                    rating: rating || lineupPlayer.rating,
                };
                return { ...pWithStats, player: mergedPlayer };
            }
            return pWithStats;
        });
    };

    return baseLineups.map(lineup => ({
        ...lineup,
        startXI: updatePlayerInList(lineup.startXI),
        substitutes: updatePlayerInList(lineup.substitutes),
    }));
};


interface MatchDetailScreenProps extends ScreenProps {
    fixtureId: string;
}

export default function MatchDetailScreen({ goBack, canGoBack, fixtureId, navigate }: MatchDetailScreenProps) {
    const [fixture, setFixture] = useState<Fixture | null>(null);
    const [standings, setStandings] = useState<Standing[] | null>(null);
    const [lineups, setLineups] = useState<LineupData[] | null>(null);
    const [events, setEvents] = useState<MatchEvent[] | null>(null);
    const [statistics, setStatistics] = useState<MatchStatistics[] | null>(null);
    const [playersDetails, setPlayersDetails] = useState<{player: Player, statistics: any[]}[] | null>(null);
    const [customStatus, setCustomStatus] = useState<string | null>(null);
    const [customNames, setCustomNames] = useState<{ [key: string]: Map<number, string> } | null>(null);

    const [loadingFixture, setLoadingFixture] = useState(true);
    const [loadingDetails, setLoadingDetails] = useState(true);
    const [loadingStandings, setLoadingStandings] = useState(true);
    
    const { isAdmin, db } = useAdmin();
    const { toast } = useToast();
    const [renameItem, setRenameItem] = useState<{ type: RenameType, id: number, name: string, originalName: string } | null>(null);

    const handleSaveRename = (type: RenameType, id: number, newName: string) => {
        if (!isAdmin || !db || !renameItem) return;
        const collectionName = `${type}Customizations`;
        const docRef = doc(db, collectionName, String(id));
        const originalName = renameItem.originalName;

        const operation = newName && newName !== originalName ? setDoc(docRef, { customName: newName }) : deleteDoc(docRef);

        operation.then(() => {
            toast({ title: `تم تعديل الاسم`, description: 'قد تحتاج لإعادة التحميل لرؤية التغييرات فوراً.' });
            // Optimistically update local state for immediate feedback
            setCustomNames(prev => {
                if (!prev) return null;
                const newMap = new Map(prev[type]);
                if (newName && newName !== originalName) {
                    newMap.set(id, newName);
                } else {
                    newMap.delete(id);
                }
                return { ...prev, [type]: newMap };
            });
        }).catch((error) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: docRef.path,
                operation: (newName && newName !== originalName) ? 'create' : 'delete',
                requestResourceData: { customName: newName }
            }));
        });
        setRenameItem(null);
    };

    const getDisplayName = useCallback((type: 'team' | 'league' | 'player' | 'coach', id: number, defaultName: string) => {
        const nameFromCustom = customNames?.[type]?.get(id);
        if (nameFromCustom) return nameFromCustom;

        const nameFromHardcoded = hardcodedTranslations[`${type}s` as const]?.[id];
        return nameFromHardcoded || defaultName;
    }, [customNames]);
    
    
    useEffect(() => {
        const controller = new AbortController();
        const signal = controller.signal;

        const fetchInitialFixture = async () => {
            setLoadingFixture(true);
            try {
                const response = await fetch(`/api/football/fixtures?id=${fixtureId}`, { signal });
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data = await response.json();

                if (signal.aborted) return;
                setFixture(data.response[0] || null);
            } catch (error) {
                if (!signal.aborted) console.error("Could not fetch fixture:", error);
            } finally {
                if (!signal.aborted) setLoadingFixture(false);
            }
        };

        fetchInitialFixture();
        return () => controller.abort();
    }, [fixtureId]);
    
    useEffect(() => {
        if (!fixture || !db) return;

        const controller = new AbortController();
        const signal = controller.signal;
        
        const fetchAllNamesAndDetails = async () => {
             setLoadingDetails(true);
             try {
                const namesPromise = Promise.all([
                    getDocs(collection(db, "leagueCustomizations")),
                    getDocs(collection(db, "teamCustomizations")),
                    getDocs(collection(db, "playerCustomizations")),
                    getDocs(collection(db, "coachCustomizations")),
                ]);
                
                const detailsPromise = Promise.all([
                    fetch(`/api/football/fixtures/lineups?fixture=${fixture.fixture.id}`, { signal }),
                    fetch(`/api/football/fixtures/events?fixture=${fixture.fixture.id}`, { signal }),
                    fetch(`/api/football/fixtures/statistics?fixture=${fixture.fixture.id}`, { signal }),
                    fetch(`/api/football/players?fixture=${fixture.fixture.id}`, { signal }),
                ]);

                const [namesSnapshots, detailsResponses] = await Promise.all([namesPromise, detailsPromise]);
                if (signal.aborted) return;
                
                const [leaguesSnapshot, teamsSnapshot, playersSnapshot, coachSnapshot] = namesSnapshots;
                const names: { [key: string]: Map<number, string> } = {
                    league: new Map(leaguesSnapshot.docs.map(d => [Number(d.id), d.data().customName])),
                    team: new Map(teamsSnapshot.docs.map(d => [Number(d.id), d.data().customName])),
                    player: new Map(playersSnapshot.docs.map(d => [Number(d.id), d.data().customName])),
                    coach: new Map(coachSnapshot.docs.map(d => [Number(d.id), d.data().customName])),
                };
                setCustomNames(names);
                
                const [lineupsRes, eventsRes, statsRes, playersRes] = detailsResponses;
                const lineupsData = await lineupsRes.json();
                const eventsData = await eventsRes.json();
                const statsData = await statsRes.json();
                const playersData = await playersRes.json();

                if (signal.aborted) return;

                setLineups(lineupsData.response);
                setEvents(eventsData.response);
                setStatistics(statsData.response);
                setPlayersDetails(playersData.response);

             } catch (error) {
                if (!signal.aborted) console.error("Could not fetch match details:", error);
             } finally {
                if (!signal.aborted) setLoadingDetails(false);
             }
        };

        const fetchStandings = async () => {
            setLoadingStandings(true);
            try {
                const response = await fetch(`/api/football/standings?league=${fixture.league.id}&season=${fixture.league.season}`, { signal });
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data = await response.json();
                if (signal.aborted) return;
                setStandings(data.response[0]?.league?.standings?.[0] || null);
            } catch (error) {
                if (!signal.aborted) console.error("Could not fetch standings:", error);
            } finally {
                 if (!signal.aborted) setLoadingStandings(false);
            }
        };
        
        const customStatusUnsub = onSnapshot(doc(db, "matchCustomizations", fixture.fixture.id.toString()), (doc) => {
            if (doc.exists()) {
                setCustomStatus(doc.data().customStatus);
            } else {
                setCustomStatus(null);
            }
        });

        fetchAllNamesAndDetails();
        fetchStandings();

        return () => {
            controller.abort();
            customStatusUnsub();
        };
    }, [fixture, db]);
    

    const mergedLineups = useMemo(() => {
        if (lineups && playersDetails) {
            return mergePlayerData(lineups, playersDetails)
        }
        return lineups;
    }, [lineups, playersDetails]);
    
    const processedFixture = useMemo(() => {
        if (!fixture) return null;
        return {
            ...fixture,
            league: { ...fixture.league, name: getDisplayName('league', fixture.league.id, fixture.league.name) },
            teams: {
                home: { ...fixture.teams.home, name: getDisplayName('team', fixture.teams.home.id, fixture.teams.home.name) },
                away: { ...fixture.teams.away, name: getDisplayName('team', fixture.teams.away.id, fixture.teams.away.name) }
            }
        };
    }, [fixture, getDisplayName]);

    const processedStandings = useMemo(() => {
        if (!standings) return null;
        return standings.map(s => ({
            ...s,
            team: {
                ...s.team,
                name: getDisplayName('team', s.team.id, s.team.name),
            }
        }));
    }, [standings, getDisplayName]);
    
    const handleOpenRename = (type: RenameType, id: number, originalName: string) => {
        const currentName = getDisplayName(type as 'player' | 'coach' | 'team' | 'league', id, originalName);
        setRenameItem({ type, id, name: currentName, originalName });
    };

    if (loadingFixture) {
        return (
            <div>
                <ScreenHeader title={'تفاصيل المباراة'} onBack={goBack} canGoBack={canGoBack} />
                <div className="p-4"><Skeleton className="h-48 w-full" /></div>
            </div>
        );
    }

    if (!processedFixture) {
        return (
            <div>
                <ScreenHeader title={'تفاصيل المباراة'} onBack={goBack} canGoBack={canGoBack} />
                <p className="text-center text-muted-foreground p-8">لم يتم العثور على المباراة.</p>
            </div>
        );
    }
    
    const homeTeamId = processedFixture.teams.home.id;
    const awayTeamId = processedFixture.teams.away.id;
    
    return (
        <div>
            <ScreenHeader title={'تفاصيل المباراة'} onBack={goBack} canGoBack={canGoBack} actions={
                isAdmin && (
                    <Button variant="ghost" size="icon" onClick={() => handleOpenRename('status', processedFixture.fixture.id, customStatus || '')}><Pencil className="h-4 w-4" /></Button>
                )
            } />
             {renameItem && <RenameDialog isOpen={!!renameItem} onOpenChange={() => setRenameItem(null)} item={{...renameItem, purpose: 'rename'}} onSave={(type, id, name) => handleSaveRename(type, Number(id), name)} />}
            <div className="container mx-auto p-4">
                <MatchHeaderCard fixture={processedFixture} navigate={navigate} customStatus={customStatus} />
                <Tabs defaultValue="details" className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="details">{'التفاصيل'}</TabsTrigger>
                        <TabsTrigger value="lineups">{'التشكيلات'}</TabsTrigger>
                        <TabsTrigger value="timeline">{'الأحداث'}</TabsTrigger>
                        <TabsTrigger value="standings">{'الترتيب'}</TabsTrigger>
                    </TabsList>
                    <TabsContent value="details" className="pt-4">
                        <DetailsTab fixture={processedFixture} statistics={statistics} loading={loadingDetails} />
                    </TabsContent>
                    <TabsContent value="lineups" className="pt-4">
                        <LineupsTab lineups={mergedLineups} events={events} navigate={navigate} isAdmin={isAdmin} onRename={handleOpenRename} homeTeamId={homeTeamId} awayTeamId={awayTeamId} />
                    </TabsContent>
                    <TabsContent value="timeline" className="pt-4">
                        <TimelineTab events={events} homeTeam={processedFixture.teams.home} awayTeam={processedFixture.teams.away} />
                    </TabsContent>
                    <TabsContent value="standings" className="pt-4">
                        <StandingsTab standings={processedStandings} homeTeamId={homeTeamId} awayTeamId={awayTeamId} navigate={navigate} loading={loadingStandings} />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}

// Ensure you have a valid fallback for useTranslation if LanguageProvider is not setup
const useTranslation = () => ({ t: (key: string) => key });
