"use client";

import React from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import type { ScreenProps } from '@/app/page';
import { CommentsButton } from '@/components/CommentsButton';
import type { Fixture as FixtureType } from '@/lib/types';
import { useAdmin } from '@/firebase/provider';
import { LiveMatchStatus } from './LiveMatchStatus';

const HomeTeamDisplay = ({ team }: { team: FixtureType['teams']['home'] }) => (
    <div className="flex flex-col items-center gap-1 flex-1 truncate">
        <Avatar className={'h-8 w-8 flex-shrink-0'}>
            <AvatarImage src={team.logo} alt={team.name} />
            <AvatarFallback>{team.name?.charAt(0) || ''}</AvatarFallback>
        </Avatar>
        <span className="font-semibold text-xs truncate text-center w-full">{team.name}</span>
    </div>
);

const AwayTeamDisplay = ({ team }: { team: FixtureType['teams']['away'] }) => (
    <div className="flex flex-col items-center gap-1 flex-1 truncate">
        <Avatar className={'h-8 w-8 flex-shrink-0'}>
            <AvatarImage src={team.logo} alt={team.name} />
            <AvatarFallback>{team.name?.charAt(0) || ''}</AvatarFallback>
        </Avatar>
        <span className="font-semibold text-xs truncate text-center w-full">{team.name}</span>
    </div>
);

export const FixtureItem = React.memo(({ fixture, navigate, commentsEnabled }: { fixture: FixtureType, navigate: ScreenProps['navigate'], commentsEnabled?: boolean }) => {
    const { isAdmin } = useAdmin();
    const hasCommentsFeature = commentsEnabled || isAdmin;

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
            <HomeTeamDisplay team={fixture.teams.home} />
            <div className="flex flex-col items-center justify-center min-w-[70px] pt-1 text-center">
                <LiveMatchStatus fixture={fixture} />
            </div>
            <AwayTeamDisplay team={fixture.teams.away} />
         </main>
        </div>

         <div className="absolute top-1 right-1 flex items-center gap-1">
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
