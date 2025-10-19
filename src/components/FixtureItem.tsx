
"use client";

import React from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import type { ScreenProps } from '@/app/page';
import { CommentsButton } from '@/components/CommentsButton';
import type { Fixture as FixtureType } from '@/lib/types';
import { useAdmin } from '@/firebase/provider';
import { LiveMatchStatus } from './LiveMatchStatus';

export const FixtureItem = React.memo(({ fixture, navigate, commentsEnabled, customStatus }: { fixture: FixtureType, navigate: ScreenProps['navigate'], commentsEnabled?: boolean, customStatus?: string | null }) => {
    const { isAdmin } = useAdmin();
    const hasCommentsFeature = commentsEnabled || isAdmin;

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

         <div className="absolute top-1 left-1 flex items-center gap-1">
            {hasCommentsFeature && (
                <CommentsButton
                  matchId={fixture.fixture.id}
                  navigate={navigate}
                  commentsEnabled={commentsEnabled}
                  size="icon"
                />
            )}
         </div>
      </div>
    );
});
FixtureItem.displayName = 'FixtureItem';
