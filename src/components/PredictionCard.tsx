

"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/use-debounce';
import type { Fixture, Prediction, PredictionMatch } from '@/lib/types';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { PredictionOdds } from './PredictionOdds';
import { LiveMatchStatus } from './LiveMatchStatus';
import { Loader2 } from 'lucide-react';
import { isMatchLive } from '@/lib/matchStatus';

const API_KEY = "774c1bb02ceabecd14e199ab73bd9722";
const API_HOST = "v3.football.api-sports.io";


const PredictionCard = ({ predictionMatch, userPrediction, onSave }: { predictionMatch: PredictionMatch, userPrediction?: Prediction, onSave: (fixtureId: number, home: string, away: string) => void }) => {
    const [liveFixture, setLiveFixture] = useState<Fixture>(predictionMatch.fixtureData);
    const [isUpdating, setIsUpdating] = useState(false);
    
    const [homeValue, setHomeValue] = useState(userPrediction?.homeGoals?.toString() ?? '');
    const [awayValue, setAwayValue] = useState(userPrediction?.awayGoals?.toString() ?? '');
    
    const debouncedHome = useDebounce(homeValue, 500);
    const debouncedAway = useDebounce(awayValue, 500);

    const isMatchLiveOrFinished = useMemo(() => isMatchLive(liveFixture.fixture.status) || ['FT', 'AET', 'PEN'].includes(liveFixture.fixture.status.short), [liveFixture.fixture.status]);
    const isMatchFinished = useMemo(() => ['FT', 'AET', 'PEN'].includes(liveFixture.fixture.status.short), [liveFixture.fixture.status]);
    const isPredictionDisabled = useMemo(() => new Date(liveFixture.fixture.timestamp * 1000) < new Date(), [liveFixture]);

    // Fetch live data for the match
    useEffect(() => {
        let intervalId: NodeJS.Timeout | null = null;

        const fetchLiveFixture = async () => {
            setIsUpdating(true);
            try {
                const res = await fetch(`https://${API_HOST}/fixtures?id=${liveFixture.fixture.id}`, {
                    headers: { 'x-rapidapi-key': API_KEY }
                });
                const data = await res.json();
                if (data.response && data.response.length > 0) {
                    setLiveFixture(data.response[0]);
                }
            } catch (error) {
                console.error("Failed to fetch live fixture data:", error);
            } finally {
                setTimeout(() => setIsUpdating(false), 500);
            }
        };

        const shouldPoll = isMatchLive(liveFixture.fixture.status);
        
        if (shouldPoll) {
            fetchLiveFixture(); // Fetch immediately
            intervalId = setInterval(fetchLiveFixture, 60000); // Then poll every 60 seconds
        } else if (new Date(liveFixture.fixture.timestamp * 1000) < new Date() && !isMatchFinished) {
            // If the match should have started but status is not live, check once.
            fetchLiveFixture();
        }

        return () => {
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    }, [liveFixture.fixture.id, liveFixture.fixture.status, isMatchFinished, liveFixture.fixture.timestamp]);


    const getPredictionStatusColors = useCallback(() => {
        if (!isMatchFinished || !userPrediction) {
            return "bg-card text-foreground";
        }

        const actualHome = liveFixture.goals.home;
        const actualAway = liveFixture.goals.away;
        const predHome = userPrediction.homeGoals;
        const predAway = userPrediction.awayGoals;
        
        if (actualHome === null || actualAway === null) return "bg-card text-foreground";

        if (actualHome === predHome && actualAway === predAway) {
            return "bg-green-500/80 text-white";
        }

        const actualWinner = actualHome > actualAway ? 'home' : actualHome < actualAway ? 'away' : 'draw';
        const predWinner = predHome > predAway ? 'home' : predHome < predAway ? 'away' : 'draw';
        
        if (actualWinner === predWinner) {
            return "bg-yellow-500/80 text-white";
        }

        return "bg-destructive/80 text-white";
    }, [isMatchFinished, userPrediction, liveFixture.goals]);
    
    const getPointsColor = useCallback(() => {
        if (!isMatchFinished || userPrediction?.points === undefined) return 'text-primary';
        if (userPrediction.points === 5) return 'text-green-500';
        if (userPrediction.points === 3) return 'text-yellow-500';
        return 'text-destructive';
    }, [isMatchFinished, userPrediction]);

    useEffect(() => {
        if (debouncedHome !== '' && debouncedAway !== '' && (debouncedHome !== userPrediction?.homeGoals?.toString() || debouncedAway !== userPrediction?.awayGoals?.toString())) {
            onSave(liveFixture.fixture.id, debouncedHome, debouncedAway);
        }
    }, [debouncedHome, debouncedAway, onSave, userPrediction, liveFixture.fixture.id]);

    const handleHomeChange = (e: React.ChangeEvent<HTMLInputElement>) => setHomeValue(e.target.value);
    const handleAwayChange = (e: React.ChangeEvent<HTMLInputElement>) => setAwayValue(e.target.value);
    
    useEffect(() => {
        setHomeValue(userPrediction?.homeGoals?.toString() ?? '');
        setAwayValue(userPrediction?.awayGoals?.toString() ?? '');
    },[userPrediction]);

    const cardColors = getPredictionStatusColors();
    const isColoredCard = cardColors !== 'bg-card text-foreground';

    return (
        <Card className={cn("transition-colors", cardColors)}>
            <CardContent className="p-3">
                <div className="flex items-center justify-between gap-1">
                     <div className="flex flex-col items-center gap-1 flex-1 justify-end truncate">
                        <Avatar className="h-8 w-8"><AvatarImage src={liveFixture.teams.home.logo} /></Avatar>
                        <span className={cn("font-semibold text-xs text-center truncate w-full", isColoredCard && "text-white")}>{liveFixture.teams.home.name}</span>
                    </div>
                    <div className="flex items-center gap-1" dir="rtl">
                        <Input 
                            type="number" 
                            className={cn("w-10 h-9 text-center text-md font-bold", isColoredCard && 'bg-black/20 border-white/30 text-white placeholder:text-white/70')}
                            min="0" 
                            value={homeValue}
                            onChange={handleHomeChange}
                            id={`home-${liveFixture.fixture.id}`}
                            disabled={isPredictionDisabled}
                        />
                         <div className="flex flex-col items-center justify-center min-w-[70px] text-center relative">
                            {isUpdating && <Loader2 className="h-4 w-4 animate-spin absolute top-0"/>}
                            <LiveMatchStatus fixture={liveFixture} />
                         </div>
                        <Input 
                            type="number" 
                            className={cn("w-10 h-9 text-center text-md font-bold", isColoredCard && 'bg-black/20 border-white/30 text-white placeholder:text-white/70')}
                            min="0"
                            value={awayValue}
                            onChange={handleAwayChange}
                            id={`away-${liveFixture.fixture.id}`}
                            disabled={isPredictionDisabled}
                        />
                    </div>
                   <div className="flex flex-col items-center gap-1 flex-1 truncate">
                        <Avatar className="h-8 w-8"><AvatarImage src={liveFixture.teams.away.logo} /></Avatar>
                        <span className={cn("font-semibold text-xs text-center truncate w-full", isColoredCard && "text-white")}>{liveFixture.teams.away.name}</span>
                    </div>
                </div>
                 <div className={cn("text-center text-xs mt-2", isMatchLiveOrFinished ? (isColoredCard ? 'text-white/80' : 'text-muted-foreground') : 'text-muted-foreground')}>
                    <span className={cn(isColoredCard && "text-white")}>{liveFixture.league.name}</span>
                </div>

                <div className="mt-2">
                    <PredictionOdds fixtureId={liveFixture.fixture.id} />
                </div>


                {isMatchFinished && userPrediction?.points !== undefined && userPrediction.points >= 0 && (
                     <p className={cn("text-center font-bold text-sm mt-2", getPointsColor())}>
                        +{userPrediction.points} نقاط
                    </p>
                )}
                
                {!isMatchFinished && userPrediction && <p className={cn("text-center text-xs mt-2", isColoredCard ? 'text-green-300' : 'text-green-500')}>تم حفظ توقعك</p>}

                
                {isPredictionDisabled && !userPrediction && !isMatchFinished && <p className={cn("text-center text-xs mt-2", isColoredCard ? 'text-red-300' : 'text-red-500')}>أغلق باب التوقع</p>}
            </CardContent>
        </Card>
    );
};

export default PredictionCard;
