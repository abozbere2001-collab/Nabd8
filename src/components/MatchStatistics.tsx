"use client";
import React from 'react';
import { Progress } from "@/components/ui/progress";

const STATS_TRANSLATIONS: Record<string, string> = {
  "Shots on Goal": "تسديدات على المرمى",
  "Shots off Goal": "تسديدات خارج المرمى",
  "Total Shots": "إجمالي التسديدات",
  "Blocked Shots": "تسديدات تم صدها",
  "Shots insidebox": "تسديدات من الداخل",
  "Shots outsidebox": "تسديدات من الخارج",
  "Fouls": "أخطاء",
  "Corner Kicks": "ركلات ركنية",
  "Offsides": "تسلل",
  "Ball Possession": "الاستحواذ",
  "Yellow Cards": "بطاقات صفراء",
  "Red Cards": "بطاقات حمراء",
  "Goalkeeper Saves": "تصديات الحارس",
  "Total passes": "إجمالي التمريرات",
  "Passes accurate": "تمريرات صحيحة",
  "Passes %": "دقة التمرير",
  "expected_goals": "الأهداف المتوقعة"
};

const getTranslatedStat = (type: string) => STATS_TRANSLATIONS[type] || type;

export function MatchStatistics({ homeStats, awayStats }: { homeStats?: any[], awayStats?: any[] }) {
    if (!homeStats || !awayStats || homeStats.length === 0) {
        return <p className="text-center text-muted-foreground p-4">الإحصائيات غير متاحة لهذه المباراة.</p>;
    }

    const combinedStats = [...homeStats];

    return (
        <div className="space-y-4 bg-card p-4 rounded-lg border">
            {combinedStats.map(stat => {
                const awayStat = awayStats.find(s => s.type === stat.type);
                
                let homeValueNum, awayValueNum;

                if(typeof stat.value === 'string' && stat.value.includes('%')) {
                    homeValueNum = parseInt(stat.value.replace('%', ''));
                    awayValueNum = awayStat ? parseInt(String(awayStat.value).replace('%', '')) : 0;
                } else {
                    homeValueNum = Number(stat.value) || 0;
                    awayValueNum = awayStat ? (Number(awayStat.value) || 0) : 0;
                }
                
                const total = homeValueNum + awayValueNum;
                const homePercentage = total > 0 ? (homeValueNum / total) * 100 : 50;

                return (
                    <div key={stat.type} className="space-y-1">
                        <div className="flex justify-between items-center text-sm font-semibold">
                            <span>{stat.value ?? 0}</span>
                            <span className="text-muted-foreground text-center">{getTranslatedStat(stat.type)}</span>
                            <span>{awayStat?.value ?? 0}</span>
                        </div>
                        <div className="flex items-center gap-2" dir="ltr">
                           <Progress value={homePercentage} className="h-2 flex-1" indicatorClassName="bg-primary" />
                           <Progress value={100 - homePercentage} className="h-2 flex-1 rotate-180" indicatorClassName="bg-destructive" />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
