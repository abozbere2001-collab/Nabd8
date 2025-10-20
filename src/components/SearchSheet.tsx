
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
  
  const [showAllPopular, setShowAllPopular] = useState(false);
  const [itemType, setItemType] = useState<ItemType>(initialItemType || 'teams');

  const { isAdmin } = useAdmin();
  const { user } = useAuth();
  const { db } = useFirestore();
  const { toast } = useToast();
  const [favorites, setFavorites] = useState<Favorites>({ userId: '' });
  const [cachedData, setCachedData] = useState<CompetitionsCache | null>(null);
  const [customTeamNames, setCustomTeamNames] = useState<Map<number, string>>(new Map());
  
  const [renameItem, setRenameItem] = useState<{ id: string | number, name: string, note?: string, type: RenameType, originalData?: any } | null>(null);
  
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

  const fetchCustomTeamNames = useCallback(async () => {
    if (!db) return;
    try {
        const teamsSnapshot = await getDocs(collection(db, 'teamCustomizations'));
        const teamNames = new Map<number, string>();
        teamsSnapshot.forEach(doc => teamNames.set(Number(doc.id), doc.data().customName));
        setCustomTeamNames(teamNames);
    } catch (error) {
        console.warn("Could not fetch custom team names, this is expected for non-admins", error);
    }
  }, [db]);


  useEffect(() => {
    if (isOpen) {
      fetchFavorites();
      setCachedData(getCachedCompetitions());
      fetchCustomTeamNames();
    }
  }, [isOpen, fetchFavorites, fetchCustomTeamNames]);

 const getDisplayName = useCallback((type: 'team' | 'league', id: number, defaultName: string) => {
    if (type === 'league') {
        const customName = cachedData?.customNames?.leagues?.[id];
        if (customName) return customName;
        const hardcodedName = hardcodedTranslations.leagues[id];
        return hardcodedName || defaultName;
    }
    if (type === 'team') {
        const customName = customTeamNames.get(id);
        if (customName) return customName;
        const hardcodedName = hardcodedTranslations.teams[id];
        return hardcodedName || defaultName;
    }
    return defaultName;
  }, [cachedData, customTeamNames]);

  const handleSearch = useCallback(async (query: string) => {
    setLoading(true);
    const normalizedQuery = normalizeArabic(query);
    const resultsMap = new Map<string, SearchResult>();

    if (!normalizedQuery) {
        setSearchResults([]);
        setLoading(false);
        return;
    }

    // --- Step 1: Perform immediate local search and update UI ---
    // Search local leagues
    const localLeagues = cachedData?.managedCompetitions || [];
    localLeagues.forEach(comp => {
        const leagueName = getDisplayName('league', comp.leagueId, comp.name);
        if (normalizeArabic(leagueName).includes(normalizedQuery)) {
            const key = `league-${comp.leagueId}`;
            if (!resultsMap.has(key)) {
                resultsMap.set(key, {
                    league: { id: comp.leagueId, name: leagueName, logo: comp.logo },
                    type: 'league'
                });
            }
        }
    });

    // Search local custom team names
    const customTeamNamePromises: Promise<void>[] = [];
    customTeamNames.forEach((name, id) => {
        if (normalizeArabic(name).includes(normalizedQuery)) {
            const key = `team-${id}`;
            if (!resultsMap.has(key)) {
                 const promise = fetch(`/api/football/teams?id=${id}`)
                    .then(res => res.json())
                    .then(data => {
                        if (data.response?.[0]) {
                            resultsMap.set(key, { ...data.response[0], type: 'team' });
                        }
                    });
                customTeamNamePromises.push(promise);
            }
        }
    });
    
    await Promise.all(customTeamNamePromises);
    setSearchResults(Array.from(resultsMap.values())); // Show local results immediately

    // --- Step 2: Perform API search in the background ---
    try {
        const [teamsData, leaguesData] = await Promise.all([
            fetch(`/api/football/teams?search=${query}`).then(res => res.ok ? res.json() : { response: [] }),
            fetch(`/api/football/leagues?search=${query}`).then(res => res.ok ? res.json() : { response: [] })
        ]);
        
        // Use a new map for merging to avoid race conditions with state updates
        const finalResultsMap = new Map(resultsMap);

        if (teamsData.response) {
            teamsData.response.forEach((r: TeamResult) => {
                const key = `team-${r.team.id}`;
                if (!finalResultsMap.has(key)) {
                    finalResultsMap.set(key, { ...r, type: 'team' });
                }
            });
        }
        if (leaguesData.response) {
            leaguesData.response.forEach((r: LeagueResult) => {
                const key = `league-${r.league.id}`;
                if (!finalResultsMap.has(key)) {
                    finalResultsMap.set(key, { ...r, type: 'league' });
                }
            });
        }
        
        // Update the state with the final merged list
        setSearchResults(Array.from(finalResultsMap.values()));

    } catch (error) {
        console.error("API Search Error: ", error);
        toast({variant: 'destructive', title: 'خطأ في البحث', description: 'فشل الاتصال بالخادم.'});
    } finally {
        setLoading(false);
    }
  }, [cachedData, customTeamNames, getDisplayName, toast]);


  useEffect(() => {
    if (debouncedSearchTerm && isOpen) {
      handleSearch(debouncedSearchTerm);
    } else {
      setSearchResults([]);
    }
  }, [debouncedSearchTerm, handleSearch, isOpen]);

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
        toast({ title: 'نجاح', description: 'تم حفظ التغييرات بنجاح. قد تحتاج لإعادة فتح التطبيق لرؤية التحديثات.' });
        // Manually update local state to reflect changes immediately
        if (type === 'team') fetchCustomTeamNames();
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
  const popularItemsToShow = showAllPopular ? popularItems : popularItems.slice(0, 6);
  
  const processedSearchResults = React.useMemo(() => {
    return searchResults.map(result => {
        if(result.type === 'team') {
           return {...result, team: {...result.team, name: getDisplayName('team', result.team.id, result.team.name)}};
        }
        if(result.type === 'league') {
           return {...result, league: {...result.league, name: getDisplayName('league', result.league.id, result.league.name)}};
        }
        return result;
    });
  }, [searchResults, getDisplayName]);

  const renderContent = () => {
    if (loading && !debouncedSearchTerm) {
        return null;
    }

    if (loading && debouncedSearchTerm) {
        // Show local results even while remote is loading
        if (processedSearchResults.length > 0) {
            return (
                <>
                    <div className="absolute top-2 left-1/2 -translate-x-1/2"><Loader2 className="h-5 w-5 animate-spin" /></div>
                    {processedSearchResults.map(result => {
                        const item = result.type === 'team' ? result.team : result.league;
                        const isFavorited = !!favorites?.[result.type]?.[item.id];
                        return <ItemRow key={`${result.type}-${item.id}`} item={item} itemType={result.type} isFavorited={isFavorited} onFavoriteToggle={(i) => handleFavorite(i, result.type)} onResultClick={() => handleResultClick(result)} isAdmin={isAdmin} onRename={() => handleOpenRename(result.type, item.id, item)} />;
                    })}
                </>
            );
        }
        return <div className="flex justify-center items-center h-full"><Loader2 className="h-6 w-6 animate-spin" /></div>;
    }
    
    if (debouncedSearchTerm) {
      return processedSearchResults.length > 0 ? (
        processedSearchResults.map(result => {
          const item = result.type === 'team' ? result.team : result.league;
          const isFavorited = !!favorites?.[result.type]?.[item.id];
          return <ItemRow key={`${result.type}-${item.id}`} item={item} itemType={result.type} isFavorited={isFavorited} onFavoriteToggle={(i) => handleFavorite(i, result.type)} onResultClick={() => handleResultClick(result)} isAdmin={isAdmin} onRename={() => handleOpenRename(result.type, item.id, item)} />;
        })
      ) : <p className="text-muted-foreground text-center pt-8">لا توجد نتائج بحث.</p>;
    }

    return (
      <div className="space-y-2">
        <h3 className="font-bold text-md text-center text-muted-foreground">{itemType === 'teams' ? 'الفرق الأكثر شعبية' : 'البطولات الأكثر شعبية'}</h3>
        {popularItemsToShow.map(item => {
          const isFavorited = !!favorites?.[itemType]?.[item.id];
          const displayName = getDisplayName(itemType.slice(0,-1) as 'team' | 'league' , item.id, item.name);
          const resultType = itemType === 'teams' ? 'team' : 'league';
          const result = { [resultType]: { ...item, name: displayName }, type: resultType } as SearchResult;

          return <ItemRow key={item.id} item={{...item, name: displayName}} itemType={itemType} isFavorited={isFavorited} onFavoriteToggle={(i) => handleFavorite(i, itemType)} onResultClick={() => handleResultClick(result)} isAdmin={isAdmin} onRename={() => handleOpenRename(resultType, item.id, item)} />;
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
