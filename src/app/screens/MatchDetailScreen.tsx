

"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import type { ScreenProps } from '@/app/page';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Share2, Star, Clock, User, ArrowLeftRight, RectangleVertical, ShieldAlert, Pencil, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAdmin, useAuth, useFirestore } from '@/firebase/provider';
import { doc, onSnapshot, setDoc, updateDoc, deleteField, getDocs, collection, getDoc } from 'firebase/firestore';
import { RenameDialog } from '@/components/RenameDialog';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

// --- TYPE DEFINITIONS ---
interface Fixture {
  fixture: { id: number; date: string; status: { short: string; long: string; elapsed: number | null }; };
  league: { id: number; name: string; logo: string; round: string; };
  teams: { home: { id: number; name: string; logo: string; winner: boolean | null }; away: { id: number; name:string; logo: string; winner: boolean | null }; };
  goals: { home: number | null; away: number | null; };
}

interface Player {
    id: number;
    name: string;
    number: number;
    pos: string;
    grid: string | null;
    photo: string;
}

interface PlayerStats {
    games: { minutes: number | null; position: string; rating: string | null; substitute: boolean; };
    // ... other stats
}

interface PlayerInfoFromApi {
    player: Player;
    statistics: PlayerStats[];
}

interface TeamLineup {
    team: { id: number; name: string; logo: string; };
    coach: { id: number; name: string; photo: string; };
    formation: string;
    startXI: PlayerInfoFromApi[];
    substitutes: PlayerInfoFromApi[];
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

interface Favorites {
    leagues?: { [key: number]: any };
    teams?: { [key: number]: any };
    players?: { [key: number]: any };
}

type RenameType = 'team' | 'player' | 'coach';

type EventFilter = "all" | "highlights";

const CURRENT_SEASON = 2025;

// --- API FETCH HOOK ---
function useMatchData(fixture?: Fixture) {
    const [data, setData] = useState<{
        lineups: TeamLineup[];
        events: Event[];
        stats: MatchStats[];
        standings: Standing[][];
    }>({ lineups: [], events: [], stats: [], standings: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!fixture) {
            setLoading(false);
            return;
        }
        const { fixture: { id: fixtureId, date }, league, teams } = fixture;

        const fetchData = async () => {
            setLoading(true);
            try {
                const isNational = fixture.teams.home.winner !== null && fixture.teams.away.winner !== null;
                const seasonForStandings = isNational ? new Date(date).getFullYear() : CURRENT_SEASON;

                // Fetch lineups using the 'players' endpoint for rich data
                const [homePlayersRes, awayPlayersRes, eventsRes, statsRes, standingsRes] = await Promise.all([
                    fetch(`/api/football/players?fixture=${fixtureId}&team=${teams.home.id}`),
                    fetch(`/api/football/players?fixture=${fixtureId}&team=${teams.away.id}`),
                    fetch(`/api/football/fixtures/events?fixture=${fixtureId}`),
                    fetch(`/api/football/fixtures/statistics?fixture=${fixtureId}`),
                    fetch(`/api/football/standings?league=${league.id}&season=${seasonForStandings}`),
                ]);

                const homePlayersData = await homePlayersRes.json();
                const awayPlayersData = await awayPlayersRes.json();
                const eventsData = await eventsRes.json();
                const statsData = await statsRes.json();
                const standingsData = await standingsRes.json();

                const processLineupData = (lineupData: any): TeamLineup | null => {
                    if (!lineupData?.response?.[0]) return null;
                    const response = lineupData.response[0];
                    const allPlayers: PlayerInfoFromApi[] = response.players || [];
                    
                    return {
                        team: response.team,
                        coach: response.coach || { id: 0, name: 'N/A', photo: '' },
                        formation: response.formation || 'N/A',
                        startXI: allPlayers.filter(p => !p.statistics[0].games.substitute),
                        substitutes: allPlayers.filter(p => p.statistics[0].games.substitute),
                    };
                };

                const homeLineup = processLineupData(homePlayersData);
                const awayLineup = processLineupData(awayPlayersData);
                const finalLineups = [homeLineup, awayLineup].filter(Boolean) as TeamLineup[];

                setData({
                    lineups: finalLineups,
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
    }, [fixture]);

    return { ...data, loading };
}


// --- SUB-COMPONENTS ---
const MatchHeader = ({ fixture, onBack, headerActions, navigate, isAdmin, onCopy }: { fixture: Fixture; onBack: () => void, headerActions?: React.ReactNode, navigate: ScreenProps['navigate'], isAdmin: boolean, onCopy: (url: string) => void }) => (
  <header className="relative bg-card text-foreground pt-10 pb-6 px-4 shadow-lg border-b">
    <div className="absolute top-4 right-4">
      <Button variant="ghost" size="icon" onClick={onBack} className="text-foreground/80 hover:bg-accent">
        <ArrowLeft />
      </Button>
    </div>
    <div className="absolute top-2 left-2 flex gap-1">
       {headerActions}
    </div>
    <div className="text-center text-sm text-muted-foreground mb-4 cursor-pointer" onClick={() => navigate('CompetitionDetails', { leagueId: fixture.league.id, title: fixture.league.name, logo: fixture.league.logo })}>
        {fixture.league.name} - {fixture.league.round}
    </div>
    <div className="flex justify-around items-center">
      <div className="flex flex-col items-center gap-2 w-1/3 text-center cursor-pointer" onClick={() => navigate('TeamDetails', { teamId: fixture.teams.home.id })}>
        <div className="relative">
            <Avatar className="w-16 h-16 border-2 border-border">
                <AvatarImage src={fixture.teams.home.logo} />
                <AvatarFallback>{fixture.teams.home.name.substring(0, 2)}</AvatarFallback>
            </Avatar>
            {isAdmin && <Button variant="ghost" size="icon" className="absolute -top-2 -right-2 h-6 w-6" onClick={(e) => { e.stopPropagation(); onCopy(fixture.teams.home.logo); }}><Copy className="h-3 w-3 text-muted-foreground" /></Button>}
        </div>
        <span className="font-bold">{fixture.teams.home.name}</span>
      </div>
      <div className="text-center">
         <div className={cn("text-4xl font-bold tracking-tight", ['NS', 'TBD', 'PST', 'CANC'].includes(fixture.fixture.status.short) && "text-2xl")}>
          {['FT', 'AET', 'PEN', 'LIVE', 'HT', '1H', '2H'].includes(fixture.fixture.status.short) || (fixture.goals.home !== null)
            ? `${fixture.goals.home ?? '-'} - ${fixture.goals.away ?? '-'}`
            : format(new Date(fixture.fixture.date), "HH:mm")}
        </div>
        <div className="text-xs text-muted-foreground mt-1">{fixture.fixture.status.long}</div>
      </div>
      <div className="flex flex-col items-center gap-2 w-1/3 text-center cursor-pointer" onClick={() => navigate('TeamDetails', { teamId: fixture.teams.away.id })}>
        <div className="relative">
            <Avatar className="w-16 h-16 border-2 border-border">
                <AvatarImage src={fixture.teams.away.logo} />
                <AvatarFallback>{fixture.teams.away.name.substring(0, 2)}</AvatarFallback>
            </Avatar>
             {isAdmin && <Button variant="ghost" size="icon" className="absolute -top-2 -right-2 h-6 w-6" onClick={(e) => { e.stopPropagation(); onCopy(fixture.teams.away.logo); }}><Copy className="h-3 w-3 text-muted-foreground" /></Button>}
        </div>
        <span className="font-bold">{fixture.teams.away.name}</span>
      </div>
    </div>
  </header>
);

const PlayerOnPitch = ({ player, rating }: { player: Player, rating: string | null }) => {
  const getRatingColor = (ratingValue: number) => {
    if (ratingValue >= 8.5) return 'bg-blue-500';
    if (ratingValue >= 7.5) return 'bg-green-500';
    if (ratingValue >= 6.5) return 'bg-yellow-500';
    return 'bg-red-500';
  };
  
  const ratingValue = rating ? parseFloat(rating) : null;

  return (
    <div className="relative flex flex-col items-center justify-center w-16">
       {ratingValue && (
            <div className={cn(
                "absolute -top-2 -left-1 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center border-2 border-background z-20",
                 getRatingColor(ratingValue)
            )}>
              {ratingValue.toFixed(1)}
            </div>
        )}
      <div className="relative">
        <Avatar className="w-10 h-10 border-2 bg-slate-800/80 border-white/50 shadow-md">
          <AvatarImage src={player.photo} alt={player.name} />
          <AvatarFallback className="bg-slate-700 text-white font-bold">{player.name?.[0]}</AvatarFallback>
        </Avatar>
        <div className="absolute -top-1 -right-1 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center border-2 border-background bg-slate-900 z-10">
          {player.number}
        </div>
      </div>
      <p className="text-[10px] font-semibold bg-black/50 text-white rounded-sm px-1.5 py-0.5 mt-1 whitespace-nowrap shadow-lg truncate max-w-full">
        {player.name}
      </p>
    </div>
  );
};


const LineupsTab = ({ lineups, loading, fixture, favorites, onRename, onFavorite, isAdmin, onCopy }: { lineups: TeamLineup[], loading: boolean, fixture: Fixture, favorites: Favorites, onRename: (type: RenameType, id: number, name: string) => void, onFavorite: (type: 'player' | 'coach', item: any) => void, isAdmin: boolean, onCopy: (url: string) => void }) => {
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

  const groupPlayersByLine = (players: PlayerInfoFromApi[]) => {
    const lines: { [key: string]: PlayerInfoFromApi[] } = {
        Goalkeeper: [],
        Defender: [],
        Midfielder: [],
        Attacker: [],
    };
    players.forEach(p => {
        const position = p.statistics[0].games.position;
        if(lines[position]) {
            lines[position].push(p);
        }
    });

    // Return in logical pitch order (reversed for display)
    return [lines.Attacker, lines.Midfielder, lines.Defender, lines.Goalkeeper].filter(line => line && line.length > 0);
  };
  
  const playerLines = groupPlayersByLine(lineupToShow.startXI);

  const renderPlayerRow = (playerInfo: PlayerInfoFromApi) => {
    if(!playerInfo) return null;
    const { player, statistics } = playerInfo;
    return (
         <div key={player.id} className="flex items-center gap-2 text-xs p-1 rounded-md hover:bg-muted">
            <span className="text-muted-foreground w-6 text-center font-mono">{player.number}</span>
             <div className="relative">
                <Avatar className="w-6 h-6">
                    <AvatarImage src={player.photo} />
                    <AvatarFallback>{player.name.substring(0,1)}</AvatarFallback>
                </Avatar>
                {isAdmin && <Button variant="ghost" size="icon" className="absolute -top-2 -right-2 h-6 w-6" onClick={(e) => { e.stopPropagation(); onCopy(player.photo); }}><Copy className="h-3 w-3 text-muted-foreground" /></Button>}
            </div>
            <p className="font-medium truncate flex-1">
                {player.name}
                {isAdmin && <span className="text-xs text-muted-foreground/70 ml-2">(ID: {player.id})</span>}
            </p>
            <div className='flex opacity-80'>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onFavorite('player', player)}>
                    <Star className={cn("h-4 w-4", favorites?.players?.[player.id] ? "text-yellow-400 fill-current" : "text-muted-foreground/60")} />
                </Button>
                {isAdmin && <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onRename('player', player.id, player.name)}>
                    <Pencil className="h-4 w-4 text-muted-foreground" />
                </Button>}
            </div>
        </div>
    );
  }

  return (
    <div className="space-y-4">
       <div className="bg-muted">
        <div className="flex justify-center items-center gap-2 p-2">
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
       </div>

      <div className="space-y-4 px-4">
        <div 
            className="relative w-full max-w-md mx-auto aspect-[3/4] bg-cover bg-center rounded-lg overflow-hidden border-4 border-green-500/30 shadow-2xl flex flex-col justify-around py-4" 
            style={{ backgroundImage: "url('/football-pitch-3d.svg')", backgroundSize: '100% 100%' }}
        >
          {playerLines.map((line, lineIndex) => (
            <div key={lineIndex} className="flex justify-around items-center">
              {line.map(({player, statistics}) => player ? <PlayerOnPitch key={player.id} player={player} rating={statistics[0]?.games.rating || null} /> : null)}
            </div>
          ))}
          <div className="absolute bottom-2 left-2 bg-black/50 text-white text-sm font-bold px-2 py-1 rounded">
             {lineupToShow?.formation}
          </div>
        </div>
      </div>
      
      <div className="p-2 rounded-lg bg-card border mx-4">
        <h4 className="font-bold mb-2 text-base px-2">طاقم التدريب</h4>
        <div className="space-y-2">
            <div className="flex items-center gap-3 p-2 rounded-md hover:bg-muted">
                 <div className="relative">
                    <Avatar className="w-10 h-10">
                        <AvatarImage src={lineupToShow.coach.photo} alt={lineupToShow.coach.name} />
                        <AvatarFallback>{lineupToShow.coach.name.substring(0,1)}</AvatarFallback>
                    </Avatar>
                    {isAdmin && <Button variant="ghost" size="icon" className="absolute -top-2 -right-2 h-6 w-6" onClick={(e) => { e.stopPropagation(); onCopy(lineupToShow.coach.photo); }}><Copy className="h-3 w-3 text-muted-foreground" /></Button>}
                </div>
                <div className='flex-1'>
                    <p className="font-medium">{lineupToShow.coach.name}</p>
                    <p className="text-xs text-muted-foreground">
                        المدرب
                        {isAdmin && <span className="text-xs text-muted-foreground/70 ml-2">(ID: {lineupToShow.coach.id})</span>}
                    </p>
                </div>
                 <div className='flex opacity-80'>
                    {isAdmin && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onRename('coach', lineupToShow.coach.id, lineupToShow.coach.name)}>
                        <Pencil className="h-4 w-4 text-muted-foreground" />
                    </Button>}
                </div>
            </div>
        </div>
      </div>

      <div className="p-2 rounded-lg bg-card border mx-4 mb-4">
         <h4 className="font-bold mb-2 text-base px-2">البدلاء</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {lineupToShow.substitutes.map(s => renderPlayerRow(s))}
        </div>
      </div>
    </div>
  );
};


const StatsTab = ({ stats, loading, fixture }: { stats: MatchStats[], loading: boolean, fixture: Fixture }) => {
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
        <div className="px-4 pt-4 space-y-4">
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

const StandingsTab = ({ standings, loading, fixture, navigate }: { standings: Standing[][], loading: boolean, fixture: Fixture, navigate: ScreenProps['navigate'] }) => {
    if (loading) return <Skeleton className="w-full h-96 m-4" />;
    if (!standings || standings.length === 0) return <p className="text-center p-8">الترتيب غير متاح.</p>;

    return (
        <div className="px-4 pt-4">
            {standings.map((group, index) => (
                <div key={index} className="mb-6">
                    <h3 className="font-bold text-lg mb-2">{group[0]?.group || fixture.league.name}</h3>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-1/2">الفريق</TableHead>
                                <TableHead className="text-center">ل</TableHead>
                                <TableHead className="text-center">ف</TableHead>
                                <TableHead className="text-center">ت</TableHead>
                                <TableHead className="text-center">خ</TableHead>
                                <TableHead className="text-center">ن</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {group.map((s) => (
                                <TableRow key={s.team.id} className={cn('cursor-pointer', s.team.id === fixture.teams.home.id || s.team.id === fixture.teams.away.id ? 'bg-primary/10' : '')} onClick={() => navigate('TeamDetails', { teamId: s.team.id })}>
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

const EventsTab = ({ events, fixture, loading, filter }: { events: Event[], fixture: Fixture, loading: boolean, filter: EventFilter }) => {
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
      <div className="px-4 pt-4">
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
                 <div className={cn("w-[calc(50%-1.5rem)]", isHomeTeam ? "ml-auto" : "mr-auto" )}>
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
export function MatchDetailScreen({ navigate, goBack, fixtureId, fixture, headerActions }: ScreenProps & { fixtureId: number; fixture: Fixture, headerActions?: React.ReactNode }) {
  const { lineups, events, stats, standings, loading } = useMatchData(fixture);
  const { isAdmin } = useAdmin();
  const { user } = useAuth();
  const { db } = useFirestore();
  const { toast } = useToast();
  const [favorites, setFavorites] = useState<Favorites>({});
  const [renameItem, setRenameItem] = useState<{ id: string | number, name: string, type: RenameType } | null>(null);
  const [isRenameOpen, setRenameOpen] = useState(false);
  const [eventFilter, setEventFilter] = useState<EventFilter>("highlights");
  
  const handleCopy = (url: string | null) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    toast({ title: "تم نسخ الرابط", description: url });
  };


  useEffect(() => {
    if (!user || !db) return;
    const unsub = onSnapshot(doc(db, 'favorites', user.uid), (doc) => {
        setFavorites(doc.data() as Favorites || {});
    }, error => {
         const permissionError = new FirestorePermissionError({
            path: `favorites/${user.uid}`,
            operation: 'get',
        });
        errorEmitter.emit('permission-error', permissionError);
    });
    return () => unsub();
  }, [user, db]);

  const handleOpenRename = (type: RenameType, id: number, name: string) => {
    setRenameItem({ id, name, type });
    setRenameOpen(true);
  };
  
  const handleFavorite = async (type: 'player' | 'coach', item: any) => {
    if (!user || !db) return;
    const favRef = doc(db, 'favorites', user.uid);
    
    let fieldPath = `players.${item.id}`; // Assuming coaches are also identified by an id in a 'players' or similar map
    let isFavorited = !!favorites?.players?.[item.id];
    let favoriteData = { players: { [item.id]: { playerId: item.id, name: item.name, photo: item.photo }}};
    
    try {
        if (isFavorited) {
            await updateDoc(favRef, { [fieldPath]: deleteField() });
        } else {
            await setDoc(favRef, favoriteData, { merge: true });
        }
    } catch (error) {
        const permissionError = new FirestorePermissionError({
            path: favRef.path,
            operation: 'update',
            requestResourceData: favoriteData
        });
        errorEmitter.emit('permission-error', permissionError);
    }
  };

  const handleSaveRename = async (newName: string) => {
    if (!renameItem || !db) return;
    const { id, type } = renameItem;
    const collectionName = type === 'player' ? 'playerCustomizations' : 'coachCustomizations';
    const docRef = doc(db, collectionName, String(id));
    const data = { customName: newName };

    try {
        await setDoc(docRef, data);
        toast({ title: 'تم الحفظ', description: `تمت إعادة تسمية ${type === 'player' ? 'اللاعب' : 'المدرب'}`});
    } catch(error) {
       const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'create',
            requestResourceData: data
        });
        errorEmitter.emit('permission-error', permissionError);
    }
  };


  return (
    <div className="flex h-full flex-col bg-background">
      <MatchHeader fixture={fixture} onBack={goBack} headerActions={headerActions} navigate={navigate} isAdmin={isAdmin} onCopy={handleCopy} />
      {renameItem && <RenameDialog 
          isOpen={isRenameOpen}
          onOpenChange={setRenameOpen}
          currentName={renameItem.name}
          onSave={handleSaveRename}
          itemType="العنصر"
        />}
      <div className="flex-1 overflow-y-auto">
        <Tabs defaultValue="lineups" className="w-full">
          <div className="sticky top-0 bg-background z-10 border-b">
            <TabsList className="grid w-full grid-cols-4 rounded-none">
              <TabsTrigger value="lineups">التشكيلات</TabsTrigger>
              <TabsTrigger value="details">التفاصيل</TabsTrigger>
              <TabsTrigger value="stats">الإحصائيات</TabsTrigger>
              <TabsTrigger value="standings">الترتيب</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="details" className='p-0'>
            <Tabs defaultValue={eventFilter} onValueChange={(val) => setEventFilter(val as EventFilter)} className="w-full">
                 <div className="px-4 pt-2">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="all">جميع التفاصيل</TabsTrigger>
                        <TabsTrigger value="highlights">الأبرز</TabsTrigger>
                    </TabsList>
                </div>
                <TabsContent value="highlights" className='p-0'>
                    <EventsTab events={events} fixture={fixture} loading={loading} filter="highlights" />
                </TabsContent>
                <TabsContent value="all" className='p-0'>
                    <EventsTab events={events} fixture={fixture} loading={loading} filter="all" />
                </TabsContent>
            </Tabs>
          </TabsContent>
          <TabsContent value="lineups" className='p-0'>
            <LineupsTab lineups={lineups} loading={loading} fixture={fixture} favorites={favorites} onRename={handleOpenRename} onFavorite={handleFavorite} isAdmin={isAdmin} onCopy={handleCopy} />
          </TabsContent>
          <TabsContent value="stats" className='p-0'>
            <StatsTab stats={stats} loading={loading} fixture={fixture} />
          </TabsContent>
          <TabsContent value="standings" className='p-0'>
            <StandingsTab standings={standings} loading={loading} fixture={fixture} navigate={navigate} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

