

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
import { Search, Star, Pencil, Loader2, Heart } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useDebounce } from '@/hooks/use-debounce';
import type { ScreenKey, ScreenProps } from '@/app/page';
import { useAdmin, useAuth, useFirestore } from '@/firebase/provider';
import { doc, getDoc, setDoc, updateDoc, deleteField, collection, getDocs, query, where, limit, orderBy } from 'firebase/firestore';
import { RenameDialog } from '@/components/RenameDialog';
import { NoteDialog } from '@/components/NoteDialog';
import { cn } from '@/lib/utils';
import type { Favorites } from '@/lib/types';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { useToast } from '@/hooks/use-toast';

interface TeamResult {
  team: { id: number; name: string; logo: string; };
  venue: any;
}
interface LeagueResult {
  league: { id: number; name: string; logo: string; };
  country: any;
}

type SearchResult = (TeamResult & { type: 'team' }) | (LeagueResult & { type: 'league' });

type RenameType = 'league' | 'team';

export function SearchSheet({ children, navigate }: { children: React.ReactNode, navigate: ScreenProps['navigate'] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [customNames, setCustomNames] = useState<{leagues: Map<number, string>, teams: Map<number, string>}>({leagues: new Map(), teams: new Map()});


  const { isAdmin } = useAdmin();
  const { user } = useAuth();
  const { db } = useFirestore();
  const { toast } = useToast();
  const [favorites, setFavorites] = useState<Favorites>({ userId: user?.uid || ''});
  const [renameItem, setRenameItem] = useState<{ id: string | number, name: string, type: RenameType } | null>(null);
  const [isRenameOpen, setRenameOpen] = useState(false);
  
  const [noteTeam, setNoteTeam] = useState<{id: number, name: string, logo: string} | null>(null);
  const [isNoteOpen, setIsNoteOpen] = useState(false);

  const fetchFavorites = useCallback(async () => {
    if (!user || !db) return;
    const docRef = doc(db, 'favorites', user.uid);
    getDoc(docRef).then(docSnap => {
        if (docSnap.exists()) {
            setFavorites(docSnap.data() as Favorites);
        } else {
            setFavorites({ userId: user.uid });
        }
    }).catch(error => {
        const permissionError = new FirestorePermissionError({ path: docRef.path, operation: 'get' });
        errorEmitter.emit('permission-error', permissionError);
    });
  }, [user, db]);

  useEffect(() => {
    if (isOpen && user) {
        fetchFavorites();
    }
  }, [isOpen, user, fetchFavorites]);

  const getDisplayName = (type: 'team' | 'league', id: number, defaultName: string) => {
      const key = `${type}s` as 'teams' | 'leagues';
      return customNames[key]?.get(id) || defaultName;
  }
  
  const fetchAllCustomNames = useCallback(async () => {
    if (!db) return;
    const leaguesCollection = collection(db, 'leagueCustomizations');
    const teamsCollection = collection(db, 'teamCustomizations');
    
    try {
        const [leaguesSnapshot, teamsSnapshot] = await Promise.all([
            getDocs(leaguesCollection),
            getDocs(teamsCollection)
        ]);
        
        const leagueNames = new Map<number, string>();
        leaguesSnapshot?.forEach(doc => leagueNames.set(Number(doc.id), doc.data().customName));
        
        const teamNames = new Map<number, string>();
        teamsSnapshot?.forEach(doc => teamNames.set(Number(doc.id), doc.data().customName));
        
        setCustomNames({ leagues: leagueNames, teams: teamNames as any });
    } catch(error) {
         const permissionError = new FirestorePermissionError({ path: 'leagueCustomizations or teamCustomizations', operation: 'list' });
         errorEmitter.emit('permission-error', permissionError);
    }
  }, [db]);


  useEffect(() => {
    if (isOpen) {
        fetchAllCustomNames();
    }
  }, [isOpen, fetchAllCustomNames]);

  const handleSearch = useCallback(async (queryTerm: string) => {
    if (!queryTerm.trim() || queryTerm.length < 2) {
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

        // 2. Search Firestore for custom names (starts with logic)
        if (db) {
            const teamCustomQuery = query(
                collection(db, "teamCustomizations"), 
                orderBy("customName"),
                where("customName", ">=", queryTerm), 
                where("customName", "<=", queryTerm + '\uf8ff'), 
                limit(10)
            );
            const leagueCustomQuery = query(
                collection(db, "leagueCustomizations"), 
                orderBy("customName"),
                where("customName", ">=", queryTerm), 
                where("customName", "<=", queryTerm + '\uf8ff'), 
                limit(10)
            );

            const [teamCustomSnap, leagueCustomSnap] = await Promise.all([
                getDocs(teamCustomQuery),
                getDocs(leagueCustomQuery),
            ]);
            
            const firestoreTeamIds: string[] = [];
            teamCustomSnap.forEach(doc => firestoreTeamIds.push(doc.id));
            
            const firestoreLeagueIds: string[] = [];
            leagueCustomSnap.forEach(doc => firestoreLeagueIds.push(doc.id));


            const teamPromises = firestoreTeamIds.map(async teamId => {
                if (!resultsMap.has(`team-${teamId}`)) {
                    const res = await fetch(`/api/football/teams?id=${teamId}`);
                    const data = await res.json();
                    if (data.response?.[0]) {
                        resultsMap.set(`team-${teamId}`, { ...data.response[0], type: 'team' });
                    }
                }
            });

            const leaguePromises = firestoreLeagueIds.map(async leagueId => {
                if (!resultsMap.has(`league-${leagueId}`)) {
                    const res = await fetch(`/api/football/leagues?id=${leagueId}`);
                    const data = await res.json();
                    if (data.response?.[0]) {
                        resultsMap.set(`league-${leagueId}`, { ...data.response[0], type: 'league' });
                    }
                }
            });

            await Promise.all([...teamPromises, ...leaguePromises]);
        }
      
      setResults(Array.from(resultsMap.values()));
    } catch (error) {
      const permissionError = new FirestorePermissionError({
        path: 'teamCustomizations/leagueCustomizations',
        operation: 'list'
      });
      errorEmitter.emit('permission-error', permissionError);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [db]);

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
    if (!renameItem || !db) return;
    const { id, type } = renameItem;
    let collectionName = type === 'league' ? 'leagueCustomizations' : 'teamCustomizations';
    const docRef = doc(db, collectionName, String(id));
    const data = { customName: newName };
    setDoc(docRef, data)
        .then(() => fetchAllCustomNames())
        .catch(serverError => {
            const permissionError = new FirestorePermissionError({
                path: docRef.path,
                operation: 'create',
                requestResourceData: data,
            });
            errorEmitter.emit('permission-error', permissionError);
        });
  };
  
  const handleOpenNote = (team: {id: number, name: string, logo: string}) => {
    setNoteTeam(team);
    setIsNoteOpen(true);
  }

  const handleSaveNote = async (note: string) => {
    if (!noteTeam || !db) return;
    const docRef = doc(db, "adminFavorites", String(noteTeam.id));
    const data = {
      teamId: noteTeam.id,
      name: noteTeam.name,
      logo: noteTeam.logo,
      note: note
    };
    setDoc(docRef, data)
        .catch(serverError => {
            const permissionError = new FirestorePermissionError({
                path: docRef.path,
                operation: 'create',
                requestResourceData: data,
            });
            errorEmitter.emit('permission-error', permissionError);
        });
  }

  const handleFavorite = async (type: 'team' | 'league', item: any) => {
    if (!user || !db) return;
    const favRef = doc(db, 'favorites', user.uid);
    const itemPath = type === 'team' ? 'teams' : 'leagues';
    const fieldPath = `${itemPath}.${item.id}`;
    const isFavorited = !!favorites?.[itemPath]?.[item.id];
    
    let favoriteData: any = { userId: user.uid };
     if (type === 'team') {
       favoriteData.teams = { [item.id]: { teamId: item.id, name: item.name, logo: item.logo }};
    } else {
       favoriteData.leagues = { [item.id]: { leagueId: item.id, name: item.name, logo: item.logo }};
    }

    const operation = isFavorited
        ? updateDoc(favRef, { [fieldPath]: deleteField() })
        : setDoc(favRef, favoriteData, { merge: true });

    operation
        .then(() => fetchFavorites())
        .catch(serverError => {
            const permissionError = new FirestorePermissionError({
                path: favRef.path,
                operation: isFavorited ? 'update' : 'create',
                requestResourceData: favoriteData,
            });
            errorEmitter.emit('permission-error', permissionError);
        });
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
        <div className="flex w-full items-center space-x-2">
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
                            <div className="font-semibold">
                                {displayName}
                                {isAdmin && <span className="block text-xs text-muted-foreground font-normal">(ID: {item.id})</span>}
                            </div>
                            <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full">{result.type === 'team' ? 'فريق' : 'بطولة'}</span>
                        </div>
                        <div className='flex items-center'>
                            {isAdmin && result.type === 'team' && (
                                <Button variant="ghost" size="icon" onClick={() => handleOpenNote(item)}>
                                    <Heart className="h-4 w-4 text-muted-foreground" />
                                </Button>
                            )}
                            <Button variant="ghost" size="icon" onClick={() => handleFavorite(result.type, {...item, name: displayName })}>
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
        {noteTeam && <NoteDialog
            isOpen={isNoteOpen}
            onOpenChange={setIsNoteOpen}
            onSave={handleSaveNote}
            teamName={noteTeam.name}
        />}
      </SheetContent>
    </Sheet>
  );
}
