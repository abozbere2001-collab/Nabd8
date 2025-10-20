
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
import type { Favorites, AdminFavorite, ManagedCompetition } from '@/lib/types';
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
interface CompetitionsCache {
    managedCompetitions: ManagedCompetition[];
    customNames: { leagues: Record<string, string>, countries: Record<string, string>, continents: Record<string, string> };
    lastFetched: number;
}
const getCachedCompetitions = (): CompetitionsCache | null => {
    if (typeof window === 'undefined') return null;
    try {
        const cachedData = localStorage.getItem(COMPETITIONS_CACHE_KEY);
        if (!cachedData) return null;
        return JSON.parse(cachedData) as CompetitionsCache;
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
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
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
    const index: SearchableItem[] = [];
    const cachedData = getCachedCompetitions();

    // 1. Add all managed competitions (leagues) from cache
    if (cachedData?.managedCompetitions) {
        cachedData.managedCompetitions.forEach(comp => {
            const name = cachedData.customNames?.leagues?.[comp.leagueId] || hardcodedTranslations.leagues[comp.leagueId] || comp.name;
            index.push({
                id: comp.leagueId,
                type: 'leagues',
                name: name,
                normalizedName: normalizeArabic(name),
                logo: comp.logo,
                originalItem: { id: comp.leagueId, name: comp.name, logo: comp.logo }
            });
        });
    }

    // 2. Add custom-named teams from Firestore
    if (db) {
        try {
            const teamsSnapshot = await getDocs(collection(db, 'teamCustomizations'));
            const teamPromises = teamsSnapshot.docs.map(async (doc) => {
                const teamId = Number(doc.id);
                const customName = doc.data().customName;
                 const teamRes = await fetch(`/api/football/teams?id=${teamId}`);
                 if (teamRes.ok) {
                     const teamData = await teamRes.json();
                     if (teamData.response?.[0]) {
                        const team = teamData.response[0].team;
                         index.push({
                            id: team.id,
                            type: 'teams',
                            name: customName,
                            normalizedName: normalizeArabic(customName),
                            logo: team.logo,
                            originalItem: team
                         });
                     }
                 }
            });
            await Promise.all(teamPromises);
        } catch (error) {
            console.warn("Could not fetch custom team names for search index.");
        }
    }
    setLocalSearchIndex(index);
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

  const handleSearch = useCallback(async (query: string) => {
    setLoading(true);
    setSearchResults([]);
    const normalizedQuery = normalizeArabic(query);

    if (!normalizedQuery) {
        setLoading(false);
        return;
    }

    // --- Step 1: Instant Local Search ---
    const localResults = localSearchIndex.filter(item => 
        item.normalizedName.includes(normalizedQuery)
    ).map(item => ({
        [item.type.slice(0, -1)]: item.originalItem,
        type: item.type.slice(0, -1)
    } as SearchResult));

    if (localResults.length > 0) {
        setSearchResults(localResults);
        setLoading(false);
        return; // Found results locally, stop here.
    }
    
    // --- Step 2: If no local results, search online ---
    try {
        const [teamsData, leaguesData] = await Promise.all([
            fetch(`/api/football/teams?search=${query}`).then(res => res.ok ? res.json() : { response: [] }),
            fetch(`/api/football/leagues?search=${query}`).then(res => res.ok ? res.json() : { response: [] })
        ]);

        const apiResults: SearchResult[] = [];
        if (teamsData.response) {
            apiResults.push(...teamsData.response.map((r: TeamResult) => ({ ...r, type: 'team' as const })));
        }
        if (leaguesData.response) {
            apiResults.push(...leaguesData.response.map((r: LeagueResult) => ({ ...r, type: 'league' as const })));
        }
        
        setSearchResults(apiResults);
        
    } catch (error) {
        console.error("API Search Error: ", error);
        toast({variant: 'destructive', title: 'خطأ في البحث', description: 'فشل الاتصال بالخادم.'});
    } finally {
        setLoading(false);
    }
  }, [localSearchIndex, toast]);

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

  const handleResultClick = (result: SearchResult) => {
    const item = result.type === 'team' ? result.team : result.league;
    const displayName = getDisplayName(result.type, item.id, item.name);
    if (result.type === 'team') {
      navigate('TeamDetails', { teamId: result.team.id });
    } else {
      navigate('CompetitionDetails', { leagueId: result.league.id, title: displayName, logo: result.league.logo });
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
        await buildLocalIndex(); // Rebuild the index after a change
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
          const item = result.type === 'team' ? result.team : result.league;
          const isFavorited = !!favorites?.[result.type]?.[item.id];
          const displayName = getDisplayName(result.type, item.id, item.name);
          return <ItemRow key={`${result.type}-${item.id}`} item={{...item, name: displayName}} itemType={result.type as ItemType} isFavorited={isFavorited} onFavoriteToggle={(i) => handleFavorite(i, result.type as ItemType)} onResultClick={() => handleResultClick(result)} isAdmin={isAdmin} onRename={() => handleOpenRename(result.type as RenameType, item.id, item)} />;
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
          const result = { [resultType]: { ...item, name: displayName }, type: resultType } as SearchResult;

          return <ItemRow key={item.id} item={{...item, name: displayName}} itemType={itemType} isFavorited={isFavorited} onFavoriteToggle={(i) => handleFavorite(i, itemType)} onResultClick={() => handleResultClick(result)} isAdmin={isAdmin} onRename={() => handleOpenRename(resultType as RenameType, item.id, item)} />;
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
            onSave={(type, id, name, note) => handleSaveRename(type, id, name, note)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
