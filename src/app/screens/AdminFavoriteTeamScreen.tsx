
"use client";

import React, { useEffect, useState, useMemo } from 'react';
import type { ScreenProps } from '@/app/page';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';
import type { Fixture } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { FixtureItem } from '@/components/FixtureItem';
import { CURRENT_SEASON } from '@/lib/constants';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { isMatchLive } from '@/lib/matchStatus';

// --- Type Definitions ---
interface GroupedFixtures {
    [competitionName: string]: {
        league: Fixture['league'];
        fixtures: Fixture[];
    };
}

interface CategorizedFixtures {
    live: GroupedFixtures;
    upcoming: GroupedFixtures;
    finished: GroupedFixtures;
}

// --- Helper Functions ---
const groupAndSortFixtures = (fixtures: Fixture[]): GroupedFixtures => {
    const grouped = fixtures.reduce((acc, fixture) => {
        const leagueName = fixture.league.name;
        if (!acc[leagueName]) {
            acc[leagueName] = { league: fixture.league, fixtures: [] };
        }
        acc[leagueName].fixtures.push(fixture);
        return acc;
    }, {} as GroupedFixtures);

    // Sort fixtures within each league by date
    Object.values(grouped).forEach(group => {
        group.fixtures.sort((a, b) => a.fixture.timestamp - b.fixture.timestamp);
    });

    return grouped;
};

// --- Sub-components ---
const FixtureGroup = ({ title, groupedFixtures, navigate, titleClassName }: { title: string, groupedFixtures: GroupedFixtures, navigate: ScreenProps['navigate'], titleClassName?: string }) => {
    const sortedCompetitions = useMemo(() => Object.keys(groupedFixtures).sort((a, b) => a.localeCompare(b)), [groupedFixtures]);
    
    if (Object.keys(groupedFixtures).length === 0) return null;

    return (
        <div className="mb-6">
            <h2 className={`text-lg font-bold mb-3 px-2 ${titleClassName}`}>{title}</h2>
            <Accordion type="multiple" className="w-full space-y-3" defaultValue={sortedCompetitions}>
                 {sortedCompetitions.map(competitionName => {
                    const { league, fixtures } = groupedFixtures[competitionName];
                    return (
                        <AccordionItem value={competitionName} key={league.id} className="border-none">
                             <AccordionTrigger className="p-2 rounded-md bg-card border hover:no-underline">
                                <div className="flex items-center gap-2">
                                    <Avatar className="h-5 w-5">
                                        <AvatarImage src={league.logo} alt={league.name} />
                                    </Avatar>
                                    <span className="font-bold text-sm truncate">{competitionName}</span>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="p-0 pt-1 space-y-1">
                                {fixtures.map(fixture => (
                                    <FixtureItem key={fixture.fixture.id} fixture={fixture} navigate={navigate} />
                                ))}
                            </AccordionContent>
                        </AccordionItem>
                    )
                })}
            </Accordion>
        </div>
    );
};


// --- Main Screen Component ---
export function AdminFavoriteTeamScreen({ navigate, goBack, canGoBack, teamId, teamName, headerActions }: ScreenProps & { teamId: number; teamName: string; headerActions?: React.ReactNode }) {
    const [categorizedFixtures, setCategorizedFixtures] = useState<CategorizedFixtures | null>(null);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    useEffect(() => {
        const fetchFixtures = async () => {
            if (!teamId) return;
            setLoading(true);
            try {
                const url = `/api/football/fixtures?team=${teamId}&season=${CURRENT_SEASON}`;
                const res = await fetch(url);
                if (!res.ok) throw new Error(`API fetch failed with status: ${res.status}`);
                
                const data = await res.json();
                const allFixtures: Fixture[] = data.response || [];

                const live: Fixture[] = [];
                const upcoming: Fixture[] = [];
                const finished: Fixture[] = [];

                allFixtures.forEach(fixture => {
                    if (isMatchLive(fixture.fixture.status)) {
                        live.push(fixture);
                    } else if (['TBD', 'NS', 'PST'].includes(fixture.fixture.status.short)) {
                        upcoming.push(fixture);
                    } else {
                        finished.push(fixture);
                    }
                });

                // Sort finished matches with most recent first
                finished.sort((a, b) => b.fixture.timestamp - a.fixture.timestamp);
                
                // Sort upcoming matches with soonest first
                upcoming.sort((a, b) => a.fixture.timestamp - b.fixture.timestamp);

                setCategorizedFixtures({
                    live: groupAndSortFixtures(live),
                    upcoming: groupAndSortFixtures(upcoming),
                    finished: groupAndSortFixtures(finished),
                });

            } catch (error) {
                console.error("Error fetching fixtures:", error);
                toast({
                    variant: "destructive",
                    title: "خطأ في الشبكة",
                    description: "فشل في جلب المباريات. يرجى التحقق من اتصالك بالإنترنت.",
                });
            } finally {
                setLoading(false);
            }
        };
        fetchFixtures();
    }, [teamId, toast]);

    return (
        <div className="flex h-full flex-col bg-background">
            <ScreenHeader title={teamName} onBack={goBack} canGoBack={canGoBack} actions={headerActions} />
            <div className="flex-1 overflow-y-auto p-2">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : categorizedFixtures && (Object.keys(categorizedFixtures.live).length > 0 || Object.keys(categorizedFixtures.upcoming).length > 0 || Object.keys(categorizedFixtures.finished).length > 0) ? (
                    <>
                        <FixtureGroup title="مباشر" groupedFixtures={categorizedFixtures.live} navigate={navigate} titleClassName="text-red-500 animate-pulse" />
                        <FixtureGroup title="القادمة" groupedFixtures={categorizedFixtures.upcoming} navigate={navigate} />
                        <FixtureGroup title="المنتهية" groupedFixtures={categorizedFixtures.finished} navigate={navigate} />
                    </>
                ) : (
                    <p className="pt-4 text-center text-muted-foreground">لا توجد مباريات متاحة لهذا الفريق.</p>
                )}
            </div>
        </div>
    );
}
