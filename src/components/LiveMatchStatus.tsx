
"use client";

import React, { useState, useEffect } from 'react';
import { format, isToday, isYesterday, isTomorrow } from 'date-fns';
import { ar } from 'date-fns/locale';
import type { Fixture as FixtureType } from '@/lib/types';
import { isMatchLive } from '@/lib/matchStatus';
import { cn } from '@/lib/utils';

const getRelativeDay = (date: Date) => {
    if (isToday(date)) return "اليوم";
    if (isYesterday(date)) return "الأمس";
    if (isTomorrow(date)) return "غداً";
    return format(date, "EEEE", { locale: ar });
};

// Live Timer Component
export const LiveMatchStatus = ({ fixture, large = false, customStatus }: { fixture: FixtureType, large?: boolean, customStatus?: string | null }) => {
    const { status, date } = fixture.fixture;
    const [elapsedSeconds, setElapsedSeconds] = useState<number | null>(null);
    const live = isMatchLive(status);
    const fixtureDate = new Date(date);
    const hasStarted = status.short !== 'NS' && status.short !== 'TBD' && status.short !== 'PST';

    useEffect(() => {
        let interval: NodeJS.Timeout | null = null;
        if (live && status.elapsed !== null) {
            const initialSeconds = status.elapsed * 60;
            const timerStart = Date.now() - (initialSeconds * 1000);

            interval = setInterval(() => {
                const seconds = Math.floor((Date.now() - timerStart) / 1000);
                setElapsedSeconds(seconds);
            }, 1000);
        } else {
             setElapsedSeconds(null);
        }
        
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [status.short, status.elapsed, live]);

    const formatTime = (totalSeconds: number | null) => {
        if (totalSeconds === null) return status.elapsed;
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    const liveDisplayTime = formatTime(elapsedSeconds);
    const isFinished = ['FT', 'AET', 'PEN'].includes(status.short);

    const renderStatus = () => {
        if (customStatus && customStatus.trim() && !hasStarted) {
             return {
                main: customStatus,
                sub: getRelativeDay(fixtureDate),
                isLive: false
            };
        }
        if (live) {
            return {
                main: `${fixture.goals.home ?? '-'} - ${fixture.goals.away ?? '-'}`,
                sub: status.short === 'HT' ? 'استراحة' : liveDisplayTime ? liveDisplayTime : 'مباشر',
                isLive: true
            };
        }
        if (isFinished) {
            return {
                main: `${fixture.goals.home ?? '-'} - ${fixture.goals.away ?? '-'}`,
                sub: status.long,
                isLive: false
            };
        }

        return {
            main: format(fixtureDate, "HH:mm"),
            sub: getRelativeDay(fixtureDate),
            isLive: false
        };
    };

    const { main, sub, isLive } = renderStatus();

    if (large) {
         return (
            <div className="flex flex-col items-center justify-center text-center">
                <div className="font-bold text-3xl tracking-wider">{main}</div>
                {sub && (
                    <div className={cn("text-xs mt-1", isLive ? "text-red-500 font-bold animate-pulse" : "text-muted-foreground")}>
                        {sub}
                    </div>
                )}
            </div>
        );
    }

    return (
        <>
            <div className={cn("font-bold", isLive ? "text-base" : "text-sm")}>{main}</div>
            {sub && (
                 <div className={cn("text-[10px] mt-1", isLive ? "text-red-500 font-bold animate-pulse" : "text-muted-foreground")}>
                    {sub}
                </div>
            )}
        </>
    );
};

    
