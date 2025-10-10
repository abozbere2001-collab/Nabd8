"use client";
import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Goal, RectangleVertical, ArrowLeftRight, AlertTriangle } from 'lucide-react';

interface MatchEvent {
    time: { elapsed: number; extra: number | null };
    team: { id: number; name: string; logo: string };
    player: { id: number; name: string };
    assist: { id: number | null; name: string | null };
    type: 'Goal' | 'Card' | 'subst' | 'Var';
    detail: string;
    comments: string | null;
}

const EventIcon = ({ event }: { event: MatchEvent }) => {
  if (event.type === 'Goal') return <Goal className="h-4 w-4 text-yellow-300" />;
  if (event.type === 'Card' && event.detail.includes('Yellow')) return <RectangleVertical className="h-4 w-4 text-yellow-400 fill-current" />;
  if (event.type === 'Card' && event.detail.includes('Red')) return <RectangleVertical className="h-4 w-4 text-red-500 fill-current" />;
  if (event.type === 'subst') return <ArrowLeftRight className="h-4 w-4 text-blue-300" />;
  if (event.type === 'Var') return <AlertTriangle className="h-4 w-4 text-orange-400" />;
  return null;
};

export default function MatchTimeline({
  events,
  fixture,
  homeTeamId,
  getPlayerName,
}: {
  events: MatchEvent[];
  fixture: any;
  homeTeamId: number;
  getPlayerName: (id: number, defaultName: string) => string;
}) {
  const [filter, setFilter] = useState<'all' | 'highlights'>('all');

  const sortedEvents = useMemo(() => [...events].sort((a, b) => a.time.elapsed - b.time.elapsed), [events]);
  
  const filteredEvents = useMemo(() => {
    if (filter === 'highlights') return sortedEvents.filter(e => e.type === 'Goal');
    return sortedEvents;
  }, [sortedEvents, filter]);

  if (!events || events.length === 0) {
    return <div className="text-muted-foreground text-center py-4">لا توجد أحداث متاحة لعرضها.</div>
  }

  return (
    <Card className="p-2 overflow-x-hidden bg-card">
      <Tabs value={filter} onValueChange={(v) => setFilter(v as any)} className="mb-2 w-full">
        <TabsList className="grid grid-cols-2">
          <TabsTrigger value="all">عرض الكل</TabsTrigger>
          <TabsTrigger value="highlights">الأبرز</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="relative pt-4 pb-4">
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-border -translate-x-1/2"></div>
        {filteredEvents.map((event, idx) => {
          const isHome = event.team.id === homeTeamId;
          const sideClass = isHome ? "pr-[55%] justify-start" : "pl-[55%] justify-end";
          const contentClass = isHome ? "flex-row-reverse text-right" : "flex-row text-left";
          const timeClass = isHome ? "left-full ml-2" : "right-full mr-2";
          
          return (
            <div key={idx} className={`flex w-full items-center my-3 relative ${sideClass}`}>
              <div className="absolute left-1/2 -translate-x-1/2 w-3 h-3 bg-primary rounded-full border-2 border-card"></div>
              
              <div className={`flex items-center gap-2 ${contentClass}`}>
                 <div className="flex flex-col">
                    <span className="text-xs font-semibold text-foreground">{getPlayerName(event.player.id, event.player.name)}</span>
                    {event.assist.id && <span className="text-[10px] text-muted-foreground">صناعة: {getPlayerName(event.assist.id, event.assist.name!)}</span>}
                    {event.type === 'Var' && <span className="text-[10px] text-orange-400">{event.detail}</span>}
                 </div>
                 <EventIcon event={event} />
              </div>

              <div className={`absolute top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-mono ${timeClass}`}>
                  {event.time.elapsed}'{event.time.extra ? `+${event.time.extra}` : ''}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
