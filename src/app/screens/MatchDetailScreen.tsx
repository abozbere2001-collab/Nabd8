

"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import type { ScreenProps } from '@/app/page';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from "@/components/ui/button";
import { cn } from '@/lib/utils';
import type { Fixture as FixtureType, Standing, Team, Favorites, Player as PlayerType, MatchEvent } from '@/lib/types';
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
import MatchTimeline from '@/components/MatchTimeline';
import MatchStatistics from '@/components/MatchStatistics';


// --- TYPE DEFINITIONS ---
interface PlayerWithStats {
    player: PlayerType;
    statistics?: any[];
}
interface LineupData {
    team: Team;
    coach: { id: number; name: string; photo: string; };
    formation: string;
    startXI: PlayerWithStats[];
    substitutes: PlayerWithStats[];
}

interface H2HData {
    fixture: { id: number, status: { long: string }, date: string };
    teams: { home: Team, away: Team };
    goals: { home: number | null, away: number | null };
}

interface MatchData {
    lineups: LineupData[];
    events: MatchEvent[];
    stats: { team: Team, statistics: { type: string, value: string | number | null }[] }[];
    standings: Standing[];
    h2h: H2HData[];
    loading: boolean;
    error: string | null;
}
type RenameType = 'team' | 'player' | 'coach' | 'statistic';


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
                    fetch(`/api/football/fixtures/statistics?fixture=${fixtureId}`),
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
                            const teamPlayersList: { player: PlayerType }[] = teamPlayersData.response || [];
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
                    events: fetchedEvents,
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
        const matchHomeId = match.teams.home.id;
        const fixtureHomeId = fixture.teams.home.id;

        if (match.goals.home === null || match.goals.away === null) return;
        
        if (match.goals.home === match.goals.away) {
            draws++;
        } else if (match.goals.home > match.goals.away) {
            if (matchHomeId === fixtureHomeId) homeWins++; else awayWins++;
        } else { // away wins
            if (matchHomeId === fixtureHomeId) awayWins++; else homeWins++;
        }
    });
    
    const total = homeWins + awayWins + draws;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-center text-lg">المواجهات المباشرة (آخر {total} مباريات)</CardTitle>
            </CardHeader>
            <CardContent>
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

