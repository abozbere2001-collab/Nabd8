"use client";

import React, { useEffect, useState } from 'react';
import type { ScreenProps } from '@/app/page';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Share2, Star, Clock, User, ArrowRight, ArrowLeftRight, RectangleVertical, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";

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
const MatchHeader = ({ fixture, onBack }: { fixture: Fixture; onBack: () => void }) => (
  <header className="relative bg-slate-800 text-white pt-10 pb-6 px-4 rounded-b-3xl shadow-lg">
    <div className="absolute top-4 right-4">
      <Button variant="ghost" size="icon" onClick={onBack} className="text-white hover:bg-white/10">
        <ArrowLeft />
      </Button>
    </div>
    <div className="absolute top-4 left-4 flex gap-2">
      <Button variant="ghost" size="icon" className="text-white hover:bg-white/10"><Star /></Button>
      <Button variant="ghost" size="icon" className="text-white hover:bg-white/10"><Share2 /></Button>
    </div>
    <div className="text-center text-sm opacity-80 mb-4">
        {fixture.league.name} - {fixture.league.round}
    </div>
    <div className="flex justify-around items-center">
      <div className="flex flex-col items-center gap-2 w-1/3 text-center">
        <Avatar className="w-16 h-16 border-2 border-white/50">
          <AvatarImage src={fixture.teams.home.logo} />
          <AvatarFallback>{fixture.teams.home.name.substring(0, 2)}</AvatarFallback>
        </Avatar>
        <span className="font-bold">{fixture.teams.home.name}</span>
      </div>
      <div className="text-center">
        <div className="text-4xl font-bold tracking-tight">
          {fixture.goals.home ?? '-'} : {fixture.goals.away ?? '-'}
        </div>
        <div className="text-xs opacity-80 mt-1">{fixture.fixture.status.long}</div>
      </div>
      <div className="flex flex-col items-center gap-2 w-1/3 text-center">
        <Avatar className="w-16 h-16 border-2 border-white/50">
          <AvatarImage src={fixture.teams.away.logo} />
          <AvatarFallback>{fixture.teams.away.name.substring(0, 2)}</AvatarFallback>
        </Avatar>
        <span className="font-bold">{fixture.teams.away.name}</span>
      </div>
    </div>
  </header>
);

const PlayerIcon = ({ player, pos, grid }: { player: { name: string, number: number, photo: string }, pos: string, grid: string | null }) => {
    if (!grid) return null;
    const [row, col] = grid.split(':').map(Number);
    
    // Position adjustments to fit a 5-row, 5-col grid system
    const top = `${(row - 1) * 20 + 10}%`;
    const left = `${(col - 1) * 20 + 10}%`;

    return (
        <div className="absolute text-center" style={{ top, left, transform: 'translate(-50%, -50%)' }}>
            <div className="relative">
                <Avatar className="w-12 h-12 border-2 bg-gray-200 border-white">
                    <AvatarImage src={player.photo} alt={player.name} />
                    <AvatarFallback>{player.name.substring(0,1)}</AvatarFallback>
                </Avatar>
                <span className="absolute -top-1 -right-1 bg-gray-800 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center border-2 border-white">
                    {player.number}
                </span>
            </div>
            <span className="text-[10px] font-semibold bg-gray-900/50 text-white rounded-sm px-1 py-0.5 mt-1 whitespace-nowrap">
                {player.name}
            </span>
        </div>
    );
};

