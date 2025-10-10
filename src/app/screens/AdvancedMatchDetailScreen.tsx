// AdvancedMatchDetailPage.tsx
"use client";

import React, { useEffect, useState } from "react";
import "./AdvancedMatchDetailScreen.css";
import type { Player, MatchEvent as Event, Stats, LineupData } from "@/lib/types";
import { ScreenHeader } from "@/components/ScreenHeader";


interface MatchData {
  homeTeam:string; awayTeam:string; homeLogo:string; awayLogo:string;
  date:string; stadium:string; time:string;
  status:"upcoming"|"live"|"finished";
  events?:Event[];
  homeFormation?:Player[]; awayFormation?:Player[];
  stats?:Stats;
  coachHome?:string; coachAway?:string;
  substitutesHome?:Player[]; substitutesAway?:Player[];
}

// ====== بيانات وهمية متكاملة ======
const mockData:MatchData = {
  homeTeam:"ريال مدريد", awayTeam:"برشلونة",
  homeLogo:"https://media.api-sports.io/football/teams/541.png",
  awayLogo:"https://media.api-sports.io/football/teams/529.png",
  date:"12/10/2025", stadium:"سانتياغو برنابيو", time:"21:00",
  status:"live",
  events:[
    {type:"Goal",team:{id: 541, name: 'Real Madrid', logo: ''},player:{id: 14, name:"مودريتش"},assist: {id:null, name: null}, time:{elapsed: 15, extra: null}, detail: "Normal Goal", comments: null},
    {type:"Card",team:{id: 529, name: 'Barcelona', logo: ''},player:{id: 874, name:"ميسي"},assist: {id:null, name: null}, time:{elapsed: 23, extra: null}, detail: "Yellow Card", comments: null},
    {type:"Card",team:{id: 541, name: 'Real Madrid', logo: ''},player:{id: 145, name:"راموس"},assist: {id:null, name: null}, time:{elapsed: 45, extra: null}, detail: "Red Card", comments: null},
    {type:"subst",team:{id: 529, name: 'Barcelona', logo: ''},player:{id: 3446, name:"أراوخو"},assist: {id:154, name: "بيكيه"}, time:{elapsed: 60, extra: null}, detail: "Substitution", comments: null},
    {type:"Goal",team:{id: 529, name: 'Barcelona', logo: ''},player:{id: 874, name:"ميسي"},assist: {id:null, name: null}, time:{elapsed: 70, extra: null}, detail: "Normal Goal", comments: null}
  ],
  homeFormation:[
    {id: 184, name:"كورتوا",number:1,position:"G",image:"https://media.api-sports.io/football/players/184.png"},
    {id: 145, name:"راموس",number:4,position:"D",image:"https://media.api-sports.io/football/players/145.png"},
    {id: 58, name:"كارفاخال",number:2,position:"D",image:"https://media.api-sports.io/football/players/58.png"},
    {id: 14, name:"مودريتش",number:10,position:"M",image:"https://media.api-sports.io/football/players/14.png"},
    {id: 15, name:"كروس",number:8,position:"M",image:"https://media.api-sports.io/football/players/15.png"},
    {id: 37, name:"بنزيما",number:9,position:"F",image:"https://media.api-sports.io/football/players/37.png"},
    {id: 3530, name:"فينيسيوس",number:20,position:"F",image:"https://media.api-sports.io/football/players/3530.png"}
  ],
  awayFormation:[
    {id: 153, name:"تير شتيجن",number:1,position:"G",image:"https://media.api-sports.io/football/players/153.png"},
    {id: 154, name:"بيكيه",number:3,position:"D",image:"https://media.api-sports.io/football/players/154.png"},
    {id: 157, name:"ألبا",number:18,position:"D",image:"https://media.api-sports.io/football/players/157.png"},
    {id: 164, name:"بوسكيتس",number:5,position:"M",image:"https://media.api-sports.io/football/players/164.png"},
    {id: 1627, name:"دي يونغ",number:21,position:"M",image:"https://media.api-sports.io/football/players/1627.png"},
    {id: 874, name:"ميسي",number:10,position:"F",image:"https://media.api-sports.io/football/players/874.png"},
    {id: 94, name:"أوباميانغ",number:14,position:"F",image:"https://media.api-sports.io/football/players/94.png"}
  ],
  substitutesHome:[
    {id: 16, name:"أسينسيو",number:11,position:"M",image:"https://media.api-sports.io/football/players/16.png"},
    {id: 68, name:"لوكاس فاسكيز",number:17,position:"F",image:"https://media.api-sports.io/football/players/68.png"}
  ],
  substitutesAway:[
    {id: 3446, name:"أراوخو",number:4,position:"D",image:"https://media.api-sports.io/football/players/3446.png"},
    {id: 95, name:"غريزمان",number:7,position:"F",image:"https://media.api-sports.io/football/players/95.png"}
  ],
  coachHome:"أنشيلوتي",
  coachAway:"تشافي",
  stats:{possessionHome:55,possessionAway:45,shotsHome:10,shotsAway:8,foulsHome:12,foulsAway:14}
};

