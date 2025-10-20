

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
import { Search, Star, Pencil, Loader2, Heart } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useDebounce } from '@/hooks/use-debounce';
import type { ScreenProps } from '@/app/page';
import { useAdmin, useAuth, useFirestore } from '@/firebase/provider';
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, writeBatch, deleteField } from 'firebase/firestore';
import { RenameDialog } from '@/components/RenameDialog';
import { cn } from '@/lib/utils';
import type { Favorites, AdminFavorite, ManagedCompetition, Team } from '@/lib/types';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { useToast } from '@/hooks/use-toast';
import { POPULAR_TEAMS, POPULAR_LEAGUES } from '@/lib/popular-data';
import { hardcodedTranslations } from '@/lib/hardcoded-translations';
import { getLocalFavorites, setLocalFavorites } from '@/lib/local-favorites';

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
type RenameType = 'league' | 'team' | 'player' | 'continent' | 'country' | 'coach' | 'status';

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


const ItemRow = ({ item, itemType, isFavorited, isHearted, onFavoriteToggle, onResultClick, onRename, isAdmin }: { item: Item, itemType: ItemType, isFavorited: boolean, isHearted: boolean, onFavoriteToggle: (item: Item, type: 'star' | 'heart') => void, onResultClick: () => void, onRename: () => void, isAdmin: boolean }) => {
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
       <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onFavoriteToggle(item, 'heart')}>
        <Heart className={cn("h-5 w-5 text-muted-foreground/60", isHearted && "fill-current text-red-500")} />
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onFavoriteToggle(item, 'star')}>
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
  const [favorites, setFavorites] = useState<Partial<Favorites>>({});
  
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
        let unsub: (()=>void)[] = [];
        if (user && db) {
            const starredFavsRef = doc(db, 'users', user.uid, 'favorites', 'data');
            const ourLeagueRef = doc(db, 'users', user.uid, 'ourFavorites', 'league');
            const ourTeamsRef = doc(db, 'users', user.uid, 'ourFavorites', 'teams');

            const unsub1 = onSnapshot(starredFavsRef, (doc) => {
                const favs = doc.data() as Favorites || { userId: user.uid };
                setFavorites(prev => ({...prev, leagues: favs.leagues, teams: favs.teams}));
            });
            const unsub2 = onSnapshot(ourLeagueRef, (doc) => {
                setFavorites(prev => ({...prev, ourLeagueId: doc.exists() ? doc.data().leagueId : undefined}));
            });
            const unsub3 = onSnapshot(ourTeamsRef, (doc) => {
                setFavorites(prev => ({...prev, ourBallTeams: doc.exists() ? doc.data() : {}}));
            });
            unsub.push(unsub1, unsub2, unsub3);
        } else {
             setFavorites(getLocalFavorites());
        }
        return () => unsub.forEach(u => u());
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
    const normalizedQuery = normalizeArabic(query);

    if (!normalizedQuery) {
        setSearchResults([]);
        setLoading(false);
        return;
    }
    
    const localResults = localSearchIndex.filter(item => 
        item.normalizedName.includes(normalizedQuery)
    );

    const apiSearchPromises = [
      fetch(`/api/football/teams?search=${query}`).then(res => res.ok ? res.json() : { response: [] }),
      fetch(`/api/football/leagues?search=${query}`).then(res => res.ok ? res.json() : { response: [] })
    ];
    
    try {
        const [teamsData, leaguesData] = await Promise.all(apiSearchPromises);
        const existingIds = new Set(localResults.map(r => `${r.type}-${r.id}`));
        
        teamsData.response?.forEach((r: TeamResult) => {
            if(!existingIds.has(`teams-${r.team.id}`)) {
                localResults.push({
                    id: r.team.id,
                    type: 'teams',
                    name: r.team.name,
                    normalizedName: normalizeArabic(r.team.name),
                    logo: r.team.logo,
                    originalItem: r.team,
                });
                existingIds.add(`teams-${r.team.id}`);
            }
        });
        leaguesData.response?.forEach((r: LeagueResult) => {
             if(!existingIds.has(`leagues-${r.league.id}`)) {
                localResults.push({
                    id: r.league.id,
                    type: 'leagues',
                    name: r.league.name,
                    normalizedName: normalizeArabic(r.league.name),
                    logo: r.league.logo,
                    originalItem: r.league,
                });
                existingIds.add(`leagues-${r.league.id}`);
            }
        });
    } catch(e) {
        console.error("API search failed, showing local results only.", e);
    }
    
    setSearchResults(localResults);
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


  const handleFavorite = useCallback((item: Item, type: 'star' | 'heart') => {
        const isLeague = 'leagueId' in item || !('national' in item);
        const itemId = item.id;
        
        const currentFavorites = user && db ? favorites : getLocalFavorites();
        const newFavorites = JSON.parse(JSON.stringify(currentFavorites));

        if (user && db) { // Logged-in user
            if (type === 'heart') {
                if (isLeague) {
                    const ref = doc(db, 'users', user.uid, 'ourFavorites', 'league');
                    const isHearted = newFavorites.ourLeagueId === itemId;
                    const operation = isHearted ? deleteDoc(ref) : setDoc(ref, { leagueId: itemId, name: item.name, logo: item.logo });
                    operation.catch(err => errorEmitter.emit('permission-error', new FirestorePermissionError({path: ref.path, operation: 'write'})));
                } else { // Team
                    const ref = doc(db, 'users', user.uid, 'ourFavorites', 'teams');
                    const isHearted = newFavorites.ourBallTeams?.[itemId];
                    const favData = { name: item.name, teamId: itemId, logo: item.logo, type: (item as Team).national ? 'National' : 'Club' };
                    setDoc(ref, { [itemId]: isHearted ? deleteField() : favData }, { merge: true })
                        .catch(err => errorEmitter.emit('permission-error', new FirestorePermissionError({path: ref.path, operation: 'write'})));
                }
            } else { // Star
                const itemType: 'leagues' | 'teams' = isLeague ? 'leagues' : 'teams';
                const ref = doc(db, 'users', user.uid, 'favorites', 'data');
                const isStarred = newFavorites[itemType]?.[itemId];
                const favData = isLeague 
                    ? { name: item.name, leagueId: itemId, logo: item.logo }
                    : { name: item.name, teamId: itemId, logo: item.logo, type: (item as Team).national ? 'National' : 'Club' };
                setDoc(ref, { [itemType]: { [itemId]: isStarred ? deleteField() : favData } }, { merge: true })
                     .catch(err => errorEmitter.emit('permission-error', new FirestorePermissionError({path: ref.path, operation: 'write'})));
            }
        } else { // Guest user
            if (type === 'heart') {
                if (isLeague) {
                    if (newFavorites.ourLeagueId === itemId) delete newFavorites.ourLeagueId;
                    else newFavorites.ourLeagueId = itemId;
                } else {
                    if (!newFavorites.ourBallTeams) newFavorites.ourBallTeams = {};
                    if (newFavorites.ourBallTeams[itemId]) delete newFavorites.ourBallTeams[itemId];
                    else newFavorites.ourBallTeams[itemId] = { name: item.name, teamId: itemId, logo: item.logo, type: (item as Team).national ? 'National' : 'Club' };
                }
            } else {
                const itemType: 'leagues' | 'teams' = isLeague ? 'leagues' : 'teams';
                 if (!newFavorites[itemType]) newFavorites[itemType] = {};
                if (newFavorites[itemType]?.[itemId]) delete newFavorites[itemType]![itemId];
                else {
                     const favData = isLeague 
                        ? { name: item.name, leagueId: itemId, logo: item.logo }
                        : { name: item.name, teamId: itemId, logo: item.logo, type: (item as Team).national ? 'National' : 'Club' };
                    newFavorites[itemType]![itemId] = favData;
                }
            }
            setLocalFavorites(newFavorites);
            setFavorites(newFavorites);
        }
    }, [user, db, favorites]);

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
    
    const itemsToRender = debouncedSearchTerm ? searchResults : popularItems.map(item => ({
        id: item.id,
        type: itemType,
        name: item.name,
        logo: item.logo,
        originalItem: item,
        normalizedName: normalizeArabic(item.name)
    })).filter(i => i.type === itemType);

    if (itemsToRender.length === 0 && debouncedSearchTerm) {
        return <p className="text-muted-foreground text-center pt-8">لا توجد نتائج بحث.</p>;
    }

    return (
        <div className="space-y-2">
            {!debouncedSearchTerm && <h3 className="font-bold text-md text-center text-muted-foreground">{itemType === 'teams' ? 'الفرق الأكثر شعبية' : 'البطولات الأكثر شعبية'}</h3>}
            {itemsToRender.map(result => {
                const isFavorited = !!favorites?.[result.type]?.[result.id];
                const isHearted = result.type === 'leagues' ? favorites.ourLeagueId === result.id : !!favorites.ourBallTeams?.[result.id];
                const displayName = getDisplayName(result.type.slice(0, -1) as 'team'|'league', result.id, result.name);

                return <ItemRow key={`${result.type}-${result.id}`} item={{...result.originalItem, name: displayName}} itemType={result.type} isFavorited={isFavorited} isHearted={isHearted} onFavoriteToggle={handleFavorite} onResultClick={() => handleResultClick(result)} isAdmin={isAdmin} onRename={() => handleOpenRename(result.type as RenameType, result.id, result.originalItem)} />;
            })}
        </div>
    )
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

