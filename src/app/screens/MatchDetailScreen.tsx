

"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ScreenProps } from '@/app/page';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import type { Fixture, Standing, LineupData, MatchEvent, MatchStatistics, PlayerWithStats, Player as PlayerType, MatchCustomization } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shirt, ArrowRight, ArrowLeft, Square, Clock, Loader2, Users, BarChart, ShieldCheck, ArrowUp, ArrowDown, TrendingUp, Pencil } from 'lucide-react';
import { FootballIcon } from '@/components/icons/FootballIcon';
import { Progress } from '@/components/ui/progress';
import { LiveMatchStatus } from '@/components/LiveMatchStatus';
import { CURRENT_SEASON } from '@/lib/constants';
import { OddsTab } from '@/components/OddsTab';
import { useTranslation } from '@/components/LanguageProvider';
import { useAdmin, useFirestore } from '@/firebase/provider';
import { RenameDialog } from '@/components/RenameDialog';
import { doc, setDoc, deleteDoc, writeBatch, getDocs, collection, onSnapshot, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { Button } from '@/components/ui/button';

type RenameType = 'player' | 'coach' | 'team' | 'league' | 'continent' | 'country' | 'matchStatus';


const PlayerCard = ({ player, navigate, onRename, isAdmin }: { player: PlayerType, navigate: ScreenProps['navigate'], onRename: () => void, isAdmin: boolean }) => {
    const { t } = useTranslation();
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
            <span className="mt-1 text-[10px] font-semibold text-center truncate w-16">{player?.name || t('unknown')}</span>
        </div>
    );
};


