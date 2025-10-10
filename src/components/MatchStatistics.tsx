
"use client";

import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import type { MatchStatistics as StatsData } from '@/lib/types';
import { cn } from '@/lib/utils';

const STAT_MAP: { [key: string]: string } = {
    "Shots on Goal": "تسديدات على المرمى",
    "Shots off Goal": "تسديدات خارج المرمى",
    "Total Shots": "مجموع التسديدات",
    "Blocked Shots": "تسديدات محجوبة",
    "Shots insidebox": "تسديدات من الداخل",
    "Shots outsidebox": "تسديدات من الخارج",
    "Fouls": "الأخطاء",
    "Corner Kicks": "الركنيات",
    "Offsides": "التسلل",
    "Ball Possession": "الاستحواذ",
    "Yellow Cards": "البطاقات الصفراء",
    "Red Cards": "البطاقات الحمراء",
    "Goalkeeper Saves": "تصديات الحارس",
    "Total passes": "مجموع التمريرات",
    "Passes accurate": "تمريرات صحيحة",
    "Passes %": "دقة التمرير",
};


export function MatchStatistics({ stats }: { stats: StatsData[] }) {

    if (!stats || stats.length < 2) {
        return <p className="text-center text-muted-foreground py-8">الإحصائيات غير متاحة حاليًا.</p>;
    }
    
    const homeStats = stats[0];
    const awayStats = stats[1];

    const combinedStats = homeStats.statistics.map(homeStat => {
        const awayStat = awayStats.statistics.find(s => s.type === homeStat.type);
        return {
            type: homeStat.type,
            homeValue: homeStat.value,
            awayValue: awayStat?.value ?? 0
        };
    }).filter(s => STAT_MAP[s.type]); // Filter only for stats we want to display


    return (
        <div className="space-y-4">
             <div className="flex justify-between items-center px-4">
                <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6"><AvatarImage src={homeStats.team.logo} /></Avatar>
                    <span className="font-bold">{homeStats.team.name}</span>
                </div>
                 <div className="flex items-center gap-2">
                    <span className="font-bold">{awayStats.team.name}</span>
                    <Avatar className="h-6 w-6"><AvatarImage src={awayStats.team.logo} /></Avatar>
                </div>
            </div>
            {combinedStats.map(stat => {
                const homeVal = typeof stat.homeValue === 'string' ? parseInt(stat.homeValue.replace('%', '')) : stat.homeValue || 0;
                const awayVal = typeof stat.awayValue === 'string' ? parseInt(stat.awayValue.replace('%', '')) : stat.awayValue || 0;
                const total = homeVal + awayVal;
                const homePercentage = total > 0 ? (homeVal / total) * 100 : 50;

                return (
                    <div key={stat.type} className="space-y-1">
                        <div className="flex justify-between items-center text-sm font-semibold px-1">
                            <span>{stat.homeValue ?? 0}</span>
                            <span className="text-muted-foreground text-xs">{STAT_MAP[stat.type]}</span>
                            <span>{stat.awayValue ?? 0}</span>
                        </div>
                        <Progress 
                            value={homePercentage} 
                            indicatorClassName="bg-primary"
                            className="h-2 [&>div]:-scale-x-100"
                        />
                    </div>
                );
            })}
        </div>
    )
}
