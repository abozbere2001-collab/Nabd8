
"use client";

import React from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import type { ScreenProps } from '@/app/page';
import { cn } from '@/lib/utils';
import { CommentsButton } from '@/components/CommentsButton';
import type { Fixture as FixtureType, MatchDetails } from '@/lib/types';
import { useAdmin } from '@/firebase/provider';
import { LiveMatchStatus } from './LiveMatchStatus';

// Fixture Item Component
export const FixtureItem = React.memo(({ fixture, navigate, commentsEnabled }: { fixture: FixtureType, navigate: ScreenProps['navigate'], commentsEnabled?: boolean }) => {
    const { isAdmin } = useAdmin();
    const hasCommentsFeature = commentsEnabled || isAdmin;

    return (
      <div 
        key={fixture.fixture.id} 
        className="rounded-lg bg-card border text-sm transition-all duration-300 flex flex-col justify-between"
      >
        <div 
            className="flex-1 p-2 cursor-pointer"
            onClick={() => navigate('MatchDetails', { fixtureId: fixture.fixture.id, fixture })}
        >
         <div className="flex-1 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 justify-end truncate">
                <span className="font-semibold truncate">{fixture.teams.home.name}</span>
                <Avatar className={'h-6 w-6'}><AvatarImage src={fixture.teams.home.logo} alt={fixture.teams.home.name} /></Avatar>
            </div>
            <div className="flex flex-col items-center justify-center min-w-[80px] text-center">
                <LiveMatchStatus fixture={fixture} />
            </div>
            <div className="flex items-center gap-2 flex-1 truncate">
                <Avatar className={'h-6 w-6'}><AvatarImage src={fixture.teams.away.logo} alt={fixture.teams.away.name} /></Avatar>
                <span className="font-semibold truncate">{fixture.teams.away.name}</span>
            </div>
         </div>
        </div>
         {hasCommentsFeature && (
            <div className="mt-2 pt-2 border-t border-border/50 px-2 pb-2">
                <CommentsButton 
                  matchId={fixture.fixture.id} 
                  navigate={navigate} 
                  commentsEnabled={commentsEnabled}
                  size="sm"
                />
            </div>
         )}
      </div>
    );
});
FixtureItem.displayName = 'FixtureItem';

    