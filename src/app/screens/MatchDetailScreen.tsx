"use client";
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from '@/hooks/use-toast';
import { useAdmin, useFirestore } from '@/firebase/provider';
import { doc, getDocs, collection, setDoc } from 'firebase/firestore';
import type { Fixture as FixtureType, Player as PlayerType, Team, MatchEvent, Standing, PlayerStats } from '@/lib/types';
import { RenameDialog } from '@/components/RenameDialog';
import { ScreenHeader } from '@/components/ScreenHeader';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { Star, Pencil, Copy, Heart, ShieldCheck, Calendar, Clock, MapPin } from 'lucide-react';
import { NoteDialog } from '@/components/NoteDialog';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { MatchTimeline } from '@/components/MatchTimeline';
import { MatchStatistics } from '@/components/MatchStatistics';
import { LineupField } from '@/components/LineupField';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';


interface LineupData {
  team: Team;
  coach?: any;
  formation?: string;
  startXI: PlayerStats[];
  substitutes: PlayerStats[];
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
  loading: boolean;
  error: string | null;
}

type RenameType = 'team' | 'player' | 'coach';

function useMatchData(fixture?: FixtureType): MatchDataHook {
  const { toast } = useToast();
  const [data, setData] = useState<MatchDataHook>({
    lineups: [], events: [], stats: [], standings: [], h2h: [], loading: true, error: null,
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
          fetch(`/api/football/players?fixture=${fixtureId}`),
          fetch(`/api/football/standings?league=${leagueId}&season=${CURRENT_SEASON}`),
        ]);
        
        const lineupsDataRaw = lineupsRes.ok ? (await lineupsRes.json()).response || [] : [];
        const eventsData = eventsRes.ok ? (await eventsRes.json()).response || [] : [];
        const statsData = statsRes.ok ? (await statsRes.json()).response || [] : [];
        const h2hData = h2hRes.ok ? (await h2hRes.json()).response || [] : [];
        const playersDataResponse: { team: Team, players: PlayerStats[] }[] = playersRes.ok ? (await playersRes.json()).response || [] : [];
        const standingsData = standingsRes.ok ? (await standingsRes.json()).response[0]?.league?.standings[0] || [] : [];
        
        const allPlayers = playersDataResponse.flatMap(p => p.players);
        const playersMap = new Map(allPlayers.map(p => [p.player.id, p]));

        const enrichedLineups = lineupsDataRaw.map((lineup: any) => {
            const enrich = (playerList: any[] = []) => playerList.map(p => {
                const fullPlayerData = playersMap.get(p.player.id);
                return fullPlayerData || p;
            });
            return {
                ...lineup,
                startXI: enrich(lineup.startXI),
                substitutes: enrich(lineup.substitutes)
            }
        });

        setData({ 
            lineups: enrichedLineups, 
            events: eventsData, 
            stats: statsData, 
            h2h: h2hData,
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
  const { lineups, events, stats, h2h, standings, loading, error } = useMatchData(initialFixture);
  const { isAdmin } = useAdmin();
  const { db } = useFirestore();

  const [renameItem, setRenameItem] = useState<{ id: number, name: string, type: RenameType } | null>(null);
  const [isRenameOpen, setRenameOpen] = useState(false);
  const [customNames, setCustomNames] = useState<{ players: Map<number, string>, teams: Map<number,string>, coaches: Map<number, string> }>({ players: new Map(), teams: new Map(), coaches: new Map() });

  const fetchCustomNames = useCallback(async () => {
    if (!db) return;
    try {
        const [playersSnapshot, teamsSnapshot, coachesSnapshot] = await Promise.all([
            getDocs(collection(db, 'playerCustomizations')),
            getDocs(collection(db, 'teamCustomizations')),
            getDocs(collection(db, 'coachCustomizations')),
        ]);
        
        const playerNames = new Map<number, string>();
        playersSnapshot.forEach(doc => playerNames.set(Number(doc.id), doc.data().customName));

        const teamNames = new Map<number, string>();
        teamsSnapshot.forEach(doc => teamNames.set(Number(doc.id), doc.data().customName));
        
        const coachNames = new Map<number, string>();
        coachesSnapshot.forEach(doc => coachNames.set(Number(doc.id), doc.data().customName));

        setCustomNames({ players: playerNames, teams: teamNames, coaches: coachNames });
    } catch (e) {
      const permissionError = new FirestorePermissionError({
          path: `playerCustomizations, teamCustomizations, or coachCustomizations`,
          operation: 'list',
      });
      errorEmitter.emit('permission-error', permissionError);
    }
  }, [db]);

  useEffect(() => {
    fetchCustomNames();
  }, [fetchCustomNames]);
  
  const getDisplayName = useCallback((type: 'player' | 'team' | 'coach', id: number, defaultName: string) => {
    const map = type === 'player' ? customNames.players : type === 'team' ? customNames.teams : customNames.coaches;
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
  
  const h2hStats = useMemo(() => {
    const total = h2h.length;
    if (total === 0) return { homeWins: 0, awayWins: 0, draws: 0, total: 0 };
    
    let homeWins = 0;
    let awayWins = 0;
    let draws = 0;

    h2h.forEach((match: any) => {
        if(match.teams.winner === null) {
            draws++;
        } else if (match.teams.winner && match.teams.home.id === homeTeamId) {
            homeWins++;
        } else if (match.teams.winner && match.teams.away.id === homeTeamId) {
            homeWins++;
        } else {
            awayWins++;
        }
    });

    return { homeWins, awayWins, draws, total };
  }, [h2h, homeTeamId]);


  const renderTabs = () => {
    const availableTabs = [
      { key: 'details', label: 'تفاصيل' },
      { key: 'lineups', label: 'التشكيلة', condition: lineups && lineups.length > 0 },
      { key: 'events', label: 'المجريات', condition: events && events.length > 0 },
      { key: 'stats', label: 'الإحصائيات', condition: stats && stats.length > 0 },
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
  }, [loading, activeTab, TABS]);

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
        <div className="bg-card p-4 rounded-lg m-4 border">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 justify-end truncate">
                    <span className="font-bold text-lg truncate">{getDisplayName('team', homeTeamId, initialFixture.teams.home.name)}</span>
                     <Avatar className="h-10 w-10">
                         <AvatarImage src={initialFixture.teams.home.logo} />
                         <AvatarFallback>{initialFixture.teams.home.name.substring(0, 2)}</AvatarFallback>
                    </Avatar>
                </div>
                <div className="font-bold text-3xl px-2 bg-muted rounded-md">
                   {initialFixture.goals.home ?? ''} - {initialFixture.goals.away ?? ''}
                </div>
                <div className="flex items-center gap-2 flex-1 truncate">
                      <Avatar className="h-10 w-10">
                         <AvatarImage src={initialFixture.teams.away.logo} />
                         <AvatarFallback>{initialFixture.teams.away.name.substring(0, 2)}</AvatarFallback>
                    </Avatar>
                    <span className="font-bold text-lg truncate">{getDisplayName('team', awayTeamId, initialFixture.teams.away.name)}</span>
                </div>
            </div>
             <div className="text-center text-sm text-primary mt-2">
                {initialFixture.fixture.status.long}
            </div>
        </div>

        <Tabs defaultValue="details" value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5 h-auto">
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

            <TabsContent value="lineups" className="p-0">
                 <Tabs defaultValue="home" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 h-auto">
                        <TabsTrigger value="away">{getDisplayName('team', awayTeamId, initialFixture.teams.away.name)}</TabsTrigger>
                        <TabsTrigger value="home">{getDisplayName('team', homeTeamId, initialFixture.teams.home.name)}</TabsTrigger>
                    </TabsList>
                    <TabsContent value="home" className="p-4">
                        <LineupField 
                            lineup={homeLineup}
                            events={events}
                            onRename={handleRename} 
                            isAdmin={isAdmin} 
                            getPlayerName={(id, name) => getDisplayName('player', id, name)} 
                            getCoachName={(id, name) => getDisplayName('coach', id, name)}
                        />
                    </TabsContent>
                    <TabsContent value="away" className="p-4">
                        <LineupField 
                            lineup={awayLineup}
                            events={events}
                            onRename={handleRename} 
                            isAdmin={isAdmin} 
                            getPlayerName={(id, name) => getDisplayName('player', id, name)}
                            getCoachName={(id, name) => getDisplayName('coach', id, name)}
                        />
                    </TabsContent>
                </Tabs>
            </TabsContent>

            <TabsContent value="events" className="p-4">
                 <MatchTimeline events={events} homeTeamId={homeTeamId} awayTeamId={awayTeamId} getPlayerName={(id, name) => getDisplayName('player', id, name)} />
            </TabsContent>
            
            <TabsContent value="stats" className="p-4">
                <MatchStatistics homeStats={homeStats} awayStats={awayStats} />
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
                                        <img src={s.team.logo} className="h-5 w-5" alt={s.team.name} />
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
