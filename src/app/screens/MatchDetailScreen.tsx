
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
import { useFirestore } from '@/firebase/provider';
import type { Fixture, Standing, LineupData, MatchEvent, MatchStatistics, PlayerWithStats } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Shirt, ArrowRight, ArrowLeft, Square, Clock, Loader2 } from 'lucide-react';
import { FootballIcon } from '@/components/icons/FootballIcon';


// --- Reusable Components ---

const MatchHeaderCard = ({ fixture }: { fixture: Fixture }) => {
    const isLive = ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE'].includes(fixture.fixture.status.short);

    return (
        <Card className="mb-4 bg-card/80 backdrop-blur-sm">
            <CardContent className="p-4">
                <div className="flex justify-between items-center text-xs text-muted-foreground mb-3">
                    <div className="flex items-center gap-2">
                        <Avatar className="h-5 w-5"><AvatarImage src={fixture.league.logo} /></Avatar>
                        <span>{fixture.league.name}</span>
                    </div>
                    <span>{format(new Date(fixture.fixture.date), 'd MMMM yyyy', { locale: ar })}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 flex-1 justify-end truncate">
                        <span className="font-bold text-lg truncate">{fixture.teams.home.name}</span>
                        <Avatar className="h-12 w-12 border-2 border-primary/50"><AvatarImage src={fixture.teams.home.logo} /></Avatar>
                    </div>
                    <div className="flex flex-col items-center justify-center min-w-[90px] text-center">
                        {isLive ? (
                            <>
                                <div className="font-bold text-3xl tracking-wider">{`${fixture.goals.home ?? 0} - ${fixture.goals.away ?? 0}`}</div>
                                <div className="text-red-500 font-bold text-xs animate-pulse mt-1">
                                    {fixture.fixture.status.elapsed ? `${fixture.fixture.status.elapsed}'` : 'مباشر'}
                                </div>
                            </>
                        ) : (
                             <div className="font-bold text-2xl tracking-wider">{format(new Date(fixture.fixture.date), "HH:mm")}</div>
                        )}
                       
                    </div>
                    <div className="flex items-center gap-3 flex-1 truncate">
                         <Avatar className="h-12 w-12 border-2 border-primary/50"><AvatarImage src={fixture.teams.away.logo} /></Avatar>
                        <span className="font-bold text-lg truncate">{fixture.teams.away.name}</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

const PitchPlayer = ({ player, isHome, position, number }: { player: PlayerWithStats, isHome: boolean, position: {top: string, left?: string, right?: string}, number: number }) => (
    <div 
        className="absolute flex flex-col items-center group cursor-pointer"
        style={{ top: position.top, left: position.left, right: position.right, transform: 'translate(-50%, -50%)' }}
    >
        <div className="relative">
            <Avatar className="h-8 w-8 border-2" style={{ borderColor: isHome ? '#fff' : '#fef08a' }}>
                <AvatarImage src={player.player.photo} />
                <AvatarFallback>{player.player.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <span className="absolute -bottom-1 -right-1 text-white bg-black/70 rounded-full text-[10px] w-4 h-4 flex items-center justify-center font-bold">
                {number}
            </span>
        </div>
        <span className="text-white text-[10px] font-semibold bg-black/50 px-1.5 py-0.5 rounded-full mt-1 whitespace-nowrap truncate max-w-[60px]">{player.player.name}</span>
         <div className="absolute bottom-full mb-2 w-max bg-black/80 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            {player.player.name} - التقييم: {player.statistics[0].games.rating || 'N/A'}
        </div>
    </div>
);


const formationPositions: Record<string, { home: { top: string, left?: string, right?: string }[], away: { top: string, left?: string, right?: string }[] }> = {
    "4-3-3": {
        home: [
            { top: '92%' }, // GK
            { top: '75%', left: '20%' }, { top: '75%', left: '80%' }, { top: '70%', left: '40%' }, { top: '70%', left: '60%' }, // DEF
            { top: '50%', left: '25%' }, { top: '50%', left: '75%' }, { top: '50%', left: '50%' }, // MID
            { top: '25%', left: '20%' }, { top: '25%', left: '80%' }, { top: '20%', left: '50%' }  // FWD
        ],
        away: [
            { top: '8%' }, // GK
            { top: '25%', left: '20%' }, { top: '25%', left: '80%' }, { top: '30%', left: '40%' }, { top: '30%', left: '60%' }, // DEF
            { top: '50%', left: '25%' }, { top: '50%', left: '75%' }, { top: '50%', left: '50%' }, // MID
            { top: '75%', left: '20%' }, { top: '75%', left: '80%' }, { top: '80%', left: '50%' }  // FWD
        ]
    },
    "4-4-2": {
        home: [
            { top: '92%' }, { top: '75%', left: '20%' }, { top: '75%', left: '80%' }, { top: '70%', left: '40%' }, { top: '70%', left: '60%' },
            { top: '50%', left: '20%' }, { top: '50%', left: '80%' }, { top: '50%', left: '40%' }, { top: '50%', left: '60%' },
            { top: '25%', left: '40%' }, { top: '25%', left: '60%' }
        ],
        away: [
            { top: '8%' }, { top: '25%', left: '20%' }, { top: '25%', left: '80%' }, { top: '30%', left: '40%' }, { top: '30%', left: '60%' },
            { top: '50%', left: '20%' }, { top: '50%', left: '80%' }, { top: '50%', left: '40%' }, { top: '50%', left: '60%' },
            { top: '75%', left: '40%' }, { top: '75%', left: '60%' }
        ]
    },
     "4-2-3-1": {
        home: [
            { top: '92%' }, { top: '75%', left: '20%' }, { top: '75%', left: '80%' }, { top: '70%', left: '40%' }, { top: '70%', left: '60%' },
            { top: '60%', left: '40%' }, { top: '60%', left: '60%' },
            { top: '40%', left: '25%' }, { top: '40%', left: '75%' }, { top: '40%', left: '50%' },
            { top: '20%', left: '50%' }
        ],
        away: [
            { top: '8%' }, { top: '25%', left: '20%' }, { top: '25%', left: '80%' }, { top: '30%', left: '40%' }, { top: '30%', left: '60%' },
            { top: '40%', left: '40%' }, { top: '40%', left: '60%' },
            { top: '60%', left: '25%' }, { top: '60%', left: '75%' }, { top: '60%', left: '50%' },
            { top: '80%', left: '50%' }
        ]
    },
};


// --- Tabs ---

const DetailsTab = ({ fixture }: { fixture: Fixture | null }) => {
    if (!fixture) return <Skeleton className="h-20 w-full" />;
    return (
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
    );
};

const TimelineTab = ({ events }: { events: MatchEvent[] | null }) => {
    if (!events) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
    if (events.length === 0) return <p className="text-center text-muted-foreground p-8">لا توجد أحداث رئيسية في المباراة بعد.</p>;

    const getEventIcon = (event: MatchEvent) => {
        if(event.type === 'Goal') return <FootballIcon className="w-5 h-5 text-green-500" />;
        if(event.type === 'Card' && event.detail.includes('Yellow')) return <Square className="w-5 h-5 text-yellow-400 fill-current" />;
        if(event.type === 'Card' && event.detail.includes('Red')) return <Square className="w-5 h-5 text-red-500 fill-current" />;
        if(event.type === 'subst') return <div className="flex"><ArrowRight className="w-4 h-4 text-red-500" /><ArrowLeft className="w-4 h-4 text-green-500" /></div>
        return <Clock className="w-5 h-5 text-muted-foreground" />;
    }

    return (
        <div className="space-y-4">
            {events.map((event, index) => (
                <div key={index} className="flex items-center gap-4">
                    <div className="flex flex-col items-center">
                        <span className="text-xs font-bold">{event.time.elapsed}'</span>
                        <div className="w-px h-6 bg-border"></div>
                    </div>
                    <div className="flex-1 flex items-center gap-3 bg-card p-2 rounded-md border">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-background">
                            {getEventIcon(event)}
                        </div>
                        <div className="flex-1 text-sm">
                            <p className="font-semibold">{event.player.name}</p>
                            <p className="text-xs text-muted-foreground">{event.team.name} - {event.detail}</p>
                            {event.type === 'subst' && <p className="text-xs text-muted-foreground">خروج: {event.assist.name}</p>}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

const LineupsTab = ({ lineups }: { lineups: LineupData[] | null }) => {
    if (!lineups) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
    if (lineups.length < 2) return <p className="text-center text-muted-foreground p-8">التشكيلات غير متاحة حاليًا.</p>;
    
    const [home, away] = lineups;

    const homePositions = formationPositions[home.formation] ? formationPositions[home.formation].home : formationPositions["4-3-3"].home;
    const awayPositions = formationPositions[away.formation] ? formationPositions[away.formation].away : formationPositions["4-3-3"].away;

    return (
        <div className="space-y-6">
            <div className="relative w-full max-w-sm mx-auto aspect-[2/3] bg-green-700 bg-[url('/pitch.svg')] bg-cover bg-center rounded-lg overflow-hidden border-4 border-green-900/50">
                 {/* Home Team */}
                {home.startXI.map((p, i) => (
                     <PitchPlayer key={`home-${p.player.id}`} player={p} isHome={true} position={homePositions[i] || { top: '50%' }} number={p.player.number || 0} />
                ))}

                {/* Away Team */}
                {away.startXI.map((p, i) => (
                    <PitchPlayer key={`away-${p.player.id}`} player={p} isHome={false} position={awayPositions[i] || { top: '50%' }} number={p.player.number || 0} />
                ))}
            </div>

            {/* Substitutes */}
            <div className="grid grid-cols-2 gap-4">
                <Card>
                    <CardContent className="p-2">
                        <h3 className="font-bold text-center p-2">{home.team.name} (البدلاء)</h3>
                         {home.substitutes.map(p => (
                             <div key={p.player.id} className="flex items-center gap-2 p-1.5 text-xs border-b last:border-b-0">
                                 <Avatar className="h-6 w-6"><AvatarImage src={p.player.photo} /></Avatar>
                                 <span className="font-semibold">{p.player.name}</span>
                             </div>
                         ))}
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-2">
                        <h3 className="font-bold text-center p-2">{away.team.name} (البدلاء)</h3>
                         {away.substitutes.map(p => (
                             <div key={p.player.id} className="flex items-center gap-2 p-1.5 text-xs border-b last:border-b-0">
                                 <Avatar className="h-6 w-6"><AvatarImage src={p.player.photo} /></Avatar>
                                 <span className="font-semibold">{p.player.name}</span>
                             </div>
                         ))}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

const StandingsTab = ({ standings }: { standings: Standing[] | null }) => {
    if (!standings) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
    if (standings.length === 0) return <p className="text-center text-muted-foreground p-8">جدول الترتيب غير متاح لهذه البطولة.</p>;
    
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead className="w-[40px]">#</TableHead>
                    <TableHead className="w-1/2 text-right">الفريق</TableHead>
                    <TableHead className="text-center">لعب</TableHead>
                    <TableHead className="text-center">ف</TableHead>
                    <TableHead className="text-center">ت</TableHead>
                    <TableHead className="text-center">خ</TableHead>
                    <TableHead className="text-center">نقاط</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {standings.map((s) => (
                    <TableRow key={s.team.id}>
                        <TableCell>{s.rank}</TableCell>
                        <TableCell className="font-medium">
                            <div className="flex items-center gap-2 justify-end">
                                <span className="truncate">{s.team.name}</span>
                                <Avatar className="h-6 w-6"><AvatarImage src={s.team.logo} /></Avatar>
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

    const fetchData = useCallback(async () => {
        try {
            const endpoints = [
                `fixtures?id=${fixtureId}`,
                `fixtures/lineups?fixture=${fixtureId}`,
                `fixtures/events?fixture=${fixtureId}`,
                `standings?league=${fixture?.league.id}&season=${fixture?.league.season}`
            ];

            const [fixtureRes, lineupsRes, eventsRes, standingsRes] = await Promise.all(
                endpoints.map(endpoint => fetch(`/api/football/${endpoint}`))
            );
            
            const fixtureData = await fixtureRes.json();
            const lineupsData = await lineupsRes.json();
            const eventsData = await eventsRes.json();
            const standingsData = await standingsRes.json();
            
            if (fixtureData.response?.[0]) setFixture(fixtureData.response[0]);
            if (lineupsData.response) setLineups(lineupsData.response);
            if (eventsData.response) setEvents(eventsData.response);
            if (standingsData.response[0]?.league?.standings[0]) setStandings(standingsData.response[0].league.standings[0]);

        } catch (error) {
            console.error("Failed to fetch match details:", error);
        } finally {
            setLoading(false);
        }
    }, [fixtureId, fixture?.league.id, fixture?.league.season]);

    useEffect(() => {
        fetchData(); // Initial fetch
        const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
        return () => clearInterval(interval);
    }, [fetchData]);


    if (loading) {
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
            <div className="flex-1 overflow-y-auto p-4">
                <MatchHeaderCard fixture={fixture} />
                <Tabs defaultValue="details" className="w-full">
                    <TabsList className="grid w-full grid-cols-4 rounded-lg h-auto p-1 bg-card">
                        <TabsTrigger value="details">تفاصيل</TabsTrigger>
                        <TabsTrigger value="events">مُجريات</TabsTrigger>
                        <TabsTrigger value="lineups">التشكيل</TabsTrigger>
                        <TabsTrigger value="standings">الترتيب</TabsTrigger>
                    </TabsList>
                    <TabsContent value="details" className="mt-4"><DetailsTab fixture={fixture} /></TabsContent>
                    <TabsContent value="events" className="mt-4"><TimelineTab events={events} /></TabsContent>
                    <TabsContent value="lineups" className="mt-4"><LineupsTab lineups={lineups} /></TabsContent>
                    <TabsContent value="standings" className="mt-4"><StandingsTab standings={standings} /></TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
