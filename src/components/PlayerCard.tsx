"use client";
import Image from "next/image";
import type { PlayerWithStats } from '@/lib/types';


const PlayerCard = ({ player, isSubstitute = false, getPlayerName }: { player: PlayerWithStats, isSubstitute?: boolean, getPlayerName: (id: number, name: string) => string }) => {
  // صورة افتراضية للاعبين بدون صورة
  const fallbackImage = "https://media.api-sports.io/football/players/0.png";

  // التأكد من وجود بيانات اللعبة
  const gameStats = player?.statistics?.[0]?.games || {};

  // الرقم والتقييم
  const playerNumber = gameStats.number || player?.player?.number || "";
  const rating =
    gameStats.rating && !isNaN(parseFloat(gameStats.rating))
      ? parseFloat(gameStats.rating).toFixed(1)
      : null;

  // الصورة الصحيحة لكل لاعب
  const playerImage =
    player?.player?.photo && player.player.photo.includes("http")
      ? player.player.photo
      : fallbackImage;
      
  const displayName = getPlayerName(player.player.id, player.player.name);

  if(isSubstitute) {
    return (
       <div className="flex items-center gap-3">
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
                  parseFloat(rating) >= 7
                    ? "bg-green-600"
                    : parseFloat(rating) >= 6
                    ? "bg-yellow-600"
                    : "bg-red-600"
                }`}
              >
                {rating}
              </div>
            )}
          </div>
        <div>
          <span className="text-sm font-semibold">{displayName}</span>
          {playerNumber && <p className="text-xs text-muted-foreground">الرقم: {playerNumber}</p>}
        </div>
       </div>
    )
  }

  return (
    <div className="relative flex flex-col items-center">
      {/* صورة اللاعب */}
      <div className="relative w-12 h-12">
        <Image
          src={playerImage}
          alt={displayName || "Player"}
          width={48}
          height={48}
          className="rounded-full border-2 border-white/50"
        />

        {/* رقم اللاعب */}
        {playerNumber && (
          <div className="absolute -top-1 -left-1 bg-gray-800 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center border-2 border-background">
            {playerNumber}
          </div>
        )}

        {/* تقييم اللاعب */}
        {rating && (
          <div
            className={`absolute -top-1 -right-1 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center border-2 border-background ${
              parseFloat(rating) >= 7
                ? "bg-green-600"
                : parseFloat(rating) >= 6
                ? "bg-yellow-600"
                : "bg-red-600"
            }`}
          >
            {rating}
          </div>
        )}
      </div>

      {/* اسم اللاعب */}
      <span className="mt-1 text-[11px] font-semibold text-center truncate w-16 bg-black/50 px-1.5 py-0.5 rounded">
        {displayName || "غير معروف"}
      </span>
    </div>
  );
};

export { PlayerCard };
