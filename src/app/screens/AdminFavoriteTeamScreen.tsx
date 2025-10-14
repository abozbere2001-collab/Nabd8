
"use client";

import React, { useEffect, useState } from 'react';
import type { ScreenProps } from '@/app/page';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { Fixture } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { FixtureItem } from '@/components/FixtureItem';


export function AdminFavoriteTeamScreen({ navigate, goBack, canGoBack, teamId, teamName, headerActions }: ScreenProps & { teamId: number; teamName: string; headerActions?: React.ReactNode }) {
    const [fixtures, setFixtures] = useState<Fixture[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    useEffect(() => {
        const fetchFixtures = async () => {
            if (!teamId) return;
            setLoading(true);
            try {
                const url = `/api/football/fixtures?team=${teamId}`;
                const res = await fetch(url);
                if (!res.ok) {
                    throw new Error(`API fetch failed with status: ${res.status}`);
                }
                const data = await res.json();
                setFixtures(data.response || []);
            } catch (error) {
                console.error("Error fetching fixtures in AdminFavoriteTeamScreen:", error);
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
            <div className="flex-1 overflow-y-auto p-1">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : fixtures.length > 0 ? (
                    <div className="space-y-3">
                        {fixtures.map((fixture) => (
                           <FixtureItem key={fixture.fixture.id} fixture={fixture} navigate={navigate} />
                        ))}
                    </div>
                ) : (
                    <p className="pt-4 text-center text-muted-foreground">لا توجد مباريات متاحة لهذا الفريق.</p>
                )}
            </div>
        </div>
    );
}

    