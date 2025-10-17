
"use client";

import React, { useState, useEffect } from 'react';
import { format, isToday, isYesterday, isTomorrow } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import type { Fixture as FixtureType } from '@/lib/types';
import { isMatchLive } from '@/lib/matchStatus';
import { useTranslation } from './LanguageProvider';
import { cn } from '@/lib/utils';

const getRelativeDay = (date: Date, lang: string) => {
    const locale = lang === 'ar' ? ar : enUS;
    if (isToday(date)) return lang === 'ar' ? "اليوم" : "Today";
    if (isYesterday(date)) return lang === 'ar' ? "الأمس" : "Yesterday";
    if (isTomorrow(date)) return lang === 'ar' ? "غداً" : "Tomorrow";
    return format(date, "EEEE", { locale });
};


// Live Timer Component
export const LiveMatchStatus = ({ fixture, large = false, customStatus }: { fixture: FixtureType, large?: boolean, customStatus?: string | null }) => {
    const { t, language } = useTranslation();
    const { status, date } = fixture.fixture;
    const [elapsedSeconds, setElapsedSeconds] = useState<number | null>(null);
    const live = isMatchLive(status);
    const fixtureDate = new Date(date);

    useEffect(() => {
        let interval: NodeJS.Timeout | null = null;
        if (live && status.elapsed !== null) {
            const initialSeconds = status.elapsed * 60;
            // Add a slight delay before starting the timer to sync with potential API lag
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

    const getTranslatedStatus = (statusLong: string) => {
        const key = statusLong.toLowerCase().replace(/ /g, '_');
        const translated = t(key);
        // Fallback to original if translation is same as key
        return translated === key ? statusLong : translated;
    }


    const renderStatus = () => {
        // Priority 1: If match is live or finished, show the score and real status.
        if (live) {
            return {
                main: `${fixture.goals.home ?? '-'} - ${fixture.goals.away ?? '-'}`,
                sub: status.short === 'HT' ? t('halftime') : liveDisplayTime ? liveDisplayTime : t('live'),
                isLive: true
            };
        }
        if (isFinished) {
            return {
                main: `${fixture.goals.home ?? '-'} - ${fixture.goals.away ?? '-'}`,
                sub: getTranslatedStatus(status.long),
                isLive: false
            };
        }

        // Priority 2: If match has not started, check for a custom admin status.
        if (customStatus) {
            return { main: customStatus, sub: null, isLive: false };
        }

        // Priority 3: If no custom status and not started, show the time and relative day.
        return {
            main: format(fixtureDate, "HH:mm"),
            sub: getRelativeDay(fixtureDate, language),
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

    // Small version
     return (
        <>
            <div className={cn("font-bold", isLive ? "text-xl" : "text-base")}>{main}</div>
            {sub && (
                 <div className={cn("text-[10px] mt-1", isLive ? "text-red-500 font-bold animate-pulse" : "text-muted-foreground")}>
                    {sub}
                </div>
            )}
        </>
    );
};
