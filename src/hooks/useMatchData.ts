
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
        const teamIds = `${fixture.teams.home.id}-${fixture.teams.away.id}`;

        const [lineupsRes, eventsRes, statsRes, h2hRes, standingsRes, homePlayersRes, awayPlayersRes] = await Promise.all([
          fetch(`/api/football/fixtures/lineups?fixture=${fixtureId}`),
          fetch(`/api/football/fixtures/events?fixture=${fixtureId}`),
          fetch(`/api/football/fixtures/statistics?fixture=${fixtureId}`),
          fetch(`/api/football/fixtures/headtohead?h2h=${teamIds}`),
          fetch(`/api/football/standings?league=${leagueId}&season=${CURRENT_SEASON}`),
          fetch(`/api/football/players?team=${fixture.teams.home.id}&season=${CURRENT_SEASON}`),
          fetch(`/api/football/players?team=${fixture.teams.away.id}&season=${CURRENT_SEASON}`),
        ]);
        
        const lineupsDataRaw = lineupsRes.ok ? (await lineupsRes.json()).response || [] : [];
        const eventsData = eventsRes.ok ? (await eventsRes.json()).response || [] : [];
        const statsData = statsRes.ok ? (await statsRes.json()).response || [] : [];
        const h2hData = h2hRes.ok ? (await h2hRes.json()).response || [] : [];
        const standingsData = standingsRes.ok ? (await standingsRes.json()).response[0]?.league?.standings[0] || [] : [];
        
        const homePlayersData = homePlayersRes.ok ? (await homePlayersRes.json()).response || [] : [];
        const awayPlayersData = awayPlayersRes.ok ? (await awayPlayersRes.json()).response || [] : [];

        const allPlayersData = [...homePlayersData, ...awayPlayersData];
        const playerDetailsMap = new Map<number, PlayerType>();
        allPlayersData.forEach(p => {
          playerDetailsMap.set(p.player.id, p.player);
        });

        const enrichedLineups = lineupsDataRaw.map((lineup: LineupData) => {
          const enrich = (players: PlayerStats[]) => players.map(p => {
            const details = playerDetailsMap.get(p.player.id);
            return {
              ...p,
              player: {
                ...p.player,
                photo: details?.photo || p.player.photo || "https://media.api-sports.io/football/players/0.png"
              }
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
