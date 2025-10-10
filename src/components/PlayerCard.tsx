import Image from "next/image";

const PlayerCard = ({ player, isSubstitute = false }: {player: any, isSubstitute?: boolean}) => {
  // صورة افتراضية للاعبين بدون صورة
  const fallbackImage = "https://media.api-sports.io/football/players/1.png";

  // جلب التقييم بشكل آمن
  const rating =
    player?.statistics?.[0]?.games?.rating &&
    !isNaN(parseFloat(player.statistics[0].games.rating))
      ? parseFloat(player.statistics[0].games.rating).toFixed(1)
      : null;

  const playerImage =
    player?.player?.photo && player.player.photo.includes("http")
      ? player.player.photo
      : fallbackImage;
      
  const playerNumber = player?.statistics?.[0]?.games?.number || player?.player?.number;


  if(isSubstitute) {
    return (
       <div className="flex items-center gap-3">
         <Image
          src={playerImage}
          alt={player?.player?.name || "Player"}
          width={40}
          height={40}
          className={`rounded-full border-2 ${
            isSubstitute ? "border-gray-400" : "border-green-400"
          }`}
        />
        <div>
          <span className="text-sm font-semibold">{player?.player?.name}</span>
          {playerNumber && <p className="text-xs text-muted-foreground">الرقم: {playerNumber}</p>}
          {rating && (
            <p className="text-xs font-bold text-white">
              تقييم: {rating}
            </p>
          )}
        </div>
       </div>
    )
  }

  return (
    <div className="relative flex flex-col items-center">
      <div className="relative">
        <Image
          src={playerImage}
          alt={player?.player?.name || "Player"}
          width={50}
          height={50}
          className={`rounded-full border-2 ${
            isSubstitute ? "border-gray-400" : "border-green-400"
          }`}
        />

        {rating && (
          <div className="absolute -top-1 -right-1 bg-yellow-500 text-white text-xs font-bold rounded-full px-2 py-0.5 shadow-md">
            {rating}
          </div>
        )}
      </div>

      <p className="text-[10px] mt-1 text-center font-medium">
        {player?.player?.name || "غير معروف"}
      </p>
    </div>
  );
};

export { PlayerCard };
