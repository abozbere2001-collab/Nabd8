"use client";
import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";

interface PlayerWithStats {
  player: {
    id: number;
    name: string;
    number?: number;
    photo?: string;
    pos?: string;
  };
  statistics?: { games?: { rating?: string } }[];
}

interface LineupData {
  startXI: PlayerWithStats[];
  substitutes: PlayerWithStats[];
  coach?: { name: string; photo?: string };
}

interface LineupFieldProps {
  lineup: LineupData;
  onRename: (id: number, name: string) => void;
  isAdmin: boolean;
  getPlayerName: (id: number, defaultName: string) => string;
}

const PlayerOnPitch = ({
  player,
  onRename,
  isAdmin,
  getPlayerName,
}: {
  player: PlayerWithStats;
  onRename: (id: number, name: string) => void;
  isAdmin: boolean;
  getPlayerName: (id: number, defaultName: string) => string;
}) => {
  const { player: p, statistics } = player;
  const rating = statistics?.[0]?.games?.rating
    ? parseFloat(statistics[0].games.rating).toFixed(1)
    : null;
  const displayName = getPlayerName(p.id, p.name);

  return (
    <div className="relative flex flex-col items-center text-white text-xs w-16 text-center">
      {isAdmin && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute -top-2 -right-2 h-6 w-6 z-20 text-white/70 hover:bg-black/50"
          onClick={() => onRename(p.id, displayName)}
        >
          <Pencil className="h-3 w-3" />
        </Button>
      )}
      <div className="relative w-12 h-12">
        <Avatar className="w-12 h-12 border-2 border-white/50 bg-black/30">
          <AvatarImage src={p.photo} alt={displayName} />
          <AvatarFallback>{displayName ? displayName.charAt(0) : "?"}</AvatarFallback>
        </Avatar>
        {p.number && (
          <div className="absolute -top-1 -left-1 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center border-2 border-background bg-gray-800 z-10">
            {p.number}
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

export const LineupField = ({
  lineup,
  onRename,
  isAdmin,
  getPlayerName,
}: LineupFieldProps) => {
  if (!lineup || lineup.startXI.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-center text-muted-foreground py-6 bg-card rounded-lg">
        التشكيلة غير متاحة
      </div>
    );
  }

  const goalkeeper = lineup.startXI.find((p) => p.player.pos === "G");
  const defenders = lineup.startXI.filter((p) => p.player.pos === "D");
  const midfielders = lineup.startXI.filter((p) => p.player.pos === "M");
  const attackers = lineup.startXI.filter((p) => p.player.pos === "F");

  // ترتيب طبيعي من الأسفل للأعلى: حارس -> دفاع -> وسط -> هجوم
  const rows: PlayerWithStats[][] = [];
  if (goalkeeper) rows.push([goalkeeper]);
  if (defenders.length > 0) rows.push(defenders);
  if (midfielders.length > 0) rows.push(midfielders);
  if (attackers.length > 0) rows.push(attackers);

  return (
    <Card className="p-3 bg-card/80">
      <div
        className="relative w-full aspect-[2/3] max-h-[700px] bg-cover bg-center bg-no-repeat rounded-lg overflow-hidden border border-green-500/20"
        style={{ backgroundImage: `url('/football-pitch-vertical.svg')` }}
      >
        <div className="absolute inset-0 flex flex-col justify-around p-2">
          {rows.map((row, rowIndex) => (
            <div key={rowIndex} className="flex justify-around items-center w-full">
              {row.map((player) => (
                <PlayerOnPitch
                  key={player.player.id}
                  player={player}
                  onRename={onRename}
                  isAdmin={isAdmin}
                  getPlayerName={getPlayerName}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {lineup.coach && (
        <div className="mt-4 pt-4 border-t border-border">
          <h4 className="font-bold text-center mb-2">المدرب</h4>
          <div className="flex flex-col items-center gap-2">
            <Avatar className="h-16 w-16">
              <AvatarImage src={lineup.coach.photo} alt={lineup.coach.name} />
              <AvatarFallback>{lineup.coach.name ? lineup.coach.name.charAt(0) : "C"}</AvatarFallback>
            </Avatar>
            <span className="font-semibold">{lineup.coach.name}</span>
          </div>
        </div>
      )}

      {lineup.substitutes && lineup.substitutes.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <h4 className="font-bold text-center mb-3">الاحتياط</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {lineup.substitutes.map((player) => (
              <div
                key={player.player.id}
                className="relative flex flex-col items-center gap-1 p-2 rounded-lg bg-background/50 border"
              >
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-0 right-0 h-6 w-6 z-10"
                    onClick={() =>
                      onRename(player.player.id, getPlayerName(player.player.id, player.player.name))
                    }
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                )}
                <Avatar className="h-10 w-10">
                  <AvatarImage src={player.player.photo} alt={player.player.name} />
                  <AvatarFallback>{player.player.name ? player.player.name.charAt(0) : "?"}</AvatarFallback>
                </Avatar>
                <span className="text-xs font-medium truncate">
                  {getPlayerName(player.player.id, player.player.name)}
                </span>
                {player.statistics?.[0]?.games?.rating && (
                  <span className="mt-0.5 text-[10px] font-bold text-blue-600">
                    {parseFloat(player.statistics[0].games.rating).toFixed(1)}
                  </span>
                )}
                {player.player.number && (
                  <span className="mt-0.5 text-[10px] font-bold text-white bg-gray-700 px-1 rounded">
                    {player.player.number}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};
