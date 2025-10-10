"use client";
import React from 'react';
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Pencil } from 'lucide-react';
import type { Player as PlayerType, Team } from '@/lib/types';

interface PlayerWithStats {
  player: PlayerType & { pos?: string };
  statistics?: any[];
}
interface LineupData {
  team: Team;
  coach: any;
  formation: string;
  startXI: PlayerWithStats[];
  substitutes: PlayerWithStats[];
}

const PlayerOnPitch = ({ player, onRename, isAdmin, getPlayerName }: { player: PlayerWithStats; onRename: (type: 'player', id: number, name: string) => void; isAdmin: boolean; getPlayerName: (id: number, name: string) => string; }) => {
  const displayName = getPlayerName(player.player.id, player.player.name);
  return (
    <div className="relative flex flex-col items-center text-white text-xs w-16 text-center">
      {isAdmin && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute -top-2 -right-2 h-6 w-6 z-10 text-white/80 hover:text-white"
          onClick={(e) => { e.stopPropagation(); onRename('player', player.player.id, displayName); }}
        >
          <Pencil className="h-3 w-3" />
        </Button>
      )}
      <Avatar className="w-12 h-12 border-2 border-white/40 bg-black/30">
        <AvatarImage src={player.player.photo || "/images/player-placeholder.png"} alt={displayName} />
        <AvatarFallback>{displayName?.charAt(0) || '?'}</AvatarFallback>
      </Avatar>
      <span className="mt-1 bg-black/50 px-1 rounded text-[10px] truncate w-full">{displayName}</span>
    </div>
  );
};

export function LineupField({ lineup, onRename, isAdmin, getPlayerName }: { lineup?: LineupData; onRename: (type: 'player' | 'coach', id: number, name: string) => void; isAdmin: boolean; getPlayerName: (id: number, name: string) => string; }) {
  if (!lineup || !lineup.startXI || lineup.startXI.length === 0) {
    return <div className="text-center py-6 text-muted-foreground">لا توجد تشكيلة متاحة</div>;
  }

  const GK = lineup.startXI.filter((p: any) => p.player.pos === 'G');
  const DEF = lineup.startXI.filter((p: any) => p.player.pos === 'D');
  const MID = lineup.startXI.filter((p: any) => p.player.pos === 'M');
  const FWD = lineup.startXI.filter((p: any) => p.player.pos === 'F');

  // الترتيب الصحيح: الهجوم، الوسط، الدفاع، الحارس (ليظهر الحارس بالأسفل)
  const rows = [FWD, MID, DEF, GK].filter(r => r.length > 0);

  return (
    <Card className="p-3 bg-card/80">
      <div
        className="relative w-full aspect-[2/3] bg-cover bg-center rounded-lg overflow-hidden border border-green-500/30"
        style={{ backgroundImage: "url('/football-pitch-vertical.svg')" }}
      >
        <div className="absolute inset-0 flex flex-col justify-around p-3">
          {rows.map((row, i) => (
            <div key={i} className="flex justify-around items-center">
              {row.map((p: any) => (
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
                    onClick={(e) => { e.stopPropagation(); onRename('coach', lineup.coach.id, lineup.coach.name); }}
                    >
                    <Pencil className="h-3 w-3" />
                    </Button>
                )}
            </div>
            <span className="font-semibold">{lineup.coach.name}</span>
        </div>
      )}

      {lineup.substitutes?.length > 0 && (
        <div className="mt-4 border-t border-border pt-4">
          <h4 className="text-center font-bold mb-2">الاحتياط</h4>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {lineup.substitutes.map((p: any) => (
              <div key={p.player.id} className="flex items-center gap-2 p-2 bg-background/40 rounded border">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={p.player.photo || "/images/player-placeholder.png"} />
                  <AvatarFallback>{p.player.name?.charAt(0) || '?'}</AvatarFallback>
                </Avatar>
                <span className="text-xs truncate">{getPlayerName(p.player.id, p.player.name)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
