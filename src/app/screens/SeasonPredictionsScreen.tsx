
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { ScreenProps } from '@/app/page';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useAuth, useFirestore } from '@/firebase/provider';
import type { Team, TopScorer, SeasonPrediction } from '@/lib/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';

const PREMIER_LEAGUE_ID = 39;
const LALIGA_ID = 140;
const SERIE_A_ID = 135;
const BUNDESLIGA_ID = 78;
const CURRENT_SEASON = 2025;

const leagues = [
    { id: PREMIER_LEAGUE_ID, name: "الدوري الإنجليزي الممتاز" },
    { id: LALIGA_ID, name: "الدوري الإسباني" },
    { id: SERIE_A_ID, name: "الدوري الإيطالي" },
    { id: BUNDESLIGA_ID, name: "الدوري الألماني" },
];

interface LeagueData {
    teams: { team: Team }[];
    scorers: TopScorer[];
}

const useLeagueData = (leagueId: number) => {
    const [data, setData] = useState<LeagueData>({ teams: [], scorers: [] });
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        const fetchData = async () => {
            if (!leagueId) {
                 setLoading(false);
                 return;
            }
            setLoading(true);
            try {
                const [teamsRes, scorersRes] = await Promise.all([
                    fetch(`/api/football/teams?league=${leagueId}&season=${CURRENT_SEASON}`),
                    fetch(`/api/football/players/topscorers?league=${leagueId}&season=${CURRENT_SEASON}`)
                ]);
                const teamsData = await teamsRes.json();
                const scorersData = await scorersRes.json();
                setData({
                    teams: teamsData.response || [],
                    scorers: scorersData.response || []
                });
            } catch (error) {
                console.error(`Failed to fetch data for league ${leagueId}`, error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [leagueId]);

    return { ...data, loading };
};

const LeaguePredictionCard = ({ league, userId }: { league: { id: number, name: string }, userId: string }) => {
    const { teams, scorers, loading } = useLeagueData(league.id);
    const { db } = useFirestore();
    const { toast } = useToast();
    
    const [championId, setChampionId] = useState<string | undefined>();
    const [scorerId, setScorerId] = useState<string | undefined>();
    const [saving, setSaving] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);


    const predictionDocRef = useMemo(() => {
        if (!db) return null;
        return doc(db, 'seasonPredictions', `${userId}_${league.id}_${CURRENT_SEASON}`);
    }, [db, userId, league.id]);

    useEffect(() => {
        if (!predictionDocRef) return;
        
        setInitialLoading(true);
        getDoc(predictionDocRef).then(docSnap => {
            if (docSnap.exists()) {
                const data = docSnap.data() as SeasonPrediction;
                setChampionId(String(data.predictedChampionId));
                setScorerId(String(data.predictedTopScorerId));
            }
        }).catch(error => {
            const permissionError = new FirestorePermissionError({ path: predictionDocRef.path, operation: 'get' });
            errorEmitter.emit('permission-error', permissionError);
        }).finally(() => {
            setInitialLoading(false);
        });
    }, [predictionDocRef]);

    const handleSave = async () => {
        if (!championId || !scorerId || !predictionDocRef) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'يرجى اختيار البطل والهداف.' });
            return;
        }
        setSaving(true);
        const predictionData: SeasonPrediction = {
            userId,
            leagueId: league.id,
            season: CURRENT_SEASON,
            predictedChampionId: Number(championId),
            predictedTopScorerId: Number(scorerId),
            championPoints: 0,
            topScorerPoints: 0
        };
        
        setDoc(predictionDocRef, predictionData)
            .then(() => {
                toast({ title: 'تم الحفظ', description: `تم حفظ توقعاتك لـ ${league.name}.` });
            })
            .catch(serverError => {
                 const permissionError = new FirestorePermissionError({ path: predictionDocRef.path, operation: 'create', requestResourceData: predictionData });
                 errorEmitter.emit('permission-error', permissionError);
            })
            .finally(() => {
                setSaving(false);
            });
    };
    
    const isLoading = loading || initialLoading;

    return (
        <div className="p-4 border rounded-lg bg-card">
            <h3 className="font-bold mb-4">{league.name}</h3>
            {isLoading ? <Loader2 className="mx-auto h-6 w-6 animate-spin" /> : (
                <div className="space-y-4">
                    <div>
                        <label className="text-sm font-medium mb-1 block">توقع البطل</label>
                        <Select value={championId} onValueChange={setChampionId}>
                            <SelectTrigger><SelectValue placeholder="اختر الفريق البطل..." /></SelectTrigger>
                            <SelectContent>
                                {teams.map(({ team }) => (
                                    <SelectItem key={team.id} value={String(team.id)}>{team.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <label className="text-sm font-medium mb-1 block">توقع الهداف</label>
                         <Select value={scorerId} onValueChange={setScorerId}>
                            <SelectTrigger><SelectValue placeholder="اختر الهداف..." /></SelectTrigger>
                            <SelectContent>
                                {scorers.map(({ player }) => (
                                    <SelectItem key={player.id} value={String(player.id)}>{player.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                     <Button onClick={handleSave} disabled={saving} className="w-full">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'حفظ'}
                    </Button>
                </div>
            )}
        </div>
    );
};


export function SeasonPredictionsScreen({ navigate, goBack, canGoBack, headerActions }: ScreenProps) {
    const { user } = useAuth();
    
    return (
        <div className="flex h-full flex-col bg-background">
            <ScreenHeader title="الموسم" onBack={goBack} canGoBack={canGoBack} actions={headerActions} />
            <div className="flex-1 overflow-y-auto p-4">
                <Card>
                    <CardHeader>
                        <CardTitle>توقع بطل الموسم وهداف الدوري</CardTitle>
                        <CardDescription>
                            سيتم منح 50 نقطة لتوقع البطل الصحيح و 25 نقطة لتوقع الهداف الصحيح في نهاية الموسم لكل دوري.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                       {user ? leagues.map(league => (
                            <LeaguePredictionCard key={league.id} league={league} userId={user.uid} />
                        )) : <p>الرجاء تسجيل الدخول للمشاركة.</p>}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
