"use client";
import { useState } from "react";

export default function MatchTimeline({ events, fixture }) {
  const [showGoalsOnly, setShowGoalsOnly] = useState(false);

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
      <div className="relative w-full max-w-[750px] h-[120vh] overflow-y-auto bg-gradient-to-b from-green-950 via-green-900 to-green-950 rounded-3xl shadow-lg p-6 border border-green-800 flex justify-center items-start my-4">
        {/* العمود الرئيسي */}
        <div className="absolute left-1/2 -translate-x-1/2 w-[2px] bg-green-500 h-[130vh] rounded-full"></div>

        {/* الأحداث */}
        <div className="flex flex-col-reverse justify-end w-full space-y-4">
          {filtered.map((ev, i) => {
            const isHome = ev.team.id === fixture.teams.home.id;
            const sideClass = isHome ? "justify-end pr-3" : "justify-start pl-3";
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

            const timeLabel =
              ev.time?.real || ev.time?.updated || `${ev.time.elapsed}'`;

            return (
              <div
                key={i}
                className={`relative flex ${sideClass} items-center gap-2 text-white my-2`}
              >
                {/* النقطة على العمود */}
                <div
                  className={`absolute ${align} top-3 w-3 h-3 bg-green-400 rounded-full border-[3px] border-green-950 shadow-md`}
                  title={timeLabel}
                ></div>

                {/* الوقت الحقيقي بجانب النقطة */}
                <div
                  className={`absolute text-[10px] text-gray-300 ${
                    isHome ? "right-[51%]" : "left-[51%]"
                  } top-6`}
                >
                  {timeLabel}
                </div>

                {/* الحاوية الجانبية للحدث (أقرب من العمود) */}
                <div
                  className={`flex flex-col ${
                    isHome ? "items-end" : "items-start"
                  } bg-green-800/70 rounded-xl px-2 py-1 shadow-md max-w-[35%] border border-green-700`}
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
                      className="w-4 h-4 rounded-full shadow-md"
                    />
                    <span className="text-[11px] text-gray-300">
                      {ev.time.elapsed}'
                    </span>
                  </div>

                  {/* نوع الحدث */}
                  <div
                    className={`text-xs font-bold ${
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

                  {/* اللاعب والمساعدة */}
                  <div className="text-[11px] text-gray-200">
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

      {/* 🧭 دليل الفرق في الأسفل */}
      <div className="flex justify-between w-full max-w-[750px] mt-2 text-gray-400 text-sm px-4">
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

      {/* فراغ خارجي إضافي للتمرير المريح */}
      <div className="h-20 w-full"></div>
    </div>
  );
}
