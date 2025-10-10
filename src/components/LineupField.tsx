"use client";
import React from 'react';
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Pencil, ArrowUp, ArrowDown } from 'lucide-react';
import type { Player as PlayerType, Team, MatchEvent, PlayerWithStats, LineupData } from '@/lib/types';
import { PlayerCard } from '@/components/PlayerCard';


export function LineupField({
  lineup,
  events,
  onRename,
  isAdmin,
  getPlayerName,
  getCoachName
}: {
  lineup?: LineupData;
  events: MatchEvent[];
  onRename: (type: 'player' | 'coach', id: number, name: string) => void;
  isAdmin: boolean;
  getPlayerName: (id: number, name: string) => string;
  getCoachName: (id: number, name: string) => string;
}) {
  if (!lineup || !lineup.startXI?.length) {
    return <div className="text-center py-6 text-muted-foreground">لا توجد تشكيلة متاحة</div>;
  }

  const playersByRow = lineup.startXI.reduce((acc, p) => {
    if (p.player.grid) {
      const [row] = p.player.grid.split(':').map(Number);
      if (!acc[row]) acc[row] = [];
      acc[row].push(p);
    }
    return acc;
  }, {} as Record<number, PlayerWithStats[]>);

  const sortedRows = Object.keys(playersByRow)
    .sort((a, b) => parseInt(b) - parseInt(a))
    .map(rowKey => {
      const row = playersByRow[Number(rowKey)];
      row.sort((a, b) => {
        const gridA = a.player.grid ? a.player.grid.split(':')[1] : '0';
        const gridB = b.player.grid ? b.player.grid.split(':')[1] : '0';
        return parseInt(gridA) - parseInt(gridB);
      });
      return row;
    });

  const substitutions = events.filter(e => e.type === 'subst' && e.team.id === lineup.team.id);

  const getPlayerFromLineup = (playerId: number): PlayerWithStats | undefined => {
      return [...lineup.startXI, ...lineup.substitutes].find(p => p.player.id === playerId);
  }

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
                <PlayerCard
                  key={p.player.id}
                  player={p}
                  onRename={onRename}
                  isAdmin={isAdmin}
                  getPlayerName={getPlayerName}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* المدرب */}
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
                variant="ghost"
                size="icon"
                className="absolute -top-2 -right-2 h-6 w-6 z-10 text-white/80 hover:text-white bg-black/50 rounded-full"
                onClick={(e) => {
                  e.stopPropagation();
                  onRename('coach', lineup.coach.id, getCoachName(lineup.coach.id, lineup.coach.name));
                }}
              >
                <Pencil className="h-3 w-3" />
              </Button>
            )}
          </div>
          <span className="font-semibold">{getCoachName(lineup.coach.id, lineup.coach.name)}</span>
        </div>
      )}

      {/* التبديلات */}
      {substitutions.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <h4 className="text-center font-bold mb-3">التبديلات</h4>
          <div className="space-y-3">
            {substitutions.map((event, idx) => {
              const playerIn = getPlayerFromLineup(event.player.id);
              const playerInName = playerIn ? getPlayerName(playerIn.player.id, playerIn.player.name) : event.player.name;
              const playerOutName = event.assist?.id ? getPlayerName(event.assist.id, event.assist.name || '') : '';
              
              return (
                <div key={idx} className="flex items-center justify-between text-sm p-2 rounded-md bg-background/40 border">
                  
                  {/* اللاعب الخارج */}
                  <div className="flex items-center gap-2 text-red-500 w-2/5">
                    <ArrowDown className="h-4 w-4" />
                    <span className="font-medium truncate">{playerOutName}</span>
                  </div>

                  <span className="text-xs text-muted-foreground">{event.time.elapsed}'</span>

                  {/* اللاعب الداخل */}
                  {playerIn && (
                    <div className="flex items-center gap-2 text-green-500 justify-end w-2/5">
                        <div className="text-right">
                           <span className="font-medium block truncate">{playerInName}</span>
                           {playerIn.statistics?.[0]?.games?.rating && (
                               <span className="text-xs text-primary font-bold">
                                   {parseFloat(playerIn.statistics[0].games.rating).toFixed(1)}
                               </span>
                           )}
                        </div>
                        <Avatar className="h-8 w-8">
                            <AvatarImage src={playerIn.player.photo} />
                        </Avatar>
                        <ArrowUp className="h-4 w-4" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      

      {/* الاحتياط */}
      {lineup.substitutes?.length > 0 && (
        <div className="mt-4 border-t border-border pt-4">
          <h4 className="text-center font-bold mb-2">الاحتياط</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {lineup.substitutes.map((p) => {
              if (!p) return null;
              return (
                <div key={p.player.id} className="relative flex items-center gap-3 p-2 rounded-lg border bg-background/40">
                  <PlayerCard
                    player={p}
                    onRename={onRename}
                    isAdmin={isAdmin}
                    getPlayerName={getPlayerName}
                    isSubstitute={true}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}
