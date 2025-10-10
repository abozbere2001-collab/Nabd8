"use client";
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from '@/hooks/use-toast';
import { useAdmin, useFirestore } from '@/firebase/provider';
import { doc, getDocs, collection, setDoc } from 'firebase/firestore';
import type { Fixture as FixtureType, Player as PlayerType, Team, MatchEvent, Standing } from '@/lib/types';
import { RenameDialog } from '@/components/RenameDialog';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { Star, Pencil, Copy, Heart, ShieldCheck, Calendar, Clock, MapPin } from 'lucide-react';
import { NoteDialog } from '@/components/NoteDialog';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { MatchTimeline } from '@/components/MatchTimeline';
import { MatchStatistics } from '@/components/MatchStatistics';
import { LineupField } from '@/components/LineupField';
import { PlayerStats } from '@/components/PlayerStats';


interface PlayerWithStats {
  player: PlayerType & { pos?: string; grid?: string; number?: number; };
  statistics: {
      games: {
          minutes: number;
          number: number;
          position: string;
          rating: string;
          captain: boolean;
          substitute: boolean;
      };
      // Add other stats as needed
  }[];
}
interface LineupData {
  team: Team;
  coach?: any;
  formation?: string;
  startXI: PlayerWithStats[];
  substitutes: PlayerWithStats[];
}

interface H2HData {
    fixture: { id: number };
    teams: { home: Team, away: Team, winner?: boolean | null };
    goals: { home: number | null, away: number | null };
}

interface MatchDataHook {
  lineups: LineupData[];
  events: MatchEvent[];
  stats: any[];
  standings: Standing[];
  h2h: H2HData[];
  players: PlayerType[];
  loading: boolean;
  error: string | null;
}

type RenameType = 'team' | 'player' | 'coach';

function useMatchData(fixture?: FixtureType): MatchDataHook {
  const { toast } = useToast();
  const [data, setData] = useState<MatchDataHook>({
    lineups: [], events: [], stats: [], standings: [], h2h: [], players: [], loading: true, error: null,
  });

  const CURRENT_SEASON = useMemo(() => new Date(fixture?.fixture.date || Date.now()).getFullYear(), [fixture]);

  useEffect(() => {
    if (!fixture) {
      setData(prev => ({ ...prev, loading: false, error: "لا توجد بيانات مباراة" }));
      return;
    }
    const fetchData = async () => {
      setData(prev => ({ ...prev, loading: true, error: null }));
      try {
        const fixtureId = fixture.fixture.id;
        const leagueId = fixture.league.id;
        const teamIds = `${fixture.teams.home.id}-${fixture.teams.away.id}`;

        const [lineupsRes, eventsRes, statsRes, h2hRes, playersRes, standingsRes] = await Promise.all([
          fetch(`/api/football/fixtures/lineups?fixture=${fixtureId}`),
          fetch(`/api/football/fixtures/events?fixture=${fixtureId}`),
          fetch(`/api/football/fixtures/statistics?fixture=${fixtureId}`),
          fetch(`/api/football/fixtures/headtohead?h2h=${teamIds}`),
          fetch(`/api/football/players?fixture=${fixtureId}`), // Fetch players by fixture
          fetch(`/api/football/standings?league=${leagueId}&season=${CURRENT_SEASON}`),
        ]);
        
        const lineupsData = lineupsRes.ok ? (await lineupsRes.json()).response || [] : [];
        const eventsData = eventsRes.ok ? (await eventsRes.json()).response || [] : [];
        const statsData = statsRes.ok ? (await statsRes.json()).response || [] : [];
        const h2hData = h2hRes.ok ? (await h2hRes.json()).response || [] : [];
        const playersData = playersRes.ok ? (await playersRes.json()).response || [] : [];
        const standingsData = standingsRes.ok ? (await standingsRes.json()).response[0]?.league?.standings[0] || [] : [];
        
        // Merge player stats into lineups
        const enrichedLineups = lineupsData.map((lineup: LineupData) => {
            const teamPlayers = playersData.find((p: any) => p.team.id === lineup.team.id)?.players || [];
            const mergeStats = (playerList: PlayerWithStats[]) => {
                return playerList.map(p => {
                    const playerStats = teamPlayers.find((tp: any) => tp.player.id === p.player.id);
                    if (playerStats) {
                        return { ...p, statistics: playerStats.statistics };
                    }
                    return p;
                });
            };
            return {
                ...lineup,
                startXI: mergeStats(lineup.startXI),
                substitutes: mergeStats(lineup.substitutes),
            };
        });

        setData({ 
            lineups: enrichedLineups, 
            events: eventsData, 
            stats: statsData, 
            h2h: h2hData,
            players: playersData.map((p: any) => p.player),
            standings: standingsData, 
            loading: false, 
            error: null 
        });

      } catch (err: any) {
        console.error("❌ fetch error:", err);
        toast({ variant: "destructive", title: "خطأ", description: "فشل تحميل بيانات المباراة" });
        setData(prev => ({ ...prev, loading: false, error: err.message }));
      }
    };
    fetchData();
  }, [fixture, toast, CURRENT_SEASON]);

  return data;
}

