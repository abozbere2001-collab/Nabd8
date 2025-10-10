
"use client";

import React, { useEffect, useState } from 'react';
import Script from 'next/script';
import type { ScreenProps } from '@/app/page';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useAdmin, useAuth, useFirestore } from '@/firebase/provider';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';

// Ensure the JSX namespace is extended to include the custom widget tag
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'api-sports-widget': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        'data-type': string;
        'data-team-id': string;
        'data-team-tab'?: string;
        'data-team-statistics'?: string;
        'data-team-squads'?: string;
      };
    }
  }
}

export function TeamDetailScreen({ goBack, canGoBack, teamId }: ScreenProps & { teamId: number }) {
  const { db } = useFirestore();
  const [displayTitle, setDisplayTitle] = useState("الفريق");

  // Fetch custom team name to display in the header
  useEffect(() => {
    if (!db || !teamId) return;

    const getTeamInfo = async () => {
        try {
            // First, check for a custom name in Firestore
            const customNameDocRef = doc(db, "teamCustomizations", String(teamId));
            const customNameDocSnap = await getDoc(customNameDocRef);
            if (customNameDocSnap.exists()) {
                setDisplayTitle(customNameDocSnap.data().customName);
                return;
            }
            
            // If no custom name, fetch from the API as a fallback
            const teamRes = await fetch(`/api/football/teams?id=${teamId}`);
            if (teamRes.ok) {
                const teamData = await teamRes.json();
                if (teamData.response?.[0]?.team?.name) {
                    setDisplayTitle(teamData.response[0].team.name);
                }
            }
        } catch (error) {
             const permissionError = new FirestorePermissionError({
                path: `teamCustomizations/${teamId}`,
                operation: 'get',
            });
            errorEmitter.emit('permission-error', permissionError);
        }
    };
    
    getTeamInfo();
    
  }, [db, teamId]);


  return (
    <div className="flex flex-col bg-background h-full">
      <Script
        id="api-sports-widget-script"
        src="https://widgets.api-sports.io/2.0.3/widgets.js"
        strategy="lazyOnload"
      />
      <ScreenHeader 
        title={displayTitle}
        onBack={goBack} 
        canGoBack={canGoBack} 
      />
      
      <div className="flex-1 overflow-y-auto p-4">
        <api-sports-widget
          data-type="team"
          data-team-id={String(teamId)}
          data-team-tab="squads"
          data-team-statistics="true"
          data-team-squads="true"
        ></api-sports-widget>
      </div>
    </div>
  );
}
