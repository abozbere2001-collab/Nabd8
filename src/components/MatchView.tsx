"use client";
import React, { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";

interface PlayerWithStats {
  player: { id: number; name: string; number?: number; photo?: string; pos?: string };
  statistics?: { games?: { rating?: string } }[];
}

interface LineupData {
  startXI: PlayerWithStats[];
  substitutes: PlayerWithStats[];
  coach?: { name: string; photo?: string };
}

interface EventData {
  time: { elapsed: number; extra?: number };
  team: { id: number; name: string; logo?: string };
  player: { id: number; name: string };
  type: string;
  detail?: string;
}

interface MatchDetails {
  lineup?: LineupData;
  events?: EventData[];
  statistics?: any;
  date?: string;
  time?: string;
  venue?: string;
  odds?: any;
  predictions?: any;
}

interface MatchProps {
  match: MatchDetails;
  homeTeamId?: number;
  onRenamePlayer: (id: number, name: string) => void;
  isAdmin: boolean;
  getPlayerName: (id: number, defaultName: string) => string;
}

const PlayerOnPitch = ({ player, onRename, isAdmin, getPlayerName }: { player: PlayerWithStats; onRename: (id: number, name: string) => void; isAdmin: boolean; getPlayerName: (id: number, defaultName: string) => string; }) => {
  const { player: p, statistics } = player;
  const rating = statistics?.[0]?.games?.rating ? parseFloat(statistics[0].games.rating).toFixed(1) : null;
  const displayName = getPlayerName(p.id, p.name);

  return (
    <div className="relative flex flex-col items-center w-16 text-center text-white text-xs">
      {isAdmin && <Button variant="ghost" size="icon" className="absolute -top-2 -right-2 h-6 w-6 z-20 text-white/70 hover:bg-black/50" onClick={() => onRename(p.id, displayName)}><Pencil className="h-3 w-3" /></Button>}
      <div className="relative w-12 h-12">
        <Avatar className="w-12 h-12 border-2 border-white/50 bg-black/30">
          <AvatarImage src={p.photo} alt={displayName} />
          <AvatarFallback>{displayName ? displayName.charAt(0) : "?"}</AvatarFallback>
        </Avatar>
        {p.number && <div className="absolute -top-1 -left-1 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center border-2 border-background bg-gray-800 z-10">{p.number}</div>}
        {rating && parseFloat(rating) > 0 && <div className="absolute -top-1 -right-1 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center border-2 border-background bg-blue-600 z-10">{rating}</div>}
      </div>
      <span className="mt-1 bg-black/50 px-1.5 py-0.5 rounded font-semibold truncate w-full text-[11px]">{displayName}</span>
    </div>
  );
};

const TimelineEvent = ({ event, isHome }: { event: EventData; isHome: boolean }) => {
  const color = event.type === "Goal" ? "bg-green-600" : event.type === "Card" ? event.detail?.includes("Red") ? "bg-red-600" : "bg-yellow-400" : "bg-gray-400";
  return (
    <div className={`flex items-center gap-1 w-32 px-1 py-0.5 rounded text-[10px] font-semibold text-white ${color} ${isHome ? "justify-start ml-1" : "justify-end mr-1"}`}>
      <span>{event.time.elapsed}'</span>
      <span>{event.player.name}</span>
    </div>
  );
};

export const MatchView = ({ match, homeTeamId, onRenamePlayer, isAdmin, getPlayerName }: MatchProps) => {
  const [activeTab, setActiveTab] = useState<"details"|"lineup"|"events"|"stats">("details");
  const lineup = match.lineup;
  const events = match.events || [];
  
  const homeEvents = events.filter((e) => e.team.id === homeTeamId);
  const awayEvents = events.filter((e) => e.team.id !== homeTeamId);

  // ترتيب اللاعبين بشكل عمودي صحيح
  const goalkeeper = lineup?.startXI.find(p => p.player.pos === "G");
  const defenders = lineup?.startXI.filter(p => p.player.pos === "D") || [];
  const midfielders = lineup?.startXI.filter(p => p.player.pos === "M") || [];
  const attackers = lineup?.startXI.filter(p => p.player.pos === "F") || [];
  const rows: PlayerWithStats[][] = [];
  if (goalkeeper) rows.push([goalkeeper]);
  if (defenders.length) rows.push(defenders);
  if (midfielders.length) rows.push(midfielders);
  if (attackers.length) rows.push(attackers);

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* شريط التبويبات */}
      <div className="flex gap-2 justify-center">
        {["details", "lineup", "events", "stats"].map(tab => (
          <Button key={tab} variant={activeTab===tab?"default":"outline"} onClick={()=>setActiveTab(tab as any)}>{tab==="details"?"التفاصيل":tab==="lineup"?"التشكيلة":tab==="events"?"المجريات":"الإحصائيات"}</Button>
        ))}
      </div>

      {/* التفاصيل */}
      {activeTab==="details" && (
        <Card className="p-3">
          <h4 className="font-bold mb-2">التفاصيل</h4>
          <p>التاريخ: {match.date}</p>
          <p>الساعة: {match.time}</p>
          <p>الملعب: {match.venue}</p>
          {match.odds && <pre>{JSON.stringify(match.odds,null,2)}</pre>}
          {match.predictions && <pre>{JSON.stringify(match.predictions,null,2)}</pre>}
        </Card>
      )}

      {/* التشكيلة */}
      {activeTab==="lineup" && lineup && (
        <Card className="p-3 bg-card/80">
          <div className="relative w-full aspect-[2/3] max-h-[700px] bg-cover bg-center rounded-lg overflow-hidden border border-green-500/20" style={{backgroundImage:`url('/football-pitch-vertical.svg')`}}>
            <div className="absolute inset-0 flex flex-col justify-around p-2">
              {rows.map((row, i)=>(<div key={i} className="flex justify-around items-center w-full">{row.map(player=><PlayerOnPitch key={player.player.id} player={player} onRename={onRenamePlayer} isAdmin={isAdmin} getPlayerName={getPlayerName} />)}</div>))}
            </div>
          </div>

          {/* المدرب */}
          {lineup.coach && <div className="mt-4 pt-4 border-t border-border flex flex-col items-center">
            <Avatar className="h-16 w-16"><AvatarImage src={lineup.coach.photo} alt={lineup.coach.name} /><AvatarFallback>{lineup.coach.name?.charAt(0)}</AvatarFallback></Avatar>
            <span className="font-semibold mt-1">{lineup.coach.name}</span>
          </div>}

          {/* البدلاء */}
          {lineup.substitutes?.length>0 && <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {lineup.substitutes.map(player=><div key={player.player.id} className="relative flex items-center gap-2 p-2 rounded-lg bg-background/50 border">
              {isAdmin && <Button variant="ghost" size="icon" className="absolute top-0 right-0 h-6 w-6 z-10" onClick={()=>onRenamePlayer(player.player.id,getPlayerName(player.player.id,player.player.name))}><Pencil className="h-3 w-3" /></Button>}
              <Avatar className="h-8 w-8"><AvatarImage src={player.player.photo} alt={player.player.name}/><AvatarFallback>{player.player.name?.charAt(0)}</AvatarFallback></Avatar>
              <span className="text-xs font-medium truncate">{getPlayerName(player.player.id,player.player.name)}</span>
              {player.statistics?.[0]?.games?.rating && <span className="ml-1 text-[10px] font-bold text-blue-600">{parseFloat(player.statistics[0].games.rating).toFixed(1)}</span>}
              {player.player.number && <span className="ml-1 text-[10px] font-bold text-white bg-gray-700 px-1 rounded">{player.player.number}</span>}
            </div>)}
          </div>}
        </Card>
      )}

      {/* مجريات المباراة */}
      {activeTab==="events" && events.length>0 && (
        <Card className="p-3">
          <h4 className="font-bold mb-2 text-center">المجريات</h4>
          <div className="relative flex items-end justify-center h-[400px] overflow-y-auto border border-gray-300 rounded p-2 gap-4">
            <div className="flex flex-col-reverse gap-2 w-32">{homeEvents.map((e,i)=><TimelineEvent key={i} event={e} isHome={true}/>)}</div>
            <div className="flex flex-col-reverse gap-2 w-32">{awayEvents.map((e,i)=><TimelineEvent key={i} event={e} isHome={false}/>)}</div>
            <div className="absolute left-1/2 transform -translate-x-1/2 h-full w-[2px] bg-white"></div>
          </div>
        </Card>
      )}

      {/* الاحصائيات */}
      {activeTab==="stats" && match.statistics && (
        <Card className="p-3">
          <h4 className="font-bold mb-2 text-center">الإحصائيات</h4>
          <pre>{JSON.stringify(match.statistics,null,2)}</pre>
        </Card>
      )}
    </div>
  );
};
