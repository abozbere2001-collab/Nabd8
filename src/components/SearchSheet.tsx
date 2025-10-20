

"use client";

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from '@/components/ui/button';
import { Search, Star, Pencil, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useDebounce } from '@/hooks/use-debounce';
import type { ScreenProps } from '@/app/page';
import { useAdmin, useAuth, useFirestore } from '@/firebase/provider';
import { doc, getDoc, setDoc, updateDoc, deleteField, collection, getDocs, writeBatch } from 'firebase/firestore';
import { RenameDialog } from '@/components/RenameDialog';
import { cn } from '@/lib/utils';
import type { Favorites, AdminFavorite, ManagedCompetition, Team } from '@/lib/types';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { useToast } from '@/hooks/use-toast';
import { POPULAR_TEAMS, POPULAR_LEAGUES } from '@/lib/popular-data';
import { hardcodedTranslations } from '@/lib/hardcoded-translations';

// --- Types ---
interface TeamResult {
  team: { id: number; name: string; logo: string; national?: boolean; };
}
interface LeagueResult {
  league: { id: number; name: string; logo: string; };
}

type Item = TeamResult['team'] | LeagueResult['league'];
type ItemType = 'teams' | 'leagues';
type SearchResult = (TeamResult & { type: 'team' }) | (LeagueResult & { type: 'league' });
type RenameType = 'league' | 'team';

interface SearchableItem {
    id: number;
    type: ItemType;
    name: string;
    normalizedName: string;
    logo: string;
    originalItem: Item;
}


// --- Cache Logic ---
const COMPETITIONS_CACHE_KEY = 'goalstack_competitions_cache';
const TEAMS_CACHE_KEY = 'goalstack_national_teams_cache';
interface Cache<T> {
    data: T;
    lastFetched: number;
}
const getCachedData = <T>(key: string): T | null => {
    if (typeof window === 'undefined') return null;
    try {
        const cachedData = localStorage.getItem(key);
        if (!cachedData) return null;
        const parsed = JSON.parse(cachedData) as Cache<T>;
        return parsed.data;
    } catch (error) {
        return null;
    }
};


const normalizeArabic = (text: string) => {
  if (!text) return '';
  return text
    .replace(/[\u064B-\u0652]/g, "") // Remove harakat
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
};


const ItemRow = ({ item, itemType, isFavorited, onFavoriteToggle, onResultClick, onRename, isAdmin }: { item: Item, itemType: ItemType, isFavorited: boolean, onFavoriteToggle: (item: Item) => void, onResultClick: () => void, onRename: () => void, isAdmin: boolean }) => {
  return (
    <div className="flex items-center gap-2 p-1.5 border-b last:border-b-0 hover:bg-accent/50 rounded-md">
       <div className="flex-1 flex items-center gap-2 cursor-pointer" onClick={onResultClick}>
            <Avatar className={cn('h-7 w-7', itemType === 'leagues' && 'p-0.5')}>
                <AvatarImage src={item.logo} alt={item.name} className={itemType === 'leagues' ? 'object-contain' : 'object-cover'} />
                <AvatarFallback>{item.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 font-semibold truncate text-sm">{item.name}</div>
        </div>
      {isAdmin && (
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRename}>
            <Pencil className="h-4 w-4 text-muted-foreground" />
        </Button>
      )}
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onFavoriteToggle(item)}>
        <Star className={cn("h-5 w-5 text-muted-foreground/60", isFavorited && "fill-current text-yellow-400")} />
      </Button>
    </div>
  );
}


