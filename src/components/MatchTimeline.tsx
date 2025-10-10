"use client";
import React, { useState } from "react";
import { motion } from "framer-motion";
import { FaFutbol, FaExclamationTriangle, FaArrowsRotate } from "react-icons/fa6";

export default function MatchTimeline({ events = [], fixture }) {
  const [filter, setFilter] = useState("all");

    if (!events || events.length === 0)
    return (
      <div className="text-center text-gray-400 p-6">⚠️ لا توجد مجريات متاحة</div>
    );

  const filteredEvents =
    filter === "highlight" ? events.filter((e) => e.type === "Goal") : events;

  const getIcon = (type) => {
    switch (type) {
      case "Goal":
        return <FaFutbol className="text-green-500" />;
      case "Card":
        return <FaExclamationTriangle className="text-yellow-400" />;
      case "subst":
        return <FaArrowsRotate className="text-blue-400" />;
      default:
        return <FaFutbol className="text-gray-300" />;
    }
  };
  
    const isHomeTeam = (teamId) => teamId === fixture.teams.home.id;


  return (
    <div className="relative flex flex-col items-center w-full mt-6">
      {/* أزرار التبديل */}
      <div className="flex gap-3 mb-4">
        <button
          onClick={() => setFilter("highlight")}
          className={`px-4 py-1 rounded-full text-sm font-semibold ${
            filter === "highlight" ? "bg-green-600 text-white" : "bg-gray-200"
          }`}
        >
          الأبرز
        </button>
        <button
          onClick={() => setFilter("all")}
          className={`px-4 py-1 rounded-full text-sm font-semibold ${
            filter === "all" ? "bg-green-600 text-white" : "bg-gray-200"
          }`}
        >
          عرض الكل
        </button>
      </div>

      {/* عمود الزمن */}
      <div className="relative w-[90%] sm:w-[70%] md:w-[60%] lg:w-[50%]">
        <div className="absolute left-1/2 top-0 bottom-0 w-[2px] bg-white opacity-80 z-0"></div>

        <div className="flex flex-col-reverse items-center gap-4 mt-4">
          {filteredEvents
            .sort((a, b) => a.time.elapsed - b.time.elapsed)
            .map((event, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`relative flex items-center w-full ${
                  isHomeTeam(event.team.id) ? "justify-end pr-[52%]" : "justify-start pl-[52%]"
                }`}
              >
                {/* الحاوية لكل حدث */}
                <div
                  className={`relative flex items-center gap-2 px-3 py-1.5 rounded-2xl shadow-md text-sm text-white max-w-[140px] ${
                    isHomeTeam(event.team.id) ? "bg-green-700" : "bg-gray-700"
                  }`}
                >
                  <span>{getIcon(event.type)}</span>
                  <div className="flex flex-col">
                    <span className="font-bold text-xs">{event.player?.name}</span>
                    <span className="text-[11px] opacity-80">{event.detail}</span>
                  </div>

                  {/* نقطة العمود */}
                  <div className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full border border-gray-400 shadow-sm z-10
                    ${isHomeTeam(event.team.id) ? "-right-4" : "-left-4"}`}></div>

                  {/* الوقت الحقيقي */}
                  <div
                    className={`absolute top-1/2 -translate-y-1/2 text-[11px] text-white opacity-70 ${
                      isHomeTeam(event.team.id) ? "-right-10" : "-left-10"
                    }`}
                  >
                    {event.time.elapsed}' 
                  </div>
                </div>
              </motion.div>
            ))}
        </div>
      </div>
    </div>
  );
}