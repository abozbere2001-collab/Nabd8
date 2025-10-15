
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import type { ScreenProps } from '@/app/page';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, Star } from 'lucide-react';
import { useAuth, useFirestore } from '@/firebase/provider';
import { doc, setDoc, deleteField, updateDoc, getDoc } from 'firebase/firestore';
import type { Favorites } from '@/lib/types';
import { POPULAR_TEAMS, POPULAR_LEAGUES } from '@/lib/popular-data';
import { SearchSheet } from '@/components/SearchSheet';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';

type Item = { id: number; name: string; logo: string; };
type ItemType = 'teams' | 'leagues';

interface DiscoverScreenProps extends ScreenProps {
    itemType: ItemType;
}

const PopularList = ({ items, itemType, favorites, onFavoriteToggle, onShowAll }: { items: Item[], itemType: ItemType, favorites: Favorites, onFavoriteToggle: (item: Item) => void, onShowAll: () => void }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{itemType === 'teams' ? 'الفرق الأكثر شعبية' : 'البطولات الأكثر شعبية'}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {items.slice(0, 6).map(item => (
          <div key={item.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-accent/50">
            <Avatar className={itemType === 'leagues' ? 'p-1' : ''}>
                <AvatarImage src={item.logo} alt={item.name} className={itemType === 'leagues' ? 'object-contain' : ''} />
                <AvatarFallback>{item.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 font-semibold truncate">{item.name}</div>
            <Button variant="ghost" size="icon" onClick={() => onFavoriteToggle(item)}>
              <Star className={cn("h-5 w-5 text-muted-foreground", favorites?.[itemType]?.[item.id] && "fill-current text-yellow-400")} />
            </Button>
          </div>
        ))}
        <div className="pt-2">
            <Button variant="ghost" className="w-full" onClick={onShowAll}>عرض الكل</Button>
        </div>
      </CardContent>
    </Card>
  );
};

export function DiscoverScreen({ navigate, goBack, canGoBack, itemType = 'teams' }: DiscoverScreenProps) {
  const { user } = useAuth();
  const { db } = useFirestore();
  const [favorites, setFavorites] = useState<Favorites>({ userId: '' });

  const fetchFavorites = useCallback(async () => {
    if (!user || !db) return;
    const docRef = doc(db, 'users', user.uid, 'favorites', 'data');
    try {
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setFavorites(docSnap.data() as Favorites);
      }
    } catch (error) {
      const permissionError = new FirestorePermissionError({ path: docRef.path, operation: 'get' });
      errorEmitter.emit('permission-error', permissionError);
    }
  }, [user, db]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  const handleFavorite = (item: Item) => {
    if (!user || !db) return;
    const favRef = doc(db, 'users', user.uid, 'favorites', 'data');
    const fieldPath = `${itemType}.${item.id}`;
    const isFavorited = !!favorites?.[itemType]?.[item.id];

    // Optimistic update
    const currentFavorites = { ...favorites };
    if (!currentFavorites[itemType]) {
        currentFavorites[itemType] = {};
    }
    if (isFavorited) {
        delete (currentFavorites[itemType] as any)[item.id];
    } else {
        (currentFavorites[itemType] as any)[item.id] = { [`${itemType.slice(0, -1)}Id`]: item.id, name: item.name, logo: item.logo };
    }
    setFavorites(currentFavorites);

    const operation = isFavorited
      ? updateDoc(favRef, { [fieldPath]: deleteField() })
      : setDoc(favRef, { [itemType]: { [item.id]: { [`${itemType.slice(0, -1)}Id`]: item.id, name: item.name, logo: item.logo } } }, { merge: true });

    operation.catch(serverError => {
      setFavorites(favorites); // Revert optimistic update
      const permissionError = new FirestorePermissionError({ path: favRef.path, operation: isFavorited ? 'update' : 'create' });
      errorEmitter.emit('permission-error', permissionError);
    });
  };

  const items = itemType === 'teams' ? POPULAR_TEAMS : POPULAR_LEAGUES;

  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader
        title="إضافة مفضلة"
        onBack={goBack}
        canGoBack={canGoBack}
        actions={
          <SearchSheet navigate={navigate}>
            <Button variant="ghost" size="icon"><Search className="h-5 w-5" /></Button>
          </SearchSheet>
        }
      />
      <div className="flex-1 overflow-y-auto p-4">
        <PopularList 
            items={items} 
            itemType={itemType} 
            favorites={favorites} 
            onFavoriteToggle={handleFavorite} 
            onShowAll={() => navigate('DiscoverAll', { itemType })} 
        />
      </div>
    </div>
  );
}

    