
"use client";

import React, { useEffect, useState } from 'react';
import type { ScreenProps } from '@/app/page';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useAdmin, useFirestore } from '@/firebase/provider';
import { doc, getDoc } from 'firebase/firestore';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'api-sports-widget': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        'data-type': string;
        'data-player-id': string;
        'data-player-statistics': string;
        'data-player-trophies': string;
        'data-player-sidelined': string;
        'data-player-transfers': string;
      };
    }
  }
}

export function PlayerDetailScreen({ goBack, canGoBack, playerId }: ScreenProps & { playerId: number }) {
  const { db } = useFirestore();
  const [displayTitle, setDisplayTitle] = useState("اللاعب");

  useEffect(() => {
    if (!playerId) return;

    const getPlayerInfo = async () => {
        try {
            // Check for a custom name in Firestore first
            if (db) {
                const customNameDocRef = doc(db, "playerCustomizations", String(playerId));
                const customNameDocSnap = await getDoc(customNameDocRef);
                if (customNameDocSnap.exists()) {
                    setDisplayTitle(customNameDocSnap.data().customName);
                    return;
                }
            }
            
            // Fallback to API if no custom name
            const playerRes = await fetch(`/api/football/players?id=${playerId}&season=2023`); // Season might be needed
            if (playerRes.ok) {
                const playerData = await playerRes.json();
                if (playerData.response?.[0]?.player?.name) {
                    setDisplayTitle(playerData.response[0].player.name);
                }
            }
        } catch (error) {
            console.error("Error fetching player info:", error);
            if (db) {
                const permissionError = new FirestorePermissionError({
                    path: `playerCustomizations/${playerId}`,
                    operation: 'get',
                });
                errorEmitter.emit('permission-error', permissionError);
            }
        }
    };
    
    getPlayerInfo();
    
  }, [db, playerId]);


  return (
    <div className="flex flex-col bg-background h-full">
      <script
        async
        src="https://widgets.api-sports.io/2.0.3/widgets.js"
      ></script>
      <ScreenHeader 
        title={displayTitle}
        onBack={goBack} 
        canGoBack={canGoBack} 
      />
      
      <div className="flex-1 overflow-y-auto p-4">
        <api-sports-widget
          data-type="player"
          data-player-id={String(playerId)}
          data-player-statistics="true"
          data-player-trophies="true"
          data-player-sidelined="true"
          data-player-transfers="true"
        ></api-sports-widget>
      </div>
    </div>
  );
}
