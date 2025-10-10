
"use client";

import React, { useEffect, useState, useCallback } from 'react';
import type { ScreenProps } from '@/app/page';
import type { Fixture, LineupData, MatchEvent, Standing, MatchStatistics, Player, PlayerWithStats } from '@/lib/types';
import './UltimateMatchDetailScreen.css';

// Re-integrated types for clarity within the component
type FullMatchData = {
    fixture: Fixture;
    lineups: LineupData[];
    events: MatchEvent[];
    statistics: MatchStatistics[];
    standings: Standing[];
};

// ====================================================================
// ========================= HELPER COMPONENTS ========================
// ====================================================================

const StatRow = ({ label, valueLeft, valueRight }: { label: string, valueLeft: any, valueRight: any }) => (
    <div className="stat-row">
        <div className="stat-value">{valueLeft ?? '-'}</div>
        <div className="stat-label">{label}</div>
        <div className="stat-value">{valueRight ?? '-'}</div>
    </div>
);

const EventItem = ({ event, homeTeamId }: { event: MatchEvent, homeTeamId: number }) => {
    const eventIcons: Record<string, { cls: string, label: string }> = {
        'Goal': { cls: 'goal-icon', label: '⚽' },
        'Card': { cls: event.detail.includes('Yellow') ? 'yellow-icon' : 'red-icon', label: '🟨' },
        'subst': { cls: 'sub-icon', label: '🔄' },
        'Var': { cls: 'var-icon', label: '🖥️' },
    };
    const icon = eventIcons[event.type] || { cls: 'white-icon', label: '📌' };

    return (
        <div className="event-item">
            <div className="ev-time">{event.time.elapsed}'</div>
            <div className={`ev-icon ${icon.cls}`}>{icon.label}</div>
            <div className="ev-body">
                <div className="ev-title">
                    <strong>{event.player.name}</strong>
                </div>
                <div className="ev-desc">
                    {event.type === 'subst' ? `خروج: ${event.assist.name || '-'} / دخول: ${event.player.name || '-'}` : event.detail}
                </div>
                <div className="ev-team" style={{ color: event.team.id === homeTeamId ? '#34d399' : '#06b6d4' }}>
                    {event.team.name}
                </div>
            </div>
        </div>
    );
};

const PlayerCircle = ({ player }: { player: Player }) => (
    <div className="player-circle" title={`${player.name} • ${player.number}`}>
        <img src={player.photo} alt={player.name} />
        <div className="player-label">{player.name}</div>
        <div className="player-number">#{player.number}</div>
    </div>
);

