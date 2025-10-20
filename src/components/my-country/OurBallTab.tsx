
"use client";

import React, { useState, useEffect, useRef } from 'react';
import type { ScreenProps } from '@/app/page';
import type { Team, Fixture } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { CURRENT_SEASON } from '@/lib/constants';
import { FixtureItem } from '@/components/FixtureItem';
import { isMatchLive } from '@/lib/matchStatus';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

const TeamFixtures = ({ teamId, navigate }: { teamId: number, navigate: ScreenProps['navigate'] }) => {
    const [fixtures, setFixtures] = useState<Fixture[]>([]);
    const [loading, setLoading] = useState(true);
    const listRef = useRef<HTMLDivElement>(null);
    const firstUpcomingMatchRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let isMounted = true;
        setLoading(true);
        fetch(`/api/football/fixtures?team=${teamId}&season=${CURRENT_SEASON}`)
            .then(res => res.json())
            .then(data => {
                if (isMounted) {
                    const sortedFixtures = (data.response || []).sort((a: Fixture, b: Fixture) => a.fixture.timestamp - b.fixture.timestamp);
                    setFixtures(sortedFixtures);
                }
            })
            .catch(console.error)
            .finally(() => {
                if (isMounted) setLoading(false);
            });
        
        return () => { isMounted = false; };
    }, [teamId]);
    
    useEffect(() => {
        if (!loading && fixtures.length > 0 && listRef.current) {
            const firstUpcomingIndex = fixtures.findIndex(f => isMatchLive(f.fixture.status) || new Date(f.fixture.timestamp * 1000) > new Date());
            if (firstUpcomingIndex !== -1 && firstUpcomingMatchRef.current) {
                 setTimeout(() => {
                    if (firstUpcomingMatchRef.current && listRef.current) {
                        firstUpcomingMatchRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 300);
            }
        }
    }, [loading, fixtures]);


    if (loading) {
        return <div className="flex justify-center items-center h-40"><Loader2 className="h-6 w-6 animate-spin" /></div>;
    }

    if (fixtures.length === 0) {
        return <p className="text-center text-muted-foreground p-4">لا توجد مباريات لهذا الفريق هذا الموسم.</p>;
    }

    return (
        <div ref={listRef} className="space-y-2 max-h-96 overflow-y-auto p-2">
            {fixtures.map((fixture, index) => {
                 const isUpcomingOrLive = isMatchLive(fixture.fixture.status) || new Date(fixture.fixture.timestamp * 1000) > new Date();
                 const isFirstUpcoming = isUpcomingOrLive && !fixtures.slice(0, index).some(f => isMatchLive(f.fixture.status) || new Date(f.fixture.timestamp * 1000) > new Date());
                return (
                     <div key={fixture.fixture.id} ref={isFirstUpcoming ? firstUpcomingMatchRef : null}>
                        <FixtureItem fixture={fixture} navigate={navigate} />
                    </div>
                )
            })}
        </div>
    );
};


interface OurBallTabProps {
    navigate: ScreenProps['navigate'];
    ourBallTeams: Team[];
}

export function OurBallTab({ navigate, ourBallTeams }: OurBallTabProps) {
    const [activeTeamId, setActiveTeamId] = useState<number | null>(null);

    const handleTeamClick = (teamId: number) => {
        setActiveTeamId(prevId => (prevId === teamId ? null : teamId));
    };

    if (!ourBallTeams || ourBallTeams.length === 0) {
        return (
            <div className="text-center text-muted-foreground py-10 px-4">
                <p className="text-lg font-semibold">قسم "كرتنا" فارغ</p>
                <p>أضف فرقك ومنتخباتك المفضلة هنا بالضغط على زر القلب ❤️ في صفحة "كل البطولات" أو من خلال البحث.</p>
                <Button className="mt-4" onClick={() => navigate('AllCompetitions')}>استكشف البطولات</Button>
            </div>
        );
    }
    
    // Fallback for local storage favorites which might use teamId
    const getKey = (team: any) => team.id || team.teamId;


    return (
        <div className="px-1 py-4">
            <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex w-max space-x-4 px-4 flex-row-reverse">
                    {ourBallTeams.map((team, index) => (
                        <div
                            key={getKey(team)}
                            onClick={() => handleTeamClick(getKey(team))}
                            className={cn(
                                "flex flex-col items-center gap-2 w-20 text-center cursor-pointer transition-transform duration-200",
                                activeTeamId === getKey(team) ? "scale-110" : "scale-100"
                            )}
                        >
                            <Avatar className={cn("h-14 w-14 border-2 transition-colors", activeTeamId === getKey(team) ? "border-primary" : "border-border")}>
                                <AvatarImage src={team.logo} />
                                <AvatarFallback>{team.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span className="text-xs font-medium truncate w-full">{team.name}</span>
                        </div>
                    ))}
                </div>
                <ScrollBar orientation="horizontal" className="h-1.5 mt-2" />
            </ScrollArea>
            
            <div className="mt-4 px-2 space-y-2">
                {ourBallTeams.map(team => (
                    <Collapsible key={getKey(team)} open={activeTeamId === getKey(team)} onOpenChange={() => handleTeamClick(getKey(team))}>
                        <CollapsibleContent>
                            <TeamFixtures teamId={getKey(team)} navigate={navigate} />
                        </CollapsibleContent>
                    </Collapsible>
                ))}
            </div>
        </div>
    );
}
