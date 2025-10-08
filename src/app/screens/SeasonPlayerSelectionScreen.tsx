
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { ScreenProps } from '@/app/page';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useAuth, useFirestore } from '@/firebase/provider';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { Player, SeasonPrediction } from '@/lib/types';
import { CURRENT_SEASON } from '@/lib/constants';
import { Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { FootballIcon } from '@/components/icons/FootballIcon';


interface SeasonPlayerSelectionScreenProps extends ScreenProps {
    leagueId: number;
    leagueName: string;
    teamId: number;
    teamName: string;
}

interface PlayerResponse {
    player: Player;
    statistics: any[];
}


export function SeasonPlayerSelectionScreen({ navigate, goBack, canGoBack, headerActions, leagueId, leagueName, teamId, teamName }: SeasonPlayerSelectionScreenProps) {
    const { user } = useAuth();
    const { db } = useFirestore();
    const { toast } = useToast();
    const [players, setPlayers] = useState<PlayerResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [predictedTopScorerId, setPredictedTopScorerId] = useState<number | undefined>();

    const predictionDocRef = useMemo(() => {
        if (!user || !db) return null;
        return doc(db, 'seasonPredictions', `${user.uid}_${leagueId}_${CURRENT_SEASON}`);
    }, [user, db, leagueId]);

    // Fetch players with pagination
    useEffect(() => {
        const fetchAllPlayers = async () => {
            setLoading(true);
            const playerMap = new Map<number, PlayerResponse>();
            let currentPage = 1;
            let totalPages = 1;

            try {
                while (currentPage <= totalPages) {
                    const res = await fetch(`/api/football/players?team=${teamId}&season=${CURRENT_SEASON}&page=${currentPage}`);
                    const data = await res.json();
                    
                    if (data.response) {
                        data.response.forEach((playerResponse: PlayerResponse) => {
                            if (!playerMap.has(playerResponse.player.id)) {
                                playerMap.set(playerResponse.player.id, playerResponse);
                            }
                        });
                    }

                    if (data.paging && data.paging.total > currentPage) {
                        totalPages = data.paging.total;
                        currentPage++;
                    } else {
                        break;
                    }
                }
                setPlayers(Array.from(playerMap.values()));
            } catch (e) {
                console.error('Failed to fetch players:', e);
                toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في تحميل اللاعبين.' });
            } finally {
                setLoading(false);
            }
        };

        fetchAllPlayers();
    }, [teamId, toast]);

    // Fetch existing prediction
    useEffect(() => {
        if (!predictionDocRef) return;
        getDoc(predictionDocRef)
            .then(docSnap => {
                if (docSnap.exists()) {
                    const data = docSnap.data() as SeasonPrediction;
                    setPredictedTopScorerId(data.predictedTopScorerId);
                }
            })
            .catch(error => {
                const permissionError = new FirestorePermissionError({ path: predictionDocRef.path, operation: 'get' });
                errorEmitter.emit('permission-error', permissionError);
            });
    }, [predictionDocRef]);

    const handleScorerSelect = useCallback((playerId: number) => {
        const newScorerId = predictedTopScorerId === playerId ? undefined : playerId;
        setPredictedTopScorerId(newScorerId);
        
        if (predictionDocRef && user) {
            const predictionData: Partial<SeasonPrediction> = {
                userId: user.uid,
                leagueId: leagueId,
                season: CURRENT_SEASON,
                predictedTopScorerId: newScorerId,
            };
            setDoc(predictionDocRef, predictionData, { merge: true })
                .catch(serverError => {
                    const permissionError = new FirestorePermissionError({ path: predictionDocRef.path, operation: 'create', requestResourceData: predictionData });
                    errorEmitter.emit('permission-error', permissionError);
                });
        }
    }, [predictionDocRef, user, leagueId, predictedTopScorerId]);

    if (loading) {
        return (
            <div className="flex h-full flex-col bg-background">
                <ScreenHeader title={`اختيار هداف من ${teamName}`} onBack={goBack} canGoBack={canGoBack} actions={headerActions} />
                <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col bg-background">
            <ScreenHeader title={`اختيار هداف من ${teamName}`} onBack={goBack} canGoBack={canGoBack} actions={headerActions} />
             <div className='p-4 text-center text-sm text-muted-foreground border-b'>
                <p>اختر الهداف المتوقع للدوري بالضغط على أيقونة الكرة.</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {players.length > 0 ? players.map(({ player }) => (
                    <div key={player.id} className="flex items-center p-2 border rounded-lg bg-card">
                         <div className="flex-1 flex items-center gap-3">
                            <Avatar className="h-10 w-10"><AvatarImage src={player.photo} /></Avatar>
                            <div>
                               <p className="font-semibold">{player.name}</p>
                               <p className="text-xs text-muted-foreground">{player.position}</p>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => handleScorerSelect(player.id)}>
                            <FootballIcon className={cn("h-6 w-6 text-muted-foreground transition-colors", predictedTopScorerId === player.id && "text-yellow-400")} />
                        </Button>
                    </div>
                )) : (
                    <p className="text-center pt-8 text-muted-foreground">لا يوجد لاعبون متاحون لهذا الفريق.</p>
                )}
            </div>
        </div>
    );
}
