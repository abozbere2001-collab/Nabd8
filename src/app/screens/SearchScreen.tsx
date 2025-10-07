"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Input } from "@/components/ui/input";
import { Button } from '@/components/ui/button';
import { Search, Star, Pencil, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useDebounce } from '@/hooks/use-debounce';
import type { ScreenKey, ScreenProps } from '@/app/page';
import { useAdmin, useFirebase } from '@/firebase/provider';
import { doc, onSnapshot, setDoc, updateDoc, deleteField } from 'firebase/firestore';
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

export function SearchScreen({ navigate, goBack, canGoBack, headerActions }: ScreenProps & { headerActions?: React.ReactNode }) {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

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

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 3) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const [teamsRes, leaguesRes] = await Promise.all([
        fetch(`/api/football/teams?search=${query}`),
        fetch(`/api/football/leagues?search=${query}`)
      ]);
      const teamsData = await teamsRes.json();
      const leaguesData = await leaguesRes.json();

      const combinedResults: SearchResult[] = [];
      if (teamsData.response) {
        combinedResults.push(...teamsData.response.map((r: TeamResult) => ({ ...r, type: 'team' } as const)));
      }
      if (leaguesData.response) {
        combinedResults.push(...leaguesData.response.map((r: LeagueResult) => ({ ...r, type: 'league' } as const)));
      }
      setResults(combinedResults);
    } catch (error) {
      console.error("Search failed:", error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    handleSearch(debouncedSearchTerm);
  }, [debouncedSearchTerm, handleSearch]);

  const handleOpenRename = (type: RenameType, id: string | number, name: string) => {
    setRenameItem({ id, name, type });
    setRenameOpen(true);
  };

  const handleSaveRename = async (newName: string) => {
    if (!renameItem) return;
    const { id, type } = renameItem;
    let collectionName = type === 'league' ? 'leagueCustomizations' : 'teamCustomizations';
    await setDoc(doc(db, collectionName, String(id)), { customName: newName });
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
      navigate('CompetitionDetails', { leagueId: result.league.id, title: result.league.name, logo: result.league.logo });
    }
  }
  
  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader title="البحث" onBack={goBack} canGoBack={canGoBack} actions={headerActions} />
        <div className="p-4 space-y-4 flex flex-col flex-1">
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
                <Button onClick={() => handleSearch(searchTerm)} disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
            </div>
            <div className="mt-4 flex-1 overflow-y-auto">
                {loading && <div className="flex justify-center items-center h-full"><Loader2 className="h-6 w-6 animate-spin" /></div>}
                {!loading && results.length > 0 && (
                    <ul className="space-y-2">
                    {results.map(result => {
                        const item = result.type === 'team' ? result.team : result.league;
                        const isFavorited = result.type === 'team' ? !!favorites?.teams?.[item.id] : !!favorites?.leagues?.[item.id];
                        return (
                            <li key={`${result.type}-${item.id}`} className="flex items-center gap-3 p-2 border rounded-md bg-card cursor-pointer hover:bg-accent">
                            <div className='flex-1 flex items-center gap-3' onClick={() => handleResultClick(result)}>
                                <Avatar>
                                    <AvatarImage src={item.logo} alt={item.name} />
                                    <AvatarFallback>{item.name.substring(0, 2)}</AvatarFallback>
                                </Avatar>
                                <span className="font-semibold">{item.name}</span>
                                <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full">{result.type === 'team' ? 'فريق' : 'بطولة'}</span>
                            </div>
                            <div className='flex items-center'>
                                <Button variant="ghost" size="icon" onClick={() => handleFavorite(result.type, item)}>
                                    <Star className={cn("h-5 w-5", isFavorited ? "text-yellow-400 fill-current" : "text-muted-foreground/60")} />
                                </Button>
                                {isAdmin && (
                                    <Button variant="ghost" size="icon" onClick={() => handleOpenRename(result.type, item.id, item.name)}>
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
    </div>
  );
}
