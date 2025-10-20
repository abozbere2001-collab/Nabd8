
"use client";

import React, { useState, useEffect, useRef } from 'react';
import type { ScreenProps } from '@/app/page';
import type { Team, Fixture } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { CURRENT_SEASON } from '@/lib/constants';
import { FixtureItem } from '@/components/FixtureItem';
import { isMatchLive } from '@/lib/matchStatus';

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
        <div ref={listRef} className="space-y-2 max-h-96 overflow-y-auto">
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
    if (ourBallTeams.length === 0) {
        return (
            <div className="text-center text-muted-foreground py-10 px-4">
                <p className="text-lg font-semibold">قسم "كرتنا" فارغ</p>
                <p>أضف فرقك ومنتخباتك المفضلة هنا بالضغط على زر القلب ❤️ في صفحة "كل البطولات" أو من خلال البحث.</p>
                <Button className="mt-4" onClick={() => navigate('AllCompetitions')}>استكشف البطولات</Button>
            </div>
        );
    }

    return (
        <div className="px-1 py-4">
            <Accordion type="single" collapsible className="w-full space-y-2">
                {ourBallTeams.map((team) => (
                    <AccordionItem value={`team-${team.id}`} key={team.id} className="border-b-0">
                         <AccordionTrigger className="p-3 rounded-lg border bg-card flex items-center gap-3 h-16 hover:no-underline data-[state=open]:bg-accent data-[state=open]:text-accent-foreground">
                            <div className="flex-1 flex items-center gap-3">
                                <Avatar className="h-10 w-10">
                                    <AvatarImage src={team.logo} alt={team.name} />
                                    <AvatarFallback>{team.name.substring(0, 2)}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-bold">{team.name}</p>
                                    {(team as any).note && <p className="text-xs text-muted-foreground">{(team as any).note}</p>}
                                </div>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-2">
                            <TeamFixtures teamId={team.id} navigate={navigate} />
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
        </div>
    );
}
