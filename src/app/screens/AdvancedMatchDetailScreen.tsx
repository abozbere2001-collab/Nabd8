// AdvancedMatchDetailPage.tsx
"use client";

import React, { useEffect, useState, useCallback } from "react";
import "./AdvancedMatchDetailScreen.css";
import type { Player as PlayerType, MatchEvent, Stats as StatsType, LineupData, Fixture } from "@/lib/types";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Loader2 } from "lucide-react";

// ====== أنواع البيانات (مستوردة الآن من types.ts) ======
// Interaces are now using the main types from lib/types.ts for consistency

// Helper function to transform API data to the component's expected format
const transformApiData = (
    fixtureDetails: Fixture, 
    lineups: LineupData[], 
    events: MatchEvent[], 
    stats: any[]
): any => {
    if (!fixtureDetails || lineups.length < 2) {
        return null;
    }
    const homeTeamApi = lineups.find(l => l.team.id === fixtureDetails.teams.home.id);
    const awayTeamApi = lineups.find(l => l.team.id === fixtureDetails.teams.away.id);

    if (!homeTeamApi || !awayTeamApi) {
         return null;
    }

    const transformPlayer = (p: any): PlayerType => ({
        id: p.player.id,
        name: p.player.name,
        number: p.player.number,
        position: p.player.pos,
        photo: p.player.photo,
        grid: p.player.grid
    });

    const homeStats = stats.find(s => s.team.id === fixtureDetails.teams.home.id)?.statistics;
    const awayStats = stats.find(s => s.team.id === fixtureDetails.teams.away.id)?.statistics;

    const getStatValue = (statsArray: any[], type: string) => {
        if (!statsArray) return 0;
        const stat = statsArray.find(s => s.type === type);
        // Handle both string and number values, remove '%' if present
        return stat ? parseInt(String(stat.value).replace('%', '')) : 0;
    };
    
    return {
        homeTeam: homeTeamApi.team.name,
        awayTeam: awayTeamApi.team.name,
        homeLogo: homeTeamApi.team.logo,
        awayLogo: awayTeamApi.team.logo,
        date: new Date(fixtureDetails.fixture.date).toLocaleDateString('ar-EG'),
        stadium: fixtureDetails.fixture.venue.name,
        time: new Date(fixtureDetails.fixture.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
        status: fixtureDetails.fixture.status.short,
        events: events,
        homeFormation: homeTeamApi.startXI.map(transformPlayer),
        awayFormation: awayTeamApi.startXI.map(transformPlayer),
        substitutesHome: homeTeamApi.substitutes.map(transformPlayer),
        substitutesAway: awayTeamApi.substitutes.map(transformPlayer),
        coachHome: homeTeamApi.coach.name,
        coachAway: awayTeamApi.coach.name,
        stats: homeStats && awayStats ? {
            possessionHome: getStatValue(homeStats, "Ball Possession"),
            possessionAway: getStatValue(awayStats, "Ball Possession"),
            shotsHome: getStatValue(homeStats, "Total Shots"),
            shotsAway: getStatValue(awayStats, "Total Shots"),
            foulsHome: getStatValue(homeStats, "Fouls"),
            foulsAway: getStatValue(awayStats, "Fouls")
        } : undefined
    };
};


// ====== مكون التشكيلة الكامل ======
const FormationCard:React.FC<{team:string; players?:PlayerType[]; substitutes?:PlayerType[]; coach?:string;}> = ({team,players,substitutes,coach})=>{
  const positions:Record<string,PlayerType[]> = {G:[],D:[],M:[],F:[]};
  if (players) {
      players.forEach(p=>{
        const pos = p.position;
        if(positions[pos]) {
           positions[pos].push(p);
        }
      });
  }

  return (
    <div className="formation-card card mb-4">
      <h3 className="text-xl font-semibold mb-2">{team}</h3>
      <div className="field">
        {["F","M","D","G"].map((pos,idx)=>(
          <div key={idx} className={`line ${pos}`}>
            {positions[pos]?.map((p,i)=>(
              <div key={`${p.id}-${i}`} className="player">
                <img src={p.photo} alt={p.name}/>
                <span>{p.number} {p.name}</span>
              </div>
            ))}
          </div>
        ))}
        {coach && <p className="coach">المدرب: {coach}</p>}
      </div>
      {substitutes && substitutes.length>0 && (
        <div className="substitutes">
          <h4 className="font-bold text-center my-2 text-white">الاحتياط</h4>
          <div className="flex flex-wrap justify-center gap-2">
            {substitutes.map((s,i)=>(
              <div key={`${s.id}-${i}`} className="substitute">
                <img src={s.photo} alt={s.name}/>
                <span className="text-xs">{s.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ====== الصفحة النهائية ======
const AdvancedMatchDetailPage:React.FC<{fixtureId:number; fixture: Fixture, goBack: () => void; canGoBack: boolean}> = ({fixtureId, fixture: initialFixture, goBack, canGoBack})=>{
  const [matchData, setMatchData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showFormation,setShowFormation]=useState<{home:boolean,away:boolean}>({home:false,away:false});

  const fetchMatchData = useCallback(async () => {
    try {
      const [lineupsRes, eventsRes, statsRes, fixtureRes] = await Promise.all([
        fetch(`/api/football/fixtures/lineups?fixture=${fixtureId}`),
        fetch(`/api/football/fixtures/events?fixture=${fixtureId}`),
        fetch(`/api/football/fixtures/statistics?fixture=${fixtureId}`),
        fetch(`/api/football/fixtures?id=${fixtureId}`) // Re-fetch fixture for live status
      ]);

      const lineupsData = await lineupsRes.json();
      const eventsData = await eventsRes.json();
      const statsData = await statsRes.json();
      const fixtureData = await fixtureRes.json();

      const transformedData = transformApiData(
          fixtureData.response[0] || initialFixture,
          lineupsData.response,
          eventsData.response,
          statsData.response
      );

      setMatchData(transformedData);
    } catch(e) {
      console.error("Failed to fetch match details", e);
    } finally {
      setLoading(false);
    }
  }, [fixtureId, initialFixture]);


  useEffect(()=>{
    setLoading(true);
    fetchMatchData(); // Initial fetch
    const interval = setInterval(fetchMatchData, 30000); // Auto-refresh every 30 seconds
    return () => clearInterval(interval);
  },[fetchMatchData]);

  if(loading) {
    return (
        <div className="match-page rtl font-arabic p-4 bg-light flex-1 overflow-y-auto flex items-center justify-center">
             <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  if(!matchData) return (
     <div className="match-page rtl font-arabic p-4 bg-light flex-1 overflow-y-auto flex items-center justify-center">
         <p>لا توجد بيانات تفصيلية لهذه المباراة.</p>
     </div>
  );

  return (
    <div className="match-page rtl font-arabic p-4 bg-light flex-1 overflow-y-auto">
        <ScreenHeader title={`${matchData.homeTeam} ضد ${matchData.awayTeam}`} onBack={goBack} canGoBack={canGoBack} />

      {/* مربع الفرق */}
      <div className="teams-box flex justify-between mb-4">
        {[
          {team:"home",name:matchData.homeTeam,logo:matchData.homeLogo},
          {team:"away",name:matchData.awayTeam,logo:matchData.awayLogo}
        ].map((t,idx)=>(
          <div key={idx} className="team-card"
            onClick={()=>setShowFormation(prev=>({home:false, away: false, [t.team]:!prev[t.team as 'home' | 'away']}))}>
            <img src={t.logo} alt={t.name} className="team-logo object-contain"/>
            <h3 className="team-name">{t.name}</h3>
          </div>
        ))}
      </div>

      {/* تشكيل كل فريق */}
      {showFormation.home && matchData.homeFormation && <FormationCard team={matchData.homeTeam} players={matchData.homeFormation} substitutes={matchData.substitutesHome} coach={matchData.coachHome}/>}
      {showFormation.away && matchData.awayFormation && <FormationCard team={matchData.awayTeam} players={matchData.awayFormation} substitutes={matchData.substitutesAway} coach={matchData.coachAway}/>}

      {/* أحداث حية */}
      {matchData.status !== "NS" && matchData.events && (
        <div className="live-card card mb-4">
          <h2 className="text-2xl font-bold text-center text-red-500 animate-pulse mb-2">
            {matchData.status === "FT" ? "انتهت" : "المجريات"}
          </h2>
          {matchData.events.map((e: MatchEvent, idx: number)=>(
            <div key={idx} className={`event flex justify-between mb-1 items-center ${e.type}`}>
              <span>{e.time.elapsed}' {e.player.name}</span>
               <div className="flex items-center gap-2">
                {e.type==="Goal" && <span className="goal-icon">⚽</span>}
                {e.type==="Card" && e.detail === "Yellow Card" && <span className="card-icon yellow-card"></span>}
                {e.type==="Card" && e.detail === "Red Card" && <span className="card-icon red-card"></span>}
                {e.type==="subst" && (
                  <span className="substitution">
                    <span className="sub-out">↓ {e.player.name}</span>
                    <span className="sub-in">↑ {e.assist.name}</span>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* إحصائيات */}
      {matchData.stats && (
        <div className="stats-card card p-4">
          <h2 className="text-2xl font-bold mb-2 text-center">إحصائيات المباراة</h2>
          <div className="stats-grid grid grid-cols-3 gap-2 items-center">
            <div className="home-stats text-right font-bold">{matchData.stats.possessionHome}%</div>
            <div className="text-center text-muted-foreground">الاستحواذ</div>
            <div className="away-stats text-left font-bold">{matchData.stats.possessionAway}%</div>
            
            <div className="home-stats text-right font-bold">{matchData.stats.shotsHome}</div>
            <div className="text-center text-muted-foreground">التسديدات</div>
            <div className="away-stats text-left font-bold">{matchData.stats.shotsAway}</div>

            <div className="home-stats text-right font-bold">{matchData.stats.foulsHome}</div>
            <div className="text-center text-muted-foreground">الأخطاء</div>
            <div className="away-stats text-left font-bold">{matchData.stats.foulsAway}</div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdvancedMatchDetailPage;
