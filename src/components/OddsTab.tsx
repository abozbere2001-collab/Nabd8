
"use client";

import React, { useState, useEffect } from 'react';
import { Loader2, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from './ui/skeleton';

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
    league: any;
    update: string;
    bookmakers: Bookmaker[];
}

interface OddsHistoryItem {
    bookmaker: { id: number; name: string };
    bet: { id: number; name: string };
    values: OddValue[];
    update: string;
}

// --- HELPER COMPONENTS ---
const OddsChangeIndicator = ({ change }: { change: number | null }) => {
    if (change === null || change === 0) return <span className="w-6"></span>;
    const isUp = change > 0;
    const color = isUp ? "text-green-500" : "text-red-500";
    const Icon = isUp ? ArrowUp : ArrowDown;

    return (
        <span className={cn("flex items-center font-mono text-xs", color)}>
            <Icon className="h-3 w-3" />
        </span>
    );
};

const BetRow = ({ values, history }: { values: OddValue[], history: OddsHistoryItem[] }) => {
    const getChange = (valueName: string, currentOdd: string): number | null => {
        const relevantHistory = history.filter(h => h.values.some(v => v.value === valueName)).sort((a,b) => new Date(b.update).getTime() - new Date(a.update).getTime());
        if (relevantHistory.length < 2) return null;

        const previousOddStr = relevantHistory[1].values.find(v => v.value === valueName)?.odd;
        if (!previousOddStr) return null;

        const current = parseFloat(currentOdd);
        const previous = parseFloat(previousOddStr);

        if (isNaN(current) || isNaN(previous)) return null;

        return current - previous;
    }

    return (
        <div className="grid grid-cols-3 gap-2 text-center">
            {values.map(v => (
                 <div key={v.value} className="flex flex-col items-center justify-center p-2 bg-background rounded-md">
                     <span className="text-xs text-muted-foreground">{v.value}</span>
                     <div className="flex items-center gap-1">
                        <span className="font-bold text-lg">{v.odd}</span>
                        <OddsChangeIndicator change={getChange(v.value, v.odd)} />
                     </div>
                 </div>
            ))}
        </div>
    )
}

// --- MAIN TAB COMPONENT ---
export function OddsTab({ fixtureId }: { fixtureId: number }) {
    const [bookmakers, setBookmakers] = useState<Bookmaker[]>([]);
    const [oddsHistory, setOddsHistory] = useState<Record<number, Record<number, OddsHistoryItem[]>>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        setLoading(true);

        fetch(`/api/football/odds?fixture=${fixtureId}`)
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch odds data');
                return res.json();
            })
            .then(data => {
                if (!isMounted) return;
                const oddsResponse: OddsApiResponse | undefined = data.response?.[0];
                setBookmakers(oddsResponse?.bookmakers || []);
                setOddsHistory(data.odds_history?.[fixtureId] || {});
            })
            .catch(err => {
                console.error("Error fetching odds:", err);
                setBookmakers([]);
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });

        return () => { isMounted = false; };
    }, [fixtureId]);

    if (loading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-32 w-full" />
            </div>
        );
    }

    if (bookmakers.length === 0) {
        return <p className="text-center text-muted-foreground p-8">لا توجد احتمالات متاحة لهذه المباراة.</p>;
    }

    return (
        <Card>
            <CardContent className="p-2">
                <Accordion type="single" collapsible className="w-full" defaultValue={bookmakers[0]?.id.toString()}>
                    {bookmakers.map(bm => (
                        <AccordionItem value={bm.id.toString()} key={bm.id}>
                            <AccordionTrigger className="font-bold text-lg">{bm.name}</AccordionTrigger>
                            <AccordionContent>
                               <div className="space-y-4">
                                 {bm.bets.map(bet => (
                                     <div key={bet.id} className="p-3 border rounded-lg">
                                         <h4 className="font-semibold text-center mb-3">{bet.name}</h4>
                                         <BetRow values={bet.values} history={oddsHistory[bm.id]?.[bet.id] || []} />
                                     </div>
                                 ))}
                               </div>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </CardContent>
        </Card>
    );
}
