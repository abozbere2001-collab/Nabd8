"use client";

import React from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import type { ScreenProps } from '@/app/page';
import { CommentsButton } from '@/components/CommentsButton';
import type { Fixture as FixtureType } from '@/lib/types';
import { useAdmin } from '@/firebase/provider';
import { LiveMatchStatus } from './LiveMatchStatus';
import { cn } from '@/lib/utils';

const TeamBlock = ({ team, isHome }: { team: FixtureType['teams']['home'] | FixtureType['teams']['away'], isHome: boolean }) => {
    // In RTL, home is on the right, away is on the left.
    // We want the logo to be closer to the center score.
    const isRightSide = isHome;

    return (
        <div className={cn(
            "flex items-center gap-2 truncate",
            isRightSide ? 'flex-row-reverse justify-start' : 'justify-start'
        )}>
            <Avatar className={'h-6 w-6'}>
                <AvatarImage src={team.logo} alt={team.name} />
                <AvatarFallback>{team.name?.charAt(0) || ''}</AvatarFallback>
            </Avatar>
            <span className={cn(
                "font-semibold text-xs truncate",
                 isRightSide ? 'text-right' : 'text-left'
            )}>
                {team.name}
            </span>
        </div>
    );
};

export const FixtureItem = React.memo(({ fixture, navigate, commentsEnabled }: { fixture: FixtureType, navigate: ScreenProps['navigate'], commentsEnabled?: boolean }) => {
    const { isAdmin } = useAdmin();
    const hasCommentsFeature = commentsEnabled || isAdmin;

    return (
      <div
        key={fixture.fixture.id}
        className="relative rounded-lg bg-card border text-sm transition-all duration-300 flex flex-col justify-between"
      >
        <div
            className="flex-1 p-2 cursor-pointer"
            onClick={() => navigate('MatchDetails', { fixtureId: fixture.fixture.id, fixture })}
        >
         <main className="grid grid-cols-[1fr_auto_1fr] items-center justify-between gap-2">
            {/* Away team on the left for RTL */}
            <TeamBlock team={fixture.teams.away} isHome={false} />
            <div className="flex flex-col items-center justify-center min-w-[70px] text-center">
                <LiveMatchStatus fixture={fixture} />
            </div>
            {/* Home team on the right for RTL */}
            <TeamBlock team={fixture.teams.home} isHome={true} />
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
