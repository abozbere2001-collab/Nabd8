

"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import type { ScreenProps } from '@/app/page';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from "@/components/ui/button";
import { cn } from '@/lib/utils';
import type { Fixture as FixtureType, Standing, Team, Favorites } from '@/lib/types';
import { useAdmin, useAuth, useFirestore } from '@/firebase/provider';
import { doc, onSnapshot, setDoc, getDocs, collection, updateDoc, deleteField, getDoc } from 'firebase/firestore';
import { RenameDialog } from '@/components/RenameDialog';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { useToast } from '@/hooks/use-toast';
import { Star, Pencil, Goal, ArrowLeftRight, RectangleVertical, Copy, Heart, User, ShieldCheck, Repeat } from 'lucide-react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { NoteDialog } from '@/components/NoteDialog';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";


// --- TYPE DEFINITIONS ---
interface Player {
  id: number;
  name: string;
  number: number;
  pos: string; // G, D, M, F
  grid: string; // "row:col"
  photo?: string;
  colIndex?: number;
}

interface PlayerWithStats {
    player: Player;
    statistics?: any[];
}
interface LineupData {
    team: Team;
    coach: any;
    formation: string;
    startXI: PlayerWithStats[];
    substitutes: PlayerWithStats[];
}
interface MatchEvent {
    time: { elapsed: number; extra: number | null };
    team: { id: number; name: string; logo: string };
    player: { id: number; name: string };
    assist: { id: number | null; name: string | null };
    type: 'Goal' | 'Card' | 'subst' | 'Var';
    detail: string;
    comments: string | null;
}
interface H2HData {
    fixture: { id: number, status: { long: string }, date: string };
    teams: { home: Team, away: Team };
    goals: { home: number | null, away: number | null };
}

interface MatchData {
    lineups: LineupData[];
    events: MatchEvent[];
    stats: any[];
    standings: Standing[];
    h2h: H2HData[];
    loading: boolean;
    error: string | null;
}
type RenameType = 'team' | 'player' | 'coach';


