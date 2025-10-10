
"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { FootballIcon } from "./icons/FootballIcon";


export default function MatchTimeline({ events, fixture }) {
  const [showAll, setShowAll] = useState(false);

  if (!events || events.length === 0)
    return (
      <div className="text-center text-gray-400 p-6">
        ⚠️ لا توجد مجريات متاحة
      </div>
    );

    const filteredEvents = showAll
    ? events
    : events.filter((ev) => ev.type === "Goal");

  // ترتيب الأحداث من الأسفل للأعلى (الزمن الحقيقي)
  const orderedEvents = [...filteredEvents].sort(
    (a, b) => a.time.elapsed - b.time.elapsed
  );

  return (
    <div className="relative w-full max-w-[650px] mx-auto bg-gradient-to-b from-green-950 via-green-900 to-green-950 rounded-3xl shadow-lg border border-green-800 p-4 my-6">
      {/* العنوان و الأزرار */}
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-green-300 text-lg font-bold">المجريات</h2>
        <div className="flex gap-2">
          <Button
            variant={!showAll ? "default" : "outline"}
            onClick={() => setShowAll(false)}
            className="bg-green-700 text-white hover:bg-green-600 px-3 py-1 text-sm rounded-full"
          >
            الأبرز
          </Button>
          <Button
            variant={showAll ? "default" : "outline"}
            onClick={() => setShowAll(true)}
            className="bg-blue-700 text-white hover:bg-blue-600 px-3 py-1 text-sm rounded-full"
          >
            عرض الكل
          </Button>
        </div>
      </div>

      {/* 🕒 العمود الزمني */}
      <div className="relative flex justify-center">
        {/* العمود الأبيض */}
        <div className="absolute top-0 bottom-0 w-[2px] bg-white rounded-full"></div>

        {/* الأحداث */}
        <div className="flex flex-col w-full">
          {orderedEvents.map((ev, i) => {
            const isHomeTeam = ev.team.id === fixture.teams.home.id; // ✅ المضيف يسار، الضيف يمين
            const alignClass = isHomeTeam ? "justify-start" : "justify-end";
            const sideOffset = isHomeTeam ? "pr-10" : "pl-10";
            const bgColor =
              ev.type === "Goal"
                ? "bg-green-700/70"
                : ev.type === "Card"
                ? "bg-yellow-600/70"
                : ev.type === "subst"
                ? "bg-blue-600/50"
                : "bg-gray-700/30";

            return (
              <div
                key={i}
                className={`flex ${alignClass} items-center w-full py-2 relative`}
              >
                <div
                  className={`flex items-center gap-1 ${sideOffset} w-[40%] max-w-[230px]`}
                >
                  {isHomeTeam && (
                    <>
                      <img
                        src={ev.team.logo}
                        alt={ev.team.name}
                        className="w-5 h-5 rounded-full"
                      />
                      <div
                        className={`text-xs md:text-sm text-white p-2 rounded-lg ${bgColor} shadow-md`}
                      >
                        <span className="font-semibold">{ev.player?.name}</span>
                        {ev.type === "Goal" && (
                           <FootballIcon className="w-4 h-4 inline-block ml-1" />
                        )}
                        {ev.assist?.name && (
                          <span className="text-xs text-gray-300 ml-1">
                            (مساعدة: {ev.assist.name})
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* ✅ النقطة الزمنية البيضاء */}
                <div className="absolute left-1/2 transform -translate-x-1/2 flex flex-col items-center">
                  <div className="w-3 h-3 bg-white rounded-full shadow-md"></div>
                  <span className="text-[10px] text-white mt-1">
                    {ev.time.elapsed}'
                    <br />
                    {ev.time?.timestamp
                      ? new Date(ev.time.timestamp * 1000).toLocaleTimeString(
                          "ar-IQ",
                          { hour: "2-digit", minute: "2-digit" }
                        )
                      : ""}
                  </span>
                </div>

                <div
                  className={`flex items-center gap-1 ${sideOffset} w-[40%] max-w-[230px]`}
                >
                  {!isHomeTeam && (
                    <>
                      <div
                        className={`text-xs md:text-sm text-white p-2 rounded-lg ${bgColor} shadow-md`}
                      >
                        <span className="font-semibold">{ev.player?.name}</span>
                         {ev.type === "Goal" && (
                           <FootballIcon className="w-4 h-4 inline-block ml-1" />
                        )}
                        {ev.assist?.name && (
                          <span className="text-xs text-gray-300 ml-1">
                            (مساعدة: {ev.assist.name})
                          </span>
                        )}
                      </div>
                      <img
                        src={ev.team.logo}
                        alt={ev.team.name}
                        className="w-5 h-5 rounded-full"
                      />
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
    