
"use client";

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Star, Plus, Search, Loader2 } from 'lucide-react';
import type { ScreenProps } from '@/app/page';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdmin, useAuth, useFirestore } from '@/firebase/provider';
import { doc, onSnapshot, updateDoc, deleteField } from 'firebase/firestore';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import type { Favorites, ManagedCompetition as ManagedCompetitionType } from '@/lib/types';
import { SearchSheet } from '@/components/SearchSheet';
import { ProfileButton } from '../AppContentWrapper';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';

// --- MAIN SCREEN COMPONENT ---
export function CompetitionsScreen({ navigate, goBack, canGoBack }: ScreenProps) {
    const { user } = useAuth();
    const { db } = useFirestore();
    const [favorites, setFavorites] = useState<Favorites | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user || !db) {
            setLoading(false);
            return;
        };
        setLoading(true);
        const docRef = doc(db, 'favorites', user.uid);
        const unsubscribe = onSnapshot(docRef, (doc) => {
            setFavorites(doc.data() as Favorites || { userId: user.uid, leagues: {}, teams: {}, players: {} });
            setLoading(false);
        }, (error) => {
            const permissionError = new FirestorePermissionError({ path: docRef.path, operation: 'get' });
            errorEmitter.emit('permission-error', permissionError);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [user, db]);

    const handleFavoriteAction = useCallback(async (type: 'league' | 'team' | 'player', item: any) => {
        if (!user || !db || !favorites) return;
        
        const favRef = doc(db, 'favorites', user.uid);
        const itemPath = `${type}s`;
        const fieldPath = `${itemPath}.${item.id}`;
        
        const isFavorited = !!(favorites as any)?.[itemPath]?.[item.id];

        if (isFavorited) {
            updateDoc(favRef, { [fieldPath]: deleteField() }).catch(serverError => {
                 const permissionError = new FirestorePermissionError({ path: favRef.path, operation: 'update' });
                 errorEmitter.emit('permission-error', permissionError);
            });
        }
        // Adding is handled via search, this component only shows/removes favorites
    }, [user, db, favorites]);

    const favoriteTeams = useMemo(() => favorites?.teams ? Object.values(favorites.teams) : [], [favorites]);
    const favoriteLeagues = useMemo(() => favorites?.leagues ? Object.values(favorites.leagues) : [], [favorites]);

    if (loading) {
        return (
             <div className="flex h-full flex-col bg-background">
                <ScreenHeader title="اختياراتي" canGoBack={false} onBack={() => {}} />
                <div className="p-4 space-y-4">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                </div>
            </div>
        )
    }

    return (
        <div className="flex h-full flex-col bg-background">
            <ScreenHeader 
                title="اختياراتي" 
                onBack={goBack} 
                canGoBack={canGoBack} 
                actions={
                  <div className="flex items-center gap-1">
                      <SearchSheet navigate={navigate}>
                          <Button variant="ghost" size="icon">
                              <Search className="h-5 w-5" />
                          </Button>
                      </SearchSheet>
                      <ProfileButton/>
                  </div>
                }
            />

            <div className="flex-1 overflow-y-auto p-4 space-y-6">

                {/* Favorite Teams Horizontal List */}
                {favoriteTeams.length > 0 && (
                    <div>
                        <h3 className="font-bold text-lg mb-2">الفرق المفضلة</h3>
                        <ScrollArea className="w-full whitespace-nowrap rounded-md">
                            <div className="flex w-max space-x-4 p-2">
                                {favoriteTeams.map(team => (
                                    <div key={team.teamId} className="flex flex-col items-center gap-2 w-20 text-center cursor-pointer" onClick={() => navigate('TeamDetails', { teamId: team.teamId })}>
                                        <Avatar className="h-12 w-12 border-2 border-primary/20">
                                            <AvatarImage src={team.logo} />
                                            <AvatarFallback>{team.name.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <span className="text-xs font-semibold truncate w-full">{team.name}</span>
                                    </div>
                                ))}
                            </div>
                            <ScrollBar orientation="horizontal" />
                        </ScrollArea>
                    </div>
                )}
                
                {/* Favorite Leagues List */}
                <div>
                     <h3 className="font-bold text-lg mb-2">البطولات المفضلة</h3>
                     <div className="space-y-2">
                        {favoriteLeagues.length > 0 ? (
                            favoriteLeagues.map(comp => 
                                <Card key={comp.leagueId} className="p-0">
                                    <div 
                                        className="flex w-full items-center justify-between p-3 group cursor-pointer"
                                    >
                                        <div className="flex items-center gap-3 flex-1" onClick={() => navigate('CompetitionDetails', { title: comp.name, leagueId: comp.leagueId, logo: comp.logo })}>
                                            <img src={comp.logo} alt={comp.name} className="h-8 w-8 object-contain" />
                                            <span className="font-semibold">{comp.name}</span>
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => handleFavoriteAction('league', { id: comp.leagueId })}>
                                            <Star className="h-6 w-6 text-yellow-400 fill-current" />
                                        </Button>
                                    </div>
                                </Card>
                            )
                        ) : (
                            <p className="text-muted-foreground text-center pt-4">لم تقم بإضافة بطولات مفضلة بعد.</p>
                        )}
                     </div>
                </div>

                 {/* Add More Button */}
                 <SearchSheet navigate={navigate}>
                    <Button variant="outline" className="w-full h-16 border-dashed">
                        <Plus className="ml-2 h-5 w-5"/>
                        إضافة فرق وبطولات أخرى
                    </Button>
                 </SearchSheet>
            </div>

        </div>
    );
}
