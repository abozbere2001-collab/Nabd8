"use client";
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from '@/hooks/use-toast';
import { useAdmin, useAuth, useFirestore } from '@/firebase/provider';
import { doc, getDocs, collection, setDoc } from 'firebase/firestore';
import type { Fixture as FixtureType, Player as PlayerType, Team, MatchEvent } from '@/lib/types';
import { MatchView } from '@/components/MatchView'; // Import the new component
import { RenameDialog } from '@/components/RenameDialog';

// Types remain largely the same, but MatchData will be the comprehensive prop for MatchView
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

interface MatchDataForView {
  lineup?: LineupData;
  events?: MatchEvent[];
  statistics?: any;
  date?: string;
  time?: string;
  venue?: string;
  // Other fields as needed by MatchView
}


type RenameType = 'team' | 'player' | 'coach';

// Data fetching hook remains mostly the same
function useMatchData(fixture?: FixtureType) {
  const { toast } = useToast();
  const [data, setData] = useState<{
    lineups: LineupData[];
    events: MatchEvent[];
    stats: any[];
    loading: boolean;
    error: string | null;
  }>({
    lineups: [],
    events: [],
    stats: [],
    loading: true,
    error: null,
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
        
        const [lineupsRes, eventsRes, statsRes] = await Promise.all([
          fetch(`/api/football/fixtures/lineups?fixture=${fixtureId}`),
          fetch(`/api/football/fixtures/events?fixture=${fixtureId}`),
          fetch(`/api/football/statistics?fixture=${fixtureId}`),
        ]);

        const lineupsData = lineupsRes.ok ? (await lineupsRes.json()).response || [] : [];
        const eventsData = eventsRes.ok ? (await eventsRes.json()).response || [] : [];
        const statsData = statsRes.ok ? (await statsRes.json()).response || [] : [];

        // Fetch player photos if missing
        for (let lineup of lineupsData) {
          const res = await fetch(`/api/football/players?team=${lineup.team.id}&season=${CURRENT_SEASON}`);
          if (res.ok) {
            const json = await res.json();
            const map = new Map(json.response.map((p: any) => [p.player.id, p.player.photo]));
            lineup.startXI.forEach((p: any) => {
              if (!p.player.photo && map.has(p.player.id)) p.player.photo = map.get(p.player.id);
            });
            lineup.substitutes.forEach((p: any) => {
              if (!p.player.photo && map.has(p.player.id)) p.player.photo = map.get(p.player.id);
            });
          }
        }
        setData({ lineups: lineupsData, events: eventsData, stats: statsData, loading: false, error: null });

      } catch (err: any) {
        console.error("❌ fetch error:", err);
        toast({ variant: "destructive", title: "خطأ", description: "فشل تحميل بيانات المباراة" });
        setData({ lineups: [], events: [], stats: [], loading: false, error: err.message });
      }
    };
    fetchData();
  }, [fixture, toast, CURRENT_SEASON]);

  return data;
}

// The main screen component now fetches data and passes it to MatchView
export function MatchDetailScreen({ fixture: initialFixture, goBack, canGoBack, navigate }: { fixture: FixtureType; goBack: () => void; canGoBack: boolean; navigate: (screen: any, props: any) => void; }) {
  const { lineups, events, stats, loading, error } = useMatchData(initialFixture);
  const { isAdmin } = useAdmin();
  const { db } = useFirestore();

  const [renameItem, setRenameItem] = useState<{ id: number, name: string, type: RenameType } | null>(null);
  const [isRenameOpen, setRenameOpen] = useState(false);
  const [customPlayerNames, setCustomPlayerNames] = useState<Map<number, string>>(new Map());

  // Fetch custom names
  const fetchCustomNames = useCallback(async () => {
    if (!db) return;
    const playersColRef = collection(db, 'playerCustomizations');
    try {
        const playersSnapshot = await getDocs(playersColRef);
        const playerNames = new Map<number, string>();
        playersSnapshot.forEach(doc => playerNames.set(Number(doc.id), doc.data().customName));
        setCustomPlayerNames(playerNames);
    } catch (e) {
        console.error("Error fetching custom names:", e);
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
    await setDoc(doc(db, collectionName, String(id)), { customName: newName });
    fetchCustomNames(); // Refresh names after saving
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

  // Assuming you want to display one team's view. Could be toggled.
  const homeTeamId = initialFixture.teams.home.id;
  const lineupForView = lineups.find(l => l.team.id === homeTeamId);

  // Construct the single `match` prop for MatchView
  const matchDataForView: MatchDataForView = {
    lineup: lineupForView,
    events: events,
    statistics: stats.find(s => s.team.id === homeTeamId),
    date: new Date(initialFixture.fixture.date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' }),
    time: new Date(initialFixture.fixture.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
    venue: initialFixture.fixture.venue.name || 'غير محدد',
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
            <MatchView 
              match={{
                ...matchDataForView,
                lineup: lineups.find(l => l.team.id === initialFixture.teams.home.id)
              }}
              onRenamePlayer={handleRenamePlayer}
              isAdmin={!!isAdmin}
              getPlayerName={getPlayerName}
            />
          </TabsContent>
           <TabsContent value="away">
             <MatchView 
              match={{
                ...matchDataForView,
                lineup: lineups.find(l => l.team.id === initialFixture.teams.away.id)
              }}
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
