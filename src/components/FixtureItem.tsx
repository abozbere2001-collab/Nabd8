
"use client";

import React from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import type { ScreenProps } from '@/app/page';
import type { Fixture as FixtureType } from '@/lib/types';
import { useAdmin, useFirestore } from '@/firebase/provider';
import { LiveMatchStatus } from './LiveMatchStatus';
import { Button } from './ui/button';
import { Crown, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';

export const FixtureItem = React.memo(({ fixture, navigate, customStatus, isPinnedForPrediction, onPinToggle }: { fixture: FixtureType, navigate: ScreenProps['navigate'], customStatus?: string | null, isPinnedForPrediction?: boolean, onPinToggle?: (fixture: FixtureType) => void }) => {
    const { isAdmin } = useAdmin();

    const HomeTeamDisplay = () => (
        <div className="flex flex-col items-center gap-1 flex-1 truncate">
            <Avatar className={'h-8 w-8 flex-shrink-0'}>
                <AvatarImage src={fixture.teams.home.logo} alt={fixture.teams.home.name} />
                <AvatarFallback>{fixture.teams.home.name?.charAt(0) || ''}</AvatarFallback>
            </Avatar>
            <span className="font-semibold text-xs truncate text-center w-full">{fixture.teams.home.name}</span>
        </div>
    );

    const AwayTeamDisplay = () => (
        <div className="flex flex-col items-center gap-1 flex-1 truncate">
            <Avatar className={'h-8 w-8 flex-shrink-0'}>
                <AvatarImage src={fixture.teams.away.logo} alt={fixture.teams.away.name} />
                <AvatarFallback>{fixture.teams.away.name?.charAt(0) || ''}</AvatarFallback>
            </Avatar>
            <span className="font-semibold text-xs truncate text-center w-full">{fixture.teams.away.name}</span>
        </div>
    );

    return (
      <div
        key={fixture.fixture.id}
        className="relative rounded-lg bg-card border text-sm transition-all duration-300 flex flex-col justify-between"
      >
        {isAdmin && onPinToggle && (
            <Button
                variant="ghost"
                size="icon"
                className="absolute top-1 right-1 h-7 w-7 z-10"
                onClick={(e) => { e.stopPropagation(); onPinToggle(fixture); }}
            >
                <Crown className={cn("h-4 w-4 text-muted-foreground", isPinnedForPrediction && "text-yellow-400 fill-current")} />
            </Button>
        )}
        <div
            className="flex-1 p-3 cursor-pointer"
            onClick={() => navigate('MatchDetails', { fixtureId: fixture.fixture.id, fixture })}
        >
         <main className="flex items-start justify-between gap-2">
            <AwayTeamDisplay />
            <div className="flex flex-col items-center justify-center min-w-[70px] pt-1 text-center">
                <LiveMatchStatus fixture={fixture} customStatus={customStatus}/>
            </div>
            <HomeTeamDisplay />
         </main>
        </div>
      </div>
    );
});
FixtureItem.displayName = 'FixtureItem';
