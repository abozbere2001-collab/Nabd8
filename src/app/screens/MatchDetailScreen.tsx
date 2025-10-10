
"use client";
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from '@/hooks/use-toast';
import { useAdmin, useFirestore } from '@/firebase/provider';
import { doc, getDocs, collection, setDoc } from 'firebase/firestore';
import type { Fixture as FixtureType, Player as PlayerType, Team, MatchEvent, Standing } from '@/lib/types';
import { MatchPage } from '@/components/MatchView'; 
import { RenameDialog } from '@/components/RenameDialog';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';

interface PlayerWithStats {
  player: PlayerType & { pos?: string };
  statistics?: any[];
}
interface LineupData {
  team: Team;
  coach?: any;
  formation?: string;
  startXI: PlayerWithStats[];
  substitutes?: PlayerWithStats[];
}

interface H2HData {
    fixture: { id: number };
    teams: { home: Team, away: Team };
    goals: { home: number, away: number };
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

        const [lineupsRes, eventsRes, statsRes, h2hRes, playersRes] = await Promise.all([
          fetch(`/api/football/fixtures/lineups?fixture=${fixtureId}`),
          fetch(`/api/football/fixtures/events?fixture=${fixtureId}`),
          fetch(`/api/football/statistics?fixture=${fixtureId}`),
          fetch(`/api/football/fixtures/headtohead?h2h=${teamIds}`),
          fetch(`/api/football/players?league=${leagueId}&season=${CURRENT_SEASON}`),
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
            standings: [], // This might need a separate fetch if required
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
  const { lineups, events, stats, h2h, players, loading, error } = useMatchData(initialFixture);
  const { isAdmin } = useAdmin();
  const { db } = useFirestore();

  const [renameItem, setRenameItem] = useState<{ id: number, name: string, type: RenameType } | null>(null);
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
    } catch (e) {
      const permissionError = new FirestorePermissionError({
          path: `playerCustomizations`,
          operation: 'list',
      });
      errorEmitter.emit('permission-error', permissionError);
    }
  }, [db]);

  useEffect(() => {
    fetchCustomNames();
  }, [fetchCustomNames]);
  
  const getPlayerName = useCallback((id: number, defaultName: string) => {
    return customPlayerNames.get(id) || defaultName;
  }, [customPlayerNames]);

  const handleRenamePlayer = (id: number, name: string) => {
    setRenameItem({ id, type: 'player', name });
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

  const constructMatchDataForView = (teamId: number) => {
    const wins = h2h.filter(m => m.teams.home.id === teamId ? m.teams.home.winner : m.teams.away.winner).length;
    const draws = h2h.filter(m => m.teams.home.winner === false && m.teams.away.winner === false).length;
    const total = h2h.length;
    const winPercentage = total > 0 ? (wins / total * 100).toFixed(0) : 0;
    const drawPercentage = total > 0 ? (draws / total * 100).toFixed(0) : 0;


    return {
      lineup: lineups.find(l => l.team.id === teamId),
      events: events,
      stats: stats.find(s => s.team.id === teamId),
      details: {
          date: new Date(initialFixture.fixture.date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' }),
          time: new Date(initialFixture.fixture.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
          stadium: initialFixture.fixture.venue.name || 'غير محدد',
          predictions: `نسبة الفوز: ${winPercentage}%`,
          history: `من أصل ${total} مواجهات، فاز ${wins} وتعادل ${draws}`
      },
    };
  };

  return (
    <div className="flex flex-col bg-background h-full">
      {renameItem && <RenameDialog isOpen={isRenameOpen} onOpenChange={setRenameOpen} currentName={renameItem.name} onSave={handleSaveRename} itemType={renameItem.type} />}
      <ScreenHeader title={`${initialFixture.teams.home.name} ضد ${initialFixture.teams.away.name}`} onBack={goBack} canGoBack={canGoBack} />
      
      <div className="flex-1 overflow-y-auto">
        <Tabs defaultValue="home" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="home">{initialFixture.teams.home.name}</TabsTrigger>
            <TabsTrigger value="away">{initialFixture.teams.away.name}</TabsTrigger>
          </TabsList>
          <TabsContent value="home">
            <MatchPage 
              match={constructMatchDataForView(initialFixture.teams.home.id)}
              onRenamePlayer={handleRenamePlayer}
              isAdmin={!!isAdmin}
              getPlayerName={getPlayerName}
            />
          </TabsContent>
           <TabsContent value="away">
             <MatchPage
              match={constructMatchDataForView(initialFixture.teams.away.id)}
              onRenamePlayer={handleRenamePlayer}
              isAdmin={!!isAdmin}
              getPlayerName={getPlayerName}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
