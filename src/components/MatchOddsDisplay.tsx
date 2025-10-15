
"use client";

import React, { useState, useEffect } from 'react';
import { Loader2, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from './ui/skeleton';

interface OddValue {
    value: string;
    odd: string;
}

interface Bet {
    id: number;
    name: string;
    values: OddValue[];
}

interface Bookmaker {
    id: number;
    name: string;
    bets: Bet[];
}

interface OddsApiResponse {
    fixture: { id: number; };
    league: any;
    update: string;
    bookmakers: Bookmaker[];
}

interface ProcessedOdds {
    home: number;
    draw: number;
    away: number;
    homeChange: number;
    drawChange: number;
    awayChange: number;
}

const OddsChangeIndicator = ({ change }: { change: number }) => {
    if (change === 0) return null;
    const isUp = change > 0;
    const color = isUp ? "text-green-500" : "text-red-500";
    const Icon = isUp ? ArrowUp : ArrowDown;

    return (
        <span className={cn("flex items-center font-mono text-[10px]", color)}>
            <Icon className="h-2.5 w-2.5" />
        </span>
    );
};

const OddButton = ({ label, value, change }: { label: string; value: number; change: number }) => (
    <div className="flex-1 flex items-center justify-center gap-1.5 p-1.5 rounded-md bg-background/50 text-xs">
        <span className="font-semibold text-muted-foreground">{label}</span>
        <span className="font-bold text-foreground">{value.toFixed(2)}</span>
        <OddsChangeIndicator change={change} />
    </div>
);


export function MatchOddsDisplay({ fixtureId }: { fixtureId: number }) {
    const [odds, setOdds] = useState<ProcessedOdds | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        setLoading(true);

        fetch(`/api/football/odds?fixture=${fixtureId}`)
        .then(res => {
            if (!res.ok) throw new Error('Failed to fetch odds');
            return res.json();
        })
        .then(data => {
            if (!isMounted) return;

            const oddsResponse: OddsApiResponse | undefined = data.response?.[0];
            if (oddsResponse) {
                const bookmaker = oddsResponse.bookmakers.find((b: Bookmaker) => b.id === 8); // Bet365
                const matchWinnerBet = bookmaker?.bets.find((b: Bet) => b.id === 1);
                
                if (matchWinnerBet && oddsResponse.update) {
                    const oddsHistory = data.odds_history?.[fixtureId]?.[bookmaker?.id]?.[1] || [];
                    
                    const currentOdds: { [key: string]: number } = {};
                    matchWinnerBet.values.forEach((v: OddValue) => {
                       const key = v.value.toLowerCase().replace(' ', '');
                       currentOdds[key] = parseFloat(v.odd);
                    });
                    
                    const previousOdds: { [key: string]: number } = {};
                    if (oddsHistory.length > 1) {
                        const prev = oddsHistory[1]; // second to last
                        prev.values.forEach((v: OddValue) => {
                            const key = v.value.toLowerCase().replace(' ', '');
                            previousOdds[key] = parseFloat(v.odd);
                        });
                    } else {
                        previousOdds.home = currentOdds.home;
                        previousOdds.draw = currentOdds.draw;
                        previousOdds.away = currentOdds.away;
                    }

                    if (currentOdds.home && currentOdds.draw && currentOdds.away) {
                        setOdds({
                            home: currentOdds.home,
                            draw: currentOdds.draw,
                            away: currentOdds.away,
                            homeChange: currentOdds.home - (previousOdds.home || currentOdds.home),
                            drawChange: currentOdds.draw - (previousOdds.draw || currentOdds.draw),
                            awayChange: currentOdds.away - (previousOdds.away || currentOdds.away),
                        });
                    }
                }
            }
        })
        .catch(console.error)
        .finally(() => {
            if (isMounted) setLoading(false);
        });

        return () => { isMounted = false; };
    }, [fixtureId]);

    if (loading) {
        return (
            <div className="flex gap-2 mt-2 px-2">
                <Skeleton className="h-8 flex-1" />
                <Skeleton className="h-8 flex-1" />
                <Skeleton className="h-8 flex-1" />
            </div>
        );
    }
    
    if (!odds) {
        return null; // Don't render anything if no odds are available
    }

    return (
        <div className="flex gap-2 mt-2 px-2 pb-1">
            <OddButton label="1" value={odds.home} change={odds.homeChange} />
            <OddButton label="X" value={odds.draw} change={odds.drawChange} />
            <OddButton label="2" value={odds.away} change={odds.awayChange} />
        </div>
    );
}
