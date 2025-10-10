"use client";
import React from 'react';
import type { Player } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

interface PlayerStatsProps {
    players: Player[];
    title: string;
}

export function PlayerStats({ players, title }: PlayerStatsProps) {
    if (!players || players.length === 0) {
        return null;
    }
    
    // Sort players by position: Goalkeepers, Defenders, Midfielders, Attackers
    const positionOrder = ['Goalkeeper', 'Defender', 'Midfielder', 'Attacker'];
    const sortedPlayers = [...players].sort((a, b) => {
        const posA = a.position || 'Unknown';
        const posB = b.position || 'Unknown';
        return positionOrder.indexOf(posA) - positionOrder.indexOf(posB);
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {sortedPlayers.map(player => (
                        <div key={player.id} className="flex items-center gap-3 p-2 bg-card-foreground/5 rounded-lg border">
                            <Avatar className="h-10 w-10">
                                <AvatarImage src={player.photo} alt={player.name} />
                                <AvatarFallback>{player.name?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                                <p className="font-bold text-sm">{player.name}</p>
                                <p className="text-xs text-muted-foreground">{player.position}</p>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                                {/* Placeholder for stats */}
                                {/* <p>G: 5</p>
                                <p>A: 2</p> */}
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
