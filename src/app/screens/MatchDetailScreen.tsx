"use client";
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from '@/hooks/use-toast';
import { useAdmin, useFirestore } from '@/firebase/provider';
import { doc, getDocs, collection, setDoc } from 'firebase/firestore';
import type { Fixture as FixtureType, Player as PlayerType, Team, MatchEvent, Standing, PlayerStats as EnrichedPlayer } from '@/lib/types';
import { RenameDialog } from '@/components/RenameDialog';
import { ScreenHeader } from '@/components/ScreenHeader';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { Star, Pencil, Copy, Heart, ShieldCheck, Calendar, Clock, MapPin, ArrowUp, ArrowDown, User } from 'lucide-react';
import { NoteDialog } from '@/components/NoteDialog';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { MatchStatistics } from '@/components/MatchStatistics';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Image from 'next/image';
import { Card } from '@/components/ui/card';

// --- TYPE DEFINITIONS ---
interface LineupData {
  team: Team;
  coach?: any;
  formation?: string;
  startXI: EnrichedPlayer[];
  substitutes: EnrichedPlayer[];
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
  players: { [key: number]: EnrichedPlayer };
  loading: boolean;
  error: string | null;
}

type RenameType = 'team' | 'player' | 'coach';


// ✅ جلب بيانات اللاعبين مع الصور والتقييما من API-Football
async function fetchPlayerData(fixtureId: number): Promise<{ [key: number]: EnrichedPlayer }> {
  const res = await fetch(`/api/football/fixtures/players?fixture=${fixtureId}`);
  if (!res.ok) return {};
  const json = await res.json();
  if (!json?.response) return {};
  const players: { [key: number]: EnrichedPlayer } = {};
  json.response.forEach((teamData: { team: Team, players: EnrichedPlayer[] }) => {
    teamData.players.forEach((p: EnrichedPlayer) => {
      players[p.player.id] = p;
    });
  });
  return players;
}

