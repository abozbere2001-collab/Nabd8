
"use client";
import { useState } from "react";
import type { MatchEvent, Fixture } from '@/lib/types';

interface MatchTimelineProps {
    events: MatchEvent[];
    fixture: Fixture;
}


export default function MatchTimeline({ events, fixture }: MatchTimelineProps) {
  const [showGoalsOnly, setShowGoalsOnly] = useState(false);

  // ترتيب الأحداث من الدقيقة 1 (أسفل) إلى 90 (أعلى)
  const sorted = [...events].sort((a, b) => a.time.elapsed - b.time.elapsed);
  const filtered = showGoalsOnly
    ? sorted.filter((e) => e.type === "Goal")
    : sorted;

  return (
    <div className="w-full flex flex-col items-center">
      {/* 🔘 أزرار التبديل */}
      <div className="flex gap-3 my-4">
        <button
          onClick={() => setShowGoalsOnly(false)}
          className={`px-4 py-1 rounded-full font-semibold text-sm transition ${
            !showGoalsOnly
              ? "bg-green-600 text-white shadow-lg"
              : "bg-gray-700 text-gray-300 hover:bg-gray-600"
          }`}
        >
          🕒 جميع الأحداث
        </button>
        <button
          onClick={() => setShowGoalsOnly(true)}
          className={`px-4 py-1 rounded-full font-semibold text-sm transition ${
            showGoalsOnly
              ? "bg-blue-600 text-white shadow-lg"
              : "bg-gray-700 text-gray-300 hover:bg-gray-600"
          }`}
        >
          ⚽ الأبرز (الأهداف فقط)
        </button>
      </div>

      {/* ⚡ الحاوية العامة */}
      <div className="relative w-full max-w-3xl h-[75vh] overflow-y-auto bg-gradient-to-b from-green-950 via-green-900 to-green-950 rounded-3xl shadow-lg p-6 border border-green-800 flex justify-center items-start">
        {/* العمود الرئيسي */}
        <div className="absolute left-1/2 -translate-x-1/2 w-[3px] bg-green-600 h-full rounded-full"></div>

        {/* الأحداث */}
        <div className="flex flex-col-reverse justify-end w-full space-y-4">
          {filtered.map((ev, i) => {
            const isHome = ev.team.id === fixture.teams.home.id;
            const sideClass = isHome ? "justify-end pr-10" : "justify-start pl-10";
            const align = isHome ? "right-1/2 -mr-[2px]" : "left-1/2 -ml-[2px]";
            const icon =
              ev.type === "Goal"
                ? "⚽"
                : ev.type === "Card" && ev.detail.includes("Yellow")
                ? "🟨"
                : ev.type === "Card" && ev.detail.includes("Red")
                ? "🟥"
                : ev.type === "subst"
                ? "🔁"
                : "•";

            return (
              <div
                key={i}
                className={`relative flex ${sideClass} items-center gap-2 text-white my-2`}
              >
                {/* النقطة على العمود */}
                <div
                  className={`absolute ${align} w-4 h-4 bg-green-400 rounded-full border-[3px] border-green-950 shadow-md`}
                ></div>

                {/* الحاوية الجانبية للحدث */}
                <div
                  className={`flex flex-col ${
                    isHome ? "items-end" : "items-start"
                  } bg-green-800/70 rounded-2xl px-3 py-2 shadow-lg max-w-[45%] border border-green-700`}
                >
                  {/* رأس الحدث */}
                  <div
                    className={`flex items-center justify-between w-full mb-1 ${
                      isHome ? "flex-row-reverse" : ""
                    }`}
                  >
                    <img
                      src={ev.team.logo}
                      alt="logo"
                      className="w-5 h-5 rounded-full shadow-md"
                    />
                    <span className="text-xs text-gray-300">{ev.time.elapsed}'</span>
                  </div>

                  {/* نوع الحدث */}
                  <div
                    className={`text-sm font-bold ${
                      ev.type === "Goal"
                        ? "text-yellow-300"
                        : ev.type === "Card" && ev.detail.includes("Red")
                        ? "text-red-400"
                        : ev.type === "Card" && ev.detail.includes("Yellow")
                        ? "text-yellow-400"
                        : "text-white"
                    }`}
                  >
                    {icon} {ev.type === "Goal" ? "هدف" : ev.detail}
                  </div>

                  {/* اللاعب وصاحب المساعدة */}
                  <div className="text-xs text-gray-200">
                    {ev.player?.name}
                    {ev.assist?.name && (
                      <span className="text-gray-400"> 🎯 {ev.assist.name}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 🧭 دليل بسيط في الأسفل */}
      <div className="flex justify-between w-full max-w-3xl mt-2 text-gray-400 text-sm">
        <div className="flex items-center gap-2">
          <img
            src={fixture.teams.home.logo}
            alt="home"
            className="w-5 h-5 rounded-full"
          />
          <span>{fixture.teams.home.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <span>{fixture.teams.away.name}</span>
          <img
            src={fixture.teams.away.logo}
            alt="away"
            className="w-5 h-5 rounded-full"
          />
        </div>
      </div>
    </div>
  );
}
