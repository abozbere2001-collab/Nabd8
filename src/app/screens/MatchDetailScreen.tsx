
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { ScreenProps } from '@/app/page';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Loader2, Shield, Users, BarChart3, Trophy } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { MatchTimeline } from '@/components/MatchTimeline';
import { LineupField } from '@/components/LineupField';
import { MatchStatistics } from '@/components/MatchStatistics';
import type { Fixture, MatchEvent, LineupData, MatchStatistics as StatsData, Standing } from '@/lib/types';
import './MatchDetailScreen.css';

const MatchHeader = React.memo(({ fixture }: { fixture: Fixture }) => {
    if (!fixture) return null;

    const { teams, goals, fixture: fixtureInfo } = fixture;
    const isLive = ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE'].includes(fixtureInfo.status.short);

    return (
        <div className="match-header-container bg-card p-4 flex flex-col items-center gap-4">
            <div className="flex justify-between items-center w-full">
                <div className="flex flex-col items-center gap-2 w-1/3">
                    <Avatar className="h-16 w-16">
                        <AvatarImage src={teams.home.logo} alt={teams.home.name} />
                        <AvatarFallback>{teams.home.name.substring(0, 2)}</AvatarFallback>
                    </Avatar>
                    <span className="font-bold text-center">{teams.home.name}</span>
                </div>
                <div className="flex flex-col items-center">
                    <div className="text-4xl font-bold tracking-wider">
                        {goals.home ?? '-'} : {goals.away ?? '-'}
                    </div>
                    {isLive && (
                        <div className="live-indicator text-red-500 font-bold text-sm animate-pulse mt-1">
                            {fixtureInfo.status.elapsed}'
                        </div>
                    )}
                </div>
                <div className="flex flex-col items-center gap-2 w-1/3">
                    <Avatar className="h-16 w-16">
                        <AvatarImage src={teams.away.logo} alt={teams.away.name} />
                        <AvatarFallback>{teams.away.name.substring(0, 2)}</AvatarFallback>
                    </Avatar>
                    <span className="font-bold text-center">{teams.away.name}</span>
                </div>
            </div>
            <div className="text-xs text-muted-foreground">
                {fixture.league.name} - {new Date(fixtureInfo.date).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
        </div>
    );
});
MatchHeader.displayName = "MatchHeader";


export function MatchDetailScreen({ fixtureId, goBack, canGoBack, navigate }: ScreenProps & { fixtureId: number, navigate: (screen: string, props: any) => void }) {
    const [loading, setLoading] = useState(true);
    const [fixture, setFixture] = useState<Fixture | null>(null);
    const [events, setEvents] = useState<MatchEvent[]>([]);
    const [lineups, setLineups] = useState<LineupData[]>([]);
    const [stats, setStats] = useState<StatsData[]>([]);
    const [standings, setStandings] = useState<Standing[]>([]);

    const fetchData = useCallback(async () => {
        try {
            const [fixtureRes, eventsRes, lineupsRes, statsRes] = await Promise.all([
                fetch(`/api/football/fixtures?id=${fixtureId}`),
                fetch(`/api/football/fixtures/events?fixture=${fixtureId}`),
                fetch(`/api/football/fixtures/lineups?fixture=${fixtureId}`),
                fetch(`/api/football/fixtures/statistics?fixture=${fixtureId}`)
            ]);

            const fixtureData = await fixtureRes.json();
            const eventsData = await eventsRes.json();
            const lineupsData = await lineupsRes.json();
            const statsData = await statsRes.json();

            const currentFixture = fixtureData.response[0];
            if (currentFixture) {
                setFixture(currentFixture);
                const leagueId = currentFixture.league.id;
                const season = currentFixture.league.season;
                const standingsRes = await fetch(`/api/football/standings?league=${leagueId}&season=${season}`);
                const standingsData = await standingsRes.json();
                if (standingsData.response[0]?.league?.standings[0]) {
                    setStandings(standingsData.response[0].league.standings[0]);
                }
            }
            setEvents(eventsData.response || []);
            setLineups(lineupsData.response || []);
            setStats(statsData.response || []);
        } catch (error) {
            console.error("Failed to fetch match details:", error);
        } finally {
            setLoading(false);
        }
    }, [fixtureId]);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
        return () => clearInterval(interval);
    }, [fetchData]);

    const homeLineup = useMemo(() => lineups.find(l => l.team.id === fixture?.teams.home.id), [lineups, fixture]);
    const awayLineup = useMemo(() => lineups.find(l => l.team.id === fixture?.teams.away.id), [lineups, fixture]);

    if (loading) {
        return (
            <div className="flex h-full flex-col bg-background">
                <ScreenHeader title="تفاصيل المباراة" onBack={goBack} canGoBack={canGoBack} />
                <div className="flex flex-1 justify-center items-center">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            </div>
        );
    }

    if (!fixture) {
        return (
            <div className="flex h-full flex-col bg-background">
                <ScreenHeader title="خطأ" onBack={goBack} canGoBack={canGoBack} />
                <div className="flex flex-1 justify-center items-center">
                    <p>تعذر تحميل تفاصيل المباراة.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col bg-background">
            <ScreenHeader title={fixture.league.name} onBack={goBack} canGoBack={canGoBack} />
            <div className="flex-1 overflow-y-auto">
                <MatchHeader fixture={fixture} />
                <Tabs defaultValue="timeline" className="w-full">
                    <TabsList className="grid w-full grid-cols-4 rounded-none h-auto p-0 border-y">
                        <TabsTrigger value="timeline"><Shield className="w-4 h-4 ml-1"/>المجريات</TabsTrigger>
                        <TabsTrigger value="lineup"><Users className="w-4 h-4 ml-1"/>التشكيلة</TabsTrigger>
                        <TabsTrigger value="stats"><BarChart3 className="w-4 h-4 ml-1"/>الإحصائيات</TabsTrigger>
                        <TabsTrigger value="standings"><Trophy className="w-4 h-4 ml-1"/>الترتيب</TabsTrigger>
                    </TabsList>
                    <TabsContent value="timeline" className="p-4">
                        <MatchTimeline events={events} homeTeamId={fixture.teams.home.id} />
                    </TabsContent>
                    <TabsContent value="lineup" className="p-0">
                        {homeLineup && awayLineup ? (
                            <LineupField home={homeLineup} away={awayLineup} />
                        ) : (
                            <p className="text-center text-muted-foreground p-8">التشكيلة غير متاحة حاليًا.</p>
                        )}
                    </TabsContent>
                    <TabsContent value="stats" className="p-4">
                        <MatchStatistics stats={stats} />
                    </TabsContent>
                    <TabsContent value="standings" className="p-0">
                        {standings.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-right">
                                    <thead className="bg-card">
                                        <tr>
                                            <th className="p-2 text-center">نقاط</th>
                                            <th className="p-2 text-center">ف</th>
                                            <th className="p-2 text-center">ت</th>
                                            <th className="p-2 text-center">خ</th>
                                            <th className="p-2 text-center">ل</th>
                                            <th className="p-2 w-1/2">الفريق</th>
                                            <th className="p-2">#</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {standings.map((s) => (
                                            <tr 
                                                key={s.team.id} 
                                                className={`border-b border-border hover:bg-accent/50 cursor-pointer ${s.team.id === fixture.teams.home.id || s.team.id === fixture.teams.away.id ? 'bg-primary/10' : ''}`}
                                                onClick={() => navigate('TeamDetails', { teamId: s.team.id })}
                                            >
                                                <td className="p-2 font-bold text-center">{s.points}</td>
                                                <td className="p-2 text-center">{s.all.win}</td>
                                                <td className="p-2 text-center">{s.all.draw}</td>
                                                <td className="p-2 text-center">{s.all.lose}</td>
                                                <td className="p-2 text-center">{s.all.played}</td>
                                                <td className="p-2">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <span>{s.team.name}</span>
                                                        <Avatar className="h-5 w-5">
                                                            <AvatarImage src={s.team.logo} />
                                                        </Avatar>
                                                    </div>
                                                </td>
                                                <td className="p-2 text-center">{s.rank}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : <p className="text-center text-muted-foreground p-8">جدول الترتيب غير متاح.</p>}
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
