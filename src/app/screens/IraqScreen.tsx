
"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ScreenProps } from '@/app/page';
import { useFirestore, useAdmin, useAuth } from '@/firebase/provider';
import { collection, onSnapshot, doc, getDoc } from 'firebase/firestore';
import type { PinnedMatch, Team } from '@/lib/types';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { Button } from '@/components/ui/button';
import { Search, Pin, Edit, Loader2 } from 'lucide-react';
import { SearchSheet } from '@/components/SearchSheet';
import { ProfileButton } from '../AppContentWrapper';
import { OurLeagueTab } from '@/components/my-country/OurLeagueTab';
import { OurBallTab } from '@/components/my-country/OurBallTab';
import { getLocalFavorites } from '@/lib/local-favorites';

function PinnedMatchCard({ match, onManage, isAdmin }: { match: PinnedMatch, onManage: () => void, isAdmin: boolean}) {
    if (!match.isEnabled) return null;

    return (
        <div className="mb-4 border-primary/50 border-2 rounded-lg p-3 relative bg-card">
            <div className="flex items-center justify-center text-center mb-2">
                 <Pin className="h-4 w-4 text-primary mr-2" />
                <p className="text-sm font-bold text-primary">مباراة مثبتة</p>
            </div>
             <div className="flex-1 flex items-center justify-between gap-1">
                <div className="flex items-center gap-2 flex-1 justify-end truncate">
                    <span className="font-semibold text-sm truncate">{match.homeTeamName}</span>
                    <img src={match.homeTeamLogo} alt={match.homeTeamName} className="h-8 w-8 object-contain" />
                </div>
                <div className="flex flex-col items-center justify-center min-w-[90px] text-center">
                    <div className="font-bold text-lg">{match.matchTime}</div>
                    <div className="text-xs text-muted-foreground mt-1">{match.matchDate}</div>
                </div>
                <div className="flex items-center gap-2 flex-1 truncate">
                    <img src={match.awayTeamLogo} alt={match.awayTeamName} className="h-8 w-8 object-contain" />
                    <span className="font-semibold text-sm truncate">{match.awayTeamName}</span>
                </div>
             </div>
             <p className="text-center text-xs text-muted-foreground mt-2">{match.competitionName}</p>
             {isAdmin && (
                 <Button variant="ghost" size="sm" className="absolute top-1 left-1" onClick={onManage}>
                     <Edit className="h-4 w-4 mr-1"/>
                     تعديل
                 </Button>
             )}
        </div>
    );
}

