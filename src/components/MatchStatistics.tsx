"use client";
import React from "react";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";

export default function MatchStatistics({ stats, fixture, isAdmin, onRename, getStatName }) {
  const homeStats = stats.find((s) => s.team.id === fixture.teams.home.id);
  const awayStats = stats.find((s) => s.team.id === fixture.teams.away.id);

  if (!homeStats || !awayStats)
    return (
      <div className="text-center text-gray-400 p-8">
        ⚠️ الإحصائيات غير متاحة حالياً
      </div>
    );

  return (
    <div className="w-full max-w-[750px] mx-auto bg-gradient-to-b from-green-950 via-green-900 to-green-950 rounded-3xl shadow-lg border border-green-800 my-6 p-4">
      <h2 className="text-center text-lg font-bold text-green-300 mb-4">
        الإحصائيات
      </h2>

      {/* 🧭 أسماء الفرق */}
      <div className="flex justify-between text-gray-300 text-sm mb-2 px-3">
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

      {/* 🧩 قائمة الإحصاءات */}
      <div className="flex flex-col divide-y divide-green-800">
        {homeStats.statistics.map((stat, i) => {
          const awayValue = awayStats.statistics[i]?.value || 0;
          const homeValue = stat.value || 0;
          const originalName = stat.type;
          const displayName = getStatName(originalName, originalName);

          const totalValue = (typeof homeValue === 'string' ? 0 : homeValue) + (typeof awayValue === 'string' ? 0 : awayValue);
          const homePercent = totalValue > 0 ? ((typeof homeValue === 'string' ? 0 : homeValue) / totalValue) * 100 : 50;
          const awayPercent = 100 - homePercent;

          return (
            <div
              key={i}
              className="flex items-center justify-between py-3 text-white relative group"
            >
              {/* 🔢 القيم */}
              <div className="w-[25%] text-right text-sm text-green-200 font-semibold">
                {homeValue ?? 0}
              </div>

              {/* 📊 الإحصاء نفسه */}
              <div className="w-[50%] flex flex-col items-center text-center relative">
                {/* اسم الإحصاء */}
                <div className="text-gray-300 text-xs mb-1 flex items-center gap-2">
                    {displayName}
                    {isAdmin && (
                        <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100" onClick={() => onRename('statistic', originalName, displayName)}>
                            <Pencil className="h-3 w-3" />
                        </Button>
                    )}
                </div>

                {/* شريط بياني وسط جميل */}
                <div className="relative w-full h-2 bg-green-950 rounded-full overflow-hidden">
                  <div
                    className="absolute right-0 top-0 h-full bg-green-500"
                    style={{ width: `${homePercent}%` }}
                  ></div>
                  <div
                    className="absolute left-0 top-0 h-full bg-blue-600"
                    style={{ width: `${awayPercent}%` }}
                  ></div>
                </div>
              </div>

              {/* 🔢 القيم */}
              <div className="w-[25%] text-left text-sm text-blue-300 font-semibold">
                {awayValue ?? 0}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
