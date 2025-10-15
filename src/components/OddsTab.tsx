
"use client";

import React, { useState, useEffect } from 'react';
import { Loader2, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

// --- TRANSLATION MAP ---
const betNameTranslations: { [key: string]: string } = {
    "Match Winner": "الفائز في المباراة",
    "Double Chance": "فرصة مزدوجة",
    "Both Teams to Score": "كلا الفريقين يسجلان",
    "Total - Over/Under": "المجموع - أعلى/أقل",
    "First Half Winner": "فائز الشوط الأول",
    "Second Half Winner": "فائز الشوط الثاني",
    "Goals Over/Under (First Half)": "أهداف الشوط الأول - أعلى/أقل",
    "Exact Score": "النتيجة الصحيحة",
    "Handicap Result": "نتيجة الهانديكاب",
};

const valueTranslations: { [key: string]: string } = {
    "Home": "فريق 1",
    "Draw": "تعادل",
    "Away": "فريق 2",
    "Yes": "نعم",
    "No": "لا",
    "Over": "أعلى",
    "Under": "أقل",
    "Home/Draw": "فريق 1 أو تعادل",
    "Home/Away": "فريق 1 أو فريق 2",
    "Draw/Away": "تعادل أو فريق 2",
};

const translate = (text: string, type: 'bet' | 'value'): string => {
    if (type === 'bet') {
        return betNameTranslations[text] || text;
    }
    // For values like "Over 2.5", "Under 1.5"
    if (text.startsWith("Over") || text.startsWith("Under")) {
        const parts = text.split(" ");
        const translatedPrefix = valueTranslations[parts[0]] || parts[0];
        return `${translatedPrefix} ${parts.slice(1).join(" ")}`;
    }
    return valueTranslations[text] || text;
};


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
                     <span className="text-xs text-muted-foreground">{translate(v.value, 'value')}</span>
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
    const [bookmaker, setBookmaker] = useState<Bookmaker | null>(null);
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
                const oneXBet = oddsResponse?.bookmakers?.find(b => b.name === '1xBet');
                
                setBookmaker(oneXBet || null);
                setOddsHistory(data.odds_history?.[fixtureId] || {});
            })
            .catch(err => {
                console.error("Error fetching odds:", err);
                setBookmaker(null);
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });

        return () => { isMounted = false; };
    }, [fixtureId]);

    if (loading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-32 w-full" />
            </div>
        );
    }

    if (!bookmaker || bookmaker.bets.length === 0) {
        return <p className="text-center text-muted-foreground p-8">لا توجد احتمالات متاحة لهذه المباراة من 1xBet.</p>;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-xl text-center font-bold">احتمالات 1xBet</CardTitle>
            </CardHeader>
            <CardContent className="p-2 space-y-4">
                 {bookmaker.bets.map(bet => (
                     <div key={bet.id} className="p-3 border rounded-lg bg-card-foreground/5">
                         <h4 className="font-semibold text-center mb-3">{translate(bet.name, 'bet')}</h4>
                         <BetRow values={bet.values} history={oddsHistory[bookmaker.id]?.[bet.id] || []} />
                     </div>
                 ))}
            </CardContent>
        </Card>
    );
}
