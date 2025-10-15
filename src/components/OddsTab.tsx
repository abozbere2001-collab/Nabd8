
"use client";

import React, { useState, useEffect } from 'react';
import { Loader2, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from './ui/skeleton';
import { Avatar, AvatarImage } from '@/components/ui/avatar';

// --- TYPE DEFINITIONS ---
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
    teams: {
        home: { id: number; name: string; logo: string; };
        away: { id: number; name: string; logo: string; };
    };
    league: any;
    update: string;
    bookmakers: Bookmaker[];
}

interface OddsHistoryItem {
    values: OddValue[];
    update: string;
}

interface ProcessedOdds {
    home: number;
    draw: number;
    away: number;
    homeChange: number;
    drawChange: number;
    awayChange: number;
    homeTeamName: string;
    awayTeamName: string;
    homeTeamLogo: string;
    awayTeamLogo: string;
}


// --- HELPER COMPONENTS ---
const OddsChangeIndicator = ({ change }: { change: number }) => {
    if (change === 0) return null;

    const isUp = change > 0;
    const color = isUp ? "text-green-500" : "text-red-500";
    const Icon = isUp ? ArrowUp : ArrowDown;

    return (
        <span className={cn("flex items-center font-mono text-xs", color)}>
            <Icon className="h-3 w-3" />
            {Math.abs(change).toFixed(2)}
        </span>
    );
};

// --- MAIN TAB COMPONENT ---
export function OddsTab({ fixtureId }: { fixtureId: number }) {
    const [odds, setOdds] = useState<ProcessedOdds | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        setLoading(true);

        Promise.all([
            fetch(`/api/football/odds?fixture=${fixtureId}`),
            fetch(`/api/football/fixtures?id=${fixtureId}`)
        ])
        .then(async ([oddsRes, fixtureRes]) => {
            if (!oddsRes.ok || !fixtureRes.ok) {
                throw new Error('Failed to fetch match data');
            }
            const oddsData = await oddsRes.json();
            const fixtureData = await fixtureRes.json();
            return { oddsData, fixtureData };
        })
        .then(({ oddsData, fixtureData }) => {
            if (!isMounted) return;

            const oddsResponse: OddsApiResponse | undefined = oddsData.response?.[0];
            const fixtureInfo = fixtureData.response?.[0];
            const bookmaker = oddsResponse?.bookmakers?.find((b: Bookmaker) => b.id === 8); // Bet365
            const matchWinnerBet = bookmaker?.bets.find((b: Bet) => b.id === 1);

            if (matchWinnerBet && oddsResponse.update && fixtureInfo) {
                const oddsHistory: OddsHistoryItem[] = oddsData.odds_history?.[fixtureId]?.[bookmaker?.id]?.[1] || [];
                
                const currentOdds: { [key: string]: number } = {};
                matchWinnerBet.values.forEach((v: OddValue) => {
                   const key = v.value.toLowerCase().replace(' ', '');
                   currentOdds[key] = parseFloat(v.odd);
                });

                const previousOdds: { [key: string]: number } = {};
                if(oddsHistory.length > 1) {
                    const prev = oddsHistory[1]; // Second to last entry is the previous odd
                    prev.values.forEach((v: OddValue) => {
                        const key = v.value.toLowerCase().replace(' ', '');
                        previousOdds[key] = parseFloat(v.odd);
                    });
                } else {
                     previousOdds.home = currentOdds.home;
                     previousOdds.draw = currentOdds.draw;
                     previousOdds.away = currentOdds.away;
                }

                setOdds({
                    home: currentOdds.home,
                    draw: currentOdds.draw,
                    away: currentOdds.away,
                    homeChange: currentOdds.home - previousOdds.home,
                    drawChange: currentOdds.draw - previousOdds.draw,
                    awayChange: currentOdds.away - previousOdds.away,
                    homeTeamName: fixtureInfo.teams.home.name,
                    awayTeamName: fixtureInfo.teams.away.name,
                    homeTeamLogo: fixtureInfo.teams.home.logo,
                    awayTeamLogo: fixtureInfo.teams.away.logo,
                });
            } else {
                setOdds(null);
            }
        })
        .catch(err => {
            console.error("Error fetching odds:", err);
            if (isMounted) setOdds(null);
        })
        .finally(() => {
            if (isMounted) setLoading(false);
        });

        return () => { isMounted = false; };
    }, [fixtureId]);


    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-3/4 mx-auto" />
                </CardHeader>
                <CardContent className="space-y-3">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                </CardContent>
            </Card>
        );
    }

    if (!odds) {
        return <p className="text-center text-muted-foreground p-8">لا توجد احتمالات متاحة لهذه المباراة.</p>;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-xl text-center font-bold">احتمالات فوز المباراة (1xBet)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="flex justify-between items-center text-sm p-3 rounded-lg bg-card-foreground/5 border">
                    <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6"><AvatarImage src={odds.homeTeamLogo} /></Avatar>
                        <span className="font-semibold">{odds.homeTeamName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-lg">{odds.home.toFixed(2)}</span>
                        <OddsChangeIndicator change={odds.homeChange} />
                    </div>
                </div>
                <div className="flex justify-between items-center text-sm p-3 rounded-lg bg-card-foreground/5 border">
                     <span className="font-semibold">تعادل</span>
                     <div className="flex items-center gap-2">
                        <span className="font-bold text-lg">{odds.draw.toFixed(2)}</span>
                        <OddsChangeIndicator change={odds.drawChange} />
                    </div>
                </div>
                <div className="flex justify-between items-center text-sm p-3 rounded-lg bg-card-foreground/5 border">
                    <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6"><AvatarImage src={odds.awayTeamLogo} /></Avatar>
                        <span className="font-semibold">{odds.awayTeamName}</span>
                    </div>
                     <div className="flex items-center gap-2">
                        <span className="font-bold text-lg">{odds.away.toFixed(2)}</span>
                        <OddsChangeIndicator change={odds.awayChange} />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
