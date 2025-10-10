
"use client";

import React from 'react';
import type { LineupData } from '@/lib/types';
import { PlayerCard } from './PlayerCard';
import './LineupField.css';

const groupPlayers = (players: LineupData['startXI']) => {
    const groups: { [key: string]: typeof players } = { 'G': [], 'D': [], 'M': [], 'F': [] };
    players.forEach(p => {
        const position = p.statistics[0]?.games?.position || 'M';
        if (groups[position[0]]) {
            groups[position[0]].push(p);
        } else {
            groups['M'].push(p); // Fallback for unknown positions
        }
    });
    return groups;
};

export function LineupField({ home, away }: { home: LineupData, away: LineupData }) {
    const homeGrouped = groupPlayers(home.startXI);
    const awayGrouped = groupPlayers(away.startXI);

    return (
        <div className="field-container bg-background p-2">
            <div className="field-background">
                {/* Away Team Section */}
                <div className="team-section away-team">
                    {['F', 'M', 'D', 'G'].map(pos => (
                        <div key={`away-${pos}`} className="lineup-row">
                            {awayGrouped[pos]?.map(({ player }) => <PlayerCard key={player.id} player={player} teamColors={away.team.colors} />)}
                        </div>
                    ))}
                </div>

                 {/* Center Line */}
                <div className="center-line-container">
                    <div className="center-line" />
                    <div className="center-circle" />
                </div>


                {/* Home Team Section */}
                <div className="team-section home-team">
                    {['G', 'D', 'M', 'F'].map(pos => (
                        <div key={`home-${pos}`} className="lineup-row">
                            {homeGrouped[pos]?.map(({ player }) => <PlayerCard key={player.id} player={player} teamColors={home.team.colors} />)}
                        </div>
                    ))}
                </div>
            </div>

             {/* Substitutes Section */}
            <div className="substitutes-section mt-4 grid grid-cols-2 gap-4">
                 <div>
                    <h3 className="text-center font-bold mb-2">احتياط {away.team.name}</h3>
                    <div className="space-y-2">
                        {away.substitutes.map(({player}) => <PlayerCard key={player.id} player={player} teamColors={away.team.colors} isSubstitute />)}
                    </div>
                </div>
                <div>
                    <h3 className="text-center font-bold mb-2">احتياط {home.team.name}</h3>
                    <div className="space-y-2">
                        {home.substitutes.map(({player}) => <PlayerCard key={player.id} player={player} teamColors={home.team.colors} isSubstitute />)}
                    </div>
                </div>
            </div>
            
             {/* Coaches Section */}
             <div className="coaches-section mt-4 grid grid-cols-2 gap-4">
                 <div className="text-center bg-card p-2 rounded-lg">
                    <p className="text-xs text-muted-foreground">مدرب {away.team.name}</p>
                    <p className="font-semibold">{away.coach.name}</p>
                 </div>
                 <div className="text-center bg-card p-2 rounded-lg">
                    <p className="text-xs text-muted-foreground">مدرب {home.team.name}</p>
                    <p className="font-semibold">{home.coach.name}</p>
                 </div>
             </div>
        </div>
    );
}

