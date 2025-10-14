
"use client";

import React, { useEffect, useState, useCallback } from 'react';
import type { ScreenProps } from '@/app/page';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useFirestore } from '@/firebase/provider';
import { doc, getDoc } from 'firebase/firestore';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import type { Player, PlayerStats } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, ArrowRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CURRENT_SEASON } from '@/lib/constants';

interface PlayerInfo extends Player {
    birth: { date: string; place: string; country: string; };
    nationality: string;
    height: string;
    weight: string;
    injured: boolean;
}

interface PlayerData {
    player: PlayerInfo;
    statistics: PlayerStats[];
}

interface Transfer {
    date: string;
    type: string;
    teams: {
        in: { id: number; name: string; logo: string; } | null;
        out: { id: number; name: string; logo: string; } | null;
    };
}


const PlayerHeader = ({ player }: { player: PlayerInfo }) => (
    <Card className="mb-4 overflow-hidden">
        <div className="relative h-24 bg-gradient-to-r from-primary/20 to-accent/20">
            <Avatar className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 h-24 w-24 border-4 border-background">
                <AvatarImage src={player.photo} alt={player.name} />
                <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
            </Avatar>
        </div>
        <CardContent className="pt-16 text-center">
            <h1 className="text-2xl font-bold">{player.name}</h1>
            <p className="text-muted-foreground">{player.nationality}</p>
            <div className="mt-4 flex justify-center gap-6 text-sm">
                <div className="flex flex-col items-center">
                    <span className="font-bold">{player.age || '-'}</span>
                    <span className="text-xs text-muted-foreground">العمر</span>
                </div>
                <div className="flex flex-col items-center">
                    <span className="font-bold">{player.height || '-'}</span>
                    <span className="text-xs text-muted-foreground">الطول</span>
                </div>
                <div className="flex flex-col items-center">
                    <span className="font-bold">{player.weight || '-'}</span>
                    <span className="text-xs text-muted-foreground">الوزن</span>
                </div>
            </div>
        </CardContent>
    </Card>
);

const DetailsTab = ({ statistics, navigate }: { statistics: PlayerStats[], navigate: ScreenProps['navigate'] }) => {
    if (statistics.length === 0) {
        return <p className="text-center text-muted-foreground p-8">لا توجد إحصائيات متاحة لهذا الموسم.</p>;
    }
    const currentLeagueStats = statistics[0]; // Assuming the first one is the primary league for the season

    return (
        <div className="space-y-4">
             <Card className="cursor-pointer" onClick={() => navigate('CompetitionDetails', { leagueId: currentLeagueStats.league.id })}>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3 mb-4">
                            <Avatar className="h-10 w-10"><AvatarImage src={currentLeagueStats.team.logo} /></Avatar>
                            <div>
                                <p className="font-bold">{currentLeagueStats.team.name}</p>
                                <p className="text-xs text-muted-foreground">{currentLeagueStats.league.name} - {currentLeagueStats.league.season}</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                                <p className="font-bold text-lg">{currentLeagueStats.games.appearences || 0}</p>
                                <p className="text-xs text-muted-foreground">مباريات</p>
                            </div>
                            <div>
                                <p className="font-bold text-lg">{currentLeagueStats.goals.total || 0}</p>
                                <p className="text-xs text-muted-foreground">أهداف</p>
                            </div>
                            <div>
                                <p className="font-bold text-lg">{currentLeagueStats.goals.assists || 0}</p>
                                <p className="text-xs text-muted-foreground">صناعة</p>
                            </div>
                             <div>
                                <p className="font-bold text-lg">{currentLeagueStats.cards.yellow || 0}</p>
                                <p className="text-xs text-muted-foreground">بطاقات صفراء</p>
                            </div>
                             <div>
                                <p className="font-bold text-lg">{currentLeagueStats.cards.red + currentLeagueStats.cards.yellowred || 0}</p>
                                <p className="text-xs text-muted-foreground">بطاقات حمراء</p>
                            </div>
                             <div>
                                <p className="font-bold text-lg">{currentLeagueStats.games.rating ? parseFloat(currentLeagueStats.games.rating).toFixed(1) : '-'}</p>
                                <p className="text-xs text-muted-foreground">تقييم</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
        </div>
    );
};

