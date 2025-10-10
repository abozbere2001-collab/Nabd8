
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
import { CommentsButton } from '@/components/CommentsButton';
import { useToast } from '@/hooks/use-toast';


const LiveMatchStatus = ({ fixture }: { fixture: Fixture }) => {
    const { status, date } = fixture.fixture;

    const isLive = ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE'].includes(status.short);
    const isFinished = ['FT', 'AET', 'PEN'].includes(status.short);

    if (isLive) {
        return (
            <>
                <div className="text-red-500 font-bold text-xs animate-pulse mb-1">
                    {status.elapsed ? `${status.elapsed}'` : status.long}
                </div>
                <div className="font-bold text-lg">{`${fixture.goals.home ?? 0} - ${fixture.goals.away ?? 0}`}</div>
                <div className="text-xs text-muted-foreground mt-1">{status.short === 'HT' ? 'استراحة' : 'مباشر'}</div>
            </>
        );
    }
    
    if (isFinished) {
         return (
            <>
                <div className="font-bold text-lg">{`${fixture.goals.home ?? 0} - ${fixture.goals.away ?? 0}`}</div>
                <div className="text-xs text-muted-foreground mt-1">انتهت</div>
            </>
        );
    }

    return (
        <>
            <div className="font-bold text-lg">{format(new Date(date), "HH:mm")}</div>
            <div className="text-xs text-muted-foreground mt-1">{status.long}</div>
        </>
    );
};


const FixtureItem = React.memo(({ fixture, navigate }: { fixture: Fixture, navigate: (screen: 'MatchDetails', props: any) => void }) => {
    return (
      <div 
        key={fixture.fixture.id} 
        className="rounded-lg bg-card border p-3 text-sm transition-all duration-300"
      >
        <div 
            className="hover:bg-accent/50 cursor-pointer -m-3 p-3"
            onClick={() => navigate('MatchDetails', { fixtureId: fixture.fixture.id, fixture })}
        >
         <div className="flex justify-between items-center text-xs text-muted-foreground mb-2">
              <div className="flex items-center gap-2">
                  <Avatar className="h-4 w-4">
                      <AvatarImage src={fixture.league.logo} alt={fixture.league.name} />
                      <AvatarFallback>{fixture.league.name.substring(0,1)}</AvatarFallback>
                  </Avatar>
                  <span className="truncate">{fixture.league.name}</span>
              </div>
         </div>
         <div className="flex items-center justify-between gap-2">
             <div className="flex items-center gap-2 flex-1 justify-end truncate">
                 <span className="font-semibold truncate">{fixture.teams.home.name}</span>
                 <Avatar className="h-8 w-8">
                     <AvatarImage src={fixture.teams.home.logo} alt={fixture.teams.home.name} />
                     <AvatarFallback>{fixture.teams.home.name.substring(0, 2)}</AvatarFallback>
                 </Avatar>
             </div>
             <div className="flex flex-col items-center justify-center min-w-[80px] text-center">
                 <LiveMatchStatus fixture={fixture} />
             </div>
             <div className="flex items-center gap-2 flex-1 truncate">
                  <Avatar className="h-8 w-8">
                     <AvatarImage src={fixture.teams.away.logo} alt={fixture.teams.away.name} />
                     <AvatarFallback>{fixture.teams.away.name.substring(0, 2)}</AvatarFallback>
                  </Avatar>
                 <span className="font-semibold truncate">{fixture.teams.away.name}</span>
             </div>
         </div>
        </div>
        <div className="mt-2 pt-2 border-t border-border/50">
           <CommentsButton matchId={fixture.fixture.id} navigate={navigate as any} />
        </div>
      </div>
    );
});
FixtureItem.displayName = 'FixtureItem';

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
            <div className="flex-1 overflow-y-auto p-4">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : fixtures.length > 0 ? (
                    <div className="space-y-3">
                        {fixtures.map((fixture) => (
                           <FixtureItem key={fixture.fixture.id} fixture={fixture} navigate={navigate as any} />
                        ))}
                    </div>
                ) : (
                    <p className="pt-4 text-center text-muted-foreground">لا توجد مباريات متاحة لهذا الفريق.</p>
                )}
            </div>
        </div>
    );
}

    