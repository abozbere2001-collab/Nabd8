"use client";
import React from 'react';
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Pencil, ArrowDown, ArrowUp } from 'lucide-react';
import type { Player as PlayerType, Team, MatchEvent } from '@/lib/types';

interface PlayerWithStats {
  player: PlayerType & { pos?: string; grid?: string; number?: number; };
  statistics: {
      games: {
          minutes: number;
          number: number;
          position: string;
          rating: string;
          captain: boolean;
          substitute: boolean;
      };
      // Add other stats as needed
  }[];
}

interface LineupData {
  team: Team;
  coach: any;
  formation: string;
  startXI: PlayerWithStats[];
  substitutes: PlayerWithStats[];
}

const PlayerOnPitch = ({ player, onRename, isAdmin, getPlayerName }: { player: PlayerWithStats; onRename: (type: 'player', id: number, name: string) => void; isAdmin: boolean; getPlayerName: (id: number, name: string) => string; }) => {
  const { player: p, statistics } = player;
  const displayName = getPlayerName(p.id, p.name);
  const rating = statistics?.[0]?.games?.rating ? parseFloat(statistics[0].games.rating).toFixed(1) : null;
  const playerNumber = statistics?.[0]?.games?.number || p.number;

  return (
    <div className="relative flex flex-col items-center text-white text-xs w-16 text-center">
       {isAdmin && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute -top-2 -right-2 h-6 w-6 z-20 text-white/70 hover:bg-black/50"
          onClick={(e) => { e.stopPropagation(); onRename('player', p.id, displayName); }}
        >
          <Pencil className="h-3 w-3" />
        </Button>
      )}
      <div className="relative w-12 h-12">
        <Avatar className="w-12 h-12 border-2 border-white/50 bg-black/30">
          <AvatarImage src={p.photo} alt={displayName} />
          <AvatarFallback>{displayName ? displayName.charAt(0) : "?"}</AvatarFallback>
        </Avatar>
        {playerNumber && (
          <div className="absolute -top-1 -left-1 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center border-2 border-background bg-gray-800 z-10">
            {playerNumber}
          </div>
        )}
        {rating && parseFloat(rating) > 0 && (
          <div className="absolute -top-1 -right-1 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center border-2 border-background bg-blue-600 z-10">
            {rating}
          </div>
        )}
      </div>
      <span className="mt-1 bg-black/50 px-1.5 py-0.5 rounded font-semibold truncate w-full text-[11px]">
        {displayName}
      </span>
    </div>
  );
};


export function LineupField({ lineup, events, onRename, isAdmin, getPlayerName, getCoachName }: { lineup?: LineupData; events: MatchEvent[]; onRename: (type: 'player' | 'coach', id: number, name: string) => void; isAdmin: boolean; getPlayerName: (id: number, name: string) => string; getCoachName: (id: number, name: string) => string; }) {
  if (!lineup || !lineup.startXI || lineup.startXI.length === 0) {
    return <div className="text-center py-6 text-muted-foreground">لا توجد تشكيلة متاحة</div>;
  }

  const playersByRow = lineup.startXI.reduce((acc, p) => {
    if (p.player.grid) {
      const row = p.player.grid.split(':')[0];
      if (!acc[row]) {
        acc[row] = [];
      }
      acc[row].push(p);
    }
    return acc;
  }, {} as Record<string, PlayerWithStats[]>);

  const sortedRows = Object.keys(playersByRow)
    .sort((a, b) => parseInt(a, 10) - parseInt(b, 10)) 
    .map(rowKey => {
        const row = playersByRow[rowKey];
        row.sort((a, b) => parseInt(a.player.grid!.split(':')[1]) - parseInt(b.player.grid!.split(':')[1]));
        return row;
    })
    .reverse();


  const substitutions = events.filter(e => e.type === 'subst' && e.team.id === lineup.team.id);

  return (
    <Card className="p-3 bg-card/80">
      <div
        className="relative w-full aspect-[2/3] bg-cover bg-center rounded-lg overflow-hidden border border-green-500/30"
        style={{ backgroundImage: "url('/football-pitch-vertical.svg')" }}
      >
        <div className="absolute inset-0 flex flex-col justify-around p-3">
          {sortedRows.map((row, i) => (
            <div key={i} className="flex justify-around items-center">
              {row.map((p) => (
                <PlayerOnPitch key={p.player.id} player={p} onRename={onRename} isAdmin={isAdmin} getPlayerName={getPlayerName} />
              ))}
            </div>
          ))}
        </div>
      </div>

      {lineup.coach && (
         <div className="mt-4 pt-4 border-t border-border flex flex-col items-center gap-2">
            <h4 className="text-center font-bold mb-2">المدرب</h4>
            <div className="relative">
                <Avatar className="h-16 w-16">
                    <AvatarImage src={lineup.coach.photo} />
                    <AvatarFallback>{lineup.coach.name?.charAt(0) || 'C'}</AvatarFallback>
                </Avatar>
                 {isAdmin && (
                    <Button
                    variant="ghost" size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6 z-10 text-white/80 hover:text-white bg-black/50 rounded-full"
                    onClick={(e) => { e.stopPropagation(); onRename('coach', lineup.coach.id, getCoachName(lineup.coach.id, lineup.coach.name)); }}
                    >
                    <Pencil className="h-3 w-3" />
                    </Button>
                )}
            </div>
            <span className="font-semibold">{getCoachName(lineup.coach.id, lineup.coach.name)}</span>
        </div>
      )}

      {substitutions.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <h4 className="text-center font-bold mb-3">التبديلات</h4>
          <div className="space-y-3">
            {substitutions.map((event, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm p-2 rounded-md bg-background/40 border">
                 <div className='flex items-center gap-2 text-green-500'>
                    <ArrowUp className="h-4 w-4" />
                    <span className="font-medium">{getPlayerName(event.player.id, event.player.name)}</span>
                 </div>
                 <span className="text-xs text-muted-foreground">{event.time.elapsed}'</span>
                 <div className='flex items-center gap-2 text-red-500'>
                    <span className="font-medium">{getPlayerName(event.assist.id!, event.assist.name!)}</span>
                    <ArrowDown className="h-4 w-4" />
                 </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {lineup.substitutes?.length > 0 && (
        <div className="mt-4 border-t border-border pt-4">
          <h4 className="text-center font-bold mb-2">الاحتياط</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {lineup.substitutes.map((p) => (
              <div key={p.player.id} className="relative flex items-center gap-3 p-2 rounded-lg border bg-background/40">
                   {isAdmin && (
                    <Button
                        variant="ghost" size="icon"
                        className="absolute top-1 right-1 h-7 w-7 z-10"
                        onClick={(e) => { e.stopPropagation(); onRename('player', p.player.id, getPlayerName(p.player.id, p.player.name)); }}
                    >
                        <Pencil className="h-4 w-4" />
                    </Button>
                    )}
                  <Avatar className="h-10 w-10">
                      <AvatarImage src={p.player.photo} />
                      <AvatarFallback>{p.player.name?.charAt(0) || '?'}</AvatarFallback>
                  </Avatar>
                  <div>
                    <span className="text-sm font-semibold">{getPlayerName(p.player.id, p.player.name)}</span>
                     {p.player.number && <p className="text-xs text-muted-foreground">الرقم: {p.player.number}</p>}
                  </div>

              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
