
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ScreenProps } from '@/app/page';
import { useAuth, useFirestore } from '@/firebase/provider';
import { collection, doc, onSnapshot, updateDoc, getDocs } from 'firebase/firestore';
import type { Favorites } from '@/lib/types';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';

export function NotificationsScreen({ navigate, goBack, canGoBack, headerActions }: ScreenProps) {
  const { user } = useAuth();
  const { db } = useFirestore();
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

  useEffect(() => {
    if (!user || !db) {
      setLoading(false);
      return;
    }
    fetchAllCustomNames();
    const favsRef = doc(db, 'favorites', user.uid);
    const unsubscribe = onSnapshot(favsRef, (docSnap) => {
      if (docSnap.exists()) {
        setFavorites(docSnap.data() as Favorites);
      } else {
        setFavorites({ userId: user.uid });
      }
      setLoading(false);
    }, (error) => {
      const permissionError = new FirestorePermissionError({ path: favsRef.path, operation: 'get' });
      errorEmitter.emit('permission-error', permissionError);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, db, fetchAllCustomNames]);

  const getDisplayName = useCallback((type: 'league' | 'team', id: number, defaultName: string) => {
    const key = `${type}s` as 'leagues' | 'teams';
    const map = customNames[key] as Map<number, string>;
    return map?.get(id) || defaultName;
  }, [customNames]);

  const handleToggleNotification = (type: 'leagues' | 'teams', itemId: number) => {
    if (!user || !db || !favorites) return;

    const currentStatus = favorites[type]?.[itemId]?.notificationsEnabled ?? true;
    const newStatus = !currentStatus;

    // Optimistically update UI
    setFavorites(prev => {
        if (!prev) return null;
        const newFavs = { ...prev };
        if (newFavs[type] && newFavs[type]?.[itemId]) {
             newFavs[type]![itemId].notificationsEnabled = newStatus;
        }
        return newFavs;
    });

    const docRef = doc(db, 'favorites', user.uid);
    const fieldPath = `${type}.${itemId}.notificationsEnabled`;
    const updateData = { [fieldPath]: newStatus };
    
    updateDoc(docRef, updateData).catch(serverError => {
      const permissionError = new FirestorePermissionError({ path: docRef.path, operation: 'update', requestResourceData: updateData });
      errorEmitter.emit('permission-error', permissionError);
      // Revert optimistic update on error
      setFavorites(favorites);
    });
  };

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

  const NotificationControlItem = ({ item, type }: { item: any, type: 'leagues' | 'teams' }) => {
    const isTeam = type === 'teams';
    const id = isTeam ? item.teamId : item.leagueId;
    const isEnabled = favorites?.[type]?.[id]?.notificationsEnabled ?? true;

    return (
        <div className="flex items-center justify-between p-3 border-b">
            <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                    <AvatarImage src={item.logo} alt={item.name} className={isTeam ? '' : 'object-contain p-1'} />
                    <AvatarFallback>{item.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <Label htmlFor={`notif-${id}`} className="font-semibold cursor-pointer">{item.name}</Label>
            </div>
            <Switch
                id={`notif-${id}`}
                checked={isEnabled}
                onCheckedChange={() => handleToggleNotification(type, id)}
            />
        </div>
    );
  }
  
  if (loading) {
    return (
      <div className="flex h-full flex-col bg-background">
        <ScreenHeader title="الإشعارات" onBack={goBack} canGoBack={canGoBack} actions={headerActions} />
         <div className="p-4 space-y-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1"><Skeleton className="h-4 w-3/4" /></div>
                 <Skeleton className="h-6 w-12" />
              </div>
            ))}
          </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader title="إشعارات المفضلة" onBack={goBack} canGoBack={canGoBack} actions={headerActions} />
        <Tabs defaultValue="my-choices" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-transparent px-4">
                <TabsTrigger value="notifications">إعدادات الإشعارات</TabsTrigger>
                <TabsTrigger value="my-choices" onClick={() => navigate('Competitions')}>اختياراتي</TabsTrigger>
            </TabsList>
        </Tabs>
      
      <div className="flex-1 overflow-y-auto pt-4">
         {(favoriteLeagues.length === 0 && favoriteTeams.length === 0) ? (
            <p className="text-center text-muted-foreground pt-16">أضف فرقا وبطولات إلى مفضلتك للتحكم في إشعاراتها.</p>
         ) : (
            <>
              {favoriteLeagues.length > 0 && (
                <div className="px-4 mb-6">
                  <h3 className="font-bold text-lg mb-2">البطولات</h3>
                  <div className="rounded-lg border">
                    {favoriteLeagues.map((league) => <NotificationControlItem key={league.leagueId} item={league} type="leagues"/>)}
                  </div>
                </div>
              )}
              {favoriteTeams.length > 0 && (
                 <div className="px-4 mb-6">
                  <h3 className="font-bold text-lg mb-2">الفرق</h3>
                   <div className="rounded-lg border">
                    {favoriteTeams.map((team) => <NotificationControlItem key={team.teamId} item={team} type="teams"/>)}
                  </div>
                </div>
              )}
            </>
         )}
      </div>
    </div>
  );
}
