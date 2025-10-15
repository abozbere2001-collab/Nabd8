
"use client";

import React, { useState, useEffect } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from './ui/button';
import { Loader2 } from 'lucide-react';
import { Progress } from './ui/progress';

interface PredictionData {
    predictions: {
        winner: { id: number; name: string; comment: string; };
        win_or_draw: boolean;
        under_over: string | null;
        goals: { home: string; away: string; };
        advice: string;
        percent: { home: string; draw: string; away: string; };
    };
    league: any;
    teams: {
        home: { id: number; name: string; logo: string; last_5: any; league: any; };
        away: { id: number; name: string; logo: string; last_5: any; league: any; };
    };
    comparison: any;
    h2h: any[];
}


export function MatchPredictionPopover({ fixtureId }: { fixtureId: number }) {
    const [prediction, setPrediction] = useState<PredictionData | null>(null);
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        if (isOpen && !prediction && !loading) {
            setLoading(true);
            fetch(`/api/football/predictions?fixture=${fixtureId}`)
                .then(res => res.json())
                .then(data => {
                    if (data.response && data.response.length > 0) {
                        setPrediction(data.response[0]);
                    }
                })
                .catch(console.error)
                .finally(() => setLoading(false));
        }
    }, [isOpen, fixtureId, prediction, loading]);

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs px-2">1x2</Button>
            </PopoverTrigger>
            <PopoverContent className="w-60 p-3" align="center" side="top">
                {loading ? (
                    <div className="flex justify-center items-center h-24">
                        <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                ) : prediction ? (
                    <div className="space-y-3 text-xs">
                        <div className="text-center font-bold">{prediction.predictions.advice}</div>
                        <div className="space-y-2">
                             {/* Home Win */}
                            <div className="flex items-center justify-between gap-2">
                                <span className="truncate">{prediction.teams.home.name}</span>
                                <span className="font-bold">{prediction.predictions.percent.home}</span>
                            </div>
                             {/* Draw */}
                            <div className="flex items-center justify-between gap-2">
                                <span>تعادل</span>
                                <span className="font-bold">{prediction.predictions.percent.draw}</span>
                            </div>
                            {/* Away Win */}
                            <div className="flex items-center justify-between gap-2">
                                <span className="truncate">{prediction.teams.away.name}</span>
                                <span className="font-bold">{prediction.predictions.percent.away}</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center text-muted-foreground py-4">
                        لا توجد توقعات متاحة.
                    </div>
                )}
            </PopoverContent>
        </Popover>
    )
}
