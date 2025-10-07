"use client";

import React, { useEffect, useState, useMemo } from 'react';
import type { ScreenProps } from '@/app/page';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Share2, Star, Clock, User, ArrowLeftRight, RectangleVertical, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Image from 'next/image';

// --- TYPE DEFINITIONS ---
interface Fixture {
  fixture: {
    id: number;
    date: string;
    status: { short: string; long: string; elapsed: number | null };
  };
  league: { id: number; name: string; logo: string; round: string; };
  teams: {
    home: { id: number; name: string; logo: string; winner: boolean | null };
    away: { id: number; name: string; logo: string; winner: boolean | null };
  };
  goals: { home: number | null; away: number | null; };
}

interface LineupPlayer {
    player: { id: number; name: string; number: number; pos: string; grid: string | null; photo: string; };
}
interface Lineup {
  team: { id: number; name: string; logo: string; };
  coach: { id: number; name: string; photo: string; };
  formation: string;
  startXI: LineupPlayer[];
  substitutes: LineupPlayer[];
}

interface Event {
  time: { elapsed: number; extra: number | null; };
  team: { id: number; name: string; logo: string; };
  player: { id: number; name: string; };
  assist: { id: number | null; name: string | null; };
  type: 'Goal' | 'Card' | 'subst' | 'Var';
  detail: string;
  comments: string | null;
}

interface Statistic {
  type: string;
  value: number | string | null;
}

interface MatchStats {
  team: { id: number; name: string; logo: string; };
  statistics: Statistic[];
}

interface Standing {
  rank: number;
  team: { id: number; name: string; logo: string; };
  points: number;
  goalsDiff: number;
  group: string;
  form: string;
  status: string;
  description: string | null;
  all: { played: number; win: number; draw: number; lose: number; goals: { for: number; against: number; }; };
}

type EventFilter = "all" | "highlights";

const CURRENT_SEASON = new Date().getFullYear();

