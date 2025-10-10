"use client";
import React from 'react';
import type { Fixture as FixtureType } from '@/lib/types';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useMatchData } from '@/hooks/useMatchData';
import { useAdmin, useFirestore } from '@/firebase/provider';
import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { RenameDialog } from '@/components/RenameDialog';
import { MatchTimeline } from '@/components/MatchTimeline';
import { LineupField } from '@/components/LineupField';
import { MatchStatistics } from '@/components/MatchStatistics';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Calendar, Shield, MapPin, Shirt, Award } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';

type RenameType = 'player' | 'coach' | 'team';

export function MatchDetailScreen({ fixture: initialFixture, goBack, canGoBack }: { fixture: FixtureType; goBack: () => void; canGoBack: boolean; }) {
  const { data, loading, error } = useMatchData(initialFixture);
  
  const { db, isAdmin } = useAdmin();
  const [customNames, setCustomNames] = React.useState<{ players: Map<number, string>, coaches: Map<number, string> }>({ players: new Map(), coaches: new Map() });
  const [renameItem, setRenameItem] = React.useState<{ id: number; name: string; type: RenameType } | null>(null);
  const [isRenameOpen, setRenameOpen] = React.useState(false);
  
  const homeTeam = initialFixture.teams.home;
  const awayTeam = initialFixture.teams.away;
  const matchStatus = initialFixture.fixture.status.short;

  const defaultTab = ['NS', 'PST', 'CANC'].includes(matchStatus) ? 'info' : 'timeline';

  React.useEffect(() => {
    if (!db) return;
    const fetchCustomNames = async () => {
        try {
            const [playersSnap, coachesSnap] = await Promise.all([
                getDocs(doc(db, "playerCustomizations")),
                getDocs(doc(db, "coachCustomizations")),
            ]);
            const playerNames = new Map(Object.entries(playersSnap.data() || {}).map(([id, data]) => [Number(id), (data as any).customName]));
            const coachNames = new Map(Object.entries(coachesSnap.data() || {}).map(([id, data]) => [Number(id), (data as any).customName]));
            setCustomNames({ players: playerNames, coaches: coachNames });
        } catch(e) {
            // Non-admin users might not have access, so we fail silently.
        }
    };
    
    if(isAdmin) {
        fetchCustomNames();
        const playersUnsub = onSnapshot(doc(db, "playerCustomizations"), (doc) => {
            const data = doc.data();
            if(data) setCustomNames(prev => ({...prev, players: new Map(Object.entries(data).map(([id, data]) => [Number(id), (data as any).customName]))}));
        });
        const coachesUnsub = onSnapshot(doc(db, "coachCustomizations"), (doc) => {
            const data = doc.data();
            if(data) setCustomNames(prev => ({...prev, coaches: new Map(Object.entries(data).map(([id, data]) => [Number(id), (data as any).customName]))}));
        });

        return () => {
          playersUnsub();
          coachesUnsub();
        };
    }
  }, [db, isAdmin]);

  const getPlayerName = React.useCallback((id: number, defaultName: string) => customNames.players.get(id) || defaultName, [customNames.players]);
  const getCoachName = React. useCallback((id: number, defaultName: string) => customNames.coaches.get(id) || defaultName, [customNames.coaches]);

  const handleOpenRename = (type: RenameType, id: number, name: string) => {
    setRenameItem({ id, name, type });
    setRenameOpen(true);
  };
  
  const handleSaveRename = async (newName: string) => {
    if (!renameItem || !db) return;
    const collectionName = `${renameItem.type}Customizations`;
    const docRef = doc(db, collectionName, String(renameItem.id));
    const dataToSave = { customName: newName };
    setDoc(docRef, dataToSave, { merge: true }).catch(serverError => {
        const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'update',
            requestResourceData: dataToSave
        });
        errorEmitter.emit('permission-error', permissionError);
    });
  };
  

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full flex-1">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      );
    }
    
    if (error || !data) {
        return <div className="text-center py-10 text-destructive">{error || "حدث خطأ أثناء تحميل بيانات المباراة."}</div>
    }

    const { lineups, events, stats, standings } = data;
    const homeLineup = lineups.find(l => l.team.id === homeTeam.id);
    const awayLineup = lineups.find(l => l.team.id === awayTeam.id);

    return (
       <Tabs defaultValue={defaultTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid w-full grid-cols-5 rounded-none h-auto p-0 border-b flex-row-reverse sticky top-0 bg-background z-10">
          <TabsTrigger value="info" className="rounded-none"><Award className="w-4 h-4 ml-1"/>قبل المباراة</TabsTrigger>
          <TabsTrigger value="timeline" className="rounded-none"><Calendar className="w-4 h-4 ml-1"/>المجريات</TabsTrigger>
          <TabsTrigger value="lineups" className="rounded-none"><Shirt className="w-4 h-4 ml-1"/>التشكيلة</TabsTrigger>
          <TabsTrigger value="stats" className="rounded-none"><Shield className="w-4 h-4 ml-1"/>الإحصائيات</TabsTrigger>
          <TabsTrigger value="standings" className="rounded-none"><MapPin className="w-4 h-4 ml-1"/>الترتيب</TabsTrigger>
        </TabsList>
        
        <ScrollArea className="flex-1">
            <TabsContent value="info" className="p-4 m-0">
                <div className="space-y-4">
                    <div className="bg-card border rounded-lg p-4 text-center">
                        <p className="text-sm text-muted-foreground">{initialFixture.league.name} - {initialFixture.league.round}</p>
                        <p className="font-bold text-lg">{format(new Date(initialFixture.fixture.date), "eeee, d MMMM yyyy", { locale: ar })}</p>
                        <p className="font-bold text-2xl">{format(new Date(initialFixture.fixture.date), "HH:mm")}</p>
                        {initialFixture.fixture.venue?.name && <p className="text-sm text-muted-foreground">{initialFixture.fixture.venue.name}, {initialFixture.fixture.venue.city}</p>}
                    </div>
                </div>
            </TabsContent>
            <TabsContent value="timeline" className="p-4 m-0">
                <MatchTimeline events={events} homeTeamId={homeTeam.id} getPlayerName={getPlayerName} />
            </TabsContent>
            <TabsContent value="lineups" className="p-0 m-0">
                 <div className="grid grid-cols-2 gap-4 p-4">
                    <LineupField lineup={awayLineup} events={events} onRename={handleOpenRename} isAdmin={isAdmin} getPlayerName={getPlayerName} getCoachName={getCoachName} />
                    <LineupField lineup={homeLineup} events={events} onRename={handleOpenRename} isAdmin={isAdmin} getPlayerName={getPlayerName} getCoachName={getCoachName} />
                </div>
            </TabsContent>
            <TabsContent value="stats" className="p-4 m-0">
                <MatchStatistics homeStats={stats.find(s => s.team.id === homeTeam.id)?.statistics} awayStats={stats.find(s => s.team.id === awayTeam.id)?.statistics} />
            </TabsContent>
            <TabsContent value="standings" className="p-0 m-0">
                {standings.length > 0 ? (
                <Table>
                    <TableHeader><TableRow>
                        <TableHead className="text-center">نقاط</TableHead>
                        <TableHead className="text-center">لعب</TableHead>
                        <TableHead className="w-1/2 text-right">الفريق</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>{standings.map((s) => (
                        <TableRow key={s.team.id} className={s.team.id === homeTeam.id || s.team.id === awayTeam.id ? 'bg-primary/10' : ''}>
                            <TableCell className="text-center font-bold">{s.points}</TableCell>
                            <TableCell className="text-center">{s.all.played}</TableCell>
                            <TableCell><div className="flex items-center gap-2 justify-end">
                                <span className="truncate font-medium">{s.team.name}</span>
                                <Avatar className="h-6 w-6"><AvatarImage src={s.team.logo} alt={s.team.name} /><AvatarFallback>{s.team.name.substring(0,1)}</AvatarFallback></Avatar>
                                <span>{s.rank}</span>
                            </div></TableCell>
                        </TableRow>
                    ))}</TableBody>
                </Table>
            ) : <p className="text-center text-muted-foreground p-8">جدول الترتيب غير متاح</p>}
            </TabsContent>
        </ScrollArea>
      </Tabs>
    );
  };
  
  const getStatusComponent = () => {
    const { elapsed } = initialFixture.fixture.status;
    if (['1H', 'HT', '2H', 'ET', 'P', 'LIVE'].includes(matchStatus)) {
        return <div className="text-red-500 font-bold animate-pulse">{elapsed}'</div>;
    }
    if (matchStatus === 'FT' || matchStatus === 'AET' || matchStatus === 'PEN') {
        return <div className="text-xs">انتهت</div>;
    }
    return <div className="text-xs">{format(new Date(initialFixture.fixture.date), "HH:mm")}</div>;
  }

  return (
    <div className="flex flex-col bg-background h-full min-h-0">
      <ScreenHeader title="" onBack={goBack} canGoBack={canGoBack} />

      <div className="p-3 border-b">
         <div className="flex items-center justify-between gap-2">
             <div className="flex items-center gap-3 flex-1 justify-end truncate">
                 <span className="font-bold truncate text-right">{homeTeam.name}</span>
                 <Avatar className="h-10 w-10"><AvatarImage src={homeTeam.logo} alt={homeTeam.name} /></Avatar>
             </div>
             <div className="flex flex-col items-center justify-center min-w-[80px] text-center bg-card rounded-lg p-1">
                 <div className="font-bold text-2xl tracking-wider">{initialFixture.goals.home ?? '-'} : {initialFixture.goals.away ?? '-'}</div>
                 {getStatusComponent()}
             </div>
             <div className="flex items-center gap-3 flex-1 truncate">
                 <Avatar className="h-10 w-10"><AvatarImage src={awayTeam.logo} alt={awayTeam.name} /></Avatar>
                 <span className="font-bold truncate text-left">{awayTeam.name}</span>
             </div>
         </div>
      </div>
      
      {renderContent()}

      {renameItem && <RenameDialog isOpen={isRenameOpen} onOpenChange={setRenameOpen} currentName={renameItem.name} onSave={handleSaveRename} itemType="اللاعب" />}
    </div>
  );
}
