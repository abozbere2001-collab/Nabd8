

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

const PredictionCard = ({ fixture, userPrediction, onSave }: { fixture: Fixture, userPrediction?: Prediction, onSave: (fixtureId: number, home: string, away: string) => void }) => {
    
    const [homeValue, setHomeValue] = useState(userPrediction?.homeGoals?.toString() ?? '');
    const [awayValue, setAwayValue] = useState(userPrediction?.awayGoals?.toString() ?? '');
    
    const debouncedHome = useDebounce(homeValue, 500);
    const debouncedAway = useDebounce(awayValue, 500);

    const isMatchFinished = useMemo(() => ['FT', 'AET', 'PEN'].includes(fixture.fixture.status.short), [fixture.fixture.status]);
    const isPredictionDisabled = useMemo(() => new Date(fixture.fixture.timestamp * 1000) < new Date(), [fixture.fixture.timestamp]);


    const getPredictionStatusColors = useCallback(() => {
        if (!isMatchFinished || !userPrediction) {
            return "bg-card text-foreground";
        }

        const actualHome = fixture.goals.home;
        const actualAway = fixture.goals.away;
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
    }, [isMatchFinished, userPrediction, fixture.goals]);
    
    const getPointsColor = useCallback(() => {
        if (!isMatchFinished || userPrediction?.points === undefined) return 'text-primary';
        if (userPrediction.points === 5) return 'text-green-500';
        if (userPrediction.points === 3) return 'text-yellow-500';
        return 'text-destructive';
    }, [isMatchFinished, userPrediction]);

    useEffect(() => {
        if (debouncedHome !== '' && debouncedAway !== '' && (debouncedHome !== userPrediction?.homeGoals?.toString() || debouncedAway !== userPrediction?.awayGoals?.toString())) {
            onSave(fixture.fixture.id, debouncedHome, debouncedAway);
        }
    }, [debouncedHome, debouncedAway, onSave, userPrediction, fixture.fixture.id]);

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
                        <Avatar className="h-8 w-8"><AvatarImage src={fixture.teams.home.logo} /></Avatar>
                        <span className={cn("font-semibold text-xs text-center truncate w-full", isColoredCard && "text-white")}>{fixture.teams.home.name}</span>
                    </div>
                    <div className="flex items-center gap-1" dir="rtl">
                        <Input 
                            type="number" 
                            className={cn("w-10 h-9 text-center text-md font-bold", isColoredCard && 'bg-black/20 border-white/30 text-white placeholder:text-white/70')}
                            min="0" 
                            value={homeValue}
                            onChange={handleHomeChange}
                            id={`home-${fixture.fixture.id}`}
                            disabled={isPredictionDisabled}
                        />
                         <div className="flex flex-col items-center justify-center min-w-[70px] text-center relative">
                            <LiveMatchStatus fixture={fixture} />
                         </div>
                        <Input 
                            type="number" 
                            className={cn("w-10 h-9 text-center text-md font-bold", isColoredCard && 'bg-black/20 border-white/30 text-white placeholder:text-white/70')}
                            min="0"
                            value={awayValue}
                            onChange={handleAwayChange}
                            id={`away-${fixture.fixture.id}`}
                            disabled={isPredictionDisabled}
                        />
                    </div>
                   <div className="flex flex-col items-center gap-1 flex-1 truncate">
                        <Avatar className="h-8 w-8"><AvatarImage src={fixture.teams.away.logo} /></Avatar>
                        <span className={cn("font-semibold text-xs text-center truncate w-full", isColoredCard && "text-white")}>{fixture.teams.away.name}</span>
                    </div>
                </div>
                 <div className={cn("text-center text-xs mt-2", isColoredCard ? 'text-white/80' : 'text-muted-foreground')}>
                    <span className={cn(isColoredCard && "text-white")}>{fixture.league.name}</span>
                </div>

                <div className="mt-2">
                    <PredictionOdds fixtureId={fixture.fixture.id} />
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

    