//
// 🏟️ عرض التشكيلة مع صور اللاعبين والتبديلات المحسّنة
//
function MatchLineups({ lineups, players, events, getPlayerName, getCoachName, onRename, isAdmin }: any) {
  if (!lineups?.length) return <p className="text-center text-muted-foreground py-4">لا توجد تشكيلات متاحة</p>;

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {lineups.map((team: any) => {
        const teamSubs = events.filter((s: MatchEvent) => s.team.id === team.team.id && s.type === 'subst');
        
        const playersByRow = team.startXI.reduce((acc: any, p: any) => {
            const row = p.player.grid ? p.player.grid.split(':')[0] : '0';
            if (!acc[row]) acc[row] = [];
            acc[row].push(p);
            return acc;
        }, {});

        const sortedRows = Object.keys(playersByRow)
            .sort((a, b) => parseInt(a) - parseInt(b)) 
            .map(rowKey => {
                const row = playersByRow[rowKey];
                // Reverse the horizontal order for the away team (or whichever is on the right)
                 row.sort((a: any, b: any) => parseInt(a.player.grid!.split(':')[1]) - parseInt(b.player.grid!.split(':')[1]));
                return row;
            }).reverse();


        return (
            <Card key={team.team.id} className="p-4 bg-card/80 rounded-2xl shadow-lg overflow-hidden">
                <h2 className="text-center font-bold text-xl mb-4 text-card-foreground">{team.team.name}</h2>
                <div className="relative w-full h-[500px] bg-[url('/football-pitch-vertical.svg')] bg-cover bg-center rounded-lg border-2 border-green-500/20">
                   <div className="absolute inset-0 flex flex-col justify-around p-3">
                    {sortedRows.map((row, i) => (
                        <div key={i} className="flex justify-around items-center">
                        {row.map((p: any) => {
                            const info = players[p.player.id] || { player: p.player, statistics: [] };
                            const rating = info.statistics[0]?.games?.rating;
                             return (
                                <motion.div
                                    key={p.player.id}
                                    className="flex flex-col items-center"
                                    initial={{ scale: 0, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ delay: i * 0.05, type: 'spring', stiffness: 300, damping: 15 }}
                                >
                                     <div className="relative w-12 h-12">
                                        <Avatar className="h-12 w-12 shadow-lg border-2 border-white/70">
                                            <AvatarImage src={info.player.photo} alt={info.player.name} />
                                            <AvatarFallback><User/></AvatarFallback>
                                        </Avatar>
                                        {rating && rating !== "N/A" &&
                                            <div className="absolute -top-1 -right-1 text-white bg-blue-600 text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-background">
                                                {parseFloat(rating).toFixed(1)}
                                            </div>
                                        }
                                        </div>
                                        <span className="text-white text-xs font-semibold mt-1 bg-black/60 px-1.5 py-0.5 rounded-md shadow-md">
                                            {getPlayerName(info.player.id, info.player.name)}
                                        </span>
                                </motion.div>
                            );
                        })}
                        </div>
                    ))}
                    </div>
                </div>

                {team.coach?.name && (
                    <div className="mt-4 pt-3 border-t border-border text-center">
                        <span className="font-medium text-muted-foreground">👔 {getCoachName(team.coach.id, team.coach.name)}</span>
                    </div>
                )}
                
                 {teamSubs.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-border">
                    <h3 className="text-center font-bold text-sm mb-2 text-muted-foreground">التبديلات</h3>
                    <div className="flex flex-col gap-2 text-sm">
                      {teamSubs.map((sub: MatchEvent, i: number) => (
                        <div key={i} className="flex items-center justify-between text-xs p-1.5 bg-background/50 rounded-md">
                          <div className="flex items-center gap-2 text-green-600 font-semibold">
                            <ArrowUp size={16} />
                            <span>{getPlayerName(sub.player.id, sub.player.name)}</span>
                          </div>
                          <span className="font-bold text-muted-foreground">{sub.time.elapsed}'</span>
                          <div className="flex items-center gap-2 text-red-600 font-semibold">
                            <span>{getPlayerName(sub.assist!.id!, sub.assist!.name!)}</span>
                            <ArrowDown size={16} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </Card>
        )
      })}
    </div>
  );
}


//
// 🕒 عرض المجريات بخط زمني عمودي متقابل
//
function MatchTimeline({ events, homeTeamId, getPlayerName }: { events: MatchEvent[], homeTeamId: number, getPlayerName: (id: number, name: string) => string }) {
  if (!events?.length) return <p className="text-center text-muted-foreground py-4">لا توجد مجريات متاحة</p>;

  // ترتيب المجريات من الدقيقة 1 في الأسفل إلى 90 في الأعلى
  const sorted = [...events].sort((a, b) => a.time.elapsed - b.time.elapsed);

  return (
    <div className="relative w-full flex justify-center p-4">
      {/* العمود المركزي */}
      <div className="absolute w-0.5 bg-border h-full top-0 left-1/2 transform -translate-x-1/2" />

      <div className="w-full max-w-2xl flex flex-col gap-6">
        {sorted.map((e, idx) => {
          const isHome = e.team.id === homeTeamId;
          const sideClass = isHome ? "items-end" : "items-start";
          const textSideClass = isHome ? "text-right" : "text-left";
          const eventPlayerName = getPlayerName(e.player.id, e.player.name);
          const assistPlayerName = e.assist?.id ? getPlayerName(e.assist.id, e.assist.name || '') : null;

          return (
            <div key={idx} className={`relative flex ${isHome ? 'justify-end' : 'justify-start'}`}>
              {/* Time Indicator on the line */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-card border-2 border-primary text-primary font-bold text-xs rounded-full z-10">
                {e.time.elapsed}'
              </div>

              {/* Event Card */}
              <motion.div
                className={`w-[calc(50%-2rem)] flex ${sideClass}`}
                initial={{ opacity: 0, x: isHome ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
              >
                <div className={`p-2 rounded-lg shadow-md bg-card border w-auto min-w-[120px] ${textSideClass}`}>
                  <p className="font-bold text-sm">{eventPlayerName}</p>
                  <p className="text-xs text-muted-foreground">{e.type}{e.detail ? ` (${e.detail})` : ""}</p>
                  {e.type === 'Goal' && assistPlayerName && <p className="text-xs text-blue-500">صناعة: {assistPlayerName}</p>}
                </div>
              </motion.div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


function useMatchData(fixture?: FixtureType): MatchDataHook {
  const { toast } = useToast();
  const [data, setData] = useState<MatchDataHook>({
    lineups: [], events: [], stats: [], standings: [], h2h: [], players: {}, loading: true, error: null,
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

        const [lineupsRes, eventsRes, statsRes, h2hRes, playersData, standingsRes] = await Promise.all([
          fetch(`/api/football/fixtures/lineups?fixture=${fixtureId}`),
          fetch(`/api/football/fixtures/events?fixture=${fixtureId}`),
          fetch(`/api/football/fixtures/statistics?fixture=${fixtureId}`),
          fetch(`/api/football/fixtures/headtohead?h2h=${teamIds}`),
          fetchPlayerData(fixtureId),
          fetch(`/api/football/standings?league=${leagueId}&season=${CURRENT_SEASON}`),
        ]);
        
        const lineupsDataRaw = lineupsRes.ok ? (await lineupsRes.json()).response || [] : [];
        const eventsData = eventsRes.ok ? (await eventsRes.json()).response || [] : [];
        const statsData = statsRes.ok ? (await statsRes.json()).response || [] : [];
        const h2hData = h2hRes.ok ? (await h2hRes.json()).response || [] : [];
        const standingsData = standingsRes.ok ? (await standingsRes.json()).response[0]?.league?.standings[0] || [] : [];
        
        setData({ 
            lineups: lineupsDataRaw, 
            events: eventsData, 
            stats: statsData, 
            h2h: h2hData,
            standings: standingsData, 
            players: playersData,
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
  const { lineups, events, stats, h2h, standings, players, loading, error } = useMatchData(initialFixture);
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
            <TabsList className="grid w-full grid-cols-3 md:grid-cols-5 h-auto">
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
               <MatchLineups 
                    lineups={lineups} 
                    players={players} 
                    events={events}
                    getPlayerName={(id: number, name: string) => getDisplayName('player', id, name)}
                    getCoachName={(id: number, name: string) => getDisplayName('coach', id, name)}
                    onRename={handleRename}
                    isAdmin={isAdmin}
                  />
            </TabsContent>

            <TabsContent value="events" className="p-4">
                 <MatchTimeline 
                    events={events} 
                    homeTeamId={homeTeamId} 
                    getPlayerName={(id: number, name: string) => getDisplayName('player', id, name)} 
                 />
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
