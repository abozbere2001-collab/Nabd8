
"use client";

import React from 'react';
import { Clock, Square, ArrowDown, ArrowUp, ShieldAlert } from 'lucide-react';
import type { MatchEvent } from '@/lib/types';
import './MatchTimeline.css';

// --- Helper Functions & Components ---
const getEventIcon = (event: MatchEvent) => {
    if (event.type === 'Goal') {
        return <div className="goal-icon">⚽</div>;
    }
    if (event.type === 'Card') {
        const color = event.detail.toLowerCase().includes('yellow') ? '#ffc700' : '#ff3c3c';
        return <Square className="card-icon" style={{ fill: color, color }} />;
    }
    if (event.type === 'subst') {
        return (
            <div className="substitution-icon">
                <ArrowUp className="sub-in" />
                <ArrowDown className="sub-out" />
            </div>
        );
    }
    if (event.type === 'Var') {
        return <ShieldAlert className="var-icon" />;
    }
    return <Clock />;
};

const EventDetail = ({ event }: { event: MatchEvent }) => {
    const mainPlayer = event.player.name;
    const assistPlayer = event.assist.name;

    if (event.type === 'Goal') {
        return (
            <div className="event-text">
                <span className="font-bold">{mainPlayer}</span>
                {assistPlayer && <span className="text-xs text-muted-foreground"> ({assistPlayer}  assists)</span>}
            </div>
        );
    }
    if (event.type === 'subst') {
        return (
            <div className="event-text substitution-text">
                <div className="flex items-center gap-1 sub-in"><ArrowUp size={14} /><span>{mainPlayer}</span></div>
                <div className="flex items-center gap-1 sub-out"><ArrowDown size={14} /><span>{assistPlayer}</span></div>
            </div>
        );
    }
     if (event.type === 'Var') {
        return <div className="event-text"><span className="font-bold">{event.detail}</span></div>;
    }
    return <div className="event-text"><span className="font-bold">{mainPlayer}</span></div>;
};

// --- Main Component ---
export function MatchTimeline({ events, homeTeamId }: { events: MatchEvent[], homeTeamId: number }) {

    if (!events || events.length === 0) {
        return <p className="text-center text-muted-foreground py-8">لم تبدأ المباراة بعد أو لا توجد أحداث متاحة.</p>;
    }

    return (
        <div className="timeline-container">
            <div className="timeline-line" />
            {events.map((event, index) => {
                const isHomeEvent = event.team.id === homeTeamId;
                const alignmentClass = isHomeEvent ? 'timeline-item-right' : 'timeline-item-left';

                return (
                    <div key={index} className={`timeline-item ${alignmentClass}`}>
                        <div className="timeline-icon-container">
                            <div className="timeline-icon">{getEventIcon(event)}</div>
                        </div>
                        <div className="timeline-content-container">
                            <div className="timeline-time">{event.time.elapsed}'</div>
                            <div className="timeline-content">
                                <EventDetail event={event} />
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

