
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
    let isCancelled = false;

    const fetchData = async () => {
      setData(prev => ({ ...prev, loading: true, error: null }));
      try {
        const fixtureId = fixture.fixture.id;
        const leagueId = fixture.league.id;
        const homeTeamId = fixture.teams.home.id;
        const awayTeamId = fixture.teams.away.id;
        
        // 1. Fetch primary data (lineups, events, etc.)
        const [lineupsRes, eventsRes, statsRes, h2hRes, standingsRes] = await Promise.all([
          fetch(`/api/football/fixtures/lineups?fixture=${fixtureId}`),
          fetch(`/api/football/fixtures/events?fixture=${fixtureId}`),
          fetch(`/api/football/fixtures/statistics?fixture=${fixtureId}`),
          fetch(`/api/football/fixtures/headtohead?h2h=${homeTeamId}-${awayTeamId}`),
          fetch(`/api/football/standings?league=${leagueId}&season=${CURRENT_SEASON}`),
        ]);
        
        if (isCancelled) return;
        
        const lineupsDataRaw = lineupsRes.ok ? (await lineupsRes.json()).response || [] : [];
        const eventsData = eventsRes.ok ? (await eventsRes.json()).response || [] : [];
        const statsData = statsRes.ok ? (await statsRes.json()).response || [] : [];
        const h2hData = h2hRes.ok ? (await h2hRes.json()).response || [] : [];
        const standingsData = standingsRes.ok ? (await standingsRes.json()).response[0]?.league?.standings[0] || [] : [];

        // 2. Fetch full player data for each team in the lineup
        let allPlayersData: PlayerStats[] = [];
        if (lineupsDataRaw.length > 0) {
            for (const lineup of lineupsDataRaw) {
                const teamId = lineup.team?.id;
                if (!teamId) continue;
                
                // Fetch all players for the team to ensure we have data for everyone
                const playersRes = await fetch(`/api/football/players?team=${teamId}&season=${CURRENT_SEASON}`);
                if (isCancelled) return;
                
                if (playersRes.ok) {
                    const teamPlayers = (await playersRes.json()).response || [];
                    allPlayersData.push(...teamPlayers);
                }
            }
        }

        // 3. Create a map of full player details
        const playerDetailsMap = new Map<number, PlayerStats>();
        allPlayersData.forEach(p => {
          playerDetailsMap.set(p.player.id, p);
        });

        // 4. Enrich lineup data with full player details
        const enrichedLineups = lineupsDataRaw.map((lineup: LineupData) => {
          const enrich = (players: { player: PlayerType }[]) => players.map(p => {
            const details = playerDetailsMap.get(p.player.id);
            return {
              player: {
                ...p.player,
                photo: details?.player.photo || p.player.photo || "https://media.api-sports.io/football/players/0.png",
              },
              statistics: details?.statistics || (p as any).statistics || [],
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
                loading: false, 
                error: null 
            });
        }

      } catch (err: any) {
        if (!isCancelled) {
            console.error("❌ fetch error:", err);
            toast({ variant: "destructive", title: "خطأ", description: "فشل تحميل بيانات المباراة" });
            setData(prev => ({ ...prev, loading: false, error: err.message }));
        }
      }
    };
    fetchData();

    return () => {
      isCancelled = true;
    };
  }, [fixture, toast, CURRENT_SEASON]);

  return data;
}
