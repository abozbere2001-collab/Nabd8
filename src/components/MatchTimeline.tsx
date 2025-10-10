"use client";
import { useState } from "react";
import type { Fixture, MatchEvent } from '@/lib/types';

interface MatchTimelineProps {
    events: MatchEvent[];
    fixture: Fixture;
}

export default function MatchTimeline({ events, fixture }: MatchTimelineProps) {
  const [showGoalsOnly, setShowGoalsOnly] = useState(false);

  // ترتيب الأحداث من الدقيقة 1 (أسفل) إلى 90 (أعلى)
  const sortedEvents = [...events].sort((a, b) => a.time.elapsed - b.time.elapsed);
  const filteredEvents = showGoalsOnly
    ? sortedEvents.filter((e) => e.type === "Goal")
    : sortedEvents;

  return (
    <div className="w-full flex flex-col items-center py-4 bg-card rounded-lg">
      {/* أزرار التبديل */}
      <div className="flex gap-3 mb-4">
        <button
          className={`px-4 py-1 rounded-full text-sm font-semibold shadow ${
            !showGoalsOnly
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
          onClick={() => setShowGoalsOnly(false)}
        >
          🕒 جميع الأحداث
        </button>
        <button
          className={`px-4 py-1 rounded-full text-sm font-semibold shadow ${
            showGoalsOnly
              ? "bg-accent text-accent-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
          onClick={() => setShowGoalsOnly(true)}
        >
          ⚽ الأهداف فقط
        </button>
      </div>

      {/* العمود الزمني */}
      <div className="relative flex justify-center w-full max-w-md h-[75vh] overflow-y-auto px-6">
        {/* العمود الرئيسي */}
        <div className="absolute left-1/2 -translate-x-1/2 w-[2px] bg-border h-full"></div>

        {/* الأحداث */}
        <div className="flex flex-col-reverse justify-end w-full space-y-3">
          {filteredEvents.map((ev, idx) => {
            const isHome = ev.team.id === fixture.teams.home.id;
            const sideClass = isHome ? "items-end pr-8" : "items-start pl-8";
            const align = isHome ? "right-1/2 -mr-[1px]" : "left-1/2 -ml-[1px]";
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
                key={idx}
                className={`relative flex ${sideClass} my-2 text-foreground`}
              >
                {/* النقطة على العمود */}
                <div
                  className={`absolute ${align} top-3 w-3 h-3 bg-muted-foreground rounded-full border-2 border-card`}
                ></div>

                {/* محتوى الحدث */}
                <div
                  className={`flex flex-col bg-background/70 rounded-xl p-2 shadow-md max-w-[45%] ${
                    isHome ? "text-right" : "text-left"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    {isHome && (
                      <img
                        src={ev.team.logo}
                        alt=""
                        className="w-4 h-4 rounded-full ml-2"
                      />
                    )}
                    <span className="text-xs opacity-70">{ev.time.elapsed}'</span>
                    {!isHome && (
                      <img
                        src={ev.team.logo}
                        alt=""
                        className="w-4 h-4 rounded-full mr-2"
                      />
                    )}
                  </div>
                  <div className="text-sm font-semibold">{ev.player?.name}</div>
                  <div className="text-xs opacity-80 flex items-center gap-1">
                    <span>{icon}</span>
                    <span>{ev.detail}</span>
                  </div>
                  {ev.assist?.name && (
                    <span className="text-xs text-muted-foreground">
                      🎯 {ev.assist.name}
                    </span>
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