const TeamFormation = ({ teamData, teamType }: { teamData: LineupData, teamType: 'home' | 'away' }) => {
    const players = teamData.startXI;
    
    const gk = players.filter(p => p.player.grid === '1:1');
    const defenders = players.filter(p => p.player.grid?.match(/^[2-5]:/));
    const midfielders = players.filter(p => p.player.grid?.match(/^[6-8]:/));
    const attackers = players.filter(p => p.player.grid?.match(/^(9|10|11):/));

    const pitchRows = [attackers, midfielders, defenders, gk];
    if (teamType === 'away') pitchRows.reverse();

    return (
        <div className="team-block">
            <div className="team-header">
                <div className="left">
                    <div style={{ width: '44px', height: '44px', borderRadius: '50%', overflow: 'hidden' }}>
                        <img src={teamData.team.logo} style={{ width: '44px', height: '44px', objectFit: 'contain' }} alt={teamData.team.name} />
                    </div>
                    <div style={{ marginRight: '8px' }}>
                        <div style={{ fontWeight: 800 }}>{teamData.team.name}</div>
                        <div className="coach muted">المدرب: {teamData.coach.name}</div>
                    </div>
                </div>
                <div className="muted">{teamType === 'home' ? 'المضيف' : 'الضيف'}</div>
            </div>
            <div className="pitch" id={`${teamType}Pitch`}>
                {pitchRows.map((row, index) => (
                    <div key={index} className="row-line">
                        {row.map(p => <PlayerCircle key={p.player.id} player={p.player} />)}
                    </div>
                ))}
            </div>
            <div className="subs-and-ratings">
                <div className="subs card">
                    <h4 className="muted">الاحتياط</h4>
                    {teamData.substitutes.map(s => (
                        <div key={s.player.id} className="sub-item">
                            <img src={s.player.photo} alt={s.player.name} />
                            <div>
                                <div style={{ fontWeight: 800 }}>{s.player.name}</div>
                                <div className="muted">{s.player.position}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// ====================================================================
// ========================= MAIN PAGE COMPONENT ======================
// ====================================================================

export function UltimateMatchDetailScreen({ fixtureId, goBack, canGoBack }: ScreenProps & { fixtureId: number }) {
    const [match, setMatch] = useState<FullMatchData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'highlights' | 'timeline'>('highlights');

    const fetchMatchData = useCallback(async () => {
        if (!fixtureId) return;

        try {
            const [fixtureRes, lineupsRes, eventsRes, statsRes] = await Promise.all([
                fetch(`/api/football/fixtures?id=${fixtureId}`),
                fetch(`/api/football/fixtures/lineups?fixture=${fixtureId}`),
                fetch(`/api/football/fixtures/events?fixture=${fixtureId}`),
                fetch(`/api/football/fixtures/statistics?fixture=${fixtureId}`),
            ]);

            if (!fixtureRes.ok || !lineupsRes.ok || !eventsRes.ok || !statsRes.ok) {
                throw new Error('فشل في جلب بعض بيانات المباراة');
            }

            const fixtureData = await fixtureRes.json();
            const lineupsData = await lineupsRes.json();
            const eventsData = await eventsRes.json();
            const statsData = await statsRes.json();
            
            const currentFixture = fixtureData.response?.[0];
            if (!currentFixture) {
                throw new Error('لم يتم العثور على المباراة');
            }

            const leagueId = currentFixture.league.id;
            const season = currentFixture.league.season;
            const standingsRes = await fetch(`/api/football/standings?league=${leagueId}&season=${season}`);
            const standingsData = await standingsRes.json();
            
            const fullLineups = lineupsData.response || [];
            if (fullLineups.length > 0) {
                 const playersWithRatingsRes = await fetch(`/api/football/players?fixture=${fixtureId}`);
                 const playersWithRatingsData = await playersWithRatingsRes.json();
                 const playersRatingsMap = new Map<number, PlayerWithStats>();
                 playersWithRatingsData.response.forEach((item: {player: Player, statistics: any[]}) => {
                     playersRatingsMap.set(item.player.id, item as PlayerWithStats);
                 });
                 
                 fullLineups.forEach((lineup: LineupData) => {
                     lineup.startXI.forEach(starter => {
                         const ratedPlayer = playersRatingsMap.get(starter.player.id);
                         if (ratedPlayer) {
                             starter.player.rating = ratedPlayer.statistics?.[0]?.games?.rating;
                         }
                     });
                 });
            }


            setMatch({
                fixture: currentFixture,
                lineups: fullLineups,
                events: eventsData.response || [],
                statistics: statsData.response || [],
                standings: standingsData.response?.[0]?.league?.standings?.[0] || [],
            });

        } catch (err: any) {
            setError(err.message || 'حدث خطأ غير متوقع');
        } finally {
            setLoading(false);
        }
    }, [fixtureId]);

    useEffect(() => {
        fetchMatchData();
        const interval = setInterval(fetchMatchData, 30000); // Auto-refresh every 30s
        return () => clearInterval(interval);
    }, [fetchMatchData]);


    if (loading) {
        return <div className="loader match-detail-page">جاري تحميل تفاصيل المباراة...</div>;
    }

    if (error) {
        return <div className="loader match-detail-page">خطأ: {error}</div>;
    }

    if (!match) {
        return <div className="loader match-detail-page">لا توجد بيانات لهذه المباراة.</div>;
    }

    const { fixture, lineups, events, statistics, standings } = match;
    const homeTeam = fixture.teams.home;
    const awayTeam = fixture.teams.away;
    const homeLineup = lineups.find(l => l.team.id === homeTeam.id);
    const awayLineup = lineups.find(l => l.team.id === awayTeam.id);
    const homeStats = statistics.find(s => s.team.id === homeTeam.id)?.statistics;
    const awayStats = statistics.find(s => s.team.id === awayTeam.id)?.statistics;
    
    const getStat = (stats: MatchStatistics['statistics'] | undefined, type: string) => stats?.find(s => s.type === type)?.value ?? '-';
    
    const statusShort = fixture.fixture.status.short;
    const isLive = ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE'].includes(statusShort);
    const isFinished = ['FT', 'AET', 'PEN'].includes(statusShort);
    const isUpcoming = !isLive && !isFinished;

    const statusClass = isFinished ? 'finished' : isLive ? 'live' : 'upcoming';
    const statusText = fixture.fixture.status.long;

    const highlights = events.filter(e => e.type === 'Goal' || (e.type === 'Card' && e.detail === 'Red Card'));
    const sortedEvents = [...events].sort((a, b) => a.time.elapsed - b.time.elapsed);

    return (
        <div className="match-detail-page">
            <header className="card header-card">
                <div className="header-row">
                     <div className="team-tile" onClick={() => document.getElementById('awayPitch')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
                        <div style={{ textAlign: 'right' }}>
                            <div className="team-name">{awayTeam.name}</div>
                            <div className="muted">المدرب: {awayLineup?.coach.name || '-'}</div>
                        </div>
                        <div className="team-logo"><img src={awayTeam.logo} alt={awayTeam.name} /></div>
                    </div>

                    <div className="scorebox center">
                        <div className="score">{fixture.goals.home ?? '-'} &nbsp; - &nbsp; {fixture.goals.away ?? '-'}</div>
                        <div className="status">
                            <span className={`status-badge ${statusClass}`}>{statusText}</span>
                            <div className="muted" style={{ marginTop: '6px' }}>{new Date(fixture.fixture.date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' })} · {new Date(fixture.fixture.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                    </div>
                   
                    <div className="team-tile" onClick={() => document.getElementById('homePitch')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
                        <div className="team-logo"><img src={homeTeam.logo} alt={homeTeam.name} /></div>
                        <div>
                            <div className="team-name">{homeTeam.name}</div>
                            <div className="muted">المدرب: {homeLineup?.coach.name || '-'}</div>
                        </div>
                    </div>
                </div>
                 <div className="meta">
                    <div className="item">الملعب: <strong style={{ marginRight: '6px' }}>{fixture.fixture.venue.name}</strong></div>
                </div>
            </header>
            
            <main className="container">
                <section className="left-col">
                    <div className="card section-card">
                        <h2 style={{ marginBottom: '10px', fontWeight: 'bold' }}>التشكيل</h2>
                        <div className="formation-grid">
                            {homeLineup ? <TeamFormation teamData={homeLineup} teamType="home" /> : <div>لا توجد تشكيلة للمضيف</div>}
                            {awayLineup ? <TeamFormation teamData={awayLineup} teamType="away" /> : <div>لا توجد تشكيلة للضيف</div>}
                        </div>
                    </div>

                    <div className="card section-card">
                         <h3 style={{ fontWeight: 'bold' }}>الترتيب والإحصائيات</h3>
                         <div className="bottom-grid">
                            <div className="card" style={{ padding: '10px' }}>
                                <h4 style={{ marginBottom: '10px' }}>ترتيب الدوري</h4>
                                {standings.length > 0 ? (
                                    <table className="standings-table">
                                        <thead><tr><th>#</th><th>الفريق</th><th>ل</th><th>ف</th><th>ت</th><th>خ</th><th>ن</th></tr></thead>
                                        <tbody>
                                            {standings.slice(0, 5).map(row => (
                                                <tr key={row.team.id}><td>{row.rank}</td><td>{row.team.name}</td><td>{row.all.played}</td><td>{row.all.win}</td><td>{row.all.draw}</td><td>{row.all.lose}</td><td>{row.points}</td></tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : <p className="muted">الترتيب غير متاح</p>}
                            </div>
                            <div className="card" style={{ padding: '10px' }}>
                                <h4 style={{ marginBottom: '10px' }}>إحصائيات المباراة</h4>
                                <StatRow label="الاستحواذ" valueLeft={getStat(homeStats, 'Ball Possession')} valueRight={getStat(awayStats, 'Ball Possession')} />
                                <StatRow label="التسديدات" valueLeft={getStat(homeStats, 'Total Shots')} valueRight={getStat(awayStats, 'Total Shots')} />
                                <StatRow label="على المرمى" valueLeft={getStat(homeStats, 'Shots on Goal')} valueRight={getStat(awayStats, 'Shots on Goal')} />
                                <StatRow label="الركنيات" valueLeft={getStat(homeStats, 'Corner Kicks')} valueRight={getStat(awayStats, 'Corner Kicks')} />
                                <StatRow label="الأخطاء" valueLeft={getStat(homeStats, 'Fouls')} valueRight={getStat(awayStats, 'Fouls')} />
                                <StatRow label="البطاقات الصفراء" valueLeft={getStat(homeStats, 'Yellow Cards')} valueRight={getStat(awayStats, 'Yellow Cards')} />
                            </div>
                         </div>
                    </div>
                </section>
                
                 <aside className="right-col">
                    <div className="card section-card events-panel">
                        <div className="controls">
                            <button id="btnH" className={`btn ${activeTab === 'highlights' ? 'active' : ''}`} onClick={() => setActiveTab('highlights')}>الأبرز</button>
                            <button id="btnA" className={`btn ${activeTab === 'timeline' ? 'active' : ''}`} onClick={() => setActiveTab('timeline')}>كل الأحداث</button>
                        </div>
                        {activeTab === 'highlights' && (
                            <div className="highlights">
                                {highlights.length > 0 ? highlights.map(event => <EventItem key={event.time.elapsed + event.player.name} event={event} homeTeamId={homeTeam.id} />) : <div className="muted">لا توجد أحداث بارزة</div>}
                            </div>
                        )}
                        {activeTab === 'timeline' && (
                            <div className="timeline">
                                {sortedEvents.length > 0 ? sortedEvents.map(event => <EventItem key={event.time.elapsed + event.player.name} event={event} homeTeamId={homeTeam.id} />) : <div className="muted">لا توجد أحداث بعد</div>}
                            </div>
                        )}
                    </div>
                </aside>
            </main>
            
            <footer className="card footer-card">
              <div className="footer-left">مصدر البيانات: <span id="dataSource">API-Football</span></div>
              <div className="footer-right muted">مصمم بواسطة لمسة إبداعية · قابل للتعديل</div>
            </footer>
        </div>
    );
}
