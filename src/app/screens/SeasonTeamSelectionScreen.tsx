
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { ScreenProps } from '@/app/page';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useAuth, useFirestore } from '@/firebase/provider';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { Team, SeasonPrediction } from '@/lib/types';
import { CURRENT_SEASON } from '@/lib/constants';
import { Loader2, Trophy } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { FixedSizeList as List } from 'react-window';

interface SeasonTeamSelectionScreenProps extends ScreenProps {
    leagueId: number;
    leagueName: string;
}

const TeamListItem = React.memo(({ team, isPredictedChampion, onChampionSelect, onTeamClick }: { team: Team, isPredictedChampion: boolean, onChampionSelect: () => void, onTeamClick: () => void }) => {
    return (
        <div className="flex items-center p-2 border rounded-lg bg-card">
            <div 
                className="flex-1 flex items-center gap-3 cursor-pointer"
                onClick={onTeamClick}
            >
                <Avatar className="h-8 w-8"><AvatarImage src={team.logo} /></Avatar>
                <span className="font-semibold">{team.name}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={onChampionSelect}>
                <Trophy className={cn("h-6 w-6 text-muted-foreground transition-colors", isPredictedChampion && "text-yellow-400 fill-current")} />
            </Button>
        </div>
    );
});
TeamListItem.displayName = 'TeamListItem';


export function SeasonTeamSelectionScreen({ navigate, goBack, canGoBack, headerActions, leagueId, leagueName }: SeasonTeamSelectionScreenProps) {
    const { user } = useAuth();
    const { db } = useFirestore();
    const { toast } = useToast();
    const [teams, setTeams] = useState<{ team: Team }[]>([]);
    const [loading, setLoading] = useState(true);
    const [predictedChampionId, setPredictedChampionId] = useState<number | undefined>();

    const predictionDocRef = useMemo(() => {
        if (!user || !db) return null;
        return doc(db, 'seasonPredictions', `${user.uid}_${leagueId}_${CURRENT_SEASON}`);
    }, [user, db, leagueId]);

    // Fetch teams
    useEffect(() => {
        setLoading(true);
        const fetchTeams = async () => {
            try {
                const res = await fetch(`/api/football/teams?league=${leagueId}&season=${CURRENT_SEASON}`);
                const data = await res.json();
                setTeams(data.response || []);
            } catch (e) {
                console.error('Failed to fetch teams:', e);
                toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في تحميل الفرق.' });
            } finally {
                setLoading(false);
            }
        };
        fetchTeams();
    }, [leagueId, toast]);

    // Fetch existing prediction
    useEffect(() => {
        if (!predictionDocRef) return;
        getDoc(predictionDocRef)
            .then(docSnap => {
                if (docSnap.exists()) {
                    const data = docSnap.data() as SeasonPrediction;
                    setPredictedChampionId(data.predictedChampionId);
                }
            })
            .catch(error => {
                const permissionError = new FirestorePermissionError({ path: predictionDocRef.path, operation: 'get' });
                errorEmitter.emit('permission-error', permissionError);
            });
    }, [predictionDocRef]);

    const handleChampionSelect = useCallback((teamId: number) => {
        const newChampionId = predictedChampionId === teamId ? undefined : teamId;
        
        setPredictedChampionId(prevId => prevId === teamId ? undefined : teamId);
        
        if (predictionDocRef && user) {
            const predictionData: Partial<SeasonPrediction> = {
                userId: user.uid,
                leagueId: leagueId,
                leagueName: leagueName,
                season: CURRENT_SEASON,
                predictedChampionId: newChampionId,
                timestamp: new Date()
            };
            setDoc(predictionDocRef, predictionData, { merge: true })
                .catch(serverError => {
                    const permissionError = new FirestorePermissionError({ path: predictionDocRef.path, operation: 'write', requestResourceData: predictionData });
                    errorEmitter.emit('permission-error', permissionError);
                });
        }
    }, [predictionDocRef, user, leagueId, leagueName, predictedChampionId]);


    const handleTeamClick = (teamId: number, teamName: string) => {
        navigate('SeasonPlayerSelection', { leagueId, leagueName, teamId, teamName });
    };

    const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
        const { team } = teams[index];
        if (!team) return null;
        return (
            <div style={style} className="px-4 py-1">
                <TeamListItem
                    team={team}
                    isPredictedChampion={predictedChampionId === team.id}
                    onChampionSelect={() => handleChampionSelect(team.id)}
                    onTeamClick={() => handleTeamClick(team.id, team.name)}
                />
            </div>
        );
    };

    if (loading) {
        return (
            <div className="flex h-full flex-col bg-background">
                <ScreenHeader title={`اختيار بطل ${leagueName}`} onBack={goBack} canGoBack={canGoBack} actions={headerActions} />
                <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
            </div>
        );
    }
    
    return (
        <div className="flex h-full flex-col bg-background">
            <ScreenHeader title={`توقع بطل ${leagueName}`} onBack={goBack} canGoBack={canGoBack} actions={headerActions} />
            <div className='p-4 text-center text-sm text-muted-foreground border-b'>
                <p>اختر الفريق البطل بالضغط على أيقونة الكأس. ثم اضغط على أي فريق لاختيار الهداف من لاعبيه.</p>
            </div>
            <div className="flex-1 overflow-y-auto">
                {teams.length > 0 ? (
                     <List
                        height={window.innerHeight - 150} // Adjust height based on your layout
                        itemCount={teams.length}
                        itemSize={68} // The height of each TeamListItem + padding
                        width="100%"
                    >
                        {Row}
                    </List>
                ) : (
                    <p className="text-center pt-8 text-muted-foreground">لا توجد فرق متاحة لهذا الدوري.</p>
                )}
            </div>
        </div>
    );
}
