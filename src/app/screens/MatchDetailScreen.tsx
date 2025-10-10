
"use client";
import React, { useEffect } from 'react';
import Script from 'next/script';
import type { Fixture as FixtureType } from '@/lib/types';
import { ScreenHeader } from '@/components/ScreenHeader';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'api-sports-widget': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        'data-type': string;
        'data-game-id': string;
        'data-refresh'?: string;
        'data-game-tab'?: string;
        'data-team-statistics'?: string;
        'data-player-statistics'?: string;
        'data-events'?: string;
        'data-quarters'?: string;
      };
    }
  }
}

export function MatchDetailScreen({ fixture, goBack, canGoBack }: { fixture: FixtureType; goBack: () => void; canGoBack: boolean; navigate: (screen: any, props: any) => void; }) {
  const fixtureId = fixture.fixture.id.toString();

  return (
    <div className="flex flex-col bg-background h-full">
      <Script
        id="api-sports-widget-script"
        src="https://widgets.api-sports.io/2.0.3/widgets.js"
        strategy="lazyOnload"
      />
      <ScreenHeader 
        title={`${fixture.teams.home.name} ضد ${fixture.teams.away.name}`} 
        onBack={goBack} 
        canGoBack={canGoBack} 
      />
      
      <div className="flex-1 overflow-y-auto p-4">
        <api-sports-widget
          data-type="game"
          data-game-id={fixtureId}
          data-refresh="20"
          data-game-tab="statistics"
          data-team-statistics="true"
          data-player-statistics="true"
          data-events="true"
        ></api-sports-widget>
      </div>
    </div>
  );
}
