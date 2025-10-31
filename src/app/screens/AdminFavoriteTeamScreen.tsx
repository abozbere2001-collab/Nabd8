

"use client";

import React, { useEffect, useState, useRef } from 'react';
import type { ScreenProps } from '@/app/page';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Loader2 } from 'lucide-react';
import type { Fixture } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { FixtureItem } from '@/components/FixtureItem';
import { CURRENT_SEASON } from '@/lib/constants';
import { isMatchLive } from '@/lib/matchStatus';
import { Card, CardContent } from '@/components/ui/card';

const API_KEY = process.env.API_FOOTBALL_KEY;


// --- Main Screen Component ---
export function AdminFavoriteTeamScreen({ navigate, goBack, canGoBack, teamId, teamName }: ScreenProps & { teamId: number; teamName: string; }) {
    const [allFixtures, setAllFixtures] = useState<Fixture[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();
    const listRef = useRef<HTMLDivElement>(null);
    const firstUpcomingMatchRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchFixtures = async () => {
            if (!teamId) {
                setLoading(false);
                return
            };
            setLoading(true);
            try {
                const url = `/api/football/fixtures?team=${teamId}&season=${CURRENT_SEASON}`;
                const res = await fetch(url, { headers: { 'x-rapidapi-key': API_KEY! } });
                if (!res.ok) throw new Error(`API fetch failed with status: ${res.status}`);
                
                const data = await res.json();
                const fixtures: Fixture[] = data.response || [];
                fixtures.sort((a, b) => a.fixture.timestamp - b.fixture.timestamp);
                setAllFixtures(fixtures);
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

    useEffect(() => {
        if (!loading && allFixtures.length > 0 && listRef.current) {
            const firstUpcomingIndex = allFixtures.findIndex(f => isMatchLive(f.fixture.status) || new Date(f.fixture.timestamp * 1000) > new Date());
            if (firstUpcomingIndex !== -1 && firstUpcomingMatchRef.current) {
                // Use a small timeout to ensure the DOM is ready for scrolling
                setTimeout(() => {
                    if (firstUpcomingMatchRef.current && listRef.current) {
                        const listTop = listRef.current.offsetTop;
                        const itemTop = firstUpcomingMatchRef.current.offsetTop;
                        listRef.current.scrollTop = itemTop - listTop;
                    }
                }, 100);
            }
        }
    }, [loading, allFixtures]);

    return (
        <div className="flex h-full flex-col bg-background">
            <ScreenHeader title={teamName} onBack={goBack} canGoBack={canGoBack} />
            <div ref={listRef} className="flex-1 overflow-y-auto p-2">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : allFixtures.length > 0 ? (
                    <div className="space-y-2">
                        {allFixtures.map((fixture, index) => {
                             const isUpcomingOrLive = isMatchLive(fixture.fixture.status) || new Date(fixture.fixture.timestamp * 1000) > new Date();
                             const isFirstUpcoming = isUpcomingOrLive && !allFixtures.slice(0, index).some(f => isMatchLive(f.fixture.status) || new Date(f.fixture.timestamp * 1000) > new Date());
                            
                            return (
                                <div key={fixture.fixture.id} ref={isFirstUpcoming ? firstUpcomingMatchRef : null}>
                                    <FixtureItem fixture={fixture} navigate={navigate} />
                                </div>
                            );
                        })}
                    </div>
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