export function IraqScreen({ navigate, goBack, canGoBack }: ScreenProps) {
    const { user, db } = useAuth();
    const { isAdmin } = useAdmin();
    
    const [ourLeagueId, setOurLeagueId] = useState<number | null>(null);
    const [ourBallTeams, setOurBallTeams] = useState<Team[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [pinnedMatches, setPinnedMatches] = useState<PinnedMatch[]>([]);
    const [leagueDetails, setLeagueDetails] = useState<{ id: number; name: string; logo: string; } | null>(null);
    const [loadingLeague, setLoadingLeague] = useState(false);


    useEffect(() => {
      let leagueUnsub: (() => void) | null = null;
      let teamsUnsub: (() => void) | null = null;
      
      setIsLoading(true);

      if (user && db) {
        // --- Setup Firestore listeners for logged-in user ---

        const ourLeagueRef = doc(db, 'users', user.uid, 'ourFavorites', 'league');
        leagueUnsub = onSnapshot(ourLeagueRef, (docSnap) => {
            if (docSnap.exists()) {
                setOurLeagueId(docSnap.data().leagueId);
            } else {
                setOurLeagueId(null);
            }
             setIsLoading(false);
        }, (error) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ourLeagueRef.path, operation: 'get' }));
            setIsLoading(false);
        });
        
        const ourTeamsRef = doc(db, 'users', user.uid, 'ourFavorites', 'teams');
        teamsUnsub = onSnapshot(ourTeamsRef, (docSnap) => {
            if (docSnap.exists()) {
                setOurBallTeams(Object.values(docSnap.data()));
            } else {
                setOurBallTeams([]);
            }
             setIsLoading(false);
        }, (error) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ourTeamsRef.path, operation: 'get' }));
             setIsLoading(false);
        });

      } else {
        // --- Fallback to local storage for guest user ---
        const localFavs = getLocalFavorites();
        setOurLeagueId(localFavs.ourLeagueId || null);
        setOurBallTeams(Object.values(localFavs.ourBallTeams || {}));
        setIsLoading(false);
      }
      
      return () => {
        if (leagueUnsub) leagueUnsub();
        if (teamsUnsub) teamsUnsub();
      };
    }, [user, db]);

    useEffect(() => {
        if (ourLeagueId) {
            setLoadingLeague(true);
             getDoc(doc(db, 'managedCompetitions', String(ourLeagueId)))
                .then(docSnap => {
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        setLeagueDetails({ id: ourLeagueId, name: data.name, logo: data.logo });
                    } else {
                        // Fallback if not in managed competitions
                         setLeagueDetails({ id: ourLeagueId, name: `League ${ourLeagueId}`, logo: `https://media.api-sports.io/football/leagues/${ourLeagueId}.png` });
                    }
                })
                .catch(console.error)
                .finally(() => setLoadingLeague(false));
        } else {
            setLeagueDetails(null);
        }
    }, [ourLeagueId, db]);


    useEffect(() => {
        if (!db) return;
        const pinnedMatchesRef = collection(db, 'pinnedIraqiMatches');
        const q = query(pinnedMatchesRef);
        const unsub = onSnapshot(q, (snapshot) => {
            setPinnedMatches(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as PinnedMatch)));
        }, (serverError) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'pinnedIraqiMatches', operation: 'list' }));
        });
        return () => unsub();
    }, [db]);


    return (
        <div className="flex h-full flex-col bg-background">
            <ScreenHeader
                title={"بلدي"}
                onBack={goBack}
                canGoBack={canGoBack}
                actions={
                    <div className="flex items-center gap-1">
                        <SearchSheet navigate={navigate}>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                                <Search className="h-5 w-5" />
                            </Button>
                        </SearchSheet>
                        <ProfileButton />
                    </div>
                }
            />
            
            {isLoading ? (
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary"/>
                </div>
            ) : (
                <div className="flex-1 flex flex-col min-h-0">
                    <div className="px-4 pt-4">
                        {pinnedMatches.map(match => (
                            <PinnedMatchCard
                                key={match.id}
                                match={match}
                                onManage={() => navigate('ManagePinnedMatch', { matchId: match.id })}
                                isAdmin={isAdmin}
                            />
                        ))}
                        {isAdmin && pinnedMatches.filter(m => m.isEnabled).length === 0 && (
                            <Button className="w-full mb-2" onClick={() => navigate('ManagePinnedMatch', { matchId: null })}>
                                <Pin className="ml-2 h-4 w-4" />
                                إضافة مباراة للتثبيت
                            </Button>
                        )}
                    </div>

                    <Tabs defaultValue="our-ball" className="w-full flex-1 flex flex-col min-h-0">
                        <div className="sticky top-0 bg-background z-10 px-1 pt-1">
                             <div className="bg-card text-card-foreground rounded-b-lg border-x border-b shadow-md">
                                <TabsList className="grid w-full grid-cols-2 flex-row-reverse h-11 bg-transparent p-0">
                                    <TabsTrigger value="our-ball">كرتنا</TabsTrigger>
                                    <TabsTrigger value="our-league">دورينا</TabsTrigger>
                                </TabsList>
                            </div>
                        </div>
                        <TabsContent value="our-league" className="flex-1 overflow-auto">
                             <OurLeagueTab
                                navigate={navigate}
                                leagueDetails={leagueDetails}
                                isLoading={loadingLeague}
                            />
                        </TabsContent>
                        <TabsContent value="our-ball" className="pt-0 flex-1 overflow-auto">
                            <OurBallTab navigate={navigate} ourBallTeams={ourBallTeams} />
                        </TabsContent>
                    </Tabs>
                </div>
            )}
        </div>
    );
}

