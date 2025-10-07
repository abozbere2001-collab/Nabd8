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
import type { ScreenKey, ScreenProps } from '@/app/page';
import { useAdmin, useFirebase } from '@/firebase/provider';
import { doc, onSnapshot, setDoc, updateDoc, deleteField, collection, getDocs, query, where, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import { RenameDialog } from '@/components/RenameDialog';
import { cn } from '@/lib/utils';

interface TeamResult {
  team: { id: number; name: string; logo: string; };
  venue: any;
}
interface LeagueResult {
  league: { id: number; name: string; logo: string; };
  country: any;
}

type SearchResult = (TeamResult & { type: 'team' }) | (LeagueResult & { type: 'league' });

interface Favorites {
    leagues?: { [key: number]: any };
    teams?: { [key: number]: any };
}
type RenameType = 'league' | 'team';

export function SearchSheet({ children, navigate }: { children: React.ReactNode, navigate: ScreenProps['navigate'] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [customNames, setCustomNames] = useState<{leagues: Map<number, string>, teams: Map<number, string>}>({leagues: new Map(), teams: new Map()});


  const { isAdmin, user } = useAdmin();
  const [favorites, setFavorites] = useState<Favorites>({});
  const [renameItem, setRenameItem] = useState<{ id: string | number, name: string, type: RenameType } | null>(null);
  const [isRenameOpen, setRenameOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'favorites', user.uid), (doc) => {
      setFavorites(doc.data() as Favorites || {});
    });
    return () => unsub();
  }, [user]);

  const getDisplayName = (type: 'team' | 'league', id: number, defaultName: string) => {
      if (type === 'team') {
          return customNames.teams.get(id) || defaultName;
      }
      return customNames.leagues.get(id) || defaultName;
  }

  useEffect(() => {
    const fetchAllCustomNames = async () => {
        const [leaguesSnapshot, teamsSnapshot] = await Promise.all([
            getDocs(collection(db, 'leagueCustomizations')),
            getDocs(collection(db, 'teamCustomizations'))
        ]);
        
        const leagueNames = new Map<number, string>();
        leaguesSnapshot.forEach(doc => leagueNames.set(Number(doc.id), doc.data().customName));
        
        const teamNames = new Map<number, string>();
        teamsSnapshot.forEach(doc => teamNames.set(Number(doc.id), doc.data().customName));
        
        setCustomNames({ leagues: leagueNames, teams: teamNames });
    };
    if (isOpen) {
        fetchAllCustomNames();
    }
  }, [isOpen]);

  const handleSearch = useCallback(async (queryTerm: string) => {
    if (!queryTerm.trim() || queryTerm.length < 3) {
      setResults([]);
      return;
    }
    setLoading(true);

    const resultsMap = new Map<string, SearchResult>();

    try {
        // 1. Search external API
        const [teamsRes, leaguesRes] = await Promise.all([
            fetch(`/api/football/teams?search=${queryTerm}`),
            fetch(`/api/football/leagues?search=${queryTerm}`)
        ]);
        const teamsData = await teamsRes.json();
        const leaguesData = await leaguesRes.json();

        if (teamsData.response) {
            teamsData.response.forEach((r: TeamResult) => resultsMap.set(`team-${r.team.id}`, { ...r, type: 'team' }));
        }
        if (leaguesData.response) {
            leaguesData.response.forEach((r: LeagueResult) => resultsMap.set(`league-${r.league.id}`, { ...r, type: 'league' }));
        }

        // 2. Search Firestore for custom names (case-insensitive for Arabic)
        const teamCustomQuery = query(collection(db, "teamCustomizations"), where("customName", ">=", queryTerm), where("customName", "<=", queryTerm + '\uf8ff'), limit(10));
        const leagueCustomQuery = query(collection(db, "leagueCustomizations"), where("customName", ">=", queryTerm), where("customName", "<=", queryTerm + '\uf8ff'), limit(10));

        const [teamCustomSnap, leagueCustomSnap] = await Promise.all([
            getDocs(teamCustomQuery),
            getDocs(leagueCustomQuery),
        ]);

        const firestoreTeamIds = teamCustomSnap.docs.map(d => d.id);
        const firestoreLeagueIds = leagueCustomSnap.docs.map(d => d.id);

        if (firestoreTeamIds.length > 0) {
            const teamDetailsRes = await fetch(`/api/football/teams?id=${firestoreTeamIds.join('-')}`);
            const teamDetailsData = await teamDetailsRes.json();
            if (teamDetailsData.response) {
                 teamDetailsData.response.forEach((r: TeamResult) => {
                    if (!resultsMap.has(`team-${r.team.id}`)) {
                        resultsMap.set(`team-${r.team.id}`, { ...r, type: 'team' });
                    }
                });
            }
        }
        
        if (firestoreLeagueIds.length > 0) {
            // API doesn't support multiple league IDs, fetch one by one
             for (const leagueId of firestoreLeagueIds) {
                if (!resultsMap.has(`league-${leagueId}`)) {
                    const leagueDetailsRes = await fetch(`/api/football/leagues?id=${leagueId}`);
                    const leagueDetailsData = await leagueDetailsRes.json();
                    if (leagueDetailsData.response?.[0]) {
                        resultsMap.set(`league-${leagueId}`, { ...leagueDetailsData.response[0], type: 'league' });
                    }
                }
            }
        }
      
      setResults(Array.from(resultsMap.values()));
    } catch (error) {
      console.error("Search failed:", error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      handleSearch(debouncedSearchTerm);
    }
  }, [debouncedSearchTerm, handleSearch, isOpen]);

  const handleOpenRename = (type: RenameType, id: string | number, name: string) => {
    setRenameItem({ id, name, type });
    setRenameOpen(true);
  };

  const handleSaveRename = async (newName: string) => {
    if (!renameItem) return;
    const { id, type } = renameItem;
    let collectionName = type === 'league' ? 'leagueCustomizations' : 'teamCustomizations';
    await setDoc(doc(db, collectionName, String(id)), { customName: newName });
    // Optimistically update custom names
    if (type === 'league') {
        setCustomNames(prev => ({...prev, leagues: new Map(prev.leagues).set(Number(id), newName)}));
    } else {
        setCustomNames(prev => ({...prev, teams: new Map(prev.teams).set(Number(id), newName)}));
    }
  };

  const handleFavorite = async (type: 'team' | 'league', item: any) => {
    if (!user) return;
    const favRef = doc(db, 'favorites', user.uid);
    const itemPath = type === 'team' ? 'teams' : 'leagues';
    const fieldPath = `${itemPath}.${item.id}`;
    const isFavorited = !!favorites?.[itemPath]?.[item.id];
    
    let favoriteData: any = {};
     if (type === 'team') {
       favoriteData = { teams: { [item.id]: { teamId: item.id, name: item.name, logo: item.logo }}};
    } else {
       favoriteData = { leagues: { [item.id]: { leagueId: item.id, name: item.name, logo: item.logo }}};
    }

    if (isFavorited) {
        await updateDoc(favRef, { [fieldPath]: deleteField() });
    } else {
        await setDoc(favRef, favoriteData, { merge: true });
    }
  };

  const handleResultClick = (result: SearchResult) => {
    if (result.type === 'team') {
      navigate('TeamDetails', { teamId: result.team.id });
    } else {
      navigate('CompetitionDetails', { leagueId: result.league.id, title: getDisplayName('league', result.league.id, result.league.name), logo: result.league.logo });
    }
    setIsOpen(false);
  }
  
  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="left" className="flex flex-col">
        <SheetHeader>
          <SheetTitle>البحث</SheetTitle>
        </SheetHeader>
        <div className="flex w-full items-center space-x-2 space-x-reverse">
            <Input
                type="text"
                placeholder="اكتب هنا للبحث عن فريق أو بطولة..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
                dir="rtl"
                autoFocus
            />
            <Button onClick={() => handleSearch(searchTerm)} disabled={loading} size="icon">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
        </div>
        <div className="mt-4 flex-1 overflow-y-auto">
            {loading && <div className="flex justify-center items-center h-full"><Loader2 className="h-6 w-6 animate-spin" /></div>}
            {!loading && results.length > 0 && (
                <ul className="space-y-2">
                {results.map(result => {
                    const item = result.type === 'team' ? result.team : result.league;
                    const displayName = getDisplayName(result.type, item.id, item.name);
                    const isFavorited = result.type === 'team' ? !!favorites?.teams?.[item.id] : !!favorites?.leagues?.[item.id];
                    return (
                        <li key={`${result.type}-${item.id}`} className="flex items-center gap-3 p-2 border rounded-md bg-card hover:bg-accent">
                        <div className='flex-1 flex items-center gap-3 cursor-pointer' onClick={() => handleResultClick(result)}>
                            <Avatar>
                                <AvatarImage src={item.logo} alt={displayName} />
                                <AvatarFallback>{displayName.substring(0, 2)}</AvatarFallback>
                            </Avatar>
                            <span className="font-semibold">{displayName}</span>
                            <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full">{result.type === 'team' ? 'فريق' : 'بطولة'}</span>
                        </div>
                        <div className='flex items-center'>
                            <Button variant="ghost" size="icon" onClick={() => handleFavorite(result.type, item)}>
                                <Star className={cn("h-5 w-5", isFavorited ? "text-yellow-400 fill-current" : "text-muted-foreground/60")} />
                            </Button>
                            {isAdmin && (
                                <Button variant="ghost" size="icon" onClick={() => handleOpenRename(result.type, item.id, displayName)}>
                                    <Pencil className="h-4 w-4 text-muted-foreground" />
                                </Button>
                            )}
                        </div>
                        </li>
                    )
                })}
                </ul>
            )}
            {!loading && results.length === 0 && debouncedSearchTerm.length > 2 && (
                <p className="text-muted-foreground text-center pt-8">لا توجد نتائج بحث.</p>
            )}
        </div>
        {renameItem && (
          <RenameDialog 
            isOpen={isRenameOpen}
            onOpenChange={setRenameOpen}
            currentName={renameItem.name}
            onSave={handleSaveRename}
            itemType={renameItem.type === 'team' ? 'الفريق' : 'البطولة'}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
