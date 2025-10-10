
"use client";

import { useEffect, useState, useMemo } from 'react';
import type { Fixture as FixtureType, Player as PlayerType, Team, MatchEvent, Standing, LineupData, PlayerStats } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

interface EnrichedLineupData extends Omit<LineupData, 'startXI' | 'substitutes'> {
  startXI: PlayerStats[];
  substitutes: PlayerStats[];
}

interface MatchDataHook {
  lineups: EnrichedLineupData[];
  events: MatchEvent[];
  stats: any[];
  standings: Standing[];
  h2h: any[];
  loading: boolean;
  error: string | null;
}

export function useMatchData(fixture?: FixtureType): MatchDataHook {
  const { toast } = useToast();
  const [data, setData] = useState<MatchDataHook>({
    lineups: [], events: [], stats: [], standings: [], h2h: [], loading: true, error: null,
  });

  const CURRENT_SEASON = useMemo(() => new Date(fixture?.fixture.date || Date.now()).getFullYear(), [fixture]);

  useEffect(() => {
    if (!fixture) {
      setData(prev => ({ ...prev, loading: false, error: "لا توجد بيانات مباراة" }));
      return;
    }
    const fetchData = async () => {
      setData(prev => ({ ...prev, loading: true, error: null }));
      try {
        const fixtureId = fixture.fixture.id;
        const leagueId = fixture.league.id;
        const homeTeamId = fixture.teams.home.id;
        const awayTeamId = fixture.teams.away.id;
        const teamIds = `${homeTeamId}-${awayTeamId}`;

        // 1. Fetch primary data in parallel
        const [lineupsRes, eventsRes, statsRes, h2hRes, standingsRes] = await Promise.all([
          fetch(`/api/football/fixtures/lineups?fixture=${fixtureId}`),
          fetch(`/api/football/fixtures/events?fixture=${fixtureId}`),
          fetch(`/api/football/fixtures/statistics?fixture=${fixtureId}`),
          fetch(`/api/football/fixtures/headtohead?h2h=${teamIds}`),
          fetch(`/api/football/standings?league=${leagueId}&season=${CURRENT_SEASON}`),
        ]);
        
        const lineupsDataRaw = lineupsRes.ok ? (await lineupsRes.json()).response || [] : [];
        const eventsData = eventsRes.ok ? (await eventsRes.json()).response || [] : [];
        const statsData = statsRes.ok ? (await statsRes.json()).response || [] : [];
        const h2hData = h2hRes.ok ? (await h2hRes.json()).response || [] : [];
        const standingsData = standingsRes.ok ? (await standingsRes.json()).response[0]?.league?.standings[0] || [] : [];
        
        // 2. Collect all player IDs from lineups
        const allPlayerIds = new Set<number>();
        lineupsDataRaw.forEach((lineup: LineupData) => {
            lineup.startXI.forEach(p => p.player.id && allPlayerIds.add(p.player.id));
            lineup.substitutes.forEach(p => p.player.id && allPlayerIds.add(p.player.id));
        });

        // 3. Fetch full player data for both teams
        let allPlayersData: PlayerStats[] = [];
        if (allPlayerIds.size > 0) {
            const [homePlayersRes, awayPlayersRes] = await Promise.all([
                fetch(`/api/football/players?team=${homeTeamId}&season=${CURRENT_SEASON}`),
                fetch(`/api/football/players?team=${awayTeamId}&season=${CURRENT_SEASON}`),
            ]);
            const homePlayers = homePlayersRes.ok ? (await homePlayersRes.json()).response || [] : [];
            const awayPlayers = awayPlayersRes.ok ? (await awayPlayersRes.json()).response || [] : [];
            allPlayersData = [...homePlayers, ...awayPlayers];
        }

        // 4. Create a map of full player details
        const playerDetailsMap = new Map<number, PlayerStats>();
        allPlayersData.forEach(p => {
          playerDetailsMap.set(p.player.id, p);
        });

        // 5. Enrich lineup data with full player details
        const enrichedLineups = lineupsDataRaw.map((lineup: LineupData) => {
          const enrich = (players: PlayerStats[]) => players.map(p => {
            const details = playerDetailsMap.get(p.player.id);
            // The lineup data from the API is minimal, we enrich it with data from the /players endpoint
            return {
              player: {
                ...p.player,
                photo: details?.player.photo || p.player.photo || "https://media.api-sports.io/football/players/0.png",
              },
              statistics: details?.statistics || p.statistics,
            };
          });

          return {
            ...lineup,
            startXI: enrich(lineup.startXI),
            substitutes: enrich(lineup.substitutes),
          };
        });
        
        setData({ 
            lineups: enrichedLineups, 
            events: eventsData, 
            stats: statsData, 
            h2h: h2hData,
            standings: standingsData, 
            loading: false, 
            error: null 
        });

      } catch (err: any) {
        console.error("❌ fetch error:", err);
        toast({ variant: "destructive", title: "خطأ", description: "فشل تحميل بيانات المباراة" });
        setData(prev => ({ ...prev, loading: false, error: err.message }));
      }
    };
    fetchData();
  }, [fixture, toast, CURRENT_SEASON]);

  return data;
}