// --- API FETCH HOOK ---
function useMatchData(fixtureId?: number, leagueId?: number) {
  const [data, setData] = useState<{
    lineups: Lineup[] | null;
    events: Event[] | null;
    stats: MatchStats[] | null;
    standings: Standing[][] | null;
  }>({ lineups: null, events: null, stats: null, standings: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!fixtureId || !leagueId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [lineupsRes, eventsRes, statsRes, standingsRes] = await Promise.all([
          fetch(`/api/football/fixtures/lineups?fixture=${fixtureId}`),
          fetch(`/api/football/fixtures/events?fixture=${fixtureId}`),
          fetch(`/api/football/fixtures/statistics?fixture=${fixtureId}`),
          fetch(`/api/football/standings?league=${leagueId}&season=${CURRENT_SEASON}`),
        ]);

        const lineupsData = await lineupsRes.json();
        const eventsData = await eventsRes.json();
        const statsData = await statsRes.json();
        const standingsData = await standingsRes.json();
        
        setData({
          lineups: lineupsData.response || [],
          events: eventsData.response || [],
          stats: statsData.response || [],
          standings: standingsData.response?.[0]?.league?.standings || [],
        });
      } catch (error) {
        console.error("Failed to fetch match details:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [fixtureId, leagueId]);

  return { ...data, loading };
}

// --- SUB-COMPONENTS ---
const MatchHeader = ({ fixture, onBack, headerActions }: { fixture: Fixture; onBack: () => void, headerActions?: React.ReactNode }) => (
  <header className="relative bg-card text-foreground pt-10 pb-6 px-4 shadow-lg border-b">
    <div className="absolute top-4 right-4">
      <Button variant="ghost" size="icon" onClick={onBack} className="text-foreground/80 hover:bg-accent">
        <ArrowLeft />
      </Button>
    </div>
    <div className="absolute top-2 left-2 flex gap-1">
       {headerActions}
    </div>
    <div className="text-center text-sm text-muted-foreground mb-4">
        {fixture.league.name} - {fixture.league.round}
    </div>
    <div className="flex justify-around items-center">
      <div className="flex flex-col items-center gap-2 w-1/3 text-center">
        <Avatar className="w-16 h-16 border-2 border-border">
          <AvatarImage src={fixture.teams.home.logo} />
          <AvatarFallback>{fixture.teams.home.name.substring(0, 2)}</AvatarFallback>
        </Avatar>
        <span className="font-bold">{fixture.teams.home.name}</span>
      </div>
      <div className="text-center">
        <div className="text-4xl font-bold tracking-tight">
          {fixture.goals.home ?? '-'} : {fixture.goals.away ?? '-'}
        </div>
        <div className="text-xs text-muted-foreground mt-1">{fixture.fixture.status.long}</div>
      </div>
      <div className="flex flex-col items-center gap-2 w-1/3 text-center">
        <Avatar className="w-16 h-16 border-2 border-border">
          <AvatarImage src={fixture.teams.away.logo} />
          <AvatarFallback>{fixture.teams.away.name.substring(0, 2)}</AvatarFallback>
        </Avatar>
        <span className="font-bold">{fixture.teams.away.name}</span>
      </div>
    </div>
  </header>
);

const PlayerIcon = ({ player, isHomeTeam }: { player: LineupPlayer, isHomeTeam: boolean }) => {
    if (!player.player.grid) return null;

    const [row, col] = player.player.grid.split(':').map(Number);
    
    // Default alignment
    let top = '50%';
    let left = '50%';

    // Normalize grid positions.
    const xPos = (col / 5) * 100;
    const yPos = (row / 11) * 100;
    
    top = `${yPos}%`;
    left = `${xPos}%`;
    
    if (!isHomeTeam) {
       top = `${100 - yPos}%`;
       left = `${100 - xPos}%`;
    }


    return (
        <div 
          className="absolute text-center flex flex-col items-center transition-all duration-300" 
          style={{ 
            top: top, 
            left: left,
            width: '60px',
            transform: 'translate(-50%, -50%)',
          }}
        >
            <div className="relative">
                <Avatar className="w-10 h-10 border-2 bg-slate-800 border-white/50 shadow-md text-white font-bold flex items-center justify-center">
                   <AvatarImage src={player.player.photo} alt={player.player.name} />
                   <AvatarFallback>{player.player.pos ? player.player.pos.charAt(0) : 'P'}</AvatarFallback>
                </Avatar>
                <span className={cn(
                  "absolute -top-1 -right-1 text-white text-[9px] font-bold rounded-full h-4 w-4 flex items-center justify-center border-2 border-background",
                   isHomeTeam ? "bg-primary" : "bg-destructive"
                  )}>
                    {player.player.number}
                </span>
            </div>
            <span className="text-[10px] font-semibold bg-black/50 text-white rounded-sm px-1 py-0.5 mt-1 whitespace-nowrap shadow-lg truncate w-full">
                {player.player.name}
            </span>
        </div>
    );
};


const LineupsTab = ({ lineups, loading, fixture }: { lineups: Lineup[] | null, loading: boolean, fixture: Fixture }) => {
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(fixture.teams.home.id);

  if (loading) {
    return <Skeleton className="w-full h-[600px] rounded-lg m-4" />;
  }

  if (!lineups || lineups.length < 1) {
    return <p className="text-center text-muted-foreground p-8">التشكيلات غير متاحة.</p>;
  }
  
  const homeLineup = lineups.find(l => l.team.id === fixture.teams.home.id);
  const awayLineup = lineups.find(l => l.team.id === fixture.teams.away.id);

  const lineupToShow = selectedTeamId === fixture.teams.home.id ? homeLineup : awayLineup;

  if (!lineupToShow) {
      return <p className="text-center text-muted-foreground p-8">تشكيلة الفريق المحدد غير متاحة.</p>;
  }
  

  return (
    <div className="p-4 space-y-6">
      <div className="flex justify-center items-center gap-2">
       {homeLineup && (
         <Button
            variant={selectedTeamId === homeLineup.team.id ? "default" : "outline"}
            className="w-40 flex items-center gap-2"
            onClick={() => setSelectedTeamId(homeLineup.team.id)}
        >
            <Avatar className="w-6 h-6"><AvatarImage src={homeLineup.team.logo} /></Avatar>
            <span>{homeLineup.team.name}</span>
        </Button>
       )}
       {awayLineup && (
        <Button
            variant={selectedTeamId === awayLineup.team.id ? "default" : "outline"}
            className="w-40 flex items-center gap-2"
            onClick={() => setSelectedTeamId(awayLineup.team.id)}
        >
            <Avatar className="w-6 h-6"><AvatarImage src={awayLineup.team.logo} /></Avatar>
            <span>{awayLineup.team.name}</span>
        </Button>
       )}
      </div>

      <div className="space-y-4">
        <div 
            className="relative w-full max-w-md mx-auto aspect-[3/4] bg-cover bg-center rounded-lg overflow-hidden border-4 border-green-500/30 shadow-2xl" 
            style={{
                backgroundImage: "url(/football-pitch-3d.svg)",
                backgroundSize: '100% 100%',
            }}
        >
          {lineupToShow?.startXI.map(p => (
              <PlayerIcon key={p.player.id} player={p} isHomeTeam={lineupToShow.team.id === fixture.teams.home.id} />
          ))}
          <div className="absolute bottom-2 right-2 bg-black/50 text-white text-sm font-bold px-2 py-1 rounded">
             {lineupToShow?.formation}
          </div>
        </div>
      </div>
      
      <div className="p-2 rounded-lg bg-card border">
        <h4 className="font-bold mb-2 text-base px-2">طاقم التدريب</h4>
        <div className="space-y-2">
            <div className="flex items-center gap-3 p-2 rounded-md">
                <Avatar className="w-10 h-10">
                <AvatarImage src={lineupToShow.coach.photo} alt={lineupToShow.coach.name} />
                <AvatarFallback>{lineupToShow.coach.name.substring(0,1)}</AvatarFallback>
                </Avatar>
                <div>
                    <p className="font-medium">{lineupToShow.coach.name}</p>
                    <p className="text-xs text-muted-foreground">المدرب</p>
                </div>
            </div>
        </div>
      </div>

      <div className="p-2 rounded-lg bg-card border">
         <h4 className="font-bold mb-2 text-base px-2">البدلاء</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {lineupToShow.substitutes.map(s => (
            <div key={s.player.id} className="flex items-center gap-2 text-xs p-1 rounded-md hover:bg-muted">
                <span className="text-muted-foreground w-6 text-center font-mono">{s.player.number}</span>
                <Avatar className="w-6 h-6">
                    <AvatarImage src={s.player.photo} />
                    <AvatarFallback>{s.player.name.substring(0,1)}</AvatarFallback>
                </Avatar>
                <span className="font-medium truncate">{s.player.name}</span>
            </div>
            ))}
        </div>
      </div>
    </div>
  );
};


const StatsTab = ({ stats, loading, fixture }: { stats: MatchStats[] | null, loading: boolean, fixture: Fixture }) => {
    if (loading) return <Skeleton className="w-full h-96 m-4" />;
    
    const homeStatsData = stats?.find(s => s.team.id === fixture.teams.home.id);
    const awayStatsData = stats?.find(s => s.team.id === fixture.teams.away.id);
    
    if (!stats || !homeStatsData || !awayStatsData) return <p className="text-center p-8">الإحصائيات غير متاحة.</p>;

    const homeStats = homeStatsData.statistics;
    const awayStats = awayStatsData.statistics;

    const statTypes = [
        "Ball Possession", "Total Shots", "Shots on Goal", "Shots off Goal", "Blocked Shots", "Shots insidebox", "Shots outsidebox",
        "Fouls", "Corner Kicks", "Offsides", "Yellow Cards", "Red Cards",
        "Goalkeeper Saves", "Total passes", "Passes accurate"
    ];
    
    const combinedStats = statTypes.map(type => {
        const homeStat = homeStats.find(s => s.type === type);
        const awayStat = awayStats.find(s => s.type === type);
        return {
            type,
            homeValue: homeStat?.value ?? 0,
            awayValue: awayStat?.value ?? 0,
        };
    }).filter(s => s.homeValue !== null || s.awayValue !== null);

    return (
        <div className="p-4 space-y-4">
            {combinedStats.map(({ type, homeValue, awayValue }) => {
                const home = Number(String(homeValue).replace('%', ''));
                const away = Number(String(awayValue).replace('%', ''));
                const total = home + away;
                const homePercentage = type === 'Ball Possession' ? home : (total > 0 ? (home / total) * 100 : 50);
                
                return (
                    <div key={type}>
                        <div className="flex justify-between items-center mb-1 text-sm font-semibold px-1">
                            <span>{homeValue ?? 0}</span>
                            <span className="text-muted-foreground text-xs">{type}</span>
                            <span>{awayValue ?? 0}</span>
                        </div>
                        <div className="flex items-center w-full bg-muted rounded-full h-2">
                           <div style={{ width: `${homePercentage}%`}} className="bg-primary h-2 rounded-l-full"></div>
                           <div style={{ width: `${100 - homePercentage}%`}} className="bg-destructive h-2 rounded-r-full"></div>
                        </div>
                    </div>
                )
            })}
        </div>
    );
};

const StandingsTab = ({ standings, loading, fixture }: { standings: Standing[][] | null, loading: boolean, fixture: Fixture }) => {
    if (loading) return <Skeleton className="w-full h-96 m-4" />;
    if (!standings || standings.length === 0) return <p className="text-center p-8">الترتيب غير متاح.</p>;

    return (
        <div className="p-4">
            {standings.map((group, index) => (
                <div key={index} className="mb-6">
                    <h3 className="font-bold text-lg mb-2">{group[0]?.group || fixture.league.name}</h3>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-1/2 text-right">الفريق</TableHead>
                                <TableHead className="text-center">ل</TableHead>
                                <TableHead className="text-center">ف</TableHead>
                                <TableHead className="text-center">ت</TableHead>
                                <TableHead className="text-center">خ</TableHead>
                                <TableHead className="text-center">ن</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {group.map((s) => (
                                <TableRow key={s.team.id} className={s.team.id === fixture.teams.home.id || s.team.id === fixture.teams.away.id ? 'bg-primary/10' : ''}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            <span>{s.rank}</span>
                                            <Avatar className="h-6 w-6">
                                                <AvatarImage src={s.team.logo} alt={s.team.name} />
                                                <AvatarFallback>{s.team.name.substring(0, 1)}</AvatarFallback>
                                            </Avatar>
                                            <span className="truncate">{s.team.name}</span>
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
                </div>
            ))}
        </div>
    );
};

const EventsTab = ({ events, fixture, loading, filter }: { events: Event[] | null, fixture: Fixture, loading: boolean, filter: EventFilter }) => {
    if (loading) return <Skeleton className="w-full h-96 m-4" />;
    if (!events || events.length === 0) return <p className="text-center p-8">لا توجد أحداث رئيسية.</p>;

    const filteredEvents = useMemo(() => (events || [])
        .filter(event => {
            if (filter === 'highlights') {
                return event.type === 'Goal' || event.detail === 'Red Card';
            }
            return true;
        })
        .sort((a, b) => b.time.elapsed - a.time.elapsed), [events, filter]);

    if (filteredEvents.length === 0) {
        return <p className="text-center p-8">لا توجد أحداث بارزة.</p>;
    }


    const getEventIcon = (event: Event) => {
        switch (event.type) {
            case 'Goal':
                 // Placeholder for a soccer ball icon, using User for now.
                 return <User className="text-green-500" size={14} />;
            case 'Card':
                if (event.detail === 'Yellow Card') return <RectangleVertical className="text-yellow-400 fill-yellow-400" size={14} />;
                return <RectangleVertical className="text-red-500 fill-red-500" size={14} />;
            case 'subst':
                return <ArrowLeftRight className="text-blue-500" size={14} />;
            case 'Var':
                return <ShieldAlert className="text-gray-500" size={14} />;
            default:
                return <Clock size={14} />;
        }
    };
    
    return (
      <div className="p-4">
        <div className="relative flex flex-col">
          <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-border -translate-x-1/2"></div>
          
          {filteredEvents.map((event, index) => {
            const isHomeTeam = event.team.id === fixture.teams.home.id;
            
            const content = (
              <div className={cn("flex items-center gap-2 text-xs", isHomeTeam ? "flex-row-reverse" : "flex-row")}>
                 <span className="font-bold w-6 text-center">{event.time.elapsed}'</span>
                 {getEventIcon(event)}
                 <div className={cn("text-left", isHomeTeam ? "text-right" : "text-left")}>
                    <p className="font-semibold">{event.player.name}</p>
                    {event.type === 'subst' ? 
                     <p className="text-muted-foreground text-[10px]">
                        <span className="text-green-500">دخول:</span> {event.player.name} / <span className="text-red-500">خروج:</span> {event.assist.name || ''}
                     </p>
                    :
                     <p className="text-muted-foreground">{event.detail}</p>
                    }
                 </div>
              </div>
            );

            return (
              <div key={index} className="relative flex my-3 w-full">
                 <div className={cn("w-[calc(50%-1.5rem)]", isHomeTeam ? 'ml-auto' : 'mr-auto' )}>
                    {content}
                 </div>
              </div>
            );
          })}
        </div>
      </div>
    );
};


// --- MAIN SCREEN COMPONENT ---
export function MatchDetailScreen({ goBack, fixtureId, fixture, headerActions }: ScreenProps & { fixtureId: number; fixture: Fixture, headerActions?: React.ReactNode }) {
  const { lineups, events, stats, standings, loading } = useMatchData(fixtureId, fixture.league.id);
  const [eventFilter, setEventFilter] = useState<EventFilter>("highlights");

  return (
    <div className="flex h-full flex-col bg-background">
      <MatchHeader fixture={fixture} onBack={goBack} headerActions={headerActions} />
      <div className="flex-1 overflow-y-auto">
        <Tabs defaultValue="lineups" className="w-full">
          <div className="p-4 pb-0 sticky top-0 bg-background z-10 border-b">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="details">التفاصيل</TabsTrigger>
              <TabsTrigger value="lineups">التشكيلات</TabsTrigger>
              <TabsTrigger value="stats">الإحصائيات</TabsTrigger>
              <TabsTrigger value="standings">الترتيب</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="details">
            <Tabs defaultValue={eventFilter} onValueChange={(val) => setEventFilter(val as EventFilter)} className="w-full">
                 <div className="px-4 pt-4">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="highlights">الأبرز</TabsTrigger>
                        <TabsTrigger value="all">جميع التفاصيل</TabsTrigger>
                    </TabsList>
                </div>
                <TabsContent value="highlights">
                    <EventsTab events={events} fixture={fixture} loading={loading} filter="highlights" />
                </TabsContent>
                <TabsContent value="all">
                    <EventsTab events={events} fixture={fixture} loading={loading} filter="all" />
                </TabsContent>
            </Tabs>
          </TabsContent>
          <TabsContent value="lineups">
            <LineupsTab lineups={lineups} loading={loading} fixture={fixture} />
          </TabsContent>
          <TabsContent value="stats">
            <StatsTab stats={stats} loading={loading} fixture={fixture} />
          </TabsContent>
          <TabsContent value="standings">
            <StandingsTab standings={standings} loading={loading} fixture={fixture} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