export function MatchDetailScreen({ fixture: initialFixture, goBack, canGoBack, navigate }: { fixture: FixtureType; goBack: () => void; canGoBack: boolean; navigate: (screen: any, props: any) => void; }) {
  const { lineups, events, stats, h2h, players, standings, loading, error } = useMatchData(initialFixture);
  const { isAdmin } = useAdmin();
  const { db } = useFirestore();

  const [renameItem, setRenameItem] = useState<{ id: number, name: string, type: RenameType } | null>(null);
  const [isRenameOpen, setRenameOpen] = useState(false);
  const [customNames, setCustomNames] = useState<{ players: Map<number, string>, teams: Map<number,string> }>({ players: new Map(), teams: new Map() });

  const fetchCustomNames = useCallback(async () => {
    if (!db) return;
    try {
        const [playersSnapshot, teamsSnapshot] = await Promise.all([
            getDocs(collection(db, 'playerCustomizations')),
            getDocs(collection(db, 'teamCustomizations')),
        ]);
        
        const playerNames = new Map<number, string>();
        playersSnapshot.forEach(doc => playerNames.set(Number(doc.id), doc.data().customName));

        const teamNames = new Map<number, string>();
        teamsSnapshot.forEach(doc => teamNames.set(Number(doc.id), doc.data().customName));

        setCustomNames({ players: playerNames, teams: teamNames });
    } catch (e) {
      const permissionError = new FirestorePermissionError({
          path: `playerCustomizations or teamCustomizations`,
          operation: 'list',
      });
      errorEmitter.emit('permission-error', permissionError);
    }
  }, [db]);

  useEffect(() => {
    fetchCustomNames();
  }, [fetchCustomNames]);
  
  const getDisplayName = useCallback((type: 'player' | 'team', id: number, defaultName: string) => {
    const map = type === 'player' ? customNames.players : customNames.teams;
    return map.get(id) || defaultName;
  }, [customNames]);

  const handleRename = (type: RenameType, id: number, name: string) => {
    setRenameItem({ id, type, name });
    setRenameOpen(true);
  };
  
  const handleSaveRename = async (newName: string) => {
    if (!renameItem || !db) return;
    const { id, type } = renameItem;
    const collectionName = `${type}Customizations`;
    const docRef = doc(db, collectionName, String(id));
    try {
      await setDoc(docRef, { customName: newName });
      fetchCustomNames(); 
    } catch(e) {
      const permissionError = new FirestorePermissionError({
          path: docRef.path,
          operation: 'create',
          requestResourceData: { customName: newName }
      });
      errorEmitter.emit('permission-error', permissionError);
    }
  };

  const homeTeamId = initialFixture.teams.home.id;
  const awayTeamId = initialFixture.teams.away.id;
  
  const homeLineup = useMemo(() => lineups.find(l => l.team.id === homeTeamId), [lineups, homeTeamId]);
  const awayLineup = useMemo(() => lineups.find(l => l.team.id === awayTeamId), [lineups, awayTeamId]);
  
  const homeStats = useMemo(() => stats.find(s => s.team.id === homeTeamId)?.statistics, [stats, homeTeamId]);
  const awayStats = useMemo(() => stats.find(s => s.team.id === awayTeamId)?.statistics, [stats, awayTeamId]);
  
  const homePlayers = useMemo(() => players.filter(p => homeLineup?.startXI.some(s => s.player.id === p.id) || homeLineup?.substitutes.some(s => s.player.id === p.id)), [players, homeLineup]);
  const awayPlayers = useMemo(() => players.filter(p => awayLineup?.startXI.some(s => s.player.id === p.id) || awayLineup?.substitutes.some(s => s.player.id === p.id)), [players, awayLineup]);

  const h2hStats = useMemo(() => {
    const total = h2h.length;
    if (total === 0) return { homeWins: 0, awayWins: 0, draws: 0, total: 0 };
    
    let homeWins = 0;
    let awayWins = 0;
    let draws = 0;

    h2h.forEach(match => {
        if(match.teams.home.id === homeTeamId && match.teams.home.winner) homeWins++;
        else if (match.teams.away.id === homeTeamId && match.teams.away.winner) homeWins++;
        else if(match.teams.home.id === awayTeamId && match.teams.home.winner) awayWins++;
        else if (match.teams.away.id === awayTeamId && match.teams.away.winner) awayWins++;
        else draws++;
    });

    return { homeWins, awayWins, draws, total };
  }, [h2h, homeTeamId, awayTeamId]);


  const renderTabs = () => {
    const availableTabs = [
      { key: 'details', label: 'تفاصيل' },
      { key: 'lineups', label: 'التشكيلة', condition: lineups && lineups.length > 0 },
      { key: 'events', label: 'المجريات', condition: events && events.length > 0 },
      { key: 'stats', label: 'الإحصائيات', condition: stats && stats.length > 0 },
      { key: 'players', label: 'أرقام اللاعبين', condition: players && players.length > 0 },
      { key: 'standings', label: 'الترتيب', condition: standings && standings.length > 0 },
    ];
    return availableTabs.filter(tab => tab.condition !== false);
  };
  
  const TABS = renderTabs();
  const [activeTab, setActiveTab] = useState(TABS[0]?.key || 'details');

  useEffect(() => {
      if(!loading) {
          const newTabs = renderTabs();
          if(newTabs.length > 0 && !newTabs.find(t => t.key === activeTab)) {
            setActiveTab(newTabs[0].key);
          }
      }
  }, [loading, activeTab]);

  if (loading) {
      return (
          <div className="flex h-full flex-col bg-background">
              <ScreenHeader title="جاري تحميل التفاصيل..." onBack={goBack} canGoBack={canGoBack} />
              <div className="p-4 space-y-4">
                  <Skeleton className="h-96 w-full" />
              </div>
          </div>
      );
  }

  if (error) {
      return (
           <div className="flex h-full flex-col bg-background">
              <ScreenHeader title="خطأ" onBack={goBack} canGoBack={canGoBack} />
              <div className="flex flex-1 items-center justify-center text-destructive p-4">
                  {error}
              </div>
          </div>
      )
  }

  return (
    <div className="flex flex-col bg-background h-full">
      {renameItem && <RenameDialog isOpen={isRenameOpen} onOpenChange={setRenameOpen} currentName={renameItem.name} onSave={handleSaveRename} itemType={renameItem.type} />}
      <ScreenHeader title={`${getDisplayName('team', homeTeamId, initialFixture.teams.home.name)} ضد ${getDisplayName('team', awayTeamId, initialFixture.teams.away.name)}`} onBack={goBack} canGoBack={canGoBack} />
      
      <div className="flex-1 overflow-y-auto">
        <Tabs defaultValue="details" value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 md:grid-cols-6 h-auto">
                {TABS.map(tab => <TabsTrigger key={tab.key} value={tab.key}>{tab.label}</TabsTrigger>)}
            </TabsList>
            
            <TabsContent value="details" className="p-4 space-y-4">
                <div className="bg-card p-4 rounded-lg border">
                    <h3 className="font-bold text-lg mb-3">تفاصيل المباراة</h3>
                    <div className="space-y-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-primary" /><span>{new Date(initialFixture.fixture.date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
                        <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /><span>{new Date(initialFixture.fixture.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span></div>
                        {initialFixture.fixture.venue.name && <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /><span>{initialFixture.fixture.venue.name}, {initialFixture.fixture.venue.city}</span></div>}
                        {initialFixture.fixture.referee && <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /><span>الحكَم: {initialFixture.fixture.referee}</span></div>}
                    </div>
                </div>
                {h2h.length > 0 && <div className="bg-card p-4 rounded-lg border">
                     <h3 className="font-bold text-lg mb-3">المواجهات المباشرة</h3>
                     <p className="text-xs text-muted-foreground mb-4">آخر {h2hStats.total} مواجهات</p>
                     <div className="flex justify-between items-center gap-4">
                         <div className="text-center">
                             <p className="font-bold text-xl">{h2hStats.homeWins}</p>
                             <p className="text-sm">{getDisplayName('team', homeTeamId, initialFixture.teams.home.name)}</p>
                         </div>
                          <div className="text-center">
                             <p className="font-bold text-xl">{h2hStats.draws}</p>
                             <p className="text-sm">تعادل</p>
                         </div>
                         <div className="text-center">
                             <p className="font-bold text-xl">{h2hStats.awayWins}</p>
                             <p className="text-sm">{getDisplayName('team', awayTeamId, initialFixture.teams.away.name)}</p>
                         </div>
                     </div>
                </div>}
            </TabsContent>

            <TabsContent value="lineups" className="p-4">
                <Tabs defaultValue="home_lineup">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="home_lineup">{getDisplayName('team', homeTeamId, initialFixture.teams.home.name)}</TabsTrigger>
                        <TabsTrigger value="away_lineup">{getDisplayName('team', awayTeamId, initialFixture.teams.away.name)}</TabsTrigger>
                    </TabsList>
                    <TabsContent value="home_lineup" className="mt-4">
                        <LineupField 
                            lineup={homeLineup}
                            events={events.filter(e => e.team.id === homeTeamId)} 
                            onRename={handleRename} 
                            isAdmin={isAdmin} 
                            getPlayerName={(id, name) => getDisplayName('player', id, name)} 
                        />
                    </TabsContent>
                    <TabsContent value="away_lineup" className="mt-4">
                        <LineupField 
                            lineup={awayLineup}
                            events={events.filter(e => e.team.id === awayTeamId)} 
                            onRename={handleRename} 
                            isAdmin={isAdmin} 
                            getPlayerName={(id, name) => getDisplayName('player', id, name)}
                        />
                    </TabsContent>
                </Tabs>
            </TabsContent>

            <TabsContent value="events" className="p-4">
                 <MatchTimeline events={events} homeTeamId={homeTeamId} getPlayerName={(id, name) => getDisplayName('player', id, name)} />
            </TabsContent>
            
            <TabsContent value="stats" className="p-4">
                <MatchStatistics homeStats={homeStats} awayStats={awayStats} />
            </TabsContent>
            
            <TabsContent value="players" className="p-4">
                 <PlayerStats players={homePlayers} title={`أرقام لاعبي ${getDisplayName('team', homeTeamId, initialFixture.teams.home.name)}`} />
                 <div className="my-4" />
                 <PlayerStats players={awayPlayers} title={`أرقام لاعبي ${getDisplayName('team', awayTeamId, initialFixture.teams.away.name)}`} />
            </TabsContent>

            <TabsContent value="standings" className="p-0">
                {standings && standings.length > 0 ? (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-card">
                                <th className="p-2 text-right">الفريق</th>
                                <th className="p-2 text-center">ل</th>
                                <th className="p-2 text-center">ف</th>
                                <th className="p-2 text-center">ت</th>
                                <th className="p-2 text-center">خ</th>
                                <th className="p-2 text-center">ن</th>
                            </tr>
                        </thead>
                        <tbody>
                        {standings.map((s) => (
                            <tr key={s.team.id} className={cn("border-b border-border", s.team.id === homeTeamId || s.team.id === awayTeamId ? 'bg-primary/10' : '')}>
                                <td className="p-2">
                                    <div className="flex items-center gap-2">
                                        <span>{s.rank}</span>
                                        <img src={s.team.logo} className="h-5 w-5" />
                                        <span>{getDisplayName('team', s.team.id, s.team.name)}</span>
                                    </div>
                                </td>
                                <td className="p-2 text-center">{s.all.played}</td>
                                <td className="p-2 text-center">{s.all.win}</td>
                                <td className="p-2 text-center">{s.all.draw}</td>
                                <td className="p-2 text-center">{s.all.lose}</td>
                                <td className="p-2 text-center font-bold">{s.points}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                ) : <p className="text-center text-muted-foreground p-4">الترتيب غير متاح حاليًا.</p>}
            </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
