"use client";

import React, { useEffect, useState, useMemo } from 'react';
import type { ScreenProps } from '@/app/page';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Loader2 } from 'lucide-react';
import type { Fixture } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { FixtureItem } from '@/components/FixtureItem';
import { CURRENT_SEASON } from '@/lib/constants';
import { isMatchLive } from '@/lib/matchStatus';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// --- Type Definitions ---
interface CategorizedFixtures {
    live: Fixture[];
    upcoming: Fixture[];
    finished: Fixture[];
}

// --- Helper Functions ---
const FixtureGroup = ({ title, fixtures, navigate, titleClassName }: { title: string, fixtures: Fixture[], navigate: ScreenProps['navigate'], titleClassName?: string }) => {
    if (fixtures.length === 0) return null;

    return (
        <div className="mb-4">
            <h2 className={cn("text-md font-bold mb-2 px-2 text-primary", titleClassName)}>{title}</h2>
            <div className="space-y-2">
                {fixtures.map(fixture => (
                    <FixtureItem key={fixture.fixture.id} fixture={fixture} navigate={navigate} />
                ))}
            </div>
        </div>
    );
};


// --- Main Screen Component ---
export function AdminFavoriteTeamScreen({ navigate, goBack, canGoBack, teamId, teamName }: ScreenProps & { teamId: number; teamName: string; }) {
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
                    live: live,
                    upcoming: upcoming,
                    finished: finished,
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
            <ScreenHeader title={teamName} onBack={goBack} canGoBack={canGoBack} />
            <div className="flex-1 overflow-y-auto p-2">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : categorizedFixtures && (categorizedFixtures.live.length > 0 || categorizedFixtures.upcoming.length > 0 || categorizedFixtures.finished.length > 0) ? (
                    <>
                        <FixtureGroup title="مباشر" fixtures={categorizedFixtures.live} navigate={navigate} titleClassName="text-red-500 animate-pulse" />
                        <FixtureGroup title="القادمة" fixtures={categorizedFixtures.upcoming} navigate={navigate} />
                        <FixtureGroup title="المنتهية" fixtures={categorizedFixtures.finished} navigate={navigate} />
                    </>
                ) : (
                    <Card className="mt-4">
                        <CardContent className="p-6">
                            <p className="text-center text-muted-foreground">لا توجد مباريات متاحة لهذا الفريق.</p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
