"use client";
import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Goal, RectangleVertical, ArrowLeftRight, AlertTriangle } from 'lucide-react';
import type { MatchEvent as MatchEventType } from '@/lib/types';


const EventIcon = ({ event }: { event: MatchEventType }) => {
  if (event.type === 'Goal') return <Goal className="h-4 w-4 text-primary" />;
  if (event.type === 'Card' && event.detail?.includes('Yellow')) return <RectangleVertical className="h-4 w-4 text-yellow-400 fill-current" />;
  if (event.type === 'Card' && event.detail?.includes('Red')) return <RectangleVertical className="h-4 w-4 text-red-600 fill-current" />;
  if (event.type === 'subst') return <ArrowLeftRight className="h-4 w-4 text-blue-400" />;
  if (event.type === 'Var' && event.detail?.includes('Goal Cancelled')) return <AlertTriangle className="h-4 w-4 text-destructive" />;
  return <div className="h-4 w-4" />;
};

export function MatchTimeline({ events, homeTeamId, getPlayerName }: { events: MatchEventType[]; homeTeamId: number; getPlayerName: (id: number, defaultName: string) => string; }) {
  const [filter, setFilter] = useState<'all' | 'highlights'>('all');

  const sortedEvents = useMemo(() => [...events].sort((a, b) => a.time.elapsed - b.time.elapsed), [events]);
  
  const filteredEvents = useMemo(() => {
    if (filter === 'highlights') {
      return sortedEvents.filter(e => e.type === 'Goal' || (e.type === 'Card' && e.detail?.includes('Red')));
    }
    return sortedEvents;
  }, [sortedEvents, filter]);

  if (!events || events.length === 0) {
    return <p className="text-center text-muted-foreground p-4">لا توجد مجريات متاحة لهذه المباراة.</p>;
  }

  return (
    <Card className="p-2 overflow-x-hidden">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as any)} className="mb-2 w-full">
            <TabsList className="grid grid-cols-2">
            <TabsTrigger value="all">عرض الكل</TabsTrigger>
            <TabsTrigger value="highlights">الأبرز</TabsTrigger>
            </TabsList>
        </Tabs>
        <div className="relative flex flex-col p-4">
            <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-border -translate-x-1/2"></div>
            
            {filteredEvents.map((event, idx) => {
            const isHomeEvent = event.team.id === homeTeamId;
            const content = (
                <div className="flex items-center gap-2">
                    <EventIcon event={event} />
                    <div className="flex flex-col">
                        <span className="text-sm font-semibold">{getPlayerName(event.player.id, event.player.name)}</span>
                        {event.assist?.name && event.type === 'Goal' && <span className="text-xs text-muted-foreground">صناعة: {getPlayerName(event.assist.id!, event.assist.name)}</span>}
                        {event.type === 'subst' && event.assist?.name && <span className="text-xs text-muted-foreground">خروج: {getPlayerName(event.assist.id!, event.assist.name)}</span>}
                    </div>
                </div>
            );
            const timeIndicator = (
                <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 bg-card border rounded-full h-8 w-8 flex items-center justify-center text-xs font-bold z-10">
                   {event.time.elapsed}'
                </div>
            );

            return (
                <div key={idx} className="relative flex items-center justify-center my-3 h-12">
                   {timeIndicator}
                   {isHomeEvent ? (
                       <div className="w-1/2 flex justify-start pr-8">{content}</div>
                   ) : (
                       <div className="w-1/2"></div>
                   )}
                   {isHomeEvent ? (
                       <div className="w-1/2"></div>
                   ) : (
                       <div className="w-1/2 flex justify-end pl-8">{content}</div>
                   )}
                </div>
            );
            })}
        </div>
    </Card>
  );
};
