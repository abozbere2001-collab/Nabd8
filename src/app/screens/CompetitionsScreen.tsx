
"use client";

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Star, Plus, Search, Loader2, Users, Trophy, User } from 'lucide-react';
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
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


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
    }, [user, db, favorites]);

    const favoriteTeams = useMemo(() => favorites?.teams ? Object.values(favorites.teams) : [], [favorites]);
    const favoriteLeagues = useMemo(() => favorites?.leagues ? Object.values(favorites.leagues) : [], [favorites]);
    const favoritePlayers = useMemo(() => favorites?.players ? Object.values(favorites.players) : [], [favorites]);

    if (loading) {
        return (
             <div className="flex h-full flex-col bg-background">
                <ScreenHeader title="اختياراتي" canGoBack={false} onBack={() => {}} />
                <div className="p-4 space-y-4">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-40 w-full" />
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
                        <ScrollArea className="w-full whitespace-nowrap rounded-md">
                            <div className="flex w-max space-x-4 p-2">
                                {favoriteTeams.map((team, index) => (
                                    <div key={`${team.teamId}-${index}`} className="flex flex-col items-center gap-2 w-20 text-center cursor-pointer" onClick={() => navigate('TeamDetails', { teamId: team.teamId })}>
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
                
                <Tabs defaultValue="competitions" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="players"><User className="ml-1 h-4 w-4"/>اللاعبين</TabsTrigger>
                        <TabsTrigger value="teams"><Users className="ml-1 h-4 w-4"/>الفرق</TabsTrigger>
                        <TabsTrigger value="competitions"><Trophy className="ml-1 h-4 w-4"/>البطولات</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="competitions" className="mt-4">
                        <SearchSheet navigate={navigate}>
                            <Button variant="outline" className="w-full h-12 border-dashed mb-4">
                                <Plus className="ml-2 h-5 w-5"/>
                                إضافة بطولة
                            </Button>
                        </SearchSheet>
                        <div className="grid grid-cols-2 gap-4">
                            {favoriteLeagues.length > 0 ? (
                                favoriteLeagues.map((comp, index) => 
                                    <Card 
                                        key={`${comp.leagueId}-${index}`} 
                                        className="relative p-0 group cursor-pointer"
                                        onClick={() => navigate('CompetitionDetails', { title: comp.name, leagueId: comp.leagueId, logo: comp.logo })}
                                    >
                                        <CardContent className="flex flex-col items-center justify-center p-4 text-center">
                                            <img src={comp.logo} alt={comp.name} className="h-16 w-16 object-contain mb-2" />
                                            <span className="font-semibold text-sm leading-tight">{comp.name}</span>
                                        </CardContent>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="absolute top-1 right-1 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" 
                                            onClick={(e) => {e.stopPropagation(); handleFavoriteAction('league', { id: comp.leagueId })}}
                                        >
                                            <Star className="h-5 w-5 text-yellow-400 fill-current" />
                                        </Button>
                                    </Card>
                                )
                            ) : (
                                <div className="col-span-2 text-muted-foreground text-center pt-4">لم تقم بإضافة بطولات مفضلة بعد.</div>
                            )}
                        </div>
                    </TabsContent>
                    
                    <TabsContent value="teams" className="mt-4">
                        <SearchSheet navigate={navigate}>
                            <Button variant="outline" className="w-full h-12 border-dashed mb-4">
                                <Plus className="ml-2 h-5 w-5"/>
                                إضافة فريق
                            </Button>
                        </SearchSheet>
                         <div className="grid grid-cols-2 gap-4">
                             {favoriteTeams.length > 0 ? (
                                favoriteTeams.map((team, index) => 
                                    <Card 
                                        key={`${team.teamId}-${index}`}
                                        className="relative p-0 group cursor-pointer"
                                        onClick={() => navigate('TeamDetails', { teamId: team.teamId })}
                                    >
                                        <CardContent className="flex flex-col items-center justify-center p-4 text-center">
                                            <Avatar className="h-16 w-16 mb-2">
                                                <AvatarImage src={team.logo} />
                                                <AvatarFallback>{team.name.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <span className="font-semibold text-sm leading-tight">{team.name}</span>
                                        </CardContent>
                                         <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="absolute top-1 right-1 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" 
                                            onClick={(e) => { e.stopPropagation(); handleFavoriteAction('team', { id: team.teamId })}}
                                        >
                                            <Star className="h-5 w-5 text-yellow-400 fill-current" />
                                        </Button>
                                    </Card>
                                )
                            ) : (
                                <div className="col-span-2 text-muted-foreground text-center pt-4">لم تقم بإضافة فرق مفضلة بعد.</div>
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="players" className="mt-4">
                         <SearchSheet navigate={navigate}>
                            <Button variant="outline" className="w-full h-12 border-dashed mb-4">
                                <Plus className="ml-2 h-5 w-5"/>
                                إضافة لاعب
                            </Button>
                        </SearchSheet>
                        <p className="text-muted-foreground text-center pt-4">قائمة اللاعبين المفضلين قيد التطوير.</p>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}

    