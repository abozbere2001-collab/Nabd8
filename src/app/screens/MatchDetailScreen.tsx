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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shirt, ArrowRight, ArrowLeft, Square, Clock, Loader2, Users, BarChart, ShieldCheck, ArrowUp, ArrowDown, TrendingUp, Pencil } from 'lucide-react';
import { FootballIcon } from '@/components/icons/FootballIcon';
import { Progress } from '@/components/ui/progress';
import { LiveMatchStatus } from '@/components/LiveMatchStatus';
import { CURRENT_SEASON } from '@/lib/constants';
import { useAdmin, useFirestore } from '@/firebase/provider';
import { RenameDialog } from '@/components/RenameDialog';
import { doc, setDoc, deleteDoc, writeBatch, getDocs, collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { Button } from '@/components/ui/button';
import { OddsTab } from '@/components/OddsTab';

type RenameType = 'player' | 'coach' | 'team' | 'league' | 'continent' | 'country';


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
            <span className="mt-1 text-[11px] font-semibold text-center truncate w-16">{player?.name || 'غير معروف'}</span>
        </div>
    );
};


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

const ShotMap = ({ homeStats, awayStats }: { homeStats: any[], awayStats: any[] }) => {
    const findStat = (stats: any[], type: string): number => {
        const value = stats.find(s => s.type === type)?.value;
        if (typeof value === 'string') return parseInt(value, 10) || 0;
        return value || 0;
    };

    const homeShotsInside = findStat(homeStats, "Shots insidebox");
    const homeShotsOutside = findStat(homeStats, "Shots outsidebox");
    const awayShotsInside = findStat(awayStats, "Shots insidebox");
    const awayShotsOutside = findStat(awayStats, "Shots outsidebox");
    
    if ((homeShotsInside + homeShotsOutside + awayShotsInside + awayShotsOutside) === 0) {
        return null; // Don't render if there are no shot stats
    }


    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg text-center">خريطة التسديد</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="relative w-full max-w-sm mx-auto aspect-[3/2] bg-green-700 bg-cover bg-center rounded-lg overflow-hidden border-4 border-green-900/50" style={{backgroundImage: "url('/pitch-horizontal.svg')"}}>
                    {/* Home Team (Right side) */}
                    <div className="absolute right-[18%] top-1/2 -translate-y-1/2 text-center text-white">
                        <p className="font-bold text-2xl drop-shadow-lg">{homeShotsInside}</p>
                        <p className="text-xs">داخل المنطقة</p>
                    </div>
                     <div className="absolute right-[40%] top-1/2 -translate-y-1/2 text-center text-white">
                        <p className="font-bold text-2xl drop-shadow-lg">{homeShotsOutside}</p>
                         <p className="text-xs">خارج المنطقة</p>
                    </div>

                    {/* Away Team (Left side) */}
                     <div className="absolute left-[18%] top-1/2 -translate-y-1/2 text-center text-white">
                        <p className="font-bold text-2xl drop-shadow-lg">{awayShotsInside}</p>
                         <p className="text-xs">داخل المنطقة</p>
                    </div>
                    <div className="absolute left-[40%] top-1/2 -translate-y-1/2 text-center text-white">
                        <p className="font-bold text-2xl drop-shadow-lg">{awayShotsOutside}</p>
                        <p className="text-xs">خارج المنطقة</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

const DetailsTab = ({ fixture, statistics }: { fixture: Fixture | null, statistics: MatchStatistics[] | null }) => {
    if (!fixture) return <Skeleton className="h-40 w-full" />;

    const homeStats = statistics?.find(s => s.team.id === fixture.teams.home.id)?.statistics || [];
    const awayStats = statistics?.find(s => s.team.id === fixture.teams.away.id)?.statistics || [];

    const findStat = (stats: any[], type: string) => stats.find(s => s.type === type)?.value ?? '0';

    const statMapping: { label: string; type: string; isProgress?: boolean }[] = [
      { label: 'الاستحواذ', type: "Ball Possession", isProgress: true },
      { label: 'إجمالي التسديدات', type: "Total Shots" },
      { label: 'تسديدات على المرمى', type: "Shots on Goal" },
      { label: 'تسديدات خارج المرمى', type: "Shots off Goal" },
      { label: 'تسديدات محجوبة', type: "Blocked Shots"},
      { label: 'الأخطاء', type: "Fouls" },
      { label: 'بطاقات صفراء', type: "Yellow Cards" },
      { label: 'بطاقات حمراء', type: "Red Cards" },
      { label: 'ركنيات', type: "Corner Kicks" },
      { label: 'تسلل', type: "Offsides" },
    ];

    return (
        <div className="space-y-4">
             {statistics && statistics.length > 0 && (
                <ShotMap homeStats={homeStats} awayStats={awayStats} />
            )}
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
                       <p className="text-center text-muted-foreground p-4">الإحصائيات غير متاحة</p>
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
        const message = highlightsOnly ? 'لا توجد أهداف أو بطاقات حمراء' : 'لا توجد أحداث رئيسية بعد';
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

const LineupsTab = ({ lineups, events, navigate, isAdmin, onRename }: { lineups: LineupData[] | null; events: MatchEvent[] | null; navigate: ScreenProps['navigate'], isAdmin: boolean, onRename: (type: RenameType, id: number, name: string) => void }) => {
    const [activeTeamTab, setActiveTeamTab] = useState<'home' | 'away'>('home');

    if (lineups === null) {
        return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
    }
    
    if (lineups.length < 2) {
        return <p className="text-center text-muted-foreground p-8">التشكيلة غير متاحة</p>;
    }

    const home = lineups.find(l => l.team.id === lineups[0].team.id);
    const away = lineups.find(l => l.team.id !== lineups[0].team.id);
    
    if (!home || !away) return <p className="text-center text-muted-foreground p-8">بيانات التشكيلة غير مكتملة</p>;

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

        Object.keys(formationGrid).forEach(row => {
            formationGrid[parseInt(row)].sort((a,b) => parseInt(a.player.grid?.split(':')[1] || '0') - parseInt(b.player.grid?.split(':')[1] || '0'));
        });
        
        const sortedRows = Object.keys(formationGrid).map(Number).sort((a,b) => a-b);

        return (
            <div 
                className="relative w-full max-w-sm mx-auto aspect-[3/4] bg-green-800 bg-cover bg-center rounded-lg overflow-hidden border-4 border-green-900/50 flex flex-col justify-around p-2"
                style={{backgroundImage: `url('/pitch-vertical.svg')`}}
            >
                <div className="absolute inset-0 bg-black/30"></div>
                {[...sortedRows].reverse().map(row => (
                    <div key={row} className="relative z-10 flex justify-around items-center">
                        {formationGrid[row].map((p, i) => (
                            <PlayerCard key={p.player.id || i} player={p.player} navigate={navigate} onRename={() => onRename('player', p.player.id, p.player.name)} isAdmin={isAdmin} />
                        ))}
                    </div>
                ))}
                {ungriddedPlayers.length > 0 && (
                    <div className="relative z-10 flex justify-around items-center">
                        {ungriddedPlayers.map((p, i) => (
                             <PlayerCard key={p.player.id || i} player={p.player} navigate={navigate} onRename={() => onRename('player', p.player.id, p.player.name)} isAdmin={isAdmin} />
                        ))}
                    </div>
                )}
            </div>
        )
    }

    const substitutionEvents = events?.filter(e => e.type === 'subst' && e.team.id === activeLineup.team.id) || [];

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
                            <Button variant="ghost" size="icon" className="absolute -top-1 -right-8 h-6 w-6" onClick={(e) => {e.stopPropagation(); onRename('coach', activeLineup.coach.id, activeLineup.coach.name);}}>
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
                                 {isAdmin && <Button variant="ghost" size="icon" className="mr-auto" onClick={(e) => {e.stopPropagation(); onRename('player', p.player.id, p.player.name)}}><Pencil className="h-4 w-4" /></Button>}
                            </div>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    );
};


const StandingsTab = ({ standings, homeTeamId, awayTeamId, navigate, loading }: { standings: Standing[] | null, homeTeamId: number, awayTeamId: number, navigate: ScreenProps['navigate'], loading: boolean }) => {
    const { t } = useTranslation();
    if (loading) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
    if (!standings || standings.length === 0) return <p className="text-center text-muted-foreground p-8">{t('standings_not_available')}</p>;
    
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
    const [loading, setLoading] = useState(true);
    const [standingsLoading, setStandingsLoading] = useState(true);
    const [playersDetails, setPlayersDetails] = useState<{player: Player, statistics: any[]}[] | null>(null);
    
    const { isAdmin, db } = useAdmin();
    const { toast } = useToast();
    const [renameItem, setRenameItem] = useState<{ type: RenameType, id: number, name: string } | null>(null);

    const handleSaveRename = (type: RenameType, id: number, newName: string) => {
        if (!isAdmin || !db) return;
        const collectionName = `${type}Customizations`;
        const docRef = doc(db, collectionName, String(id));
        setDoc(docRef, { customName: newName })
            .then(() => toast({ title: `تم تغيير ${type}`, description: `تم حفظ التغييرات بنجاح.` }))
            .catch((error) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: docRef.path,
                    operation: 'create',
                    requestResourceData: { customName: newName }
                }));
            });
        setRenameItem(null);
    };

    useEffect(() => {
        const fetchFixture = async () => {
            setLoading(true);
            try {
                const response = await fetch(`/api/football/fixtures?id=${fixtureId}`);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                setFixture(data.response[0]);
            } catch (error) {
                console.error("Could not fetch fixture:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchFixture();
    }, [fixtureId]);

    useEffect(() => {
        if (!fixture) return;

        const fetchStandings = async () => {
            setStandingsLoading(true);
            try {
                const response = await fetch(`/api/football/standings?league=${fixture.league.id}&season=${fixture.league.season}`);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                setStandings(data.response[0]?.league?.standings?.[0] || null);
            } catch (error) {
                console.error("Could not fetch standings:", error);
            } finally {
                setStandingsLoading(false);
            }
        };

        fetchStandings();
    }, [fixture]);

    useEffect(() => {
        if (!fixture) return;

        const fetchAllMatchData = async () => {
             try {
                const [lineupsRes, eventsRes, statsRes, playersRes] = await Promise.all([
                    fetch(`/api/football/fixtures/lineups?fixture=${fixture.fixture.id}`),
                    fetch(`/api/football/fixtures/events?fixture=${fixture.fixture.id}`),
                    fetch(`/api/football/fixtures/statistics?fixture=${fixture.fixture.id}`),
                    fetch(`/api/football/players?fixture=${fixture.fixture.id}`)
                ]);
                
                const lineupsData = await lineupsRes.json();
                setLineups(lineupsData.response);

                const eventsData = await eventsRes.json();
                setEvents(eventsData.response);
                
                const statsData = await statsRes.json();
                setStatistics(statsData.response);
                
                const playersData = await playersRes.json();
                setPlayersDetails(playersData.response);

            } catch (error) {
                console.error("Could not fetch match details:", error);
            }
        };
        
        fetchAllMatchData();
    }, [fixture]);
    

    const mergedLineups = useMemo(() => {
        if (lineups && playersDetails) {
            return mergePlayerData(lineups, playersDetails)
        }
        return lineups;
    }, [lineups, playersDetails]);

    if (!fixture) {
        return (
            <div>
                <ScreenHeader title="تفاصيل المباراة" onBack={goBack} canGoBack={canGoBack} />
                <div className="container mx-auto p-4">
                    {loading ? (
                        <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                    ) : (
                        <p className="text-center text-muted-foreground p-8">تعذر جلب المباراة.</p>
                    )}
                </div>
            </div>
        );
    }
    
    const homeTeamId = fixture.teams.home.id;
    const awayTeamId = fixture.teams.away.id;

    return (
        <div>
            <ScreenHeader title="تفاصيل المباراة" onBack={goBack} canGoBack={canGoBack} />
             {renameItem && <RenameDialog isOpen={!!renameItem} onOpenChange={() => setRenameItem(null)} item={{...renameItem, purpose: 'rename'}} onSave={(type, id, name) => handleSaveRename(type, Number(id), name)} />}
            <div className="container mx-auto p-4">
                <MatchHeaderCard fixture={fixture} navigate={navigate} />
                <Tabs defaultValue="details" className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="details">تفاصيل</TabsTrigger>
                        <TabsTrigger value="lineups">التشكيلات</TabsTrigger>
                        <TabsTrigger value="timeline">الاحداث</TabsTrigger>
                        <TabsTrigger value="standings">الترتيب</TabsTrigger>
                    </TabsList>
                    <TabsContent value="details" className="pt-4">
                        <DetailsTab fixture={fixture} statistics={statistics} />
                    </TabsContent>
                    <TabsContent value="lineups" className="pt-4">
                        <LineupsTab lineups={mergedLineups} events={events} navigate={navigate} isAdmin={isAdmin} onRename={(type, id, name) => setRenameItem({ type, id, name })} />
                    </TabsContent>
                    <TabsContent value="timeline" className="pt-4">
                        <TimelineTab events={events} homeTeamId={homeTeamId} />
                    </TabsContent>
                    <TabsContent value="standings" className="pt-4">
                        <StandingsTab standings={standings} homeTeamId={homeTeamId} awayTeamId={awayTeamId} navigate={navigate} loading={standingsLoading} />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}

// Ensure you have a valid fallback for useTranslation if LanguageProvider is not setup
const useTranslation = () => ({ t: (key: string) => key });
```