// --- HOOKS ---
function useMatchData(fixture?: FixtureType): MatchData {
    const { toast } = useToast();
    const [data, setData] = useState<MatchData>({
        lineups: [], events: [], stats: [], standings: [], h2h: [], loading: true, error: null,
    });
    
    const CURRENT_SEASON = useMemo(() => {
        if (!fixture) return new Date().getFullYear();
        if (fixture.league && fixture.league.round) {
            const seasonYearMatch = fixture.league.round.match(/(\d{4})/);
            if (seasonYearMatch) {
              const year = parseInt(seasonYearMatch[0], 10);
              if (!isNaN(year)) return year;
            }
        }
        return new Date(fixture.fixture.date).getFullYear();
    }, [fixture]);


    useEffect(() => {
        if (!fixture) {
            setData(prev => ({ ...prev, loading: false, error: "No fixture data provided" }));
            return;
        }

        const fetchData = async () => {
            setData(prev => ({ ...prev, loading: true, error: null }));
            const fixtureId = fixture.fixture.id;
            const leagueId = fixture.league.id;
            const homeTeamId = fixture.teams.home.id;
            const awayTeamId = fixture.teams.away.id;

            try {
                const [lineupsRes, eventsRes, statsRes, standingsRes, h2hRes] = await Promise.allSettled([
                    fetch(`/api/football/fixtures/lineups?fixture=${fixtureId}`),
                    fetch(`/api/football/fixtures/events?fixture=${fixtureId}`),
                    fetch(`/api/football/statistics?fixture=${fixtureId}`),
                    fetch(`/api/football/standings?league=${leagueId}&season=${CURRENT_SEASON}`),
                    fetch(`/api/football/fixtures/headtohead?h2h=${homeTeamId}-${awayTeamId}`),
                ]);

                const parseResult = async (res: PromiseSettledResult<Response>) => {
                    if (res.status === 'fulfilled' && res.value.ok) {
                        try {
                            const json = await res.value.json();
                            return json.response || [];
                        } catch (e) { return []; }
                    }
                    return [];
                };

                let fetchedLineups: LineupData[] = await parseResult(lineupsRes);
                const fetchedEvents: MatchEvent[] = await parseResult(eventsRes);
                const fetchedStats: any[] = await parseResult(statsRes);
                const fetchedStandings: Standing[] = (await parseResult(standingsRes))[0]?.league?.standings[0] || [];
                const fetchedH2H: H2HData[] = await parseResult(h2hRes);
                
                 if (fetchedLineups.length > 0) {
                     for (let i = 0; i < fetchedLineups.length; i++) {
                        const lineup = fetchedLineups[i];
                        if (!lineup.team?.id) continue;
                        
                        const teamPlayersRes = await fetch(`/api/football/players?team=${lineup.team.id}&season=${CURRENT_SEASON}`);
                        if (teamPlayersRes.ok) {
                            const teamPlayersData = await teamPlayersRes.json();
                            const teamPlayersList: { player: Player }[] = teamPlayersData.response || [];
                            const photoMap = new Map<number, string>();
                            teamPlayersList.forEach(p => { if (p.player.photo) photoMap.set(p.player.id, p.player.photo); });

                            const updatePhotos = (playerList: PlayerWithStats[] | undefined) => {
                                if (!playerList) return;
                                playerList.forEach(p => {
                                    if (!p.player.photo) {
                                      p.player.photo = photoMap.get(p.player.id) || `https://media.api-sports.io/football/players/${p.player.id}.png`;
                                    }
                                });
                            };

                            updatePhotos(lineup.startXI);
                            updatePhotos(lineup.substitutes);
                        }
                    }
                }
                
                setData({
                    lineups: fetchedLineups,
                    events: fetchedEvents.sort((a, b) => a.time.elapsed - b.time.elapsed),
                    stats: fetchedStats,
                    standings: fetchedStandings,
                    h2h: fetchedH2H,
                    loading: false,
                    error: null,
                });

            } catch (error: any) {
                console.error("❌ Match data fetch error:", error);
                toast({
                    variant: "destructive",
                    title: "خطأ في الشبكة",
                    description: "فشل في جلب بيانات المباراة. يرجى التحقق من اتصالك بالإنترنت.",
                });
                setData({
                    lineups: [], events: [], stats: [], standings: [], h2h: [], loading: false,
                    error: error.message || "Unknown error",
                });
            }
        };

        fetchData();
    }, [fixture, toast, CURRENT_SEASON]);

    return data;
}

