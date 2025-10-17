

"use client";

import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import type { Fixture as FixtureType } from '@/lib/types';
import { isMatchLive } from '@/lib/matchStatus';
import { useTranslation } from './LanguageProvider';

// Live Timer Component
export const LiveMatchStatus = ({ fixture, large = false }: { fixture: FixtureType, large?: boolean }) => {
    const { t } = useTranslation();
    const { status, date } = fixture.fixture;
    const [elapsedSeconds, setElapsedSeconds] = useState<number | null>(null);
    const live = isMatchLive(status);

    useEffect(() => {
        let interval: NodeJS.Timeout | null = null;
        if (live && status.elapsed !== null) {
            // Initialize seconds based on last known elapsed minute
            const initialSeconds = status.elapsed * 60;
            setElapsedSeconds(initialSeconds);
            
            interval = setInterval(() => {
                setElapsedSeconds(prev => (prev !== null ? prev + 1 : 0));
            }, 1000);
        } else {
             setElapsedSeconds(null);
        }
        
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [status.short, status.elapsed, live]);

    const formatTime = (totalSeconds: number | null) => {
        if (totalSeconds === null) return null;
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


    if (large) {
        if (live) {
            return (
                <div className="flex flex-col items-center justify-center text-center">
                    <div className="font-bold text-3xl tracking-wider">{`${fixture.goals.home ?? '-'} - ${fixture.goals.away ?? '-'}`}</div>
                    <div className="text-red-500 font-bold text-xs animate-pulse mt-1">
                        {status.short === 'HT' ? t('halftime') : liveDisplayTime ? liveDisplayTime : t('live')}
                    </div>
                </div>
            );
        }
        if (isFinished) {
            return (
                <div className="flex flex-col items-center justify-center text-center">
                    <div className="font-bold text-3xl tracking-wider">{`${fixture.goals.home ?? '-'} - ${fixture.goals.away ?? '-'}`}</div>
                    <div className="text-xs text-muted-foreground mt-1">{getTranslatedStatus(status.long)}</div>
                </div>
            );
        }
         return (
            <div className="flex flex-col items-center justify-center text-center">
                <div className="font-bold text-2xl tracking-wider">{format(new Date(date), "HH:mm")}</div>
                <div className="text-xs text-muted-foreground mt-1">{getTranslatedStatus(status.long)}</div>
            </div>
        );

    }

    // Small version
    if (live) {
        return (
            <>
                <div className="text-red-500 font-bold text-sm animate-pulse mb-1">
                    {status.short === 'HT' ? t('halftime') : liveDisplayTime ? liveDisplayTime : t('live')}
                </div>
                <div className="font-bold text-xl">{`${fixture.goals.home ?? 0} - ${fixture.goals.away ?? 0}`}</div>
            </>
        );
    }
    
    if (isFinished) {
         return (
            <>
                <div className="font-bold text-lg">{`${fixture.goals.home ?? 0} - ${fixture.goals.away ?? 0}`}</div>
                <div className="text-xs text-muted-foreground mt-1">{t('finished')}</div>
            </>
        );
    }

    return (
        <>
            <div className="font-bold text-base">{format(new Date(date), "HH:mm")}</div>
            <div className="text-xs text-muted-foreground mt-1">{getTranslatedStatus(status.long)}</div>
        </>
    );
};
