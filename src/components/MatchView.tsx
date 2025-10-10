"use client";
import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

interface EventItem {
  time: { elapsed: number; extra?: number | null };
  team: { id: number; name: string; logo?: string };
  player: { id: number; name: string };
  assist?: { id?: number; name?: string };
  type: "Goal" | "Card" | "Var";
  detail?: string;
  comments?: string | null;
}

interface MatchData {
  lineup?: LineupData;
  events?: EventItem[];
  stats?: any;
  details: {
    date: string;
    time: string;
    stadium?: string;
    predictions?: string;
    history?: string;
  };
}

interface MatchPageProps {
  match: MatchData;
  isAdmin: boolean;
  onRenamePlayer: (id: number, name: string) => void;
  getPlayerName: (id: number, defaultName: string) => string;
}

export const MatchPage = ({
  match,
  isAdmin,
  onRenamePlayer,
  getPlayerName,
}: MatchPageProps) => {
  const [activeTab, setActiveTab] = useState<
    "details" | "timeline" | "lineup" | "stats" | "ranking"
  >("details");
  const [timelineView, setTimelineView] = useState<"all" | "highlights">(
    "highlights"
  );

  // Helper لترتيب اللاعبين حسب خطوط اللعب
  const getRows = (lineup: LineupData) => {
    const goalkeeper = lineup.startXI.find((p) => p.player.pos === "G");
    const defenders = lineup.startXI.filter((p) => p.player.pos === "D");
    const midfielders = lineup.startXI.filter((p) => p.player.pos === "M");
    const attackers = lineup.startXI.filter((p) => p.player.pos === "F");
    const rows: PlayerWithStats[][] = [];
    if (attackers.length) rows.push(attackers); // الأعلى
    if (midfielders.length) rows.push(midfielders);
    if (defenders.length) rows.push(defenders);
    if (goalkeeper) rows.push([goalkeeper]); // الأسفل
    return rows;
  };

  // Component للاعب على الملعب
  const PlayerOnPitch = ({ player }: { player: PlayerWithStats }) => {
    const { player: p, statistics } = player;
    const rating = statistics?.[0]?.games?.rating
      ? parseFloat(statistics[0].games.rating).toFixed(1)
      : null;
    return (
      <div className="relative flex flex-col items-center text-white text-xs w-16 text-center">
        {isAdmin && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute -top-2 -right-2 h-6 w-6 z-20 text-white/70 hover:bg-black/50"
            onClick={() => onRenamePlayer(p.id, getPlayerName(p.id, p.name))}
          >
            <Pencil className="h-3 w-3" />
          </Button>
        )}
        <div className="relative w-12 h-12">
          <Avatar className="w-12 h-12 border-2 border-white/50 bg-black/30">
            <AvatarImage src={p.photo} alt={p.name} />
            <AvatarFallback>{p.name.charAt(0)}</AvatarFallback>
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
          {getPlayerName(p.id, p.name)}
        </span>
      </div>
    );
  };

  // Component Timeline للمجريات
  const Timeline = () => {
    if (!match.events || match.events.length === 0)
      return <div className="text-center py-4">المجريات غير متاحة</div>;

    const events = timelineView === "highlights"
      ? match.events.filter((e) => e.type === "Goal")
      : match.events;

    return (
      <div className="flex flex-row justify-center gap-4 overflow-x-auto py-4">
        <div className="relative w-8 flex flex-col justify-between">
          {Array.from({ length: 90 }, (_, i) => (
            <div
              key={i}
              className="h-[2px] bg-white/30 w-full my-[1px]"
              title={`${i + 1} دقيقة`}
            />
          ))}
        </div>
        <div className="flex-1 flex flex-col justify-end gap-2">
          {events.map((e, idx) => (
            <div
              key={idx}
              className={`flex justify-${
                e.team.id === 1 ? "start" : "end"
              } gap-2 items-center`}
            >
              <div
                className={`px-2 py-1 rounded text-white text-xs font-semibold bg-${
                  e.type === "Goal"
                    ? "green-600"
                    : e.type === "Card"
                    ? "yellow-500"
                    : "red-600"
                }`}
              >
                {e.player.name} {e.type === "Goal" ? "⚽" : e.type === "Card" ? (e.detail?.includes("Yellow") ? "🟨" : "🟥") : "VAR"}
              </div>
              <div className="text-white text-[10px]">{e.time.elapsed}'</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const Lineup = () => {
    if (!match.lineup || match.lineup.startXI.length === 0)
      return <div className="text-center py-4">التشكيلة غير متاحة</div>;
    const rows = getRows(match.lineup);

    return (
      <Card className="p-3 bg-card/80">
        <div className="relative w-full aspect-[2/3] max-h-[700px] bg-cover bg-center rounded-lg overflow-hidden border border-green-500/20"
             style={{ backgroundImage: `url('/football-pitch-vertical.svg')` }}>
          <div className="absolute inset-0 flex flex-col justify-around p-2">
            {rows.map((row, idx) => (
              <div key={idx} className="flex justify-around items-center w-full">
                {row.map((player) => (
                  <PlayerOnPitch key={player.player.id} player={player} />
                ))}
              </div>
            ))}
          </div>
        </div>
        {match.lineup.coach && (
          <div className="mt-4 pt-4 border-t border-border flex flex-col items-center gap-2">
            <h4 className="font-bold text-center">المدرب</h4>
            <Avatar className="h-16 w-16">
              <AvatarImage src={match.lineup.coach.photo} alt={match.lineup.coach.name} />
              <AvatarFallback>{match.lineup.coach.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <span className="font-semibold">{match.lineup.coach.name}</span>
          </div>
        )}
        {match.lineup.substitutes.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <h4 className="font-bold text-center mb-3">الاحتياط</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {match.lineup.substitutes.map((player) => (
                <PlayerOnPitch key={player.player.id} player={player} />
              ))}
            </div>
          </div>
        )}
      </Card>
    );
  };

  const Details = () => {
    const d = match.details;
    return (
      <Card className="p-3">
        <h3 className="font-bold mb-2">تفاصيل المباراة</h3>
        <p>التاريخ: {d.date}</p>
        <p>الساعة: {d.time}</p>
        {d.stadium && <p>الملعب: {d.stadium}</p>}
        {d.predictions && <p>التوقعات: {d.predictions}</p>}
        {d.history && <p>المواجهات السابقة: {d.history}</p>}
      </Card>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        {["details", "timeline", "lineup", "stats", "ranking"].map((tab) => (
          <Button
            key={tab}
            variant={activeTab === tab ? "default" : "ghost"}
            onClick={() => setActiveTab(tab as any)}
          >
            {tab === "details" ? "التفاصيل" :
             tab === "timeline" ? "المجريات" :
             tab === "lineup" ? "التشكيلة" :
             tab === "stats" ? "الإحصائيات" :
             "الترتيب"}
          </Button>
        ))}
      </div>

      {/* Content */}
      <div className="flex flex-col gap-4">
        {activeTab === "details" && <Details />}
        {activeTab === "timeline" && (
          <div>
            <div className="flex gap-2 mb-2">
              <Button
                variant={timelineView === "highlights" ? "default" : "outline"}
                onClick={() => setTimelineView("highlights")}
              >
                الأبرز
              </Button>
              <Button
                variant={timelineView === "all" ? "default" : "outline"}
                onClick={() => setTimelineView("all")}
              >
                عرض الكل
              </Button>
            </div>
            <Timeline />
          </div>
        )}
        {activeTab === "lineup" && <Lineup />}
        {activeTab === "stats" && match.stats && (
          <Card className="p-3">الإحصائيات هنا</Card>
        )}
        {activeTab === "ranking" && <Card className="p-3">الترتيب هنا</Card>}
      </div>
    </div>
  );
};
