
"use client";

import React from 'react';
import type { Player } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface PlayerCardProps {
    player: Player;
    teamColors: any;
    isSubstitute?: boolean;
}

export const PlayerCard = ({ player, teamColors, isSubstitute = false }: PlayerCardProps) => {

    const rating = player.rating ? parseFloat(player.rating) : 0;
    
    const getRatingColor = (r: number) => {
        if (r >= 8.5) return 'bg-blue-500';
        if (r >= 7.5) return 'bg-green-500';
        if (r >= 6.5) return 'bg-yellow-500';
        if (r > 0) return 'bg-red-500';
        return 'bg-muted';
    };
    
    const ratingColor = getRatingColor(rating);

    if (isSubstitute) {
        return (
            <div className="flex items-center gap-2 bg-card p-1.5 rounded-md text-xs">
                <Avatar className="h-6 w-6">
                    <AvatarImage src={player.photo} alt={player.name} />
                    <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <span className="font-semibold truncate flex-1">{player.name}</span>
                <span className="text-muted-foreground">{player.number}</span>
            </div>
        )
    }
    
    return (
        <div className="player-card-container">
             {rating > 0 && <div className={cn("player-rating", ratingColor)}>{player.rating}</div>}
            <div className="player-shirt" style={{ backgroundColor: teamColors?.player?.primary || '#ccc', color: teamColors?.player?.number || '#000' }}>
                 <Avatar className="w-full h-full">
                    <AvatarImage src={player.photo} alt={player.name} className="object-cover" />
                    <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="player-number">{player.number}</div>
            </div>
            <div className="player-name-plate">
                {player.name}
            </div>
        </div>
    );
};
