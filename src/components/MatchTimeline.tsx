
// --- Event Timeline Component جاهز للشعارات ---
import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RectangleVertical, Goal, ArrowLeftRight } from 'lucide-react';

interface MatchEvent {
    time: { elapsed: number; extra: number | null };
    team: { id: number; name: string; logo?: string }; // الشعار اختياري
    player: { id: number; name: string };
    assist: { id: number | null; name: string | null };
    type: 'Goal' | 'Card' | 'subst' | 'Var';
    detail: string;
    comments: string | null;
}

export default function MatchTimeline({ events, homeTeamId, getPlayerName }: { events: MatchEvent[], homeTeamId: number, getPlayerName: (id: number, defaultName: string) => string }) {
    const [filter, setFilter] = useState<'highlights' | 'all'>('all');

    const sortedEvents = useMemo(() => [...events].sort((a, b) => a.time.elapsed - b.time.elapsed), [events]);
    const filteredEvents = useMemo(() => {
        if (filter === 'highlights') return sortedEvents.filter(e => e.type === 'Goal');
        return sortedEvents;
    }, [sortedEvents, filter]);

    if (!events || events.length === 0) {
        return <div className="text-muted-foreground text-center py-4">لا توجد أحداث متاحة لعرضها.</div>
    }

    const EventIcon = ({ event }: { event: MatchEvent }) => {
        if (event.type === 'Goal') return <Goal className="h-5 w-5 text-green-500" />;
        if (event.type === 'Card' && event.detail === 'Yellow Card') return <RectangleVertical className="h-5 w-5 text-yellow-400" />;
        if (event.type === 'Card' && (event.detail === 'Red Card' || event.detail === 'Second Yellow card')) return <RectangleVertical className="h-5 w-5 text-red-500" />;
        if (event.type === 'subst') return <ArrowLeftRight className="h-4 w-4 text-blue-400" />;
        if (event.type === 'Var') return <span className="text-xs px-1 bg-gray-300 rounded">VAR</span>;
        return null;
    };

    return (
        <Card className="p-2">
            <CardContent className="p-2">
                <Tabs value={filter} onValueChange={(v) => setFilter(v as any)} className="w-full mb-2">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="all">عرض الكل</TabsTrigger>
                        <TabsTrigger value="highlights">الأبرز</TabsTrigger>
                    </TabsList>
                </Tabs>
                <div className="relative flex justify-center">
                    {/* العمود الزمني */}
                    <div className="relative flex flex-col items-center bg-white w-1.5 rounded-full mx-4" style={{ minHeight: '400px' }}>
                        {Array.from({ length: 91 }).map((_, i) => (
                            <div key={i} className="w-full h-[2px] border-b border-gray-300 relative">
                                <span className="absolute -left-10 text-xs text-white">{i + 1}'</span>
                            </div>
                        ))}
                    </div>

                    {/* أحداث المباراة */}
                    <div className="absolute inset-0 flex flex-col justify-between">
                        {filteredEvents.map((event, idx) => {
                            const isHome = event.team.id === homeTeamId;
                            return (
                                <div key={idx} className={`flex w-full justify-${isHome ? 'start' : 'end'} items-center mb-1`}>
                                    <div className={`flex items-center gap-2 p-1 rounded ${isHome ? 'bg-blue-600 text-white' : 'bg-green-600 text-white'} max-w-xs`}>
                                        {/* شعار الفريق عند توفره */}
                                        {event.team.logo && <img src={event.team.logo} alt={event.team.name} className="h-4 w-4 rounded-full" />}
                                        <span className="font-semibold text-xs">{getPlayerName(event.player.id, event.player.name)}</span>
                                        {event.assist.name && <span className="text-xs text-gray-200">({getPlayerName(event.assist.id!, event.assist.name)})</span>}
                                        <EventIcon event={event} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
};

    