// --- CHILD COMPONENTS ---
const H2HView = ({ h2h, fixture, homeName, awayName }: { h2h: H2HData[], fixture: FixtureType, homeName: string, awayName: string }) => {
    if (!h2h || h2h.length === 0) return null;

    let homeWins = 0;
    let awayWins = 0;
    let draws = 0;

    h2h.forEach(match => {
        if (match.goals.home === match.goals.away) {
            draws++;
        } else if (match.teams.home.id === fixture.teams.home.id) {
            if (match.goals.home! > match.goals.away!) homeWins++; else awayWins++;
        } else {
            if (match.goals.home! > match.goals.away!) awayWins++; else homeWins++;
        }
    });

    const total = homeWins + awayWins + draws;
    const homeWinPercentage = total > 0 ? (homeWins / total) * 100 : 0;
    const awayWinPercentage = total > 0 ? (awayWins / total) * 100 : 0;
    const drawPercentage = total > 0 ? (draws / total) * 100 : 0;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-center text-lg">المواجهات المباشرة (آخر {total} مباريات)</CardTitle>
            </CardHeader>
            <CardContent>
                 <div className="flex w-full h-2 rounded-full overflow-hidden mt-4">
                    <div style={{ width: `${homeWinPercentage}%`}} className="bg-primary h-full"></div>
                    <div style={{ width: `${drawPercentage}%`}} className="bg-muted h-full"></div>
                    <div style={{ width: `${awayWinPercentage}%`}} className="bg-destructive h-full"></div>
                </div>
                <div className="flex justify-between items-center mt-2">
                    <div className="text-center">
                        <p className="font-bold text-xl">{homeWins}</p>
                        <p className="text-sm text-muted-foreground">فوز {homeName}</p>
                    </div>
                     <div className="text-center">
                        <p className="font-bold text-xl">{draws}</p>
                        <p className="text-sm text-muted-foreground">تعادل</p>
                    </div>
                    <div className="text-center">
                        <p className="font-bold text-xl">{awayWins}</p>
                         <p className="text-sm text-muted-foreground">فوز {awayName}</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

const SubstitutionsView = ({ events, homeTeamId, awayTeamId, getPlayerName, onRename }: { events: MatchEvent[], homeTeamId: number, awayTeamId: number, getPlayerName: (id: number, defaultName: string) => string, onRename: (type: RenameType, id: number, name: string) => void }) => {
    const substitutions = events.filter(e => e.type === 'subst');
    if (substitutions.length === 0) return null;

    const homeSubs = substitutions.filter(s => s.team.id === homeTeamId);
    const awaySubs = substitutions.filter(s => s.team.id === awayTeamId);

    return (
        <div className="mt-4 pt-4 border-t border-border">
            <h4 className="font-bold text-center mb-3">التبديلات</h4>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 text-right">
                    {homeSubs.map((sub, i) => (
                        <div key={`home-sub-${i}`} className="text-xs flex items-center justify-end gap-2">
                            <p>{sub.time.elapsed}'</p>
                            <div>
                               <p className="text-green-500 flex items-center gap-1">
                                 <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => onRename('player', sub.player.id, getPlayerName(sub.player.id, sub.player.name))}><Pencil className="h-3 w-3" /></Button>
                                 دخول: {getPlayerName(sub.player.id, sub.player.name)}
                               </p>
                               <p className="text-red-500 flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => onRename('player', sub.assist.id!, getPlayerName(sub.assist.id!, sub.assist.name!))}><Pencil className="h-3 w-3" /></Button>
                                 خروج: {getPlayerName(sub.assist.id!, sub.assist.name!)}
                               </p>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="space-y-2 text-left">
                     {awaySubs.map((sub, i) => (
                        <div key={`away-sub-${i}`} className="text-xs flex items-center justify-start gap-2">
                             <div>
                                <p className="text-green-500 flex items-center gap-1">
                                  دخول: {getPlayerName(sub.player.id, sub.player.name)}
                                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => onRename('player', sub.player.id, getPlayerName(sub.player.id, sub.player.name))}><Pencil className="h-3 w-3" /></Button>
                                </p>
                                <p className="text-red-500 flex items-center gap-1">
                                    خروج: {getPlayerName(sub.assist.id!, sub.assist.name!)}
                                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => onRename('player', sub.assist.id!, getPlayerName(sub.assist.id!, sub.assist.name!))}><Pencil className="h-3 w-3" /></Button>
                                </p>
                             </div>
                             <p>{sub.time.elapsed}'</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const LineupField = ({ lineup, opponentTeam, events, getPlayerName, onRename }: { lineup: LineupData, opponentTeam?: Team, events: MatchEvent[], getPlayerName: (id: number, defaultName: string) => string, onRename: (type: RenameType, id: number, name: string) => void }) => {
  if (!lineup || !lineup.startXI || lineup.startXI.length === 0) {
    return <div className="text-center py-6 text-muted-foreground">التشكيلة غير متاحة حاليًا</div>;
  }

  const rowsMap: { [key: number]: Player[] } = {};
  lineup.startXI.forEach(({player}) => {
    if (!player.grid) return;
    const [row, col] = player.grid.split(':').map(Number);
    if (!rowsMap[row]) rowsMap[row] = [];
    rowsMap[row].push({ ...player, colIndex: col });
  });
  
  const sortedRows = Object.values(rowsMap).map(row => row.sort((a, b) => a.colIndex! - b.colIndex!)).sort((a,b) => (b[0].grid.split(':')[0] as any) - (a[0].grid.split(':')[0] as any));


  return (
    <Card className="p-3 bg-card/80">
      <div className="relative w-full aspect-[2/3] max-h-[700px] bg-cover bg-center bg-no-repeat rounded-lg overflow-hidden border border-green-500/20" style={{ backgroundImage: `url('/football-pitch-vertical.svg')` }}>
        <div className="absolute inset-0 flex flex-col justify-around p-2">
          {sortedRows.map((row, rowIndex) => (
            <div key={rowIndex} className="flex justify-around items-center w-full">
              {row.map((player) => {
                const displayName = getPlayerName(player.id, player.name);
                const playerPhoto = player.photo || `https://media.api-sports.io/football/players/${player.id}.png`;
                
                return (
                  <div key={player.id} className="flex flex-col items-center text-xs text-white w-16 text-center group">
                    <div className="relative w-12 h-12">
                      <Avatar className="w-12 h-12 border-2 border-white/50 bg-black/30">
                        <AvatarImage src={playerPhoto} alt={displayName} />
                        <AvatarFallback>{displayName ? displayName.charAt(0) : '?'}</AvatarFallback>
                      </Avatar>
                      {player.number && (
                        <div className="absolute -top-1 -left-1 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center border-2 border-background bg-gray-800 z-10">
                          {player.number}
                        </div>
                      )}
                       <Button variant="ghost" size="icon" className="absolute -top-1 -right-1 h-5 w-5 opacity-0 group-hover:opacity-100" onClick={() => onRename('player', player.id, displayName)}><Pencil className="h-3 w-3 text-white" /></Button>
                    </div>
                    <span className="mt-1 bg-black/50 px-1.5 py-0.5 rounded font-semibold truncate w-full text-[11px]">{displayName}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      
       {opponentTeam && lineup.substitutes && (
        <div className="mt-4 pt-4 border-t border-border">
          <h4 className="font-bold text-center mb-3">الاحتياط</h4>
           <div className="grid grid-cols-2 gap-2">
            {lineup.substitutes.map(({ player }) => (
                <div key={player.id} className="flex items-center gap-2 p-1 border rounded bg-card/50 group">
                    <Avatar className="h-8 w-8"><AvatarImage src={player.photo} /></Avatar>
                    <p className="text-xs font-semibold flex-1">{getPlayerName(player.id, player.name)}</p>
                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => onRename('player', player.id, getPlayerName(player.id, player.name))}><Pencil className="h-3 w-3" /></Button>
                </div>
            ))}
           </div>
          {lineup.substitutes.length > 0 && <SubstitutionsView events={events} homeTeamId={lineup.team.id} awayTeamId={opponentTeam.id} getPlayerName={getPlayerName} onRename={onRename} />}
        </div>
       )}
    </Card>
  );
};

const EventsView = ({ events, fixture, getPlayerName, onRename }: { events: MatchEvent[]; fixture: FixtureType; getPlayerName: (id: number, defaultName: string) => string; onRename: (type: RenameType, id: number, name: string) => void }) => {
    const [activeTab, setActiveTab] = useState('all');
    
    const keyEvents = useMemo(() => events.filter(e => e.type === 'Goal' || e.type === 'Card'), [events]);
    const eventsToShow = activeTab === 'all' ? events : keyEvents;
    
    if (!events || events.length === 0) {
        return <div className="text-muted-foreground text-center py-4">لا توجد أحداث متاحة لعرضها.</div>
    }

    const renderEvent = (ev: MatchEvent, isHomeTeam: boolean) => {
        const icon =
          ev.type === "Goal" ? "⚽" :
          ev.type === "Card" && ev.detail.includes("Yellow") ? "🟨" :
          ev.type === "Card" && ev.detail.includes("Red") ? "🟥" :
          ev.type === "subst" ? "🔁" : "•";

        const playerName = getPlayerName(ev.player.id, ev.player.name);
        const assistName = ev.assist?.id ? getPlayerName(ev.assist.id, ev.assist.name!) : null;

        return (
            <div className="flex items-center gap-2 py-1">
                <span className="w-8 text-center text-xs">{ev.time.elapsed}'</span>
                <div className="flex items-center gap-1.5 flex-1">
                    <Avatar className="w-5 h-5"><AvatarImage src={ev.team.logo} /></Avatar>
                    <div className="text-xs">
                        <div className="font-semibold flex items-center gap-1">
                          {playerName}
                           <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => onRename('player', ev.player.id, playerName)}><Pencil className="h-3 w-3" /></Button>
                        </div>
                        <div className="text-muted-foreground">
                            {icon} {ev.detail}
                            {assistName && ` (صناعة: ${assistName})`}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <Card>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="key">الأبرز</TabsTrigger>
                    <TabsTrigger value="all">كل الأحداث</TabsTrigger>
                </TabsList>
                <CardContent className="p-0">
                    <div className="flex h-[70vh]">
                        {/* Home Team Events */}
                        <div className="w-1/2 border-r pr-2 overflow-y-auto flex flex-col-reverse">
                            {eventsToShow.map((ev, i) => (
                                ev.team.id === fixture.teams.home.id ? <div key={`home-${i}`}>{renderEvent(ev, true)}</div> : <div key={`home-empty-${i}`} className="h-10"></div>
                            ))}
                        </div>
                        {/* Away Team Events */}
                        <div className="w-1/2 pl-2 overflow-y-auto flex flex-col-reverse">
                           {eventsToShow.map((ev, i) => (
                                ev.team.id === fixture.teams.away.id ? <div key={`away-${i}`}>{renderEvent(ev, false)}</div> : <div key={`away-empty-${i}`} className="h-10"></div>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Tabs>
        </Card>
    );
};

const STATS_TRANSLATIONS: { [key: string]: string } = {
    "Shots on Goal": "تسديدات على المرمى", "Shots off Goal": "تسديدات خارج المرمى", "Total Shots": "إجمالي التسديدات",
    "Blocked Shots": "تسديدات تم صدها", "Shots insidebox": "تسديدات من الداخل", "Shots outsidebox": "تسديدات من الخارج",
    "Fouls": "أخطاء", "Corner Kicks": "ركلات ركنية", "Offsides": "تسلل", "Ball Possession": "الاستحواذ",
    "Yellow Cards": "بطاقات صفراء", "Red Cards": "بطاقات حمراء", "Goalkeeper Saves": "تصديات الحارس",
    "Total passes": "إجمالي التمريرات", "Passes accurate": "تمريرات صحيحة", "Passes %": "دقة التمرير",
};

const StatsView = ({ stats, fixture }: { stats: any[], fixture: FixtureType }) => {
    if (stats.length < 2) return <p className="text-muted-foreground text-center py-4">الإحصائيات غير متاحة</p>;

    const homeStats = stats.find(s => s.team.id === fixture.teams.home.id)?.statistics || [];
    const awayStats = stats.find(s => s.team.id === fixture.teams.away.id)?.statistics || [];

    const combinedStats = homeStats.map((stat: any) => {
        const awayStat = awayStats.find((s: any) => s.type === stat.type);
        return {
            type: stat.type,
            homeValue: stat.value,
            awayValue: awayStat ? awayStat.value : null
        };
    }).filter((s: any) => STATS_TRANSLATIONS[s.type]); // Filter only for stats we can translate

    return (
        <Card>
            <CardContent className="p-4 space-y-3">
                {combinedStats.map((stat, index) => {
                    const homeVal = typeof stat.homeValue === 'string' ? parseInt(stat.homeValue.replace('%', '')) : (stat.homeValue || 0);
                    const awayVal = typeof stat.awayValue === 'string' ? parseInt(stat.awayValue.replace('%', '')) : (stat.awayValue || 0);
                    const total = homeVal + awayVal;
                    const homePercentage = total > 0 ? (homeVal / total) * 100 : 50;

                    return (
                        <div key={index} className="space-y-1">
                             <div className="flex justify-between items-center text-sm font-bold">
                                <span>{stat.homeValue ?? 0}</span>
                                <span className="text-muted-foreground text-xs">{STATS_TRANSLATIONS[stat.type] || stat.type}</span>
                                <span>{stat.awayValue ?? 0}</span>
                            </div>
                            <Progress value={homePercentage} className="h-2 [&>div]:bg-primary" />
                        </div>
                    )
                })}
            </CardContent>
        </Card>
    );
};

const StandingsView = ({ standings, teamId }: { standings: Standing[] | null, teamId: number }) => {
    if (!standings || standings.length === 0) {
        return <p className="text-center py-8 text-muted-foreground">الترتيب غير متاح حاليًا.</p>
    }
    return (
        <Table>
            <TableHeader><TableRow>
                <TableHead className="text-center">ن</TableHead><TableHead className="text-center">خ</TableHead><TableHead className="text-center">ت</TableHead><TableHead className="text-center">ف</TableHead><TableHead className="text-center">ل</TableHead><TableHead className="w-1/2 text-right">الفريق</TableHead>
            </TableRow></TableHeader>
            <TableBody>
            {standings.map((s) => (
                <TableRow key={s.team.id} className={cn(s.team.id === teamId ? 'bg-primary/10' : '')}>
                    <TableCell className="text-center font-bold">{s.points}</TableCell>
                    <TableCell className="text-center">{s.all.lose}</TableCell>
                    <TableCell className="text-center">{s.all.draw}</TableCell>
                    <TableCell className="text-center">{s.all.win}</TableCell>
                    <TableCell className="text-center">{s.all.played}</TableCell>
                    <TableCell className="font-medium"><div className="flex items-center gap-2 justify-end">
                        <span className="truncate">{s.team.name}</span>
                        <Avatar className="h-6 w-6"><AvatarImage src={s.team.logo} /></Avatar>
                        <span>{s.rank}</span>
                    </div></TableCell>
                </TableRow>
            ))}
            </TableBody>
        </Table>
    );
}

// --- MAIN SCREEN COMPONENT ---
export function MatchDetailScreen({ navigate, goBack, canGoBack, fixture, headerActions }: ScreenProps & { fixtureId: number; fixture: FixtureType, headerActions?: React.ReactNode }) {
    const { lineups, events, stats, h2h, standings, loading, error } = useMatchData(fixture);
    const [activeLineup, setActiveLineup] = useState<'home' | 'away'>('home');
    const { isAdmin } = useAdmin();
    const { db } = useFirestore();
    const [renameItem, setRenameItem] = useState<{ id: number; name: string; type: RenameType } | null>(null);
    const [isRenameOpen, setRenameOpen] = useState(false);
    const [customPlayerNames, setCustomPlayerNames] = useState<Map<number, string>>(new Map());

    const fetchCustomNames = useCallback(async () => {
        if (!db) return;
        const playersColRef = collection(db, 'playerCustomizations');
        try {
            const playersSnapshot = await getDocs(playersColRef);
            const playerNames = new Map<number, string>();
            playersSnapshot.forEach(doc => playerNames.set(Number(doc.id), doc.data().customName));
            setCustomPlayerNames(playerNames);
        } catch (error) {
             const permissionError = new FirestorePermissionError({ path: 'playerCustomizations', operation: 'list' });
             errorEmitter.emit('permission-error', permissionError);
        }
    }, [db]);

    useEffect(() => { fetchCustomNames(); }, [fetchCustomNames]);
    
    const getPlayerName = useCallback((id: number, defaultName: string) => {
        return customPlayerNames.get(id) || defaultName;
    }, [customPlayerNames]);

    const handleOpenRename = (type: RenameType, id: number, name: string) => {
        setRenameItem({ id, name, type });
        setRenameOpen(true);
    };

    const handleSaveRename = async (newName: string) => {
        if (!renameItem || !db) return;
        const collectionName = `${renameItem.type}Customizations`;
        const docRef = doc(db, collectionName, String(renameItem.id));
        await setDoc(docRef, { customName: newName });
        fetchCustomNames();
    };

    if (loading && lineups.length === 0) {
        return (
            <div className="flex h-full flex-col bg-background">
                <ScreenHeader title="تفاصيل المباراة" onBack={goBack} canGoBack={canGoBack} actions={headerActions} />
                <div className="flex-1 p-4 space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-96 w-full" /></div>
            </div>
        );
    }
     if (error) {
        return <div className="flex h-full flex-col bg-background"><ScreenHeader title="خطأ" onBack={goBack} canGoBack={canGoBack} /><div className="text-center text-red-500 py-10">حدث خطأ: {error}</div></div>
    }
    
    const homeLineup = lineups.find(l => l.team.id === fixture.teams.home.id);
    const awayLineup = lineups.find(l => l.team.id === fixture.teams.away.id);
    const lineupToShow = activeLineup === 'home' ? homeLineup : awayLineup;
    const opponentTeam = activeLineup === 'home' ? awayLineup?.team : homeLineup?.team;
    
    return (
        <div className="flex h-full flex-col bg-background">
            {renameItem && <RenameDialog isOpen={isRenameOpen} onOpenChange={setRenameOpen} currentName={renameItem.name} onSave={handleSaveRename} itemType={renameItem.type === 'player' ? 'اللاعب' : 'الفريق'} />}
            <ScreenHeader title={fixture.league.name} onBack={goBack} canGoBack={canGoBack} actions={headerActions} />
            <div className="p-4 flex-1 overflow-y-auto">
                 <div className="text-center mb-4">
                    <div className="flex justify-around items-center">
                        <div className="flex flex-col items-center gap-2 w-1/3">
                            <Avatar className="h-16 w-16"><AvatarImage src={fixture.teams.home.logo} /></Avatar>
                            <h2 className="text-lg font-bold">{fixture.teams.home.name}</h2>
                        </div>
                        <div className="text-4xl font-bold">
                            {fixture.goals.home ?? '-'} - {fixture.goals.away ?? '-'}
                        </div>
                         <div className="flex flex-col items-center gap-2 w-1/3">
                            <Avatar className="h-16 w-16"><AvatarImage src={fixture.teams.away.logo} /></Avatar>
                            <h2 className="text-lg font-bold">{fixture.teams.away.name}</h2>
                        </div>
                    </div>
                     <p className="text-muted-foreground text-sm mt-2">{fixture.fixture.status.long}</p>
                 </div>
                 
                <Tabs defaultValue="lineups">
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="lineups">التشكيلة</TabsTrigger>
                        <TabsTrigger value="events">الأحداث</TabsTrigger>
                        <TabsTrigger value="stats">الإحصائيات</TabsTrigger>
                        <TabsTrigger value="standings">الترتيب</TabsTrigger>
                    </TabsList>
                    <TabsContent value="lineups" className="mt-4 space-y-4">
                        {h2h && h2h.length > 0 && <H2HView h2h={h2h} fixture={fixture} homeName={fixture.teams.home.name} awayName={fixture.teams.away.name} />}
                        <div className="flex justify-center gap-4">
                             <Button onClick={() => setActiveLineup('home')} variant={activeLineup === 'home' ? 'default' : 'outline'}>{fixture.teams.home.name}</Button>
                             <Button onClick={() => setActiveLineup('away')} variant={activeLineup === 'away' ? 'default' : 'outline'}>{fixture.teams.away.name}</Button>
                        </div>
                        {lineupToShow && 
                            <LineupField 
                                lineup={lineupToShow}
                                opponentTeam={opponentTeam}
                                events={events}
                                getPlayerName={getPlayerName}
                                onRename={handleOpenRename}
                            />
                        }
                        {!lineupToShow && !loading && 
                             <div className="flex items-center justify-center h-64 text-muted-foreground">
                                التشكيلة غير متاحة حالياً
                             </div>
                        }
                    </TabsContent>
                    <TabsContent value="events" className="mt-4">
                       <EventsView events={events} fixture={fixture} getPlayerName={getPlayerName} onRename={handleOpenRename} />
                    </TabsContent>
                     <TabsContent value="stats" className="mt-4">
                       <StatsView stats={stats} fixture={fixture} />
                    </TabsContent>
                     <TabsContent value="standings" className="mt-4">
                       <StandingsView standings={standings} teamId={fixture.teams.home.id} />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}

    

