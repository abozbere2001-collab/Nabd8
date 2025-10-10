"use client";
import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { FaFutbol, FaArrowsRotate, FaExclamation } from "react-icons/fa6";
import { IoSquare } from "react-icons/io5";

export default function MatchTimeline({ events = [], fixture }) {
  const [filter, setFilter] = useState("all");

  const filteredEvents =
    filter === "highlight" ? events.filter((e) => e.type === "Goal") : events;

  const getIcon = (type, detail) => {
    if (type === "Goal") return <FaFutbol className="text-green-400 text-sm" />;
    if (type === "subst")
      return <FaArrowsRotate className="text-blue-400 text-sm" />;
    if (type === "Card") {
      if (detail === "Yellow Card")
        return <IoSquare className="text-yellow-400 text-base" />;
      if (detail === "Red Card")
        return <IoSquare className="text-red-600 text-base" />;
    }
    // Fallback for other card types or Var
    if (type === "Card") return <IoSquare className="text-yellow-400 text-base" />;
    if (type === "Var") return <FaExclamation className="text-gray-300 text-sm" />;
    return <FaFutbol className="text-gray-300 text-sm" />;
  };

  return (
    <div className="relative flex flex-col items-center w-full mt-6">
      {/* أزرار التبديل */}
      <div className="flex gap-3 mb-4">
        <button
          onClick={() => setFilter("highlight")}
          className={`px-4 py-1 rounded-full text-sm font-semibold border transition ${
            filter === "highlight"
              ? "bg-green-600 text-white border-green-600 shadow-md"
              : "bg-white text-gray-800 border-gray-300"
          }`}
        >
          الأبرز
        </button>
        <button
          onClick={() => setFilter("all")}
          className={`px-4 py-1 rounded-full text-sm font-semibold border transition ${
            filter === "all"
              ? "bg-green-600 text-white border-green-600 shadow-md"
              : "bg-white text-gray-800 border-gray-300"
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
            .map((event, index) => {
              const isHome = event.team.id === fixture.teams.home.id;
              return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`relative flex items-center w-full ${
                  isHome
                    ? "justify-start pl-[52%]" // المضيف يسار
                    : "justify-end pr-[52%]"   // الضيف يمين
                }`}
              >
                {/* الحاوية لكل حدث */}
                <div
                  className={`relative flex items-center gap-2 px-3 py-1.5 rounded-2xl shadow-md text-sm text-white max-w-[140px] ${
                    isHome ? "bg-blue-700" : "bg-green-700"
                  }`}
                >
                  <span>{getIcon(event.type, event.detail)}</span>
                  <div className="flex flex-col">
                    <span className="font-bold text-xs">{event.player?.name}</span>
                    <span className="text-[11px] opacity-80">{event.detail}</span>
                  </div>

                  {/* نقطة العمود */}
                  <div
                    className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full border border-gray-400 shadow-sm z-10 ${
                      isHome ? "-left-4" : "-right-4"
                    }`}
                  ></div>

                  {/* الوقت */}
                  <div
                    className={`absolute top-1/2 -translate-y-1/2 text-[11px] text-white opacity-70 ${
                      isHome ? "-left-10" : "-right-10"
                    }`}
                  >
                    {event.time.elapsed}'
                  </div>
                </div>
              </motion.div>
            )})}
        </div>
      </div>
    </div>
  );
}
