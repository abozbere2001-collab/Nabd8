
"use client";

import { useEffect, useState, useMemo } from 'react';
import type { Fixture as FixtureType, Player as PlayerType, Team, MatchEvent, Standing, LineupData } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

interface EnrichedLineupData extends Omit<LineupData, 'startXI' | 'substitutes'> {
  startXI: PlayerStats[];
  substitutes: PlayerStats[];
}

interface PlayerStats {
  player: PlayerType;
  statistics: any[];
}

interface MatchData {
    lineups: EnrichedLineupData[];
    events: MatchEvent[];
    stats: any[];
    standings: Standing[];
    h2h: any[];
}
interface MatchDataHook {
  data: MatchData | null;
  loading: boolean;
  error: string | null;
}

export function useMatchData(fixture?: FixtureType): MatchDataHook {
  const { toast } = useToast();
  const [data, setData] = useState<MatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


  const CURRENT_SEASON = useMemo(() => fixture ? new Date(fixture.fixture.date).getFullYear() : new Date().getFullYear(), [fixture]);

  useEffect(() => {
    if (!fixture) {
      setLoading(false);
      setError("لا توجد بيانات مباراة");
      return;
    }
    let isCancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const fixtureId = fixture.fixture.id;
        const leagueId = fixture.league.id;
        const homeTeamId = fixture.teams.home.id;
        const awayTeamId = fixture.teams.away.id;
        
        const [lineupsRes, eventsRes, statsRes, h2hRes, standingsRes, playersRes] = await Promise.all([
          fetch(`/api/football/fixtures/lineups?fixture=${fixtureId}`),
          fetch(`/api/football/fixtures/events?fixture=${fixtureId}`),
          fetch(`/api/football/fixtures/statistics?fixture=${fixtureId}`),
          fetch(`/api/football/fixtures/headtohead?h2h=${homeTeamId}-${awayTeamId}`),
          fetch(`/api/football/standings?league=${leagueId}&season=${CURRENT_SEASON}`),
          fetch(`/api/football/players?fixture=${fixtureId}`),
        ]);
        
        if (isCancelled) return;
        
        const lineupsDataRaw = lineupsRes.ok ? (await lineupsRes.json()).response || [] : [];
        const eventsData = eventsRes.ok ? (await eventsRes.json()).response || [] : [];
        const statsData = statsRes.ok ? (await statsRes.json()).response || [] : [];
        const h2hData = h2hRes.ok ? (await h2hRes.json()).response || [] : [];
        const standingsData = standingsRes.ok ? (await standingsRes.json()).response[0]?.league?.standings[0] || [] : [];
        const playersData = playersRes.ok ? (await playersRes.json()).response || [] : [];

        const playerDetailsMap = new Map<number, PlayerStats>();
        playersData.forEach((teamPlayers: { team: Team, players: PlayerStats[] }) => {
            teamPlayers.players.forEach(p => {
                playerDetailsMap.set(p.player.id, p);
            })
        });

        const enrichedLineups = lineupsDataRaw.map((lineup: LineupData) => {
          const enrich = (players: { player: PlayerType }[] | undefined) => (players || []).map(p => {
            const details = playerDetailsMap.get(p.player.id);
            return {
              player: {
                ...p.player,
                photo: details?.player.photo || p.player.photo || "https://media.api-sports.io/football/players/0.png",
                grid: (p.player as any).grid || null,
              },
              statistics: details?.statistics || [],
            };
          });

          return {
            ...lineup,
            startXI: enrich(lineup.startXI),
            substitutes: enrich(lineup.substitutes),
          };
        });
        
        if (!isCancelled) {
            setData({ 
                lineups: enrichedLineups, 
                events: eventsData, 
                stats: statsData, 
                h2h: h2hData,
                standings: standingsData, 
            });
        }

      } catch (err: any) {
        if (!isCancelled) {
            console.error("❌ fetch error:", err);
            toast({ variant: "destructive", title: "خطأ", description: "فشل تحميل بيانات المباراة" });
            setError(err.message);
        }
      } finally {
        if (!isCancelled) {
            setLoading(false);
        }
      }
    };
    fetchData();

    return () => {
      isCancelled = true;
    };
  }, [fixture, toast, CURRENT_SEASON]);

  return { data, loading, error };
}
