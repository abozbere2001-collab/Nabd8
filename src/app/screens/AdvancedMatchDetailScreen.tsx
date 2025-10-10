// AdvancedMatchDetailPage.tsx
"use client";

import React, { useEffect, useState } from "react";
import "./AdvancedMatchDetailScreen.css";

// Mock axios for now
const axios = {
  get: async (url: string) => {
    console.log(`Axios GET: ${url}`);
    // Return mock data based on the URL
    if (url.includes('/api/match/')) {
        const mockData: MatchData = {
            homeTeam: "ريال مدريد",
            awayTeam: "برشلونة",
            homeLogo: "https://media.api-sports.io/football/teams/541.png",
            awayLogo: "https://media.api-sports.io/football/teams/529.png",
            date: "2024-10-26",
            stadium: "سانتياغو برنابيو",
            time: "22:00",
            status: "live",
            events: [
                { type: "goal", team: "home", player: "بيلينجهام", minute: 78 },
                { type: "yellowCard", team: "away", player: "أراوخو", minute: 65 },
                { type: "substitution", team: "home", player: "مودريتش", minute: 60, subIn: "مودريتش", subOut: "كروس" },
                { type: "goal", team: "home", player: "فينيسيوس", minute: 23 },
            ],
            homeFormation: [
                { name: "كورتوا", position: "GK", number: 1, image: "https://media.api-sports.io/football/players/1357.png" },
                { name: "كارفاخال", position: "DEF", number: 2, image: "https://media.api-sports.io/football/players/567.png" },
                { name: "روديجر", position: "DEF", number: 22, image: "https://media.api-sports.io/football/players/891.png" },
                { name: "ألابا", position: "DEF", number: 4, image: "https://media.api-sports.io/football/players/25.png" },
                { name: "ميندي", position: "DEF", number: 23, image: "https://media.api-sports.io/football/players/2730.png" },
                { name: "تشواميني", position: "MID", number: 18, image: "https://media.api-sports.io/football/players/47539.png" },
                { name: "كروس", position: "MID", number: 8, image: "https://media.api-sports.io/football/players/184.png" },
                { name: "فالفيردي", position: "MID", number: 15, image: "https://media.api-sports.io/football/players/3419.png" },
                { name: "بيلينجهام", position: "FWD", number: 5, image: "https://media.api-sports.io/football/players/41659.png" },
                { name: "فينيسيوس", position: "FWD", number: 7, image: "https://media.api-sports.io/football/players/3420.png" },
                { name: "رودريجو", position: "FWD", number: 11, image: "https://media.api-sports.io/football/players/3421.png" },
            ],
            awayFormation: [
                 { name: "شتيغن", position: "GK", number: 1, image: "https://media.api-sports.io/football/players/154.png" },
            ],
            coachHome: "كارلو أنشيلوتي",
            substitutesHome: [
                { name: "لونين", position: "GK", number: 13, image: "https://media.api-sports.io/football/players/3415.png" }
            ]
        };
      return { data: mockData };
    }
    return { data: null };
  }
};


type Player = { name: string; position: string; number: number; image: string; }
type Event = { type: "goal"|"yellowCard"|"redCard"|"substitution"; team:"home"|"away"; player:string; minute:number; subIn?:string; subOut?:string; }
type Stats = { possessionHome:number; possessionAway:number; shotsHome:number; shotsAway:number; foulsHome:number; foulsAway:number; }

type MatchData = {
  homeTeam:string; awayTeam:string; homeLogo:string; awayLogo:string; date:string; stadium:string; time:string;
  status:"upcoming"|"live"|"finished"; odds?:any; predictions?:any; events?:Event[];
  homeFormation?:Player[]; awayFormation?:Player[];
  stats?:Stats;
  coachHome?:string; coachAway?:string;
  substitutesHome?:Player[]; substitutesAway?:Player[];
}

