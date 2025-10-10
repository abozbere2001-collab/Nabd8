"use client";
import React from "react";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";

export default function MatchStatistics({ stats, fixture, isAdmin, onRename, getStatName }: { stats: any[], fixture: any, isAdmin: boolean, onRename: (type: string, id: string, name: string) => void, getStatName: (id: string, defaultName: string) => string }) {
  const homeStats = stats.find((s) => s.team.id === fixture.teams.home.id);
  const awayStats = stats.find((s) => s.team.id === fixture.teams.away.id);

  if (!homeStats || !awayStats) {
    return (
      <div className="text-center text-gray-400 p-8">
        ⚠️ الإحصائيات غير متاحة حالياً
      </div>
    );
  }

  return (
    <div className="w-full max-w-[750px] mx-auto bg-card rounded-lg shadow-lg border my-6 p-4">
      <h2 className="text-center text-lg font-bold text-foreground mb-4">
        الإحصائيات
      </h2>

      <div className="flex justify-between items-center text-sm mb-4 px-3">
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

      <div className="flex flex-col divide-y divide-border">
        {homeStats.statistics.map((stat: any, i: number) => {
          const awayValue = awayStats.statistics[i]?.value ?? 0;
          const homeValue = stat.value ?? 0;
          const originalName = stat.type;
          const displayName = getStatName(originalName, originalName);

          const totalValue = (typeof homeValue === 'string' ? parseInt(homeValue.replace('%', '')) : homeValue) + (typeof awayValue === 'string' ? parseInt(awayValue.replace('%', '')) : awayValue);
          const homePercent = totalValue > 0 ? ((typeof homeValue === 'string' ? parseInt(homeValue.replace('%', '')) : homeValue) / totalValue) * 100 : 50;

          return (
            <div
              key={i}
              className="flex items-center justify-between py-3 text-foreground relative group"
            >
              <div className="w-[15%] text-center text-sm font-semibold">
                {homeValue ?? 0}
              </div>

              <div className="w-[70%] flex flex-col items-center text-center relative">
                <div className="text-muted-foreground text-xs mb-1 flex items-center gap-2">
                    {displayName}
                    {isAdmin && (
                        <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100" onClick={() => onRename('statistic', originalName, displayName)}>
                            <Pencil className="h-3 w-3" />
                        </Button>
                    )}
                </div>

                <div className="relative w-full h-2 bg-secondary rounded-full overflow-hidden flex flex-row-reverse">
                  <div
                    className="h-full bg-blue-600"
                    style={{ width: `${homePercent}%` }}
                  ></div>
                </div>
              </div>

              <div className="w-[15%] text-center text-sm font-semibold">
                {awayValue ?? 0}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
