
"use client";

import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
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
    bookmakers: Bookmaker[];
}

interface ProcessedOdds {
    home: number;
    draw: number;
    away: number;
}

export function PredictionOdds({ fixtureId }: { fixtureId: number }) {
    const [odds, setOdds] = useState<ProcessedOdds | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        setLoading(true);

        fetch(`/api/football/odds?fixture=${fixtureId}&bookmaker=8`)
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch odds');
                return res.json();
            })
            .then(data => {
                if (!isMounted) return;

                const oddsResponse: OddsApiResponse | undefined = data.response?.[0];
                const bookmaker = oddsResponse?.bookmakers?.find((b: Bookmaker) => b.id === 8);
                const matchWinnerBet = bookmaker?.bets.find((b: Bet) => b.id === 1);

                if (matchWinnerBet) {
                    const currentOdds: { [key: string]: number } = {};
                    matchWinnerBet.values.forEach((v: OddValue) => {
                        const key = v.value.toLowerCase().replace(' ', '');
                        currentOdds[key] = parseFloat(v.odd);
                    });

                    setOdds({
                        home: currentOdds.home,
                        draw: currentOdds.draw,
                        away: currentOdds.away,
                    });
                } else {
                    setOdds(null);
                }
            })
            .catch(err => {
                if (isMounted) setOdds(null);
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });

        return () => { isMounted = false; };
    }, [fixtureId]);

    if (loading) {
        return <Skeleton className="h-2 w-full mt-2" />;
    }

    if (!odds) {
        return null; // Don't render anything if odds are not available
    }

    const probHome = (1 / odds.home) * 100;
    const probDraw = (1 / odds.draw) * 100;
    const probAway = (1 / odds.away) * 100;
    const totalProb = probHome + probDraw + probAway;

    const percentHome = (probHome / totalProb) * 100;
    const percentDraw = (probDraw / totalProb) * 100;
    const percentAway = (probAway / totalProb) * 100;

    return (
        <div className="flex w-full h-2 rounded-full overflow-hidden" dir="ltr">
            <div style={{ width: `${percentHome}%` }} className="bg-primary h-full transition-all duration-500" title={`فوز الفريق المضيف ${percentHome.toFixed(0)}%`}></div>
            <div style={{ width: `${percentDraw}%` }} className="bg-gray-400 h-full transition-all duration-500" title={`تعادل ${percentDraw.toFixed(0)}%`}></div>
            <div style={{ width: `${percentAway}%` }} className="bg-accent h-full transition-all duration-500" title={`فوز الفريق الضيف ${percentAway.toFixed(0)}%`}></div>
        </div>
    );
}