const AdvancedMatchDetailPage:React.FC<{fixtureId:number}> = ({fixtureId})=>{
  const [match,setMatch]=useState<MatchData|null>(null);
  const [showFormation,setShowFormation]=useState<{home:boolean,away:boolean}>({home:false,away:false});

  const fetchMatchData=async()=>{
    try{
      // The fixtureId is now passed correctly, but the API endpoint /api/match/ needs to be created.
      // For now, it will use the mock data.
      const response=await axios.get(`/api/match/${fixtureId}`);
      setMatch(response.data);
    }catch(e){console.error(e);}
  };

  useEffect(()=>{
    fetchMatchData();
    const interval=setInterval(fetchMatchData,20000);
    return ()=>clearInterval(interval);
  },[fixtureId]);

  if(!match) return <p>جارٍ تحميل البيانات...</p>;

  return (
    <div className="match-page rtl font-arabic bg-light p-4">

      {/* ======= مربع الفرق قبل المباراة ======= */}
      {match.status==="upcoming" && (
        <div className="teams-box flex justify-between mb-4">
          {[
            {team:"home", name:match.homeTeam, logo:match.homeLogo},
            {team:"away", name:match.awayTeam, logo:match.awayLogo}
          ].map((t,idx)=>(
            <div key={idx} className={`team-card cursor-pointer hover:shadow-xl transition-shadow`}
              onClick={()=>setShowFormation(prev=>({...prev,[t.team]:!prev[t.team]}))}>
              <img src={t.logo} alt={t.name} className="team-logo"/>
              <h3 className="team-name">{t.name}</h3>
            </div>
          ))}
        </div>
      )}

      {/* ======= عرض تشكيل الفريق عند الضغط ======= */}
      {showFormation.home && match.homeFormation && (
        <FormationCard team="home" players={match.homeFormation} substitutes={match.substitutesHome} coach={match.coachHome}/>
      )}
      {showFormation.away && match.awayFormation && (
        <FormationCard team="away" players={match.awayFormation} substitutes={match.substitutesAway} coach={match.coachAway}/>
      )}

      {/* ======= المباريات المباشرة ======= */}
      {match.status==="live" && match.events && (
        <div className="live-card card mb-4">
          <h2 className="text-2xl font-bold text-center text-red-500 animate-pulse mb-2">مباشر الآن</h2>
          {match.events.map((e,idx)=>(
            <div key={idx} className={`event flex justify-between mb-1 ${e.type}`}>
              <span>{e.minute}' {e.player}</span>
              <span>
                {e.type==="goal" && <span className="goal-icon">⚽</span>}
                {e.type==="yellowCard" && <span className="yellow-card">🟨</span>}
                {e.type==="redCard" && <span className="red-card">🟥</span>}
                {e.type==="substitution" && (
                  <span className={`substitution ${e.subIn?"in":"out"}`}>
                    {e.subOut} → {e.subIn}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ======= بعد المباراة ======= */}
      {match.status==="finished" && (
        <>
          <div className="formations mb-6">
            <FormationCard team="home" players={match.homeFormation} substitutes={match.substitutesHome} coach={match.coachHome}/>
            <FormationCard team="away" players={match.awayFormation} substitutes={match.substitutesAway} coach={match.coachAway}/>
          </div>

          {/* إحصائيات */}
          {match.stats && (
            <div className="stats-card card p-4">
              <h2 className="text-2xl font-bold mb-2">إحصائيات المباراة</h2>
              <div className="stats-grid grid grid-cols-2 gap-4">
                <div className="home-stats text-left">
                  <p>استحواذ: {match.stats.possessionHome}%</p>
                  <p>تسديدات: {match.stats.shotsHome}</p>
                  <p>أخطاء: {match.stats.foulsHome}</p>
                </div>
                <div className="away-stats text-right">
                  <p>استحواذ: {match.stats.possessionAway}%</p>
                  <p>تسديدات: {match.stats.shotsAway}</p>
                  <p>أخطاء: {match.stats.foulsAway}</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const FormationCard:React.FC<{team:"home"|"away"; players?:Player[]; substitutes?:Player[]; coach?:string;}> = ({team,players,substitutes,coach})=>{
  // ترتيب اللاعبين حسب المراكز
  const positions: Record<string, Player[]> ={"GK":[], "DEF":[], "MID":[], "FWD":[]};
  if (players) {
    players.forEach(p=>{
        if(p.position.includes("G")) positions.GK.push(p);
        else if(p.position.includes("D")) positions.DEF.push(p);
        else if(p.position.includes("M")) positions.MID.push(p);
        else positions.FWD.push(p);
    });
  }


  return (
    <div className="formation-card card mb-4">
      <h3 className="text-xl font-semibold mb-2">{team==="home"?"الفريق المضيف":"الفريق الضيف"}</h3>
      <div className="field">
        {Object.entries(positions).reverse().map(([pos,plist],idx)=>(
          <div key={idx} className={`line ${pos}`}>
            {plist.map((p,i)=>(
              <div key={i} className="player">
                <img src={p.image} alt={p.name}/>
                <span>{p.number} {p.name}</span>
              </div>
            ))}
          </div>
        ))}
        {coach && <p className="coach">المدرب: {coach}</p>}
      </div>
      {substitutes && substitutes.length>0 && (
        <div className="substitutes mt-2">
          <h4>الاحتياط</h4>
          <div className="flex gap-2">
            {substitutes.map((s,i)=>(
              <div key={i} className="substitute">
                <img src={s.image} alt={s.name}/>
                <span>{s.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedMatchDetailPage;
