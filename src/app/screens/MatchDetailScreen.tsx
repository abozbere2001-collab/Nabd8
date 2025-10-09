
// ✅ ملف: src/app/screens/MatchDetailScreen.tsx

"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import type { ScreenProps } from "@/app/page";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function useMatchData(fixture: any) {
  const [data, setData] = useState({
    players: { home: [], away: [] } as { home: any[], away: any[] },
    events: [],
    stats: [],
    standings: [],
    loading: true,
    error: null as string | null,
  });

  useEffect(() => {
    if (!fixture) return;

    const fetchData = async () => {
      setData((prev) => ({ ...prev, loading: true, error: null }));

      const fixtureId = fixture?.fixture?.id;
      const homeTeamId = fixture?.teams?.home?.id;
      const awayTeamId = fixture?.teams?.away?.id;

      try {
        const [
          playersHome,
          playersAway,
          eventsRes,
          statsRes,
          standingsRes,
        ] = await Promise.allSettled([
          fetch(`/api/football/players?fixture=${fixtureId}&team=${homeTeamId}`),
          fetch(`/api/football/players?fixture=${fixtureId}&team=${awayTeamId}`),
          fetch(`/api/football/events?fixture=${fixtureId}`),
          fetch(`/api/football/stats?fixture=${fixtureId}`),
          fetch(`/api/football/standings?league=${fixture?.league?.id}`),
        ]);

        const parseResult = async (res: any) =>
          res.status === "fulfilled" && res.value.ok
            ? await res.value.json()
            : null;

        const [homeData, awayData, events, stats, standings] =
          await Promise.all([
            parseResult(playersHome),
            parseResult(playersAway),
            parseResult(eventsRes),
            parseResult(statsRes),
            parseResult(standingsRes),
          ]);

        const safeHome =
          homeData?.response?.[0]?.players || homeData?.response || [];
        const safeAway =
          awayData?.response?.[0]?.players || awayData?.response || [];

        setData({
          players: { home: safeHome, away: safeAway },
          events: events?.response || [],
          stats: stats?.response || [],
          standings: standings?.response || [],
          loading: false,
          error: null,
        });
      } catch (error: any) {
        console.error("❌ Match data fetch error:", error);
        setData((prev) => ({
          ...prev,
          loading: false,
          error: error.message || "Unknown error",
        }));
      }
    };

    fetchData();
  }, [fixture]);

  return data;
}

// 🏟️ مكون عرض اللاعبين على الملعب
function LineupField({ players }: { players: any[] }) {
  if (!players?.length) {
    return (
      <div className="flex items-center justify-center h-full text-center text-muted-foreground py-6">
        التشكيلة غير متاحة حاليًا
      </div>
    );
  }

  // توزيع بسيط للاعبين حسب المراكز في شبكة الملعب
  return (
    <div className="relative w-full h-[600px] bg-green-700/10 rounded-2xl overflow-hidden shadow-inner border border-green-500/20 bg-cover bg-center" style={{ backgroundImage: "url('/football-pitch-3d.svg')", backgroundSize: '100% 100%' }}>
      {/* خطوط الملعب */}
      <div className="absolute inset-0 grid grid-rows-5 grid-cols-4 gap-2 p-3">
        {players.slice(0, 11).map((p: any, i: number) => {
          const name = p.player?.name || "غير معروف";
          const photo = p.player?.photo || "";
          const number = p.player?.number || "-";
          const rating =
            p.statistics?.[0]?.games?.rating
              ? parseFloat(p.statistics[0].games.rating).toFixed(1)
              : null;

          return (
            <div
              key={i}
              className="flex flex-col items-center justify-center text-white text-xs"
            >
              <div className="relative w-12 h-12">
                <Avatar className="w-12 h-12 border-2 border-white/50 bg-black/30">
                  <AvatarImage src={photo} alt={name} />
                  <AvatarFallback>{name.charAt(0)}</AvatarFallback>
                </Avatar>
                {rating && <div className="absolute -top-1 -right-1 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center border-2 border-background bg-blue-600 z-10">{rating}</div>}
              </div>
              <span className="mt-1 bg-black/50 px-1.5 rounded font-semibold text-center truncate w-20">{name}</span>
              <span className="text-[10px] font-bold">{number}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 🧠 شاشة تفاصيل المباراة
export function MatchDetailScreen({ navigate, goBack, canGoBack, fixture, headerActions }: ScreenProps & { fixture: any }) {
  const { players, loading, error } = useMatchData(fixture);

  if (loading)
    return (
      <div className="flex h-full flex-col bg-background">
        <ScreenHeader title="تفاصيل المباراة" onBack={goBack} canGoBack={canGoBack} actions={headerActions} />
        <div className="flex-1 flex items-center justify-center">
            <Skeleton className="w-[90%] h-[70vh]" />
        </div>
      </div>
    );

  if (error)
    return (
      <div className="flex h-full flex-col bg-background">
        <ScreenHeader title="خطأ" onBack={goBack} canGoBack={canGoBack} />
        <div className="flex-1 flex items-center justify-center text-center text-destructive p-4">
            حدث خطأ أثناء جلب البيانات: {error}
        </div>
      </div>
    );

  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader title="تفاصيل المباراة" onBack={goBack} canGoBack={canGoBack} actions={headerActions} />
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <h2 className="text-center text-lg font-bold">
          {fixture?.teams?.home?.name} ⚽ {fixture?.teams?.away?.name}
        </h2>

        <Card className="p-3 bg-card">
          <h3 className="font-bold text-center mb-2">تشكيلة الفريق المضيف</h3>
          <LineupField players={players.home} />
        </Card>

        <Card className="p-3 bg-card">
          <h3 className="font-bold text-center mb-2">تشكيلة الفريق الضيف</h3>
          <LineupField players={players.away} />
        </Card>
      </div>
    </div>
  );
}
