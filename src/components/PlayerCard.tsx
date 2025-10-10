"use client";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Pencil } from 'lucide-react';
import type { PlayerWithStats } from '@/lib/types';


export function PlayerCard({ 
    player, 
    isSubstitute = false, 
    getPlayerName,
    onRename,
    isAdmin
}: { 
    player: PlayerWithStats, 
    isSubstitute?: boolean, 
    getPlayerName: (id: number, name: string) => string,
    onRename: (type: 'player', id: number, name: string) => void,
    isAdmin: boolean
}) {
  const fallbackImage = "https://media.api-sports.io/football/players/0.png";
  const gameStats = player?.statistics?.[0]?.games || {};
  const playerNumber = gameStats.number || player?.player?.number || "";
  const rating = gameStats.rating && !isNaN(parseFloat(gameStats.rating)) ? parseFloat(gameStats.rating).toFixed(1) : null;
  const playerImage = player?.player?.photo && player.player.photo.includes("http") ? player.player.photo : fallbackImage;
  const displayName = getPlayerName(player.player.id, player.player.name);

  if(isSubstitute) {
    return (
       <div className="flex items-center gap-3 w-full">
          <div className="relative w-10 h-10">
            <Image
              src={playerImage}
              alt={displayName || "Player"}
              width={40}
              height={40}
              className="rounded-full border-2 border-gray-400"
            />
             {rating && (
              <div
                className={`absolute -top-1 -right-1 text-white text-[9px] font-bold rounded-full h-4 w-4 flex items-center justify-center border border-background ${
                  parseFloat(rating) >= 7.5 ? "bg-blue-600" : parseFloat(rating) >= 7 ? "bg-green-600" : parseFloat(rating) >= 6 ? "bg-yellow-600" : "bg-red-600"
                }`}
              >
                {rating}
              </div>
            )}
          </div>
        <div className="flex-1">
          <span className="text-sm font-semibold">{displayName}</span>
          <div className="flex items-center gap-2">
            {playerNumber && <p className="text-xs text-muted-foreground">الرقم: {playerNumber}</p>}
          </div>
        </div>
        {isAdmin && (
             <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onRename('player', player.player.id, displayName)}>
                <Pencil className="h-3 w-3 text-muted-foreground" />
             </Button>
        )}
       </div>
    )
  }

  return (
    <div className="relative flex flex-col items-center">
      <div className="relative w-12 h-12">
        <Image
          src={playerImage}
          alt={displayName || "Player"}
          width={48}
          height={48}
          className="rounded-full border-2 border-white/50"
        />
        {playerNumber && (
          <div className="absolute -top-1 -left-1 bg-gray-800 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center border-2 border-background">
            {playerNumber}
          </div>
        )}
        {rating && (
          <div
            className={`absolute -top-1 -right-1 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center border-2 border-background ${
               parseFloat(rating) >= 7.5 ? "bg-blue-600" : parseFloat(rating) >= 7 ? "bg-green-600" : parseFloat(rating) >= 6 ? "bg-yellow-600" : "bg-red-600"
            }`}
          >
            {rating}
          </div>
        )}
        {isAdmin && (
             <Button variant="ghost" size="icon" className="absolute -bottom-1 -right-1 h-5 w-5 bg-black/50" onClick={() => onRename('player', player.player.id, displayName)}>
                <Pencil className="h-3 w-3 text-white/80" />
             </Button>
        )}
      </div>
      <span className="mt-1 text-[11px] font-semibold text-center truncate w-16 bg-black/50 px-1.5 py-0.5 rounded">
        {displayName || "غير معروف"}
      </span>
    </div>
  );
};