const MatchHeaderCard = ({ fixture, navigate, onRename, customStatus, isAdmin }: { fixture: Fixture, navigate: ScreenProps['navigate'], onRename: () => void, customStatus: string | null, isAdmin: boolean }) => {
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
                     <div className="flex flex-col items-center justify-center min-w-[120px] text-center">
                        <LiveMatchStatus fixture={fixture} customStatus={customStatus} large />
                         {isAdmin && (
                            <Button variant="ghost" size="icon" className="h-6 w-6 mt-1" onClick={onRename}>
                                <Pencil className="h-3 w-3" />
                            </Button>
                        )}
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

const DetailsTab = ({ fixture, statistics }: { fixture: Fixture | null, statistics: MatchStatistics[] | null }) => {
    const { t } = useTranslation();
    if (!fixture) return <Skeleton className="h-40 w-full" />;

    const homeStats = statistics?.find(s => s.team.id === fixture.teams.home.id)?.statistics || [];
    const awayStats = statistics?.find(s => s.team.id === fixture.teams.away.id)?.statistics || [];

    const findStat = (stats: any[], type: string) => stats.find(s => s.type === type)?.value ?? '0';

    const statMapping: { label: string; type: string; isProgress?: boolean }[] = [
      { label: t('possession'), type: "Ball Possession", isProgress: true },
      { label: t('total_shots'), type: "Total Shots" },
      { label: t('shots_on_goal'), type: "Shots on Goal" },
      { label: t('shots_off_goal'), type: "Shots off Goal" },
      { label: t('blocked_shots'), type: "Blocked Shots"},
      { label: t('fouls'), type: "Fouls" },
      { label: t('yellow_cards'), type: "Yellow Cards" },
      { label: t('red_cards'), type: "Red Cards" },
      { label: t('corner_kicks'), type: "Corner Kicks" },
      { label: t('offsides'), type: "Offsides" },
    ];

    return (
        <div className="space-y-4">
            <Card>
                <CardContent className="p-4 text-sm">
                    <div className="flex justify-between py-2 border-b">
                        <span className="font-semibold">{fixture.fixture.venue.name || t('not_specified')}</span>
                        <span className="text-muted-foreground">{t('stadium')}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                        <span className="font-semibold">{fixture.league.round}</span>
                        <span className="text-muted-foreground">{t('round')}</span>
                    </div>
                    <div className="flex justify-between py-2">
                        <span className="font-semibold">{t(fixture.fixture.status.long.toLowerCase().replace(/ /g, '_')) || fixture.fixture.status.long}</span>
                        <span className="text-muted-foreground">{t('status')}</span>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-4 space-y-4">
                    <h3 className="font-bold text-center">{t('match_stats')}</h3>
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
                                            <Progress value={awayVal} indicatorClassName="bg-accent rounded-r-full" className="rounded-r-full" style={{transform: 'rotate(180deg)'}}/>
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
                       <p className="text-center text-muted-foreground p-4">{t('stats_not_available')}</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};


const TimelineTabContent = ({ events, homeTeamId, highlightsOnly }: { events: MatchEvent[] | null, homeTeamId: number, highlightsOnly: boolean }) => {
    const { t } = useTranslation();
    if (!events) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
    
    const filteredEvents = useMemo(() => {
        if (!highlightsOnly) return events;
        return events.filter(e => e.type === 'Goal' || (e.type === 'Card' && e.detail.includes('Red')));
    }, [events, highlightsOnly]);

    if (filteredEvents.length === 0) {
        const message = highlightsOnly ? t('no_goals_or_red_cards') : t('no_major_events_yet');
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
                                             <div className={cn("flex items-center gap-1 text-xs text-muted-foreground", isHomeEvent ? "flex-row-reverse" : "")}>
                                                {isHomeEvent ? <ArrowUp className="h-3 w-3 text-green-500"/> : <ArrowDown className="h-3 w-3 text-red-500"/>}
                                                <span>{t('substitution_for')} {event.assist.name}</span>
                                             </div>
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
    const { t } = useTranslation();
    return (
        <Tabs defaultValue="highlights" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="highlights">{t('highlights')}</TabsTrigger>
                <TabsTrigger value="all">{t('all_events')}</TabsTrigger>
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
    const { t } = useTranslation();
    const [activeTeamTab, setActiveTeamTab] = useState<'home' | 'away'>('home');

    if (lineups === null) {
        return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
    }
    
    if (lineups.length < 2) {
        return <p className="text-center text-muted-foreground p-8">{t('lineups_not_available')}</p>;
    }

    const home = lineups.find(l => l.team.id === lineups[0].team.id);
    const away = lineups.find(l => l.team.id !== lineups[0].team.id);
    
    if (!home || !away) return <p className="text-center text-muted-foreground p-8">{t('lineups_incomplete')}</p>;

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
                {sortedRows.map(row => (
                    <div key={row} className="flex justify-around items-center">
                        {formationGrid[row]?.map(p => <PlayerCard key={p.player.id || p.player.name} player={p.player} navigate={navigate} isAdmin={isAdmin} onRename={() => onRename('player', p.player.id, p.player.name)} />)}
                    </div>
                ))}
                 {ungriddedPlayers.length > 0 && (
                    <div className="flex justify-around items-center">
                        {ungriddedPlayers.map(p => <PlayerCard key={p.player.id || p.player.name} player={p.player} navigate={navigate} isAdmin={isAdmin} onRename={() => onRename('player', p.player.id, p.player.name)} />)}
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
            
            <div className="font-bold text-center text-muted-foreground text-sm">{t('formation')}: {activeLineup.formation}</div>
            
            {renderPitch(activeLineup)}
            
            <div className="bg-background">
                <h3 className="text-center text-base font-bold mb-2">{t('substitutes_and_changes')}</h3>
                <div className="bg-card/50 space-y-2 mb-4 rounded-lg p-2" style={{backgroundColor: '#000000'}}>
                    {substitutionEvents.map((event, index) => {
                        const playerOut = event.player;
                        const playerIn = event.assist;

                        return (
                             <div key={index} className="p-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 font-semibold w-2/5 text-red-500">
                                        <ArrowDown className="h-4 w-4" />
                                        <div className="flex flex-col items-start">
                                            <span className="truncate">{playerIn.name}</span>
                                        </div>
                                    </div>

                                    <div className="font-bold text-sm text-muted-foreground w-1/5 text-center">{event.time.elapsed}'</div>

                                    <div className="flex items-center gap-2 font-semibold w-2/5 flex-row-reverse text-green-500">
                                        <ArrowUp className="h-4 w-4" />
                                        <div className="flex flex-col items-end">
                                            <span className="truncate">{playerOut.name}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            
                <Card>
                    <CardContent className="p-3 text-center">
                        <h3 className="font-bold text-sm mb-2">{t('coach')}</h3>
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

                 <div className="space-y-4 pt-4">
                    <h3 className="text-center text-base font-bold">الاحتياط</h3>
                    <div className="bg-card/50 grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-lg p-2">
                        {activeLineup.substitutes.map(p => (
                            <div key={p.player.id || p.player.name} className="p-2 cursor-pointer" onClick={() => p.player.id && navigate('PlayerDetails', { playerId: p.player.id })}>
                                <div className="flex items-center gap-3">
                                    <PlayerCard player={p.player} navigate={navigate} isAdmin={isAdmin} onRename={() => onRename('player', p.player.id, p.player.name)} />
                                    <div className="flex-1 text-right">
                                        <p className="font-semibold text-sm">{p.player.name}</p>
                                        <p className="text-xs text-muted-foreground">{p.player.position}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};


const StandingsTab = ({ standings, fixture, navigate }: { standings: Standing[] | null, fixture: Fixture, navigate: ScreenProps['navigate'] }) => {
    const { t } = useTranslation();
    if (!standings) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
    if (standings.length === 0) return <p className="text-center text-muted-foreground p-8">{t('standings_not_available')}</p>;
    
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead className="w-[40px]">#</TableHead>
                    <TableHead className="w-1/2 text-right">{t('team')}</TableHead>
                    <TableHead className="text-center">{t('played_short')}</TableHead>
                    <TableHead className="text-center">{t('w_d_l')}</TableHead>
                    <TableHead className="text-center">{t('points')}</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {standings.map((s) => {
                    const isRelevantTeam = s.team.id === fixture.teams.home.id || s.team.id === fixture.teams.away.id;
                    return (
                        <TableRow key={s.team.id} className={cn(isRelevantTeam && "bg-primary/10", "cursor-pointer")} onClick={() => navigate('TeamDetails', { teamId: s.team.id })}>
                            <TableCell className="font-bold">{s.rank}</TableCell>
                            <TableCell className="font-medium">
                                <div className="flex items-center gap-2 justify-end">
                                    <span className="truncate">{s.team.name}</span>
                                    <Avatar className="h-6 w-6"><AvatarImage src={s.team.logo} /></Avatar>
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

const mergePlayerData = (lineups: LineupData[], playersData: { player: Player, statistics: any[] }[]): LineupData[] => {
    if (!playersData || playersData.length === 0 || !lineups || lineups.length === 0) {
        return lineups;
    }

    const playersMap = new Map<number, { player: Player, statistics: any[] }>();
    playersData.forEach(p => {
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

    return lineups.map(lineup => ({
        ...lineup,
        startXI: updatePlayerInList(lineup.startXI),
        substitutes: updatePlayerInList(lineup.substitutes)
    }));
};


export function MatchDetailScreen({ navigate, goBack, canGoBack, fixtureId, fixture: initialFixture }: ScreenProps & { fixtureId: number, fixture?: Fixture }) {
    const { isAdmin, db } = useAdmin();
    const { toast } = useToast();
    const [fixture, setFixture] = useState<Fixture | null>(initialFixture || null);
    const [lineups, setLineups] = useState<LineupData[] | null>(null);
    const [events, setEvents] = useState<MatchEvent[] | null>(null);
    const [statistics, setStatistics] = useState<MatchStatistics[] | null>(null);
    const [standings, setStandings] = useState<Standing[] | null>(null);
    const [customStatus, setCustomStatus] = useState<string | null>(null);
    const [loading, setLoading] = useState(!initialFixture);
    const { t } = useTranslation();
    const [renameItem, setRenameItem] = useState<{ type: RenameType, id: number, name: string, originalName?: string } | null>(null);
    const [customNames, setCustomNames] = useState<{ [key: string]: Map<number, string> }>({});

    const applyCustomNamesToFixture = useCallback((fixtureToUpdate: Fixture | null, names: { [key: string]: Map<number, string> }) => {
        if (!fixtureToUpdate) return null;
        return {
            ...fixtureToUpdate,
            league: {
                ...fixtureToUpdate.league,
                name: names.league?.get(fixtureToUpdate.league.id) || fixtureToUpdate.league.name,
            },
            teams: {
                home: { ...fixtureToUpdate.teams.home, name: names.team?.get(fixtureToUpdate.teams.home.id) || fixtureToUpdate.teams.home.name },
                away: { ...fixtureToUpdate.teams.away, name: names.team?.get(fixtureToUpdate.teams.away.id) || fixtureToUpdate.teams.away.name },
            }
        };
    }, []);

    const fetchData = useCallback(async (isInitialLoad: boolean) => {
        if (!fixtureId) return;
        if (isInitialLoad) setLoading(true);

        try {
             if (isInitialLoad && !fixture) {
                 const fixtureRes = await fetch(`/api/football/fixtures?id=${fixtureId}`);
                 const fixtureData = await fixtureRes.json();
                 const currentFixture = fixtureData.response?.[0];
                 if (!currentFixture) throw new Error("Fixture not found");
                 setFixture(currentFixture);
            }
           

            const [eventsRes, statisticsRes, lineupsRes, playersRes] = await Promise.all([
                fetch(`/api/football/fixtures/events?fixture=${fixtureId}`),
                fetch(`/api/football/fixtures/statistics?fixture=${fixtureId}`),
                fetch(`/api/football/fixtures/lineups?fixture=${fixtureId}`),
                fetch(`/api/football/fixtures/players?fixture=${fixtureId}`)
            ]);

            const eventsData = await eventsRes.json();
            const statisticsData = await statisticsRes.json();
            const lineupsData = await lineupsRes.json();
            const playersData = await playersRes.json();

            setEvents(eventsData.response || []);
            setStatistics(statisticsData.response || []);
            
            let finalLineups = lineupsData.response || [];
            const detailedPlayers = playersData.response || [];
            
            if (detailedPlayers.length > 0 && finalLineups.length > 0) {
                 const allPlayersFromFixture = detailedPlayers.flatMap((team: any) => team.players);
                 finalLineups = mergePlayerData(finalLineups, allPlayersFromFixture);
            }

            setLineups(finalLineups);
            
             setFixture(prevFixture => {
                if (!prevFixture) return null;
                const matchSeason = prevFixture.league?.season || CURRENT_SEASON;
                const currentLeagueId = prevFixture.league.id;
                
                if(currentLeagueId) {
                    fetch(`/api/football/standings?league=${currentLeagueId}&season=${matchSeason}`)
                        .then(res => res.json())
                        .then(standingsData => {
                             setStandings(standingsData?.response?.[0]?.league?.standings[0] || []);
                        });
                }
                return prevFixture;
            });
    
        } catch (error) {
            console.error("Failed to fetch match details:", error);
        } finally {
            if (isInitialLoad) setLoading(false);
        }
    }, [fixtureId, fixture]);
    
    // Fetch initial data
    useEffect(() => {
        fetchData(true);
    }, [fixtureId]); // Only run on initial load based on fixtureId
    
    // Apply custom names when they are fetched or fixture data changes
    useEffect(() => {
        const fetchAndApplyNames = async () => {
             if (!db || !fixture) return;

             try {
                const [teamsSnapshot, leaguesSnapshot] = await Promise.all([
                    getDocs(collection(db, 'teamCustomizations')),
                    getDocs(collection(db, 'leagueCustomizations'))
                ]);
                const teamNames = new Map();
                teamsSnapshot.forEach(doc => teamNames.set(Number(doc.id), doc.data().customName));
                const leagueNames = new Map();
                leaguesSnapshot.forEach(doc => leagueNames.set(Number(doc.id), doc.data().customName));
                
                const fetchedCustomNames = { team: teamNames, league: leagueNames };
                setCustomNames(fetchedCustomNames);

                setFixture(currentFixture => applyCustomNamesToFixture(currentFixture, fetchedCustomNames));

            } catch (e) {
                console.error("Error fetching custom names:", e);
            }
        };

        fetchAndApplyNames();
    }, [db, fixture?.fixture.id, applyCustomNamesToFixture]);


    useEffect(() => {
        if (!db || !fixtureId) return;
        const unsub = onSnapshot(doc(db, "matchCustomizations", String(fixtureId)), (doc) => {
            if (doc.exists()) {
                setCustomStatus(doc.data()?.customStatus || null);
            } else {
                setCustomStatus(null);
            }
        }, (error) => {
            console.error("Failed to listen to custom match status:", error);
        });
        return () => unsub();
    }, [db, fixtureId]);
    
    const handleOpenRename = (type: RenameType, id: number, name: string) => {
        setRenameItem({ type, id, name, originalName: name });
    };

    const handleSaveRename = (newName: string, note?: string) => {
        if (!renameItem || !db) return;
        const { id, type } = renameItem;

        if (type === 'matchStatus') {
            const docRef = doc(db, 'matchCustomizations', String(id));
            if(newName && newName.trim().length > 0) {
                setDoc(docRef, { customStatus: newName }).catch(serverError => {
                    const permissionError = new FirestorePermissionError({path: docRef.path, operation: 'create', requestResourceData: {customStatus: newName}});
                    errorEmitter.emit('permission-error', permissionError);
                });
            } else {
                deleteDoc(docRef).catch(serverError => {
                     const permissionError = new FirestorePermissionError({path: docRef.path, operation: 'delete'});
                     errorEmitter.emit('permission-error', permissionError);
                });
            }
            toast({ title: "نجاح", description: "تم تحديث حالة المباراة." });
            setRenameItem(null);
            return;
        }

        const collectionName = `${type}Customizations`;
        const docRef = doc(db, collectionName, String(id));
        const data = { customName: newName };

        setDoc(docRef, data)
            .then(() => {
                toast({ title: t('success_title'), description: `تم تحديث اسم ${type === 'player' ? 'اللاعب' : 'المدرب'}.` });
                fetchData(false); // Refetch data to show updated name
            })
            .catch(serverError => {
                const permissionError = new FirestorePermissionError({
                    path: docRef.path,
                    operation: 'create',
                    requestResourceData: data,
                });
                errorEmitter.emit('permission-error', permissionError);
            });

        setRenameItem(null);
    };


    if (loading && !fixture) {
        return (
            <div className="flex h-full flex-col bg-background">
                <ScreenHeader title={t('match_details_title')} onBack={goBack} canGoBack={canGoBack} />
                <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
            </div>
        );
    }
    
    if (!fixture) {
         return (
            <div className="flex h-full flex-col bg-background">
                <ScreenHeader title={t('error_title')} onBack={goBack} canGoBack={canGoBack} />
                <p className="text-center p-8">{t('match_not_found')}</p>
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col bg-background">
            <ScreenHeader title="" onBack={goBack} canGoBack={canGoBack} />
            
            {renameItem && (
                <RenameDialog
                    isOpen={!!renameItem}
                    onOpenChange={(isOpen) => !isOpen && setRenameItem(null)}
                    item={renameItem}
                    onSave={handleSaveRename}
                />
            )}

            <div className="flex-1 overflow-y-auto p-1">
                <MatchHeaderCard 
                    fixture={fixture} 
                    navigate={navigate} 
                    customStatus={customStatus} 
                    isAdmin={isAdmin}
                    onRename={() => handleOpenRename('matchStatus', fixture.fixture.id, customStatus || '')} 
                />
                <Tabs defaultValue="lineups" className="w-full">
                    <TabsList className="grid w-full grid-cols-5 rounded-lg h-auto p-1 bg-card">
                        <TabsTrigger value="details"><ShieldCheck className="w-4 h-4 ml-1" />{t('details')}</TabsTrigger>
                        <TabsTrigger value="odds"><TrendingUp className="w-4 h-4 ml-1" />{t('odds')}</TabsTrigger>
                        <TabsTrigger value="events"><Clock className="w-4 h-4 ml-1" />{t('events')}</TabsTrigger>
                        <TabsTrigger value="lineups"><Users className="w-4 h-4 ml-1" />{t('lineups')}</TabsTrigger>
                        <TabsTrigger value="standings"><BarChart className="w-4 h-4 ml-1" />{t('standings')}</TabsTrigger>
                    </TabsList>
                    <TabsContent value="details" className="mt-4"><DetailsTab fixture={fixture} statistics={statistics} /></TabsContent>
                    <TabsContent value="odds" className="mt-4"><OddsTab fixtureId={fixture.fixture.id} /></TabsContent>
                    <TabsContent value="events" className="mt-4"><TimelineTab events={events} homeTeamId={fixture.teams.home.id} /></TabsContent>
                    <TabsContent value="lineups" className="mt-4">
                        <LineupsTab lineups={lineups} events={events} navigate={navigate} isAdmin={isAdmin} onRename={handleOpenRename}/>
                    </TabsContent>
                    <TabsContent value="standings" className="mt-4"><StandingsTab standings={standings} fixture={fixture} navigate={navigate} /></TabsContent>
                </Tabs>
            </div>
        </div>
    );
}

    

    