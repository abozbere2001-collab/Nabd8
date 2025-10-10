
// AdvancedMatchDetailPage.tsx
"use client";

import React, { useEffect, useState } from "react";
import "./AdvancedMatchDetailScreen.css";

// ====== أنواع البيانات ======
interface Player { name:string; number:number; position:string; image:string; }
interface Event { type:"goal"|"yellowCard"|"redCard"|"substitution"; team:"home"|"away"; player:string; minute:number; subIn?:string; subOut?:string; }
interface Stats { possessionHome:number; possessionAway:number; shotsHome:number; shotsAway:number; foulsHome:number; foulsAway:number; }
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
    {type:"goal",team:"home",player:"مودريتش",minute:15},
    {type:"yellowCard",team:"away",player:"ميسي",minute:23},
    {type:"redCard",team:"home",player:"راموس",minute:45},
    {type:"substitution",team:"away",player:"بيكيه",minute:60,subOut:"بيكيه",subIn:"أراوخو"},
    {type:"goal",team:"away",player:"ميسي",minute:70}
  ],
  homeFormation:[
    {name:"كورتوا",number:1,position:"GK",image:"https://media.api-sports.io/football/players/184.png"},
    {name:"راموس",number:4,position:"DEF",image:"https://media.api-sports.io/football/players/145.png"},
    {name:"كارفاخال",number:2,position:"DEF",image:"https://media.api-sports.io/football/players/58.png"},
    {name:"مودريتش",number:10,position:"MID",image:"https://media.api-sports.io/football/players/14.png"},
    {name:"كروس",number:8,position:"MID",image:"https://media.api-sports.io/football/players/15.png"},
    {name:"بنزيما",number:9,position:"FWD",image:"https://media.api-sports.io/football/players/37.png"},
    {name:"فينيسيوس",number:20,position:"FWD",image:"https://media.api-sports.io/football/players/3530.png"}
  ],
  awayFormation:[
    {name:"تير شتيجن",number:1,position:"GK",image:"https://media.api-sports.io/football/players/153.png"},
    {name:"بيكيه",number:3,position:"DEF",image:"https://media.api-sports.io/football/players/154.png"},
    {name:"ألبا",number:18,position:"DEF",image:"https://media.api-sports.io/football/players/157.png"},
    {name:"بوسكيتس",number:5,position:"MID",image:"https://media.api-sports.io/football/players/164.png"},
    {name:"دي يونغ",number:21,position:"MID",image:"https://media.api-sports.io/football/players/1627.png"},
    {name:"ميسي",number:10,position:"FWD",image:"https://media.api-sports.io/football/players/874.png"},
    {name:"أوباميانغ",number:14,position:"FWD",image:"https://media.api-sports.io/football/players/94.png"}
  ],
  substitutesHome:[
    {name:"أسينسيو",number:11,position:"MID",image:"https://media.api-sports.io/football/players/16.png"},
    {name:"لوكاس فاسكيز",number:17,position:"FWD",image:"https://media.api-sports.io/football/players/68.png"}
  ],
  substitutesAway:[
    {name:"أراوخو",number:4,position:"DEF",image:"https://media.api-sports.io/football/players/3446.png"},
    {name:"غريزمان",number:7,position:"FWD",image:"https://media.api-sports.io/football/players/95.png"}
  ],
  coachHome:"أنشيلوتي",
  coachAway:"تشافي",
  stats:{possessionHome:55,possessionAway:45,shotsHome:10,shotsAway:8,foulsHome:12,foulsAway:14}
};

// ====== مكون التشكيلة الكامل ======
const FormationCard:React.FC<{team:string; players?:Player[]; substitutes?:Player[]; coach?:string;}> = ({team,players,substitutes,coach})=>{
  const positions:Record<string,Player[]> = {GK:[],DEF:[],MID:[],FWD:[]};
  if (players) {
      players.forEach(p=>{
        if(p.position.includes("GK")) positions.GK.push(p);
        else if(p.position.includes("DEF")) positions.DEF.push(p);
        else if(p.position.includes("MID")) positions.MID.push(p);
        else positions.FWD.push(p);
      });
  }


  return (
    <div className="formation-card card mb-4">
      <h3 className="text-xl font-semibold mb-2">{team}</h3>
      <div className="field">
        {["FWD","MID","DEF","GK"].map((pos,idx)=>(
          <div key={idx} className={`line ${pos}`}>
            {positions[pos].map((p,i)=>(
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

// ====== الصفحة النهائية ======
const AdvancedMatchDetailPage:React.FC<{fixtureId:number}> = ({fixtureId})=>{
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
    <div className="match-page rtl font-arabic p-4 bg-light">

      {/* مربع الفرق */}
      <div className="teams-box flex justify-between mb-4">
        {[
          {team:"home",name:match.homeTeam,logo:match.homeLogo},
          {team:"away",name:match.awayTeam,logo:match.awayLogo}
        ].map((t,idx)=>(
          <div key={idx} className="team-card"
            onClick={()=>setShowFormation(prev=>({...prev,[t.team]:!prev[t.team]}))}>
            <img src={t.logo} alt={t.name} className="team-logo"/>
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
            <div key={idx} className={`event flex justify-between mb-1 ${e.type}`}>
              <span>{e.minute}' {e.player}</span>
              <span>
                {e.type==="goal" && <span className="goal-icon">⚽</span>}
                {e.type==="yellowCard" && <span className="yellow-card">🟨</span>}
                {e.type==="redCard" && <span className="red-card">🟥</span>}
                {e.type==="substitution" && (
                  <span className={`substitution ${e.subIn?"in":"out"}`}>{e.subOut} → {e.subIn}</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

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

    </div>
  );
};

export default AdvancedMatchDetailPage;
