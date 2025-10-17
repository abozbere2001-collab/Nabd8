"use client";

import React from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import type { ScreenProps } from '@/app/page';
import { CommentsButton } from '@/components/CommentsButton';
import type { Fixture as FixtureType } from '@/lib/types';
import { useAdmin } from '@/firebase/provider';
import { LiveMatchStatus } from './LiveMatchStatus';
import { useTranslation } from 'react-i18next';

const TeamBlock = ({ team, isHome, isRTL }: { team: FixtureType['teams']['home'] | FixtureType['teams']['away'], isHome: boolean, isRTL: boolean }) => {
    const isLeftSide = isRTL ? !isHome : isHome; // يحدد من جهة اليسار
    return (
        <div className={`flex items-center gap-2 truncate ${isLeftSide ? 'justify-end' : 'justify-start'}`}>
            {isLeftSide ? (
                <>
                    <span className="font-semibold text-xs truncate text-right">{team.name}</span>
                    <Avatar className={'h-6 w-6'}>
                        <AvatarImage src={team.logo} alt={team.name} />
                        <AvatarFallback>{team.name?.charAt(0) || ''}</AvatarFallback>
                    </Avatar>
                </>
            ) : (
                <>
                    <Avatar className={'h-6 w-6'}>
                        <AvatarImage src={team.logo} alt={team.name} />
                        <AvatarFallback>{team.name?.charAt(0) || ''}</AvatarFallback>
                    </Avatar>
                    <span className="font-semibold text-xs truncate text-left">{team.name}</span>
                </>
            )}
        </div>
    );
};

export const FixtureItem = React.memo(({ fixture, navigate, commentsEnabled }: { fixture: FixtureType, navigate: ScreenProps['navigate'], commentsEnabled?: boolean }) => {
    const { isAdmin } = useAdmin();
    const hasCommentsFeature = commentsEnabled || isAdmin;
    const { i18n } = useTranslation();
    const isRTL = i18n.language === 'ar';

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
            <TeamBlock team={fixture.teams.home} isHome={true} isRTL={isRTL} />
            <div className="flex flex-col items-center justify-center min-w-[70px] text-center">
                <LiveMatchStatus fixture={fixture} />
            </div>
            <TeamBlock team={fixture.teams.away} isHome={false} isRTL={isRTL} />
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