// ====== مكون التشكيلة الكامل ======
const FormationCard:React.FC<{team:string; players?:Player[]; substitutes?:Player[]; coach?:string;}> = ({team,players,substitutes,coach})=>{
  const positions:Record<string,Player[]> = {G:[],D:[],M:[],F:[]};
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
                <img src={p.image} alt={p.name}/>
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
                <img src={s.image} alt={s.name}/>
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
const AdvancedMatchDetailPage:React.FC<{fixtureId:number; goBack: () => void; canGoBack: boolean}> = ({fixtureId, goBack, canGoBack})=>{
  const [match,setMatch]=useState<MatchData>(mockData);
  const [showFormation,setShowFormation]=useState<{home:boolean,away:boolean}>({home:false,away:false});

    useEffect(()=>{
        // We are using mock data, but this keeps the structure for potential future API calls.
        // The fixtureId is available here if needed.
        const interval=setInterval(()=>{
             // In a real scenario, you would fetch data here using fixtureId
            setMatch({...mockData}); 
        },20000);
        return ()=>clearInterval(interval);
    },[fixtureId]);


  if(!match) return <p>جارٍ تحميل البيانات...</p>;

  return (
    <div className="match-page rtl font-arabic p-4 bg-light flex-1 overflow-y-auto">
        <ScreenHeader title={`${match.homeTeam} ضد ${match.awayTeam}`} onBack={goBack} canGoBack={canGoBack} />

      {/* مربع الفرق */}
      <div className="teams-box flex justify-between mb-4">
        {[
          {team:"home",name:match.homeTeam,logo:match.homeLogo},
          {team:"away",name:match.awayTeam,logo:match.awayLogo}
        ].map((t,idx)=>(
          <div key={idx} className="team-card"
            onClick={()=>setShowFormation(prev=>({home:false, away: false, [t.team]:!prev[t.team as 'home' | 'away']}))}>
            <img src={t.logo} alt={t.name} className="team-logo object-contain"/>
            <h3 className="team-name">{t.name}</h3>
          </div>
        ))}
      </div>

      {/* تشكيل كل فريق */}
      {showFormation.home && match.homeFormation && <FormationCard team={match.homeTeam} players={match.homeFormation} substitutes={match.substitutesHome} coach={match.coachHome}/>}
      {showFormation.away && match.awayFormation && <FormationCard team={match.awayTeam} players={match.awayFormation} substitutes={match.substitutesAway} coach={match.coachAway}/>}

      {/* أحداث حية */}
      {match.status==="live" && match.events && (
        <div className="live-card card mb-4">
          <h2 className="text-2xl font-bold text-center text-red-500 animate-pulse mb-2">مباشر الآن</h2>
          {match.events.map((e,idx)=>(
            <div key={idx} className={`event flex justify-between mb-1 items-center ${e.type}`}>
              <span>{e.time.elapsed}' {e.player.name}</span>
               <div className="flex items-center gap-2">
                {e.type==="Goal" && <span className="goal-icon">⚽</span>}
                {e.type==="Card" && e.detail === "Yellow Card" && <span className="card-icon yellow-card"></span>}
                {e.type==="Card" && e.detail === "Red Card" && <span className="card-icon red-card"></span>}
                {e.type==="subst" && (
                  <span className="substitution">
                    <span className="sub-out">↓ {e.assist.name}</span>
                    <span className="sub-in">↑ {e.player.name}</span>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* إحصائيات */}
      {match.stats && (
        <div className="stats-card card p-4">
          <h2 className="text-2xl font-bold mb-2 text-center">إحصائيات المباراة</h2>
          <div className="stats-grid grid grid-cols-3 gap-2 items-center">
            <div className="home-stats text-right font-bold">{match.stats.possessionHome}%</div>
            <div className="text-center text-muted-foreground">الاستحواذ</div>
            <div className="away-stats text-left font-bold">{match.stats.possessionAway}%</div>
            
            <div className="home-stats text-right font-bold">{match.stats.shotsHome}</div>
            <div className="text-center text-muted-foreground">التسديدات</div>
            <div className="away-stats text-left font-bold">{match.stats.shotsAway}</div>

            <div className="home-stats text-right font-bold">{match.stats.foulsHome}</div>
            <div className="text-center text-muted-foreground">الأخطاء</div>
            <div className="away-stats text-left font-bold">{match.stats.foulsAway}</div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdvancedMatchDetailPage;
