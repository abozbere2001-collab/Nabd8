
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { ScreenProps } from '@/app/page';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Star, Loader2 } from 'lucide-react';
import { useAuth, useFirestore, useAdmin } from '@/firebase/provider';
import { doc, setDoc, deleteField, updateDoc, getDoc } from 'firebase/firestore';
import type { Favorites } from '@/lib/types';
import { cn } from '@/lib/utils';
import { POPULAR_TEAMS, POPULAR_LEAGUES } from '@/lib/popular-data';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';

type Item = { id: number; name: string; logo: string; };
type ItemType = 'teams' | 'leagues';

interface DiscoverAllScreenProps extends ScreenProps {
  itemType: ItemType;
}

const ItemRow = ({ item, itemType, isFavorited, onFavoriteToggle }: { item: Item, itemType: ItemType, isFavorited: boolean, onFavoriteToggle: (item: Item) => void }) => {
  return (
    <div className="flex items-center gap-3 p-3 border-b last:border-b-0">
      <Avatar className={itemType === 'leagues' ? 'p-1' : ''}>
        <AvatarImage src={item.logo} alt={item.name} className={itemType === 'leagues' ? 'object-contain' : ''} />
        <AvatarFallback>{item.name.charAt(0)}</AvatarFallback>
      </Avatar>
      <div className="flex-1 font-semibold truncate">{item.name}</div>
      <Button variant="ghost" size="icon" onClick={() => onFavoriteToggle(item)}>
        <Star className={cn("h-5 w-5 text-muted-foreground", isFavorited && "fill-current text-yellow-400")} />
      </Button>
    </div>
  );
}

export function DiscoverAllScreen({ navigate, goBack, canGoBack, itemType }: DiscoverAllScreenProps) {
  const { user } = useAuth();
  const { db } = useFirestore();

  const [searchTerm, setSearchTerm] = useState('');
  const [favorites, setFavorites] = useState<Favorites>({ userId: '' });
  const [loading, setLoading] = useState(true);

  const title = itemType === 'teams' ? 'الفرق الأكثر شعبية' : 'البطولات الأكثر شعبية';
  const allItems: Item[] = itemType === 'teams' ? POPULAR_TEAMS : POPULAR_LEAGUES;

  const filteredItems = useMemo(() => {
    if (!searchTerm) {
      return allItems;
    }
    return allItems.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [searchTerm, allItems]);

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
    } finally {
      setLoading(false);
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
      setFavorites(favorites); // Revert optimistic update on error
      const permissionError = new FirestorePermissionError({ path: favRef.path, operation: isFavorited ? 'update' : 'create' });
      errorEmitter.emit('permission-error', permissionError);
    });
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader title={title} onBack={goBack} canGoBack={canGoBack} />
      <div className="p-4 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="ابحث..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>
        ) : (
          filteredItems.map(item => (
            <ItemRow
              key={item.id}
              item={item}
              itemType={itemType}
              isFavorited={!!favorites?.[itemType]?.[item.id]}
              onFavoriteToggle={handleFavorite}
            />
          ))
        )}
      </div>
    </div>
  );
}
