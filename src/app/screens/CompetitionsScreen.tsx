
"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Star, Plus, Users, Trophy, User as PlayerIcon, Search, Bell } from 'lucide-react';
import type { ScreenProps } from '@/app/page';
import { Button } from '@/components/ui/button';
import { useAuth, useFirestore } from '@/firebase/provider';
import { doc, onSnapshot, getDocs, collection } from 'firebase/firestore';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import type { Favorites, ManagedCompetition } from '@/lib/types';
import { SearchSheet } from '@/components/SearchSheet';
import { ProfileButton } from '../AppContentWrapper';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// --- MAIN SCREEN COMPONENT ---
export function CompetitionsScreen({ navigate, goBack, canGoBack }: ScreenProps) {
    const { user } = useAuth();
    const { db } = useFirestore();
    const { toast } = useToast();
    const [favorites, setFavorites] = useState<Favorites | null>(null);
    const [loading, setLoading] = useState(true);
    const [customNames, setCustomNames] = useState<{ leagues: Map<number, string>, teams: Map<number, string> }>({ leagues: new Map(), teams: new Map() });


    const fetchAllCustomNames = useCallback(async () => {
        if (!db) return;
        try {
            const [leaguesSnapshot, teamsSnapshot] = await Promise.all([
                getDocs(collection(db, 'leagueCustomizations')),
                getDocs(collection(db, 'teamCustomizations'))
            ]);
            
            const leagueNames = new Map<number, string>();
            leaguesSnapshot.forEach(doc => leagueNames.set(Number(doc.id), doc.data().customName));

            const teamNames = new Map<number, string>();
            teamsSnapshot.forEach(doc => teamNames.set(Number(doc.id), doc.data().customName));
            
            setCustomNames({ leagues: leagueNames, teams: teamNames });

        } catch (error) {
            const permissionError = new FirestorePermissionError({ path: 'customizations collections', operation: 'list' });
            errorEmitter.emit('permission-error', permissionError);
        }
    }, [db]);

     const getDisplayName = useCallback((type: 'league' | 'team', id: number, defaultName: string) => {
        const key = `${type}s` as 'leagues' | 'teams';
        const map = customNames[key] as Map<number, string>;
        return map?.get(id) || defaultName;
    }, [customNames]);


    useEffect(() => {
        if (!user || !db) {
            setLoading(false);
            return;
        };
        setLoading(true);
        fetchAllCustomNames();
        const docRef = doc(db, 'favorites', user.uid);
        const unsubscribe = onSnapshot(docRef, (doc) => {
            const favs = (doc.data() as Favorites) || { userId: user.uid, leagues: {}, teams: {}, players: {} };
            setFavorites(favs);
            setLoading(false);
        }, (error) => {
            const permissionError = new FirestorePermissionError({ path: docRef.path, operation: 'get' });
            errorEmitter.emit('permission-error', permissionError);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [user, db, fetchAllCustomNames]);


    const favoriteTeams = useMemo(() => {
      if (!favorites?.teams) return [];
      return Object.values(favorites.teams).map(team => ({
        ...team,
        name: getDisplayName('team', team.teamId, team.name)
      }));
    }, [favorites, getDisplayName]);

    const favoriteLeagues = useMemo(() => {
        if (!favorites?.leagues) return [];
        return Object.values(favorites.leagues).map(comp => ({
            ...comp,
            name: getDisplayName('league', comp.leagueId, comp.name)
        }));
    }, [favorites, getDisplayName]);

    const favoritePlayers = useMemo(() => favorites?.players ? Object.values(favorites.players) : [], [favorites]);

    const AddChoiceCard = () => (
        <SearchSheet navigate={navigate}>
            <div className="flex flex-col items-center justify-center gap-2 text-center p-2 rounded-2xl border-2 border-dashed border-muted-foreground/50 h-full w-full cursor-pointer hover:bg-accent/50 transition-colors">
                <div className="flex items-center justify-center h-10 w-10 bg-primary/10 rounded-full">
                    <Plus className="h-6 w-6 text-primary" />
                </div>
            </div>
        </SearchSheet>
    );

    return (
        <div className="flex h-full flex-col bg-background">
             <ScreenHeader 
                title="" 
                onBack={goBack} 
                canGoBack={canGoBack} 
                actions={
                  <div className="flex items-center gap-1">
                      <SearchSheet navigate={navigate}>
                          <Button variant="ghost" size="icon">
                              <Search className="h-5 w-5" />
                          </Button>
                      </SearchSheet>
                      <ProfileButton />
                  </div>
                }
            />
            <div className="flex-1 flex flex-col min-h-0">
                <Tabs defaultValue="my-choices" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 bg-transparent px-4">
                        <TabsTrigger value="notifications" onClick={() => navigate('Notifications')}>إشعارات</TabsTrigger>
                        <TabsTrigger value="my-choices">اختياراتي</TabsTrigger>
                    </TabsList>
                </Tabs>
                
                <div className="flex-1 overflow-y-auto">
                     <div className="space-y-6 py-4">
                        <ScrollArea className="w-full whitespace-nowrap">
                            <div className="flex w-max space-x-4 px-4 flex-row-reverse">
                                 <div className="flex flex-col items-center gap-2 w-20 h-[84px] text-center">
                                     <SearchSheet navigate={navigate}>
                                        <div className="flex flex-col items-center justify-center h-14 w-14 bg-card rounded-full cursor-pointer hover:bg-accent/50 transition-colors">
                                            <Plus className="h-6 w-6 text-primary" />
                                        </div>
                                     </SearchSheet>
                                      <span className="text-xs font-medium truncate w-full text-primary">أضف</span>
                                </div>
                                {favoriteTeams.map((team, index) => (
                                    <div key={`${team.teamId}-${index}`} className="relative flex flex-col items-center gap-2 w-20 text-center cursor-pointer" onClick={() => navigate('TeamDetails', { teamId: team.teamId })}>
                                        <Avatar className="h-14 w-14 border-2 border-border">
                                            <AvatarImage src={team.logo} />
                                            <AvatarFallback>{team.name.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <span className="text-xs font-medium truncate w-full">{team.name}</span>
                                        <Star className="absolute top-0 right-0 h-4 w-4 text-yellow-400 fill-current" />
                                    </div>
                                ))}
                            </div>
                            <ScrollBar orientation="horizontal" className="h-1.5 mt-2" />
                        </ScrollArea>

                        <Tabs defaultValue="teams" className="w-full px-4">
                             <TabsList className="grid w-full grid-cols-3 bg-card text-card-foreground">
                                <TabsTrigger value="players"><PlayerIcon className="ml-1 h-4 w-4"/>اللاعبين</TabsTrigger>
                                <TabsTrigger value="competitions"><Trophy className="ml-1 h-4 w-4"/>منافسات</TabsTrigger>
                                <TabsTrigger value="teams"><Users className="ml-1 h-4 w-4"/>فرق</TabsTrigger>
                            </TabsList>
                            
                            <TabsContent value="teams" className="mt-4">
                                <div className="grid grid-cols-4 gap-4">
                                     <div className="h-[76px] w-full">
                                        <AddChoiceCard />
                                    </div>
                                    {favoriteTeams.map((team, index) => 
                                        <div key={`${team.teamId}-${index}`} className="relative flex flex-col items-center justify-center gap-2 text-center p-2 rounded-2xl cursor-pointer h-[76px]" onClick={() => navigate('TeamDetails', { teamId: team.teamId })}>
                                            <Avatar className="h-12 w-12 border-2 border-border">
                                                <AvatarImage src={team.logo} />
                                                <AvatarFallback>{team.name.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <span className="text-[11px] font-medium truncate w-full">{team.name}</span>
                                            <Star className="absolute top-1 right-1 h-3 w-3 text-yellow-400 fill-current" />
                                        </div>
                                    )}
                                </div>
                            </TabsContent>
                            
                            <TabsContent value="competitions" className="mt-4">
                                <div className="grid grid-cols-4 gap-4">
                                    <div className="h-[76px] w-full">
                                        <AddChoiceCard />
                                    </div>
                                    {favoriteLeagues.map((comp, index) => 
                                        <div key={`${comp.leagueId}-${index}`} className="relative flex flex-col items-center justify-center gap-2 text-center p-2 rounded-2xl cursor-pointer h-[76px]" onClick={() => navigate('CompetitionDetails', { title: comp.name, leagueId: comp.leagueId, logo: comp.logo })}>
                                            <Avatar className="h-12 w-12 border-2 border-border p-1">
                                                <AvatarImage src={comp.logo} className="object-contain" />
                                                <AvatarFallback>{comp.name.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                             <span className="text-[11px] font-medium truncate w-full">{comp.name}</span>
                                            <Star className="absolute top-1 right-1 h-3 w-3 text-yellow-400 fill-current" />
                                        </div>
                                    )}
                                </div>
                            </TabsContent>

                            <TabsContent value="players" className="mt-4">
                                <div className="grid grid-cols-4 gap-4">
                                     <div className="h-[76px] w-full">
                                        <AddChoiceCard />
                                     </div>
                                     <div className="h-[76px] w-full col-span-3 flex items-center justify-center">
                                        <p className="text-muted-foreground text-center text-sm">قائمة اللاعبين المفضلين قيد التطوير.</p>
                                     </div>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>
                </div>
            </div>
        </div>
    );
}

    