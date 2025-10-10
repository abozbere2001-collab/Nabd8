"use client";
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import type { ScreenProps } from '@/app/page';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Button } from "@/components/ui/button";
import { Pencil } from 'lucide-react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { RenameDialog } from '@/components/RenameDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAdmin, useFirestore } from '@/firebase/provider';
import { doc, getDocs, collection, setDoc } from 'firebase/firestore';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import type { Fixture, Standing, Player as PlayerType, Team } from '@/lib/types';


// ✅ أنواع
interface PlayerWithStats {
  player: PlayerType & { pos?: string };
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
interface MatchData {
  lineups: LineupData[];
  events: MatchEvent[];
  stats: any[];
  standings: Standing[];
  loading: boolean;
  error: string | null;
}
type RenameType = 'team' | 'player' | 'coach';

// ✅ جلب البيانات من API-Football
function useMatchData(fixture?: Fixture): MatchData {
  const { toast } = useToast();
  const [data, setData] = useState<MatchData>({
    lineups: [], events: [], stats: [], standings: [], loading: true, error: null,
  });

  const CURRENT_SEASON = useMemo(() => new Date(fixture?.fixture.date || Date.now()).getFullYear(), [fixture]);

  useEffect(() => {
    if (!fixture) {
      setData(prev => ({ ...prev, loading: false, error: "لا توجد بيانات مباراة" }));
      return;
    }
    const fetchData = async () => {
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

        // ✅ تحسين جلب صور اللاعبين
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

        setData({ lineups: lineupsData, events: eventsData, stats: statsData, standings: [], loading: false, error: null });
      } catch (err: any) {
        console.error("❌ fetch error:", err);
        toast({ variant: "destructive", title: "خطأ", description: "فشل تحميل بيانات المباراة" });
        setData({ lineups: [], events: [], stats: [], standings: [], loading: false, error: err.message });
      }
    };
    fetchData();
  }, [fixture, toast, CURRENT_SEASON]);

  return data;
}

// ✅ مكون اللاعب على أرض الملعب
const PlayerOnPitch = ({ player, onRename, isAdmin, getPlayerName }: any) => {
  const displayName = getPlayerName(player.player.id, player.player.name);
  return (
    <div className="relative flex flex-col items-center text-white text-xs w-16">
      {isAdmin && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute -top-2 -right-2 h-6 w-6 z-10"
          onClick={(e) => { e.stopPropagation(); onRename('player', player.player.id, displayName); }}
        >
          <Pencil className="h-3 w-3" />
        </Button>
      )}
      <Avatar className="w-12 h-12 border-2 border-white/40 bg-black/30">
        <AvatarImage src={player.player.photo || "/images/player-placeholder.png"} alt={displayName} />
        <AvatarFallback>{displayName?.charAt(0) || '?'}</AvatarFallback>
      </Avatar>
      <span className="mt-1 bg-black/50 px-1 rounded text-[10px] truncate">{displayName}</span>
    </div>
  );
};

// ✅ أرض الملعب – تصحيح الترتيب (الحارس بالأسفل)
function LineupField({ lineup, onRename, isAdmin, getPlayerName }: any) {
  if (!lineup) return <div className="text-center py-6 text-muted-foreground">لا توجد تشكيلة متاحة</div>;

  const GK = lineup.startXI.filter((p: any) => p.player.pos === 'G');
  const DEF = lineup.startXI.filter((p: any) => p.player.pos === 'D');
  const MID = lineup.startXI.filter((p: any) => p.player.pos === 'M');
  const FWD = lineup.startXI.filter((p: any) => p.player.pos === 'F');

  const rows = [FWD, MID, DEF, GK].filter(r => r.length > 0);

  return (
    <Card className="p-3 bg-card/80">
      <div
        className="relative w-full aspect-[2/3] bg-green-700 rounded-lg overflow-hidden border border-green-500/30"
        style={{ backgroundImage: "url('/football-pitch-vertical.svg')", backgroundSize: "cover", backgroundPosition: 'center' }}
      >
        {/* ✅ الحارس في الأسفل */}
        <div className="absolute inset-0 flex flex-col justify-around p-3">
          {rows.map((row, i) => (
            <div key={i} className="flex justify-around items-center">
              {row.map((p: any) => (
                <PlayerOnPitch key={p.player.id} player={p} onRename={onRename} isAdmin={isAdmin} getPlayerName={getPlayerName} />
              ))}
            </div>
          ))}
        </div>
      </div>

      {lineup.substitutes?.length > 0 && (
        <div className="mt-4 border-t border-border pt-4">
          <h4 className="text-center font-bold mb-2">الاحتياط</h4>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {lineup.substitutes.map((p: any) => (
              <div key={p.player.id} className="flex items-center gap-2 p-2 bg-background/40 rounded border">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={p.player.photo || "/images/player-placeholder.png"} />
                  <AvatarFallback>{p.player.name?.charAt(0) || '?'}</AvatarFallback>
                </Avatar>
                <span className="text-xs truncate">{getPlayerName(p.player.id, p.player.name)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

// ✅ المكون الرئيسي
export function MatchDetailScreen({ fixture, goBack, canGoBack, navigate }: ScreenProps & { fixture: Fixture }) {
  const { lineups, events, stats, loading, error } = useMatchData(fixture);
  const { isAdmin } = useAdmin();
  const { db } = useFirestore();
  const [renameItem, setRenameItem] = useState<any>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [customNames, setCustomNames] = useState<Map<number, string>>(new Map());

  const getPlayerName = useCallback((id: number, name: string) => customNames.get(id) || name, [customNames]);
  const handleRename = (type: RenameType, id: number, name: string) => { setRenameItem({ id, type, name }); setRenameOpen(true); };
  
  const handleSaveRename = async (newName: string) => {
    if (!renameItem || !db) return;
    const { id, type } = renameItem;
    let collectionName = '';
    switch(type) {
        case 'team': collectionName = 'teamCustomizations'; break;
        case 'player': collectionName = 'playerCustomizations'; break;
        case 'coach': collectionName = 'coachCustomizations'; break;
    }
    try {
      await setDoc(doc(db, collectionName, String(id)), { customName: newName });
    } catch(error) {
      const permissionError = new FirestorePermissionError({
          path: `${collectionName}/${id}`,
          operation: 'create',
          requestResourceData: { customName: newName },
      });
      errorEmitter.emit('permission-error', permissionError);
    }
  };


  if (loading) return <div className="p-4"><Skeleton className="h-96 w-full" /></div>;
  if (error) return <div className="text-center text-red-500 py-10">{error}</div>;

  const home = lineups.find(l => l.team.id === fixture.teams.home.id);
  const away = lineups.find(l => l.team.id === fixture.teams.away.id);

  return (
    <div className="flex flex-col bg-background h-full">
      {renameItem && <RenameDialog isOpen={renameOpen} onOpenChange={setRenameOpen} currentName={renameItem.name} onSave={handleSaveRename} itemType="player" />}
      <ScreenHeader title="تشكيلة المباراة" onBack={goBack} canGoBack={canGoBack} />
      <div className="p-4 overflow-y-auto">
        <Tabs defaultValue="home">
          <TabsList className="grid grid-cols-2 w-full mb-4">
            <TabsTrigger value="home">{fixture.teams.home.name}</TabsTrigger>
            <TabsTrigger value="away">{fixture.teams.away.name}</TabsTrigger>
          </TabsList>
          <TabsContent value="home"><LineupField lineup={home} onRename={handleRename} isAdmin={isAdmin} getPlayerName={getPlayerName} /></TabsContent>
          <TabsContent value="away"><LineupField lineup={away} onRename={handleRename} isAdmin={isAdmin} getPlayerName={getPlayerName} /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