const SubstitutionsView = ({ events, teamId, getPlayerName, onRename }: { events: MatchEvent[], teamId: number, getPlayerName: (id: number, defaultName: string) => string, onRename: (type: RenameType, id: number, name: string) => void }) => {
    const { isAdmin } = useAdmin();
    const teamSubs = events.filter(e => e.type === 'subst' && e.team.id === teamId);
    
    if (teamSubs.length === 0) return null;

    return (
        <div className="mt-4 pt-4 border-t border-border">
            <h4 className="font-bold text-center mb-3">التبديلات</h4>
            <div className="space-y-2 text-center">
                {teamSubs.map((sub, i) => (
                    <div key={`sub-${i}`} className="text-xs flex items-center justify-center gap-2">
                        <p className="w-6 text-muted-foreground">{sub.time.elapsed}'</p>
                        <div className='flex-1 text-right flex items-center gap-1 justify-end'>
                            {isAdmin && sub.assist.id && <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => onRename('player', sub.assist.id!, getPlayerName(sub.assist.id!, sub.assist.name!))}><Pencil className="h-3 w-3" /></Button>}
                            <p className="text-red-500">{sub.assist.id ? getPlayerName(sub.assist.id, sub.assist.name!) : ''}</p>
                        </div>
                         <ArrowLeftRight className="w-3 h-3 text-muted-foreground" />
                        <div className='flex-1 text-left flex items-center gap-1 justify-start'>
                           <p className="text-green-500">{getPlayerName(sub.player.id, sub.player.name)}</p>
                           {isAdmin && <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => onRename('player', sub.player.id, getPlayerName(sub.player.id, sub.player.name))}><Pencil className="h-3 w-3" /></Button>}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const LineupField = ({ lineup, events, getPlayerName, getCoachName, onRename, fixture }: { lineup: LineupData, events: MatchEvent[], getPlayerName: (id: number, defaultName: string) => string; getCoachName: (id: number, defaultName: string) => string; onRename: (type: RenameType, id: number, name: string) => void, fixture: FixtureType }) => {
  const { isAdmin } = useAdmin();
  if (!lineup || !lineup.startXI || lineup.startXI.length === 0) {
    return <div className="text-center py-6 text-muted-foreground">التشكيلة غير متاحة حاليًا</div>;
  }

  const rowsMap: { [key: number]: PlayerWithStats[] } = {};
  lineup.startXI.forEach((playerWithStats) => {
    const { player } = playerWithStats;
    if (!player.grid) return;
    const [row, col] = player.grid.split(':').map(Number);
    if (!rowsMap[row]) rowsMap[row] = [];
    rowsMap[row].push({ ...playerWithStats, player: { ...player, colIndex: col }});
  });
  
  const sortedRows = Object.values(rowsMap).map(row => row.sort((a, b) => a.player.colIndex! - b.player.colIndex!)).sort((a,b) => (b[0].player.grid.split(':')[0] as any) - (a[0].player.grid.split(':')[0] as any));


  return (
    <Card className="p-3 bg-card/80">
      <div className="relative w-full aspect-[2/3] max-h-[700px] bg-cover bg-center bg-no-repeat rounded-lg overflow-hidden border border-green-500/20" style={{ backgroundImage: `url('/football-pitch-vertical.svg')` }}>
        <div className="absolute inset-0 flex flex-col justify-around p-2">
          {sortedRows.map((row, rowIndex) => (
            <div key={rowIndex} className="flex justify-around items-center w-full">
              {row.map(({ player, statistics }) => {
                const displayName = getPlayerName(player.id, player.name);
                const playerPhoto = player.photo || `https://media.api-sports.io/football/players/${player.id}.png`;
                const rating = statistics?.[0]?.games?.rating;
                
                return (
                  <div key={player.id} className="flex flex-col items-center text-xs text-white w-16 text-center group">
                    <div className="relative w-12 h-12">
                      {rating && (
                        <div className="absolute -top-1 -right-1 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center border-2 border-background bg-gray-800 z-10">
                          {parseFloat(rating).toFixed(1)}
                        </div>
                      )}
                      <Avatar className="w-12 h-12 border-2 border-white/50 bg-black/30">
                        <AvatarImage src={playerPhoto} alt={displayName} />
                        <AvatarFallback>{displayName ? displayName.charAt(0) : '?'}</AvatarFallback>
                      </Avatar>
                      {isAdmin && <Button variant="ghost" size="icon" className="absolute -bottom-1 -left-1 h-5 w-5 opacity-0 group-hover:opacity-100" onClick={() => onRename('player', player.id, displayName)}><Pencil className="h-3 w-3 text-white" /></Button>}
                    </div>
                    <span className="mt-1 bg-black/50 px-1.5 py-0.5 rounded font-semibold truncate w-full text-[11px]">{displayName}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      
      {lineup.coach && (
        <div className="mt-4 pt-4 border-t border-border">
          <h4 className="font-bold text-center mb-2">المدرب</h4>
          <div className="flex items-center justify-center gap-2 group">
            <Avatar className="h-10 w-10"><AvatarImage src={lineup.coach.photo} /></Avatar>
            <p className="font-semibold">{getCoachName(lineup.coach.id, lineup.coach.name)}</p>
            {isAdmin && <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => onRename('coach', lineup.coach.id, getCoachName(lineup.coach.id, lineup.coach.name))}><Pencil className="h-4 w-4" /></Button>}
          </div>
        </div>
      )}

      {lineup.team && <SubstitutionsView events={events} teamId={lineup.team.id} getPlayerName={getPlayerName} onRename={onRename} />}
      
      {lineup.substitutes && lineup.substitutes.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <h4 className="font-bold text-center mb-3">الاحتياط</h4>
           <div className="grid grid-cols-2 gap-2">
            {lineup.substitutes.map(({ player, statistics }) => {
              const rating = statistics?.[0]?.games?.rating;
              return (
                <div key={player.id} className="flex items-center gap-2 p-1 border rounded bg-card/50 group">
                    <div className="relative">
                      <Avatar className="h-8 w-8"><AvatarImage src={player.photo} /></Avatar>
                      {rating && (
                        <div className="absolute -top-1 -right-1 text-white text-[9px] font-bold rounded-full h-4 w-4 flex items-center justify-center border border-background bg-gray-600 z-10">
                          {parseFloat(rating).toFixed(1)}
                        </div>
                      )}
                    </div>
                    <p className="text-xs font-semibold flex-1">{getPlayerName(player.id, player.name)}</p>
                    {isAdmin && <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => onRename('player', player.id, getPlayerName(player.id, player.name))}><Pencil className="h-3 w-3" /></Button>}
                </div>
              )
            })}
           </div>
        </div>
       )}
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
    const [renameItem, setRenameItem] = useState<{ id: string | number; name: string; type: RenameType } | null>(null);
    const [isRenameOpen, setRenameOpen] = useState(false);
    const [customNames, setCustomNames] = useState<{[key: string]: Map<string | number, string>}>({
        player: new Map(),
        coach: new Map(),
        statistic: new Map(),
    });

    const fetchCustomNames = useCallback(async () => {
        if (!db) return;
        const collectionsToFetch = ['playerCustomizations', 'coachCustomizations', 'statisticCustomizations'];
        try {
            const snapshots = await Promise.all(collectionsToFetch.map(c => getDocs(collection(db, c))));
            const names = {
                player: new Map<number, string>(),
                coach: new Map<number, string>(),
                statistic: new Map<string, string>(),
            };
            snapshots[0].forEach(doc => names.player.set(Number(doc.id), doc.data().customName));
            snapshots[1].forEach(doc => names.coach.set(Number(doc.id), doc.data().customName));
            snapshots[2].forEach(doc => names.statistic.set(doc.id, doc.data().customName));

            setCustomNames(names as any);
        } catch (error) {
             const permissionError = new FirestorePermissionError({ path: 'customizations', operation: 'list' });
             errorEmitter.emit('permission-error', permissionError);
        }
    }, [db]);

    useEffect(() => { fetchCustomNames(); }, [fetchCustomNames]);
    
    const getCustomName = useCallback((type: 'player' | 'coach' | 'statistic', id: string | number, defaultName: string) => {
        return customNames[type]?.get(id) || defaultName;
    }, [customNames]);

    const handleOpenRename = (type: RenameType, id: string | number, name: string) => {
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
    
    return (
        <div className="flex h-full flex-col bg-background">
            {renameItem && <RenameDialog isOpen={isRenameOpen} onOpenChange={setRenameOpen} currentName={renameItem.name} onSave={handleSaveRename} itemType={renameItem.type} />}
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
                                events={events}
                                getPlayerName={(id, name) => getCustomName('player', id, name)}
                                getCoachName={(id, name) => getCustomName('coach', id, name)}
                                onRename={handleOpenRename}
                                fixture={fixture}
                            />
                        }
                        {!lineupToShow && !loading && 
                             <div className="flex items-center justify-center h-64 text-muted-foreground">
                                التشكيلة غير متاحة حالياً
                             </div>
                        }
                    </TabsContent>
                    <TabsContent value="events" className="mt-4">
                       <MatchTimeline events={events} fixture={fixture} />
                    </TabsContent>
                     <TabsContent value="stats" className="mt-4">
                       <MatchStatistics stats={stats} fixture={fixture} isAdmin={isAdmin} onRename={handleOpenRename} getStatName={(id, name) => getCustomName('statistic', id, name)} />
                    </TabsContent>
                     <TabsContent value="standings" className="mt-4">
                       <StandingsView standings={standings} teamId={fixture.teams.home.id} />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}

    
