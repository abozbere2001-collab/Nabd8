
"use client";

import React from 'react';
import type { ScreenProps } from '@/app/page';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { PREMIER_LEAGUE_ID, LALIGA_ID, SERIE_A_ID, BUNDESLIGA_ID } from '@/lib/constants';

const leagues = [
    { id: PREMIER_LEAGUE_ID, name: "الدوري الإنجليزي الممتاز", logo: "https://media.api-sports.io/football/leagues/39.png" },
    { id: LALIGA_ID, name: "الدوري الإسباني", logo: "https://media.api-sports.io/football/leagues/140.png" },
    { id: SERIE_A_ID, name: "الدوري الإيطالي", logo: "https://media.api-sports.io/football/leagues/135.png" },
    { id: BUNDESLIGA_ID, name: "الدوري الألماني", logo: "https://media.api-sports.io/football/leagues/78.png" },
];


export function SeasonPredictionsScreen({ navigate, goBack, canGoBack, headerActions }: ScreenProps) {
    
    const handleLeagueSelect = (leagueId: number, leagueName: string) => {
        navigate('SeasonTeamSelection', { leagueId, leagueName });
    };

    return (
        <div className="flex h-full flex-col bg-background">
            <ScreenHeader title="توقعات الموسم" onBack={goBack} canGoBack={canGoBack} actions={headerActions} />
            <div className="flex-1 overflow-y-auto p-4">
                <div className="grid grid-cols-2 gap-4">
                    {leagues.map(league => (
                        <Card 
                            key={league.id} 
                            className="cursor-pointer hover:bg-accent/50 transition-colors"
                            onClick={() => handleLeagueSelect(league.id, league.name)}
                        >
                            <CardHeader className="items-center text-center">
                                <img src={league.logo} alt={league.name} className="w-20 h-20 object-contain mb-4" />
                                <CardTitle className="text-base">{league.name}</CardTitle>
                            </CardHeader>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    );
}