const LineupsTab = ({ lineups, loading }: { lineups: Lineup[] | null, loading: boolean }) => {
  const [activeTeamId, setActiveTeamId] = useState<number | null>(null);
  
  useEffect(() => {
    if (lineups && lineups.length > 0) {
      setActiveTeamId(lineups[0].team.id);
    }
  }, [lineups]);

  if (loading) {
    return <Skeleton className="w-full h-[500px] rounded-lg" />;
  }

  if (!lineups || lineups.length === 0) {
    return <p className="text-center text-muted-foreground p-8">التشكيلات غير متاحة.</p>;
  }

  const activeLineup = lineups.find(l => l.team.id === activeTeamId);

  return (
    <div>
      <div className="p-4 bg-card rounded-lg m-4">
        <Tabs value={activeTeamId?.toString()} onValueChange={(val) => setActiveTeamId(Number(val))} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            {lineups.map(lineup => (
              <TabsTrigger key={lineup.team.id} value={lineup.team.id.toString()}>{lineup.team.name}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {activeLineup && (
        <>
          <div className="px-4">
            <h3 className="font-bold text-center mb-4">
              الخطة: {activeLineup.formation}
            </h3>
            <div className="relative w-full max-w-sm mx-auto aspect-[3/4] bg-green-600 rounded-lg overflow-hidden border-4 border-green-500/50">
              <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/football-pitch.svg')"}}></div>
              {activeLineup.startXI.map(p => (
                  <PlayerIcon key={p.player.id} player={p.player} pos={p.player.pos} grid={p.player.grid} />
              ))}
            </div>
          </div>
          <div className="p-4">
             <h3 className="font-bold mb-2">البدلاء</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                 {activeLineup.substitutes.map(s => (
                    <div key={s.player.id} className="flex items-center gap-2 bg-card p-2 rounded-md">
                        <span className="text-muted-foreground">{s.player.number}</span>
                        <span className="font-medium">{s.player.name}</span>
                    </div>
                 ))}
             </div>
          </div>
           <div className="p-4">
             <h3 className="font-bold mb-2">المدرب</h3>
              <div className="flex items-center gap-3 bg-card p-2 rounded-md">
                  <Avatar>
                      <AvatarImage src={activeLineup.coach.photo} alt={activeLineup.coach.name} />
                      <AvatarFallback>{activeLineup.coach.name.substring(0,1)}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{activeLineup.coach.name}</span>
              </div>
          </div>
        </>
      )}
    </div>
  );
};

const StatsTab = ({ stats, loading }: { stats: MatchStats[] | null, loading: boolean }) => {
    if (loading) return <Skeleton className="w-full h-96" />;
    if (!stats || stats.length < 2) return <p className="text-center p-8">الإحصائيات غير متاحة.</p>;

    const homeStats = stats[0].statistics;
    const awayStats = stats[1].statistics;

    const statTypes = [
        "Shots on Goal", "Shots off Goal", "Total Shots", "Blocked Shots", "Shots insidebox", "Shots outsidebox",
        "Fouls", "Corner Kicks", "Offsides", "Ball Possession", "Yellow Cards", "Red Cards",
        "Goalkeeper Saves", "Total passes", "Passes accurate", "Passes %"
    ];
    
    const combinedStats = statTypes.map(type => {
        const homeStat = homeStats.find(s => s.type === type);
        const awayStat = awayStats.find(s => s.type === type);
        return {
            type,
            homeValue: homeStat?.value ?? 0,
            awayValue: awayStat?.value ?? 0,
        };
    });

    return (
        <div className="p-4 space-y-3">
            {combinedStats.map(({ type, homeValue, awayValue }) => {
                const home = Number(String(homeValue).replace('%', ''));
                const away = Number(String(awayValue).replace('%', ''));
                const total = home + away;
                const homePercentage = total > 0 ? (home / total) * 100 : 0;
                
                return (
                    <div key={type}>
                        <div className="flex justify-between items-center mb-1 text-sm font-semibold">
                            <span>{homeValue}</span>
                            <span className="text-muted-foreground">{type}</span>
                            <span>{awayValue}</span>
                        </div>
                        <div className="flex items-center w-full">
                            <Progress value={homePercentage} className="rounded-l-full rounded-r-none h-2" />
                            <Progress value={100 - homePercentage} className="rounded-r-full rounded-l-none h-2" dir="rtl" />
                        </div>
                    </div>
                )
            })}
        </div>
    );
};

const StandingsTab = ({ standings, loading, fixture }: { standings: Standing[][] | null, loading: boolean, fixture: Fixture }) => {
    if (loading) return <Skeleton className="w-full h-96" />;
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

const EventsTab = ({ events, fixture, loading }: { events: Event[] | null, fixture: Fixture, loading: boolean }) => {
    if (loading) return <Skeleton className="w-full h-96" />;
    if (!events || events.length === 0) return <p className="text-center p-8">لا توجد أحداث رئيسية.</p>;

    const getEventIcon = (event: Event) => {
        switch (event.type) {
            case 'Goal':
                return <User className="text-green-500" size={18} />; // Should be a soccer ball
            case 'Card':
                if (event.detail === 'Yellow Card') return <RectangleVertical className="text-yellow-400 fill-yellow-400" size={18} />;
                return <RectangleVertical className="text-red-500 fill-red-500" size={18} />;
            case 'subst':
                return <ArrowLeftRight className="text-blue-500" size={18} />;
            case 'Var':
                return <ShieldAlert className="text-gray-500" size={18} />;
            default:
                return <Clock size={18} />;
        }
    };
    
    return (
      <div className="p-4">
        <div className="relative flex flex-col items-center">
          {/* Timeline */}
          <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-border -translate-x-1/2"></div>
          
          {events.map((event, index) => {
            const isHomeTeam = event.team.id === fixture.teams.home.id;
            const content = (
              <div className="flex-1">
                <p className="font-semibold text-sm">{event.player.name}</p>
                <p className="text-xs text-muted-foreground">
                  {event.type === 'subst' ? `${event.assist.name || 'خروج'} / ${event.player.name || 'دخول'}` : event.detail}
                </p>
              </div>
            );

            return (
              <div key={index} className="relative w-full flex items-center my-3">
                {/* Timeline Dot */}
                <div className="absolute left-1/2 h-3 w-3 rounded-full bg-muted-foreground -translate-x-1/2 z-10"></div>
                
                {/* Event Content */}
                <div className={cn("w-1/2 p-2 flex gap-3 items-center", isHomeTeam ? "pr-8 flex-row-reverse text-right" : "pl-8 text-left")}>
                  {isHomeTeam ? (
                    <>
                      {content}
                      {getEventIcon(event)}
                      <span className="font-bold text-sm w-8">{event.time.elapsed}'</span>
                    </>
                  ) : (
                    <>
                      <span className="font-bold text-sm w-8">{event.time.elapsed}'</span>
                      {getEventIcon(event)}
                      {content}
                    </>
                  )}
                </div>
                {/* The other half is empty */}
                <div className="w-1/2 p-2"></div>
              </div>
            );
          })}
        </div>
      </div>
    );
};


// --- MAIN SCREEN COMPONENT ---
export function MatchDetailScreen({ goBack, fixtureId, fixture }: ScreenProps & { fixtureId: number; fixture: Fixture }) {
  const { lineups, events, stats, standings, loading } = useMatchData(fixtureId, fixture.league.id);

  return (
    <div className="flex h-full flex-col bg-background">
      <MatchHeader fixture={fixture} onBack={goBack} />
      <div className="flex-1 overflow-y-auto">
        <Tabs defaultValue="details" className="w-full">
          <div className="p-4 pb-0 sticky top-0 bg-background z-10 border-b">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="details">التفاصيل</TabsTrigger>
              <TabsTrigger value="lineups">التشكيلات</TabsTrigger>
              <TabsTrigger value="stats">الإحصائيات</TabsTrigger>
              <TabsTrigger value="standings">الترتيب</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="details">
            <EventsTab events={events} fixture={fixture} loading={loading} />
          </TabsContent>
          <TabsContent value="lineups">
            <LineupsTab lineups={lineups} loading={loading} />
          </TabsContent>
          <TabsContent value="stats">
            <StatsTab stats={stats} loading={loading} />
          </TabsContent>
          <TabsContent value="standings">
            <StandingsTab standings={standings} loading={loading} fixture={fixture} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