export function SearchSheet({ children, navigate, initialItemType }: { children: React.ReactNode, navigate: ScreenProps['navigate'], initialItemType?: ItemType }) {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [searchResults, setSearchResults] = useState<SearchableItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  
  const [itemType, setItemType] = useState<ItemType>(initialItemType || 'teams');

  const { isAdmin } = useAdmin();
  const { user } = useAuth();
  const { db } = useFirestore();
  const { toast } = useToast();
  const [favorites, setFavorites] = useState<Favorites>({ userId: '' });
  
  const [renameItem, setRenameItem] = useState<{ id: string | number, name: string, note?: string, type: RenameType, originalData?: any } | null>(null);

  const [localSearchIndex, setLocalSearchIndex] = useState<SearchableItem[]>([]);
  
  const buildLocalIndex = useCallback(async () => {
    setLoading(true);
    const index: SearchableItem[] = [];
    const competitionsCache = getCachedData<{managedCompetitions: ManagedCompetition[]}>(COMPETITIONS_CACHE_KEY);
    const nationalTeamsCache = getCachedData<Team[]>(TEAMS_CACHE_KEY);
    
    let customTeamNames = new Map<number, string>();
    let customLeagueNames = new Map<number, string>();

    if(db) {
        try {
            const [teamsSnap, leaguesSnap] = await Promise.all([
                getDocs(collection(db, 'teamCustomizations')),
                getDocs(collection(db, 'leagueCustomizations'))
            ]);
            teamsSnap.forEach(doc => customTeamNames.set(Number(doc.id), doc.data().customName));
            leaguesSnap.forEach(doc => customLeagueNames.set(Number(doc.id), doc.data().customName));
        } catch (e) {
            console.warn("Could not fetch custom names for index.");
        }
    }

    const getName = (type: 'team' | 'league', id: number, defaultName: string) => {
        const customMap = type === 'team' ? customTeamNames : customLeagueNames;
        return customMap.get(id) || hardcodedTranslations[`${type}s`]?.[id] || defaultName;
    };

    if (competitionsCache?.managedCompetitions) {
        competitionsCache.managedCompetitions.forEach(comp => {
            const name = getName('league', comp.leagueId, comp.name);
            index.push({
                id: comp.leagueId,
                type: 'leagues',
                name,
                normalizedName: normalizeArabic(name),
                logo: comp.logo,
                originalItem: { id: comp.leagueId, name: comp.name, logo: comp.logo }
            });
        });
    }

    if (nationalTeamsCache) {
        nationalTeamsCache.forEach(team => {
            const name = getName('team', team.id, team.name);
            index.push({
                id: team.id,
                type: 'teams',
                name,
                normalizedName: normalizeArabic(name),
                logo: team.logo,
                originalItem: { ...team }
            });
        });
    }
    
    setLocalSearchIndex(index);
    setLoading(false);
  }, [db]);


  useEffect(() => {
    if (isOpen) {
      buildLocalIndex();
      if (user && db) {
        const docRef = doc(db, 'users', user.uid, 'favorites', 'data');
        getDoc(docRef).then(docSnap => {
            if (docSnap.exists()) setFavorites(docSnap.data() as Favorites);
        }).catch(err => console.error("Failed to fetch favorites", err));
      }
    }
  }, [isOpen, user, db, buildLocalIndex]);


  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setSearchTerm('');
      setSearchResults([]);
      if (initialItemType) {
        setItemType(initialItemType);
      }
    }
  };

  const handleSearch = useCallback((query: string) => {
    setLoading(true);
    const normalizedQuery = normalizeArabic(query);

    if (!normalizedQuery) {
        setSearchResults([]);
        setLoading(false);
        return;
    }

    const results = localSearchIndex.filter(item => 
        item.normalizedName.includes(normalizedQuery)
    );
    
    setSearchResults(results);
    setLoading(false);
  }, [localSearchIndex]);


  useEffect(() => {
    if (debouncedSearchTerm && isOpen) {
      handleSearch(debouncedSearchTerm);
    } else {
      setSearchResults([]);
    }
  }, [debouncedSearchTerm, handleSearch, isOpen]);

 const getDisplayName = useCallback((type: 'team' | 'league', id: number, defaultName: string): string => {
    const item = localSearchIndex.find(i => i.id === id && i.type === `${type}s`);
    return item?.name || hardcodedTranslations[`${type}s`]?.[id] || defaultName;
}, [localSearchIndex]);


  const handleFavorite = (item: Item, type: ItemType) => {
    if (!user || !db) return;

    const favRef = doc(db, 'users', user.uid, 'favorites', 'data');
    const fieldPath = `${type}.${item.id}`;
    const isFavorited = !!favorites?.[type]?.[item.id];

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
      };
      if (type === 'teams' && 'national' in item) {
         (currentFavorites.teams as any)[item.id].type = (item as any).national ? 'National' : 'Club'
      }
    }
    setFavorites(currentFavorites);
    
    let dataToSave: any = { 
      name: item.name, 
      logo: item.logo || '' 
    };

    if (type === 'teams') {
        dataToSave.teamId = item.id;
        dataToSave.type = 'national' in item && item.national ? 'National' : 'Club';
    } else {
        dataToSave.leagueId = item.id;
    }


    const operation = isFavorited
      ? updateDoc(favRef, { [fieldPath]: deleteField() })
      : setDoc(favRef, { [type]: { [item.id]: dataToSave } }, { merge: true });

    operation.catch(serverError => {
      setFavorites(favorites);
      const permissionError = new FirestorePermissionError({ path: favRef.path, operation: 'update' });
      errorEmitter.emit('permission-error', permissionError);
    });
  };

  const handleResultClick = (result: SearchableItem) => {
    if (result.type === 'teams') {
      navigate('TeamDetails', { teamId: result.id });
    } else {
      navigate('CompetitionDetails', { leagueId: result.id, title: result.name, logo: result.logo });
    }
    handleOpenChange(false);
  }

  const handleOpenRename = (type: RenameType, id: number, originalData: any) => {
    const currentName = getDisplayName(type, id, originalData.name);
    setRenameItem({ id, name: currentName, type, originalData });
  };
  
  const handleSaveRename = async (type: RenameType, id: string | number, newName: string, newNote?: string) => {
    if (!renameItem || !db) return;
    const { originalData } = renameItem;

    const batch = writeBatch(db);

    const nameRef = doc(db, `${type}Customizations`, String(id));
    if (newName && newName !== originalData.name) {
        batch.set(nameRef, { customName: newName });
    } else {
        batch.delete(nameRef); 
    }

    try {
        await batch.commit();
        toast({ title: 'نجاح', description: 'تم حفظ التغييرات. قد تحتاج لإعادة فتح البحث لرؤية التحديث.' });
        await buildLocalIndex();
        if(debouncedSearchTerm) {
            handleSearch(debouncedSearchTerm);
        }
    } catch (serverError) {
        const permissionError = new FirestorePermissionError({
            path: `batch write for customizations`,
            operation: 'write'
        });
        errorEmitter.emit('permission-error', permissionError);
    }
    setRenameItem(null);
  };
  
  const popularItems = itemType === 'teams' ? POPULAR_TEAMS : POPULAR_LEAGUES;

  const renderContent = () => {
    if (loading) {
      return <div className="flex justify-center items-center h-full"><Loader2 className="h-6 w-6 animate-spin" /></div>;
    }
    
    if (debouncedSearchTerm) {
      return searchResults.length > 0 ? (
        searchResults.map(result => {
          const isFavorited = !!favorites?.[result.type]?.[result.id];
          return <ItemRow key={`${result.type}-${result.id}`} item={result} itemType={result.type} isFavorited={isFavorited} onFavoriteToggle={(i) => handleFavorite(i, result.type)} onResultClick={() => handleResultClick(result)} isAdmin={isAdmin} onRename={() => handleOpenRename(result.type as RenameType, result.id, result.originalItem)} />;
        })
      ) : <p className="text-muted-foreground text-center pt-8">لا توجد نتائج بحث.</p>;
    }

    return (
      <div className="space-y-2">
        <h3 className="font-bold text-md text-center text-muted-foreground">{itemType === 'teams' ? 'الفرق الأكثر شعبية' : 'البطولات الأكثر شعبية'}</h3>
        {popularItems.map(item => {
          const isFavorited = !!favorites?.[itemType]?.[item.id];
          const displayName = getDisplayName(itemType.slice(0,-1) as 'team' | 'league' , item.id, item.name);
          const resultType = itemType === 'teams' ? 'team' : 'league';

          return <ItemRow key={item.id} item={{...item, name: displayName}} itemType={itemType} isFavorited={isFavorited} onFavoriteToggle={(i) => handleFavorite(i, itemType)} onResultClick={() => handleResultClick({type: resultType, [resultType]: item} as SearchResult)} isAdmin={isAdmin} onRename={() => handleOpenRename(resultType as RenameType, item.id, item)} />;
        })}
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
        <div className="mt-4 flex-1 overflow-y-auto space-y-1 pr-2 relative">
          {renderContent()}
        </div>
        
        {renameItem && (
          <RenameDialog 
            isOpen={!!renameItem}
            onOpenChange={(isOpen) => !isOpen && setRenameItem(null)}
            item={renameItem}
            onSave={(type, id, name, note) => handleSaveRename(type as RenameType, id, name, note)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
