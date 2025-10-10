"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { FootballIcon } from "./icons/FootballIcon";

export default function MatchTimeline({ events, fixture }) {
  const [showAll, setShowAll] = useState(false);

  if (!events || events.length === 0)
    return (
      <div className="text-center text-muted-foreground p-6">⚠️ لا توجد مجريات متاحة</div>
    );

  const filteredEvents = showAll
    ? events
    : events.filter((ev) => ev.type === "Goal" || ev.detail === 'Red Card');

  return (
    <div className="relative w-full max-w-[800px] mx-auto bg-gradient-to-b from-card to-background rounded-3xl shadow-lg border p-4 my-6">
      {/* 🔘 العنوان و الأزرار */}
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-primary text-lg font-bold">المجريات</h2>
        <div className="flex gap-2">
          <Button
            variant={!showAll ? "default" : "outline"}
            onClick={() => setShowAll(false)}
            className="px-3 py-1 text-sm rounded-full"
          >
            الأبرز
          </Button>
          <Button
            variant={showAll ? "default" : "outline"}
            onClick={() => setShowAll(true)}
            className="px-3 py-1 text-sm rounded-full"
          >
            عرض الكل
          </Button>
        </div>
      </div>

      {/* 🕒 العمود الزمني */}
      <div className="relative flex justify-center">
        <div className="absolute top-0 bottom-0 w-[2px] bg-border rounded-full"></div>

        <div className="flex flex-col-reverse w-full">
          {[...filteredEvents].sort((a, b) => b.time.elapsed - a.time.elapsed).map((ev, i) => {
            const isHomeTeam = ev.team.id === fixture.teams.home.id;
            const alignClass = isHomeTeam ? "justify-start" : "justify-end";
            const sideOffset = isHomeTeam ? "pr-8" : "pl-8";
            
            const iconMap: {[key:string]: React.ReactNode} = {
                "Goal": <FootballIcon className="w-4 h-4 text-green-400" />,
                "Yellow Card": <div className="w-3 h-4 bg-yellow-400 rounded-sm" />,
                "Red Card": <div className="w-3 h-4 bg-red-500 rounded-sm" />,
                "subst": <span className="text-blue-400 text-lg">🔁</span>,
            };

            return (
              <div
                key={i}
                className={`flex ${alignClass} items-center w-full py-2 relative`}
              >
                <div
                  className={`flex items-center gap-1 ${sideOffset} w-[45%] max-w-[260px] ${isHomeTeam ? 'flex-row-reverse' : ''}`}
                >
                  {/* شعار الفريق */}
                  <img
                    src={ev.team.logo}
                    alt={ev.team.name}
                    className="w-5 h-5 rounded-full"
                  />
                  {/* الحدث */}
                  <div className={`text-xs md:text-sm text-foreground p-2 rounded-lg bg-card shadow-md flex-1 ${isHomeTeam ? 'text-right' : 'text-left'}`}>
                    <div className="font-semibold flex items-center gap-2">
                        {iconMap[ev.detail] || iconMap[ev.type]}
                        <span>{ev.player?.name}</span>
                    </div>
                    {ev.assist?.name && (
                      <div className="text-xs text-muted-foreground mt-1">
                        (مساعدة: {ev.assist.name})
                      </div>
                    )}
                  </div>
                </div>

                {/* النقطة الزمنية */}
                <div className="absolute left-1/2 transform -translate-x-1/2 flex flex-col items-center">
                  <div className="w-3 h-3 bg-primary rounded-full shadow-md"></div>
                  <span className="text-[10px] text-muted-foreground mt-1">
                    {ev.time.elapsed}'
                  </span>
                </div>

              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}