
"use client";

import React, { useState, useCallback, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from '@/components/ui/button';
import { Search, Star, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useDebounce } from '@/hooks/use-debounce';
import type { ScreenProps } from '@/app/page';
import { useAuth, useFirestore } from '@/firebase/provider';
import { doc, setDoc, deleteField, updateDoc, getDoc } from 'firebase/firestore';
import type { Favorites } from '@/lib/types';
import { cn } from '@/lib/utils';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { POPULAR_TEAMS, POPULAR_LEAGUES } from '@/lib/popular-data';

type Item = { id: number; name: string; logo: string; type?: 'Club' | 'National' };
type ItemType = 'teams' | 'leagues';

interface TeamResult { team: Item; }
interface LeagueResult { league: Item; }

type SearchResult = (TeamResult & { type: 'team' }) | (LeagueResult & { type: 'league' });

const ItemRow = ({ item, itemType, isFavorited, onFavoriteToggle, onResultClick }: { item: Item, itemType: ItemType, isFavorited: boolean, onFavoriteToggle: (item: Item) => void, onResultClick: () => void }) => {
  return (
    <div className="flex items-center gap-2 p-1.5 border-b last:border-b-0 hover:bg-accent/50 rounded-md">
       <div className="flex-1 flex items-center gap-2 cursor-pointer" onClick={onResultClick}>
            <Avatar className={cn('h-7 w-7', itemType === 'leagues' && 'p-0.5')}>
                <AvatarImage src={item.logo} alt={item.name} className={itemType === 'leagues' ? 'object-contain' : 'object-cover'} />
                <AvatarFallback>{item.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 font-semibold truncate text-sm">{item.name}</div>
        </div>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onFavoriteToggle(item)}>
        <Star className={cn("h-5 w-5 text-muted-foreground/60", isFavorited && "fill-current text-yellow-400")} />
      </Button>
    </div>
  );
}

export function SearchSheet({ children, navigate, initialItemType }: { children: React.ReactNode, navigate: ScreenProps['navigate'], initialItemType?: ItemType }) {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  
  const [showAllPopular, setShowAllPopular] = useState(false);
  const [itemType, setItemType] = useState<ItemType>(initialItemType || 'teams');

  const { user } = useAuth();
  const { db } = useFirestore();
  const [favorites, setFavorites] = useState<Favorites>({ userId: '' });
  
  useEffect(() => {
    if(initialItemType) {
        setItemType(initialItemType);
    }
  }, [initialItemType])


  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setSearchTerm('');
      setSearchResults([]);
      setShowAllPopular(false);
      if (initialItemType) {
        setItemType(initialItemType);
      }
    }
  };

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
    if (isOpen) {
      fetchFavorites();
    }
  }, [isOpen, fetchFavorites]);

  const handleSearch = useCallback(async (query: string) => {
    if (!query) {
      setSearchResults([]);
      return;
    }
    setLoading(true);
    try {
      const [teamsRes, leaguesRes] = await Promise.all([
        fetch(`/api/football/teams?search=${query}`),
        fetch(`/api/football/leagues?search=${query}`),
      ]);
      const teamsData = await teamsRes.json();
      const leaguesData = await leaguesRes.json();
      
      const combinedResults: SearchResult[] = [
        ...(teamsData.response || []).map((r: TeamResult) => ({ ...r, type: 'team' as const })),
        ...(leaguesData.response || []).map((r: LeagueResult) => ({ ...r, type: 'league' as const })),
      ];
      setSearchResults(combinedResults);

    } catch (error) {
      console.error("Search failed", error);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debouncedSearchTerm) {
      handleSearch(debouncedSearchTerm);
    } else {
      setSearchResults([]);
    }
  }, [debouncedSearchTerm, handleSearch]);

  const handleFavorite = (item: Item, type: ItemType) => {
    if (!user || !db) return;

    const favRef = doc(db, 'users', user.uid, 'favorites', 'data');
    const fieldPath = `${type}.${item.id}`;
    const isFavorited = !!favorites?.[type]?.[item.id];

    // Optimistically update UI
    const currentFavorites = { ...favorites };
    if (!currentFavorites[type]) {
      (currentFavorites as any)[type] = {};
    }

    if (isFavorited) {
      delete (currentFavorites[type] as any)[item.id];
    } else {
      const idKey = type === 'teams' ? 'teamId' : 'leagueId';
      (currentFavorites[type] as any)[item.id] = { 
          [idKey]: item.id, 
          name: item.name, 
          logo: item.logo,
          type: item.type,
      };
    }
    setFavorites(currentFavorites);

    const dataToSave: any = {
      name: item.name,
      logo: item.logo || '',
    };

    if (type === 'teams') {
      dataToSave.teamId = item.id;
      // This is the key fix: ensure the type ('Club' or 'National') is saved.
      // The API response for teams includes a `national` boolean. We map this to our type.
      // We look up the original search result to get this info.
      const originalResult = searchResults.find(r => r.type === 'team' && r.team.id === item.id) as (TeamResult & {type: 'team'}) | undefined;
      const isNational = originalResult ? (originalResult as any).team.national : false;
      dataToSave.type = isNational ? 'National' : 'Club';
    } else {
      dataToSave.leagueId = item.id;
    }


    const operation = isFavorited
      ? updateDoc(favRef, { [fieldPath]: deleteField() })
      : setDoc(favRef, { [type]: { [item.id]: dataToSave } }, { merge: true });

    operation.catch(serverError => {
      setFavorites(favorites); // Revert on error
      const permissionError = new FirestorePermissionError({ path: favRef.path, operation: 'update' });
      errorEmitter.emit('permission-error', permissionError);
    });
  };

  const handleResultClick = (result: SearchResult) => {
    if (result.type === 'team') {
      navigate('TeamDetails', { teamId: result.team.id });
    } else {
      navigate('CompetitionDetails', { leagueId: result.league.id, title: result.league.name, logo: result.league.logo });
    }
    handleOpenChange(false);
  }
  
  const popularItems = itemType === 'teams' ? POPULAR_TEAMS : POPULAR_LEAGUES;
  const popularItemsToShow = showAllPopular ? popularItems : popularItems.slice(0, 6);

  const renderContent = () => {
    if (loading) {
      return <div className="flex justify-center items-center h-full"><Loader2 className="h-6 w-6 animate-spin" /></div>;
    }
    
    if (debouncedSearchTerm) {
      return searchResults.length > 0 ? (
        searchResults.map(result => {
          const item = result.type === 'team' ? result.team : result.league;
          const isFavorited = !!favorites?.[result.type]?.[item.id];
          // For search results, we pass the full item from the result to handleFavorite
          return <ItemRow key={`${result.type}-${item.id}`} item={item} itemType={result.type} isFavorited={isFavorited} onFavoriteToggle={() => handleFavorite(item, result.type)} onResultClick={() => handleResultClick(result)} />;
        })
      ) : <p className="text-muted-foreground text-center pt-8">لا توجد نتائج بحث.</p>;
    }

    return (
      <div className="space-y-2">
        <h3 className="font-bold text-md text-center text-muted-foreground">{itemType === 'teams' ? 'الفرق الأكثر شعبية' : 'البطولات الأكثر شعبية'}</h3>
        {popularItemsToShow.map(item => {
          const isFavorited = !!favorites?.[itemType]?.[item.id];
          return <ItemRow key={item.id} item={item} itemType={itemType} isFavorited={isFavorited} onFavoriteToggle={(i) => handleFavorite(i, itemType)} onResultClick={() => handleResultClick({[itemType.slice(0,-1)]: item, type: itemType} as any)} />;
        })}
        {!showAllPopular && popularItems.length > 6 && (
          <Button variant="ghost" className="w-full" onClick={() => setShowAllPopular(true)}>عرض الكل</Button>
        )}
      </div>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild onClick={(e) => { e.stopPropagation(); setIsOpen(true) }}>{children}</SheetTrigger>
      <SheetContent side="bottom" className="flex flex-col h-[90vh] top-0 rounded-t-none">
        <SheetHeader>
          <SheetTitle>اكتشف</SheetTitle>
        </SheetHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="ابحث عن فريق أو بطولة..."
            className="pl-10 text-md"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {!debouncedSearchTerm && (
             <div className="flex items-center justify-center pt-2">
                <Button variant={itemType === 'teams' ? 'secondary' : 'ghost'} size="sm" onClick={() => setItemType('teams')}>الفرق</Button>
                <Button variant={itemType === 'leagues' ? 'secondary' : 'ghost'} size="sm" onClick={() => setItemType('leagues')}>البطولات</Button>
            </div>
        )}
        <div className="mt-4 flex-1 overflow-y-auto space-y-1 pr-2">
          {renderContent()}
        </div>
      </SheetContent>
    </Sheet>
  );
}
