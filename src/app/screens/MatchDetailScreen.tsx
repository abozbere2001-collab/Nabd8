"use client";
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from '@/lib/utils';
import type { Fixture as FixtureType, Standing, Team, Favorites, Player as PlayerType, MatchEvent } from '@/lib/types';
import { useAdmin, useAuth, useFirestore } from '@/firebase/provider';
import { doc, setDoc, getDocs, collection } from 'firebase/firestore';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { useToast } from '@/hooks/use-toast';
import { Star, Pencil, Goal, ArrowLeftRight, RectangleVertical, Copy, Heart, ShieldCheck, Repeat, AlertTriangle, Calendar, Clock, MapPin } from 'lucide-react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { NoteDialog } from '@/components/NoteDialog';
import { RenameDialog } from '@/components/RenameDialog';
import { Progress } from '@/components/ui/progress';
import { LineupField } from '@/components/LineupField';
import MatchStatistics from '@/components/MatchStatistics';
import MatchTimeline from '@/components/MatchTimeline';


// --- TYPES ---
interface Head2Head {
    wins: { home: number; away: number; };
    draws: number;
}
interface MatchData {
    lineups: any[];
    events: MatchEvent[];
    stats: any[];
    h2h: any[];
    players: any[];
    loading: boolean;
    error: string | null;
}
type RenameType = 'team' | 'player' | 'coach' | 'statistic';


// --- HOOKS ---
function useMatchData(fixture?: FixtureType): MatchData {
  const { toast } = useToast();
  const [data, setData] = useState<MatchData>({
    lineups: [], events: [], stats: [], h2h: [], players: [], loading: true, error: null,
  });

  const CURRENT_SEASON = useMemo(() => new Date(fixture?.fixture.date || Date.now()).getFullYear(), [fixture]);

  useEffect(() => {
    if (!fixture) {
      setData(prev => ({ ...prev, loading: false, error: "لا توجد بيانات مباراة" }));
      return;
    }
    const fetchData = async () => {
      setData(prev => ({ ...prev, loading: true }));
      try {
        const fixtureId = fixture.fixture.id;
        const teamIds = `${fixture.teams.home.id}-${fixture.teams.away.id}`;

        const [lineupsRes, eventsRes, statsRes, h2hRes, playersRes] = await Promise.all([
          fetch(`/api/football/fixtures/lineups?fixture=${fixtureId}`),
          fetch(`/api/football/fixtures/events?fixture=${fixtureId}`),
          fetch(`/api/football/statistics?fixture=${fixtureId}`),
          fetch(`/api/football/fixtures/headtohead?h2h=${teamIds}`),
          fetch(`/api/football/players?fixture=${fixtureId}`)
        ]);

        const lineupsData = lineupsRes.ok ? (await lineupsRes.json()).response || [] : [];
        const eventsData = eventsRes.ok ? (await eventsRes.json()).response || [] : [];
        const statsData = statsRes.ok ? (await statsRes.json()).response || [] : [];
        const h2hData = h2hRes.ok ? (await h2hRes.json()).response || [] : [];
        const playersData = playersRes.ok ? (await playersRes.json()).response || [] : [];
        
        setData({ 
            lineups: lineupsData, 
            events: eventsData, 
            stats: statsData,
            h2h: h2hData,
            players: playersData,
            loading: false, 
            error: null 
        });

      } catch (err: any) {
        console.error("❌ fetch error:", err);
        toast({ variant: "destructive", title: "خطأ", description: "فشل تحميل بيانات المباراة" });
        setData({ lineups: [], events: [], stats: [], h2h: [], players: [], loading: false, error: err.message });
      }
    };
    fetchData();
  }, [fixture, toast, CURRENT_SEASON]);

  return data;
}


// --- MAIN COMPONENT ---
export function MatchDetailScreen({ fixture, goBack, canGoBack, navigate }: ScreenProps & { fixture: FixtureType }) {
  const { lineups, events, stats, h2h, players, loading, error } = useMatchData(fixture);
  const { isAdmin, user } = useAuth();
  const { db } = useFirestore();
  const [renameItem, setRenameItem] = useState<{ id: string | number; name: string; type: RenameType; } | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [customNames, setCustomNames] = useState<Map<string, string>>(new Map());
  const [noteTeam, setNoteTeam] = useState<{ id: number; name: string; logo: string; } | null>(null);
  const [isNoteOpen, setIsNoteOpen] = useState(false);

  // --- Custom Names Logic ---
  const fetchCustomNames = useCallback(async () => {
    if (!db) return;
    const collections = ['playerCustomizations', 'coachCustomizations', 'statisticCustomizations'];
    const names = new Map<string, string>();
    try {
      for (const coll of collections) {
        const snapshot = await getDocs(collection(db, coll));
        snapshot.forEach(doc => names.set(`${coll.replace('Customizations', '')}-${doc.id}`, doc.data().customName));
      }
      setCustomNames(names);
    } catch (e) {
      console.error("Error fetching custom names:", e);
    }
  }, [db]);

  useEffect(() => { fetchCustomNames(); }, [fetchCustomNames]);

  const getName = (type: string, id: string | number, defaultName: string) => customNames.get(`${type}-${id}`) || defaultName;
  const getPlayerName = (id: number, defaultName: string) => getName('player', id, defaultName);
  const getCoachName = (id: number, defaultName: string) => getName('coach', id, defaultName);
  const getStatName = (id: string, defaultName: string) => getName('statistic', id, defaultName);
  
  const handleRename = (type: RenameType, id: string | number, name: string) => { setRenameItem({ id, type, name }); setRenameOpen(true); };

  const handleSaveRename = async (newName: string) => {
    if (!renameItem || !db) return;
    const { id, type } = renameItem;
    const collectionName = `${type}Customizations`;
    await setDoc(doc(db, collectionName, String(id)), { customName: newName });
    fetchCustomNames();
  };

  // --- H2H Calculations ---
  const h2hStats = useMemo(() => {
    if (!h2h || h2h.length === 0) return null;
    const homeId = fixture.teams.home.id;
    const awayId = fixture.teams.away.id;
    const stats: Head2Head = { wins: { home: 0, away: 0 }, draws: 0 };
    h2h.forEach(match => {
      if (match.teams.home.winner) {
        if (match.teams.home.id === homeId) stats.wins.home++; else stats.wins.away++;
      } else if (match.teams.away.winner) {
        if (match.teams.away.id === homeId) stats.wins.home++; else stats.wins.away++;
      } else {
        stats.draws++;
      }
    });
    return stats;
  }, [h2h, fixture.teams.home.id, fixture.teams.away.id]);

  const totalH2h = h2hStats ? h2hStats.wins.home + h2hStats.wins.away + h2hStats.draws : 0;
  const homeWinPercentage = totalH2h > 0 ? (h2hStats!.wins.home / totalH2h) * 100 : 0;
  const awayWinPercentage = totalH2h > 0 ? (h2hStats!.wins.away / totalH2h) * 100 : 0;
  const drawPercentage = totalH2h > 0 ? (h2hStats!.draws / totalH2h) * 100 : 0;
  
  // -- Top Scorers & Assists --
  const { topScorers, topAssists } = useMemo(() => {
      if (!players || players.length === 0) return { topScorers: [], topAssists: [] };
      const teamPlayers = players.flatMap((p: any) => p.players);
      
      const scorers = teamPlayers
        .filter((p: any) => p.statistics[0].goals.total > 0)
        .sort((a: any, b: any) => b.statistics[0].goals.total - a.statistics[0].goals.total);
        
      const assists = teamPlayers
        .filter((p: any) => p.statistics[0].goals.assists > 0)
        .sort((a: any, b: any) => b.statistics[0].goals.assists - a.statistics[0].goals.assists);
        
      return { topScorers: scorers, topAssists: assists };
  }, [players]);


  // --- RENDER ---
  if (loading) {
    return (
      <div className="flex flex-col bg-background h-full">
        <ScreenHeader title="جاري التحميل..." onBack={goBack} canGoBack={canGoBack} />
        <div className="p-4 space-y-4"><Skeleton className="h-96 w-full" /></div>
      </div>
    );
  }

  if (error) return <div className="text-center text-red-500 py-10">{error}</div>;

  const home = lineups.find(l => l.team.id === fixture.teams.home.id);
  const away = lineups.find(l => l.team.id === fixture.teams.away.id);
  const isLineupAvailable = lineups && lineups.length > 0;
  const isEventsAvailable = events && events.length > 0;
  const isStatsAvailable = stats && stats.length > 0;
  const isH2hAvailable = h2hStats && totalH2h > 0;
  const isPlayerStatsAvailable = topScorers.length > 0 || topAssists.length > 0;

  return (
    <div className="flex flex-col bg-background h-full">
      {renameItem && <RenameDialog isOpen={renameOpen} onOpenChange={setRenameOpen} currentName={renameItem.name} onSave={handleSaveRename} itemType={renameItem.type} />}
      <ScreenHeader title="تفاصيل المباراة" onBack={goBack} canGoBack={canGoBack} />

      <div className="p-4 overflow-y-auto">
        <Tabs defaultValue="details">
          <TabsList className="grid w-full grid-cols-5 mb-4 h-auto p-0">
             <TabsTrigger value="details">تفاصيل</TabsTrigger>
             {isLineupAvailable && <TabsTrigger value="lineup">التشكيلة</TabsTrigger>}
             {isEventsAvailable && <TabsTrigger value="events">المجريات</TabsTrigger>}
             {isStatsAvailable && <TabsTrigger value="stats">إحصائيات</TabsTrigger>}
             {isPlayerStatsAvailable && <TabsTrigger value="player-stats">أرقام اللاعبين</TabsTrigger>}
          </TabsList>
          
          <TabsContent value="details">
              <Card>
                  <CardHeader><CardTitle>ملخص</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                      {isH2hAvailable && (
                          <div>
                              <h3 className="font-bold mb-2">المواجهات المباشرة ({totalH2h} مباريات)</h3>
                              <div className="space-y-2">
                                  <div className="flex items-center justify-between gap-4">
                                      <span className="text-sm">{fixture.teams.home.name}</span>
                                      <span className="text-sm font-bold">{h2hStats.wins.home} فوز</span>
                                  </div>
                                  <Progress value={homeWinPercentage} className="h-2" />
                                  <div className="flex items-center justify-between gap-4">
                                      <span className="text-sm">تعادل</span>
                                      <span className="text-sm font-bold">{h2hStats.draws}</span>
                                  </div>
                                  <Progress value={drawPercentage} className="h-2 bg-gray-400" />
                                  <div className="flex items-center justify-between gap-4">
                                      <span className="text-sm">{fixture.teams.away.name}</span>
                                      <span className="text-sm font-bold">{h2hStats.wins.away} فوز</span>
                                  </div>
                                  <Progress value={awayWinPercentage} className="h-2" />
                              </div>
                          </div>
                      )}
                       <div>
                            <h3 className="font-bold mb-3">معلومات المباراة</h3>
                            <div className="space-y-3 text-sm">
                                <div className="flex items-center gap-3"><Calendar className="h-4 w-4 text-muted-foreground" /><p>{new Date(fixture.fixture.date).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p></div>
                                <div className="flex items-center gap-3"><Clock className="h-4 w-4 text-muted-foreground" /><p>{new Date(fixture.fixture.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</p></div>
                                {fixture.fixture.referee && <div className="flex items-center gap-3"><ShieldCheck className="h-4 w-4 text-muted-foreground" /><p>الحكم: {fixture.fixture.referee}</p></div>}
                                {fixture.fixture.venue.name && <div className="flex items-center gap-3"><MapPin className="h-4 w-4 text-muted-foreground" /><p>الملعب: {fixture.fixture.venue.name}, {fixture.fixture.venue.city}</p></div>}
                            </div>
                        </div>
                  </CardContent>
              </Card>
          </TabsContent>

          {isLineupAvailable && (
            <TabsContent value="lineup">
                <Tabs defaultValue="home">
                    <TabsList className="grid grid-cols-2 w-full mb-4">
                        <TabsTrigger value="home">{fixture.teams.home.name}</TabsTrigger>
                        <TabsTrigger value="away">{fixture.teams.away.name}</TabsTrigger>
                    </TabsList>
                    <TabsContent value="home"><LineupField lineup={home} onRename={(id: any, name: any) => handleRename('player', id, name)} isAdmin={!!isAdmin} getPlayerName={getPlayerName} getCoachName={getCoachName} /></TabsContent>
                    <TabsContent value="away"><LineupField lineup={away} onRename={(id: any, name: any) => handleRename('player', id, name)} isAdmin={!!isAdmin} getPlayerName={getPlayerName} getCoachName={getCoachName} /></TabsContent>
                </Tabs>
                <p className='text-center text-xs text-muted-foreground mt-2'>* التشكيلة قد تكون متوقعة قبل الإعلان الرسمي</p>
            </TabsContent>
          )}

          {isEventsAvailable && (
             <TabsContent value="events"><MatchTimeline fixture={fixture} events={events} homeTeamId={fixture.teams.home.id} getPlayerName={getPlayerName} /></TabsContent>
          )}
          
          {isStatsAvailable && (
            <TabsContent value="stats"><MatchStatistics fixture={fixture} stats={stats} isAdmin={!!isAdmin} onRename={(id:any, name:any) => handleRename('statistic', id, name)} getStatName={getStatName} /></TabsContent>
          )}

          {isPlayerStatsAvailable && (
             <TabsContent value="player-stats">
                 <Card>
                    <CardHeader><CardTitle>أبرز اللاعبين</CardTitle></CardHeader>
                    <CardContent className="space-y-6">
                        {topScorers.length > 0 && (
                             <div>
                                <h3 className="font-bold mb-2">الهدافون</h3>
                                {topScorers.map((p: any) => (
                                    <div key={p.player.id} className="flex items-center justify-between text-sm py-1 border-b">
                                        <div className="flex items-center gap-2">
                                            <Avatar className="h-6 w-6"><AvatarImage src={p.player.photo} /><AvatarFallback>{p.player.name.charAt(0)}</AvatarFallback></Avatar>
                                            <span>{getPlayerName(p.player.id, p.player.name)}</span>
                                        </div>
                                        <span className="font-bold">{p.statistics[0].goals.total}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        {topAssists.length > 0 && (
                            <div>
                                <h3 className="font-bold mb-2">صناع اللعب</h3>
                                {topAssists.map((p: any) => (
                                     <div key={p.player.id} className="flex items-center justify-between text-sm py-1 border-b">
                                        <div className="flex items-center gap-2">
                                            <Avatar className="h-6 w-6"><AvatarImage src={p.player.photo} /><AvatarFallback>{p.player.name.charAt(0)}</AvatarFallback></Avatar>
                                            <span>{getPlayerName(p.player.id, p.player.name)}</span>
                                        </div>
                                        <span className="font-bold">{p.statistics[0].goals.assists}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                 </Card>
             </TabsContent>
          )}

        </Tabs>
      </div>
    </div>
  );
}
