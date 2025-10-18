
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
import type { Favorites, AdminFavorite } from '@/lib/types';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { useToast } from '@/hooks/use-toast';
import { POPULAR_TEAMS, POPULAR_LEAGUES } from '@/lib/popular-data';
import { hardcodedTranslations } from '@/lib/hardcoded-translations';

interface TeamResult {
  team: { id: number; name: string; logo: string; national?: boolean; };
  venue?: any;
}
interface LeagueResult {
  league: { id: number; name: string; logo: string; };
  country?: any;
}

type Item = TeamResult['team'] | LeagueResult['league'];
type ItemType = 'teams' | 'leagues';

type SearchResult = (TeamResult & { type: 'team' }) | (LeagueResult & { type: 'league' });

type RenameType = 'league' | 'team';

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
  const [customNames, setCustomNames] = useState<{leagues: Map<number, string>, teams: Map<number, string>, adminNotes: Map<number, string>}>({leagues: new Map(), teams: new Map(), adminNotes: new Map() });
  
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

  const fetchAllCustomNames = useCallback(async () => {
    if (!db) return;
    try {
        const [leaguesSnapshot, teamsSnapshot, adminFavsSnapshot] = await Promise.all([
            getDocs(collection(db, 'leagueCustomizations')),
            getDocs(collection(db, 'teamCustomizations')),
            isAdmin ? getDocs(collection(db, 'adminFavorites')) : Promise.resolve({ docs: [] }),
        ]);
        
        const leagueNames = new Map<number, string>();
        leaguesSnapshot?.forEach(doc => leagueNames.set(Number(doc.id), doc.data().customName));
        
        const teamNames = new Map<number, string>();
        teamsSnapshot?.forEach(doc => teamNames.set(Number(doc.id), doc.data().customName));

        const adminNotes = new Map<number, string>();
        adminFavsSnapshot?.forEach(doc => adminNotes.set(Number(doc.id), doc.data().note));
        
        setCustomNames({ leagues: leagueNames, teams: teamNames, adminNotes: adminNotes });
    } catch(error) {
         console.warn("Could not fetch custom names, this is expected for non-admins", error);
    }
  }, [db, isAdmin]);

  const getDisplayName = useCallback((type: 'team' | 'league', id: number, defaultName: string) => {
      // Prioritize custom name from Firestore
      const firestoreMap = type === 'team' ? customNames.teams : customNames.leagues;
      const customName = firestoreMap.get(id);
      if (customName) return customName;

      // Fallback to hardcoded translations
      const hardcodedMap = type === 'team' ? hardcodedTranslations.teams : hardcodedTranslations.leagues;
      const hardcodedName = hardcodedMap[id];
      if(hardcodedName) return hardcodedName;

      return defaultName;
  }, [customNames]);

  useEffect(() => {
    if (isOpen) {
      fetchFavorites();
      fetchAllCustomNames();
    }
  }, [isOpen, fetchFavorites, fetchAllCustomNames]);

 const applyCustomNamesToResults = useCallback((results: SearchResult[]): SearchResult[] => {
    return results.map(result => {
        if (result.type === 'team') {
            return {
                ...result,
                team: {
                    ...result.team,
                    name: getDisplayName('team', result.team.id, result.team.name),
                }
            };
        } else if (result.type === 'league') {
            return {
                ...result,
                league: {
                    ...result.league,
                    name: getDisplayName('league', result.league.id, result.league.name),
                }
            };
        }
        return result;
    });
  }, [getDisplayName]);


 const handleSearch = useCallback(async (query: string) => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery || trimmedQuery.length < 2) {
        setSearchResults([]);
        return;
    }
    setLoading(true);
    const resultsMap = new Map<string, SearchResult>();

    try {
        const isArabic = /[\u0600-\u06FF]/.test(trimmedQuery);
        
        const fetchAndSet = async (id: number, type: 'team' | 'league') => {
            const key = `${type}-${id}`;
            if (resultsMap.has(key)) return;
            const endpoint = type === 'team' ? 'teams' : 'leagues';
            try {
                const res = await fetch(`/api/football/${endpoint}?id=${id}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.response?.[0]) {
                        resultsMap.set(key, { ...data.response[0], type });
                    }
                }
            } catch (e) { console.error(`Failed to fetch ${type} with id ${id}`, e); }
        };

        if (isArabic) {
            const normalizedQuery = normalizeArabic(trimmedQuery);
            const customNamePromises: Promise<void>[] = [];

            // Search Firestore custom names
            customNames.teams.forEach((name, id) => {
                if (normalizeArabic(name).includes(normalizedQuery)) {
                    customNamePromises.push(fetchAndSet(id, 'team'));
                }
            });
            customNames.leagues.forEach((name, id) => {
                if (normalizeArabic(name).includes(normalizedQuery)) {
                    customNamePromises.push(fetchAndSet(id, 'league'));
                }
            });

            // Search hardcoded translations
            for (const id in hardcodedTranslations.teams) {
                const name = hardcodedTranslations.teams[id];
                if (normalizeArabic(name).includes(normalizedQuery)) {
                     customNamePromises.push(fetchAndSet(Number(id), 'team'));
                }
            }
             for (const id in hardcodedTranslations.leagues) {
                const name = hardcodedTranslations.leagues[id];
                if (normalizeArabic(name).includes(normalizedQuery)) {
                     customNamePromises.push(fetchAndSet(Number(id), 'league'));
                }
            }
            await Promise.all(customNamePromises);

        } else { // English search
            const [teamsData, leaguesData] = await Promise.all([
                fetch(`/api/football/teams?search=${trimmedQuery}`).then(res => res.json()),
                fetch(`/api/football/leagues?search=${trimmedQuery}`).then(res => res.json()),
            ]);

            teamsData.response?.forEach((r: TeamResult) => {
                if (!resultsMap.has(`team-${r.team.id}`)) resultsMap.set(`team-${r.team.id}`, { ...r, type: 'team' });
            });
            leaguesData.response?.forEach((r: LeagueResult) => {
                if (!resultsMap.has(`league-${r.league.id}`)) resultsMap.set(`league-${r.league.id}`, { ...r, type: 'league' });
            });
        }
        
        const allResults = Array.from(resultsMap.values());
        const localizedResults = applyCustomNamesToResults(allResults);
        setSearchResults(localizedResults);

    } catch (error) {
        console.error("API Search Error: ", error);
        toast({variant: 'destructive', title: 'خطأ في البحث', description: 'فشل الاتصال بالخادم.'});
        setSearchResults([]);
    } finally {
        setLoading(false);
    }
  }, [customNames.teams, customNames.leagues, toast, applyCustomNamesToResults]);


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
    const note = type === 'team' ? customNames.adminNotes.get(id) : undefined;
    setRenameItem({ id, name: currentName, note, type, originalData });
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

    if (type === 'team') {
        const noteRef = doc(db, "adminFavorites", String(id));
        if (newNote !== undefined && newNote.length > 0) {
            const data: AdminFavorite = {
                teamId: originalData.id,
                name: originalData.name,
                logo: originalData.logo,
                note: newNote
            };
            batch.set(noteRef, data);
        } else {
            batch.delete(noteRef);
        }
    }

    try {
        await batch.commit();
        toast({ title: 'نجاح', description: 'تم حفظ التغييرات بنجاح.' });
        await fetchAllCustomNames(); 
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

  const renderContent = () => {
    if (loading) {
      return <div className="flex justify-center items-center h-full"><Loader2 className="h-6 w-6 animate-spin" /></div>;
    }
    
    if (debouncedSearchTerm) {
      return searchResults.length > 0 ? (
        searchResults.map(result => {
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
        <div className="mt-4 flex-1 overflow-y-auto space-y-1 pr-2">
          {renderContent()}
        </div>
        
        {renameItem && (
          <RenameDialog 
            isOpen={!!renameItem}
            onOpenChange={(isOpen) => !isOpen && setRenameItem(null)}
            item={renameItem}
            onSave={(name, note) => handleSaveRename(renameItem.type, renameItem.id, name, note)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