const TransfersTab = ({ transfers, navigate }: { transfers: Transfer[], navigate: ScreenProps['navigate'] }) => {
     if (transfers.length === 0) {
        return <p className="text-center text-muted-foreground p-8">لا يوجد تاريخ انتقالات لهذا اللاعب.</p>;
    }

    return (
        <div className="space-y-3">
            {transfers.map((transfer, index) => (
                <Card key={index}>
                    <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground mb-2">{new Date(transfer.date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                        <div className="flex items-center justify-between gap-2">
                             <div 
                                className="flex-1 flex items-center gap-2 cursor-pointer justify-start" 
                                onClick={() => transfer.teams.out && navigate('TeamDetails', {teamId: transfer.teams.out.id })}
                            >
                                {transfer.teams.out ? (
                                    <>
                                        <Avatar className="h-8 w-8"><AvatarImage src={transfer.teams.out.logo} /></Avatar>
                                        <span className="font-semibold text-sm">{transfer.teams.out.name}</span>
                                    </>
                                ) : <span className="font-semibold text-sm text-muted-foreground">بداية المسيرة</span>}
                            </div>
                            
                            <div className="flex flex-col items-center text-muted-foreground">
                                 <ArrowRight className="h-5 w-5"/>
                                 <p className="text-xs bg-muted px-2 py-1 rounded-md mt-1">{transfer.type}</p>
                            </div>

                             <div 
                                className="flex-1 flex items-center gap-2 cursor-pointer justify-end" 
                                onClick={() => transfer.teams.in && navigate('TeamDetails', {teamId: transfer.teams.in.id })}
                            >
                                {transfer.teams.in ? (
                                    <>
                                        <span className="font-semibold text-sm">{transfer.teams.in.name}</span>
                                        <Avatar className="h-8 w-8"><AvatarImage src={transfer.teams.in.logo} /></Avatar>
                                    </>
                                ) : <span className="font-semibold text-sm text-muted-foreground">نهاية العقد</span>}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
};


export function PlayerDetailScreen({ navigate, goBack, canGoBack, playerId }: ScreenProps & { playerId: number }) {
  const { db } = useFirestore();
  const [displayTitle, setDisplayTitle] = useState("اللاعب");
  const [playerData, setPlayerData] = useState<PlayerData | null>(null);
  const [transfers, setTransfers] = useState<Transfer[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!playerId) return;

    const getPlayerInfo = async () => {
        setLoading(true);
        try {
            // Fetch main player data
            const playerRes = await fetch(`/api/football/players?id=${playerId}&season=${CURRENT_SEASON}`);
            if (playerRes.ok) {
                const data = await playerRes.json();
                if (data.response?.[0]) {
                    setPlayerData(data.response[0]);
                    const name = data.response[0].player.name;

                    // Check for custom name
                    if (db) {
                         const customNameDocRef = doc(db, "playerCustomizations", String(playerId));
                         const customNameDocSnap = await getDoc(customNameDocRef);
                         if (customNameDocSnap.exists()) {
                             setDisplayTitle(customNameDocSnap.data().customName);
                         } else {
                            setDisplayTitle(name);
                         }
                    } else {
                        setDisplayTitle(name);
                    }
                }
            }

            // Fetch transfer data
            const transferRes = await fetch(`/api/football/transfers?player=${playerId}`);
            if (transferRes.ok) {
                 const data = await transferRes.json();
                 setTransfers(data.response || []);
            }

        } catch (error) {
            console.error("Error fetching player info:", error);
            if (db) {
                const permissionError = new FirestorePermissionError({
                    path: `playerCustomizations/${playerId}`,
                    operation: 'get',
                });
                errorEmitter.emit('permission-error', permissionError);
            }
        } finally {
            setLoading(false);
        }
    };
    
    getPlayerInfo();
    
  }, [db, playerId]);

  if(loading) {
     return (
        <div className="flex h-full flex-col bg-background">
            <ScreenHeader title="جاري التحميل..." onBack={goBack} canGoBack={canGoBack} />
             <div className="p-4 space-y-4">
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        </div>
    );
  }
  
  if(!playerData) {
     return (
        <div className="flex h-full flex-col bg-background">
            <ScreenHeader title="خطأ" onBack={goBack} canGoBack={canGoBack} />
            <p className="text-center p-8">لم يتم العثور على بيانات اللاعب.</p>
        </div>
    );
  }


  return (
    <div className="flex flex-col bg-background h-full">
      <ScreenHeader 
        title={displayTitle}
        onBack={goBack} 
        canGoBack={canGoBack} 
      />
      
      <div className="flex-1 overflow-y-auto p-4">
        <PlayerHeader player={playerData.player} />
        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">تفاصيل</TabsTrigger>
            <TabsTrigger value="transfers">الانتقالات</TabsTrigger>
          </TabsList>
          <TabsContent value="details" className="mt-4">
            <DetailsTab statistics={playerData.statistics} navigate={navigate} />
          </TabsContent>
          <TabsContent value="transfers" className="mt-4">
            {transfers ? <TransfersTab transfers={transfers} navigate={navigate}/> : <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

    