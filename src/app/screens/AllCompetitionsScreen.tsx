"use client";

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Star, Pencil, Plus, Search, Users, Trophy, Loader2, RefreshCw } from 'lucide-react';
import type { ScreenProps } from '@/app/page';
import { Button } from '@/components/ui/button';
import { useAdmin, useAuth, useFirestore } from '@/firebase/provider';
import { doc, setDoc, collection, onSnapshot, getDocs, writeBatch, getDoc, deleteDoc, deleteField, updateDoc } from 'firebase/firestore';
import { RenameDialog } from '@/components/RenameDialog';
import { AddCompetitionDialog } from '@/components/AddCompetitionDialog';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import type { Favorites, ManagedCompetition as ManagedCompetitionType, Team } from '@/lib/types';
import { SearchSheet } from '@/components/SearchSheet';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from '@/hooks/use-toast';
import { getLocalFavorites, setLocalFavorites } from '@/lib/local-favorites';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { hardcodedTranslations } from '@/lib/hardcoded-translations';
import { LeagueHeaderItem } from '@/components/LeagueHeaderItem';
import { POPULAR_LEAGUES } from '@/lib/popular-data';

const API_KEY = process.env.NEXT_PUBLIC_API_FOOTBALL_KEY;
const API_HOST = 'v3.football.api-sports.io';
const COMPETITIONS_CACHE_KEY = 'goalstack_competitions_cache';
const COUNTRIES_CACHE_KEY = 'goalstack_countries_cache';
const TEAMS_CACHE_KEY = 'goalstack_national_teams_cache';
const CACHE_EXPIRATION_MS = 60 * 24 * 60 * 60 * 1000;

interface CompetitionsCache {
    managedCompetitions: ManagedCompetitionType[];
    lastFetched: number;
}

const getCachedData = <T,>(key: string): { data: T; lastFetched: number } | null => {
    if (typeof window === 'undefined') return null;
    try {
        const cachedData = localStorage.getItem(key);
        if (!cachedData) return null;
        const parsed = JSON.parse(cachedData);
        if (!parsed || !parsed.lastFetched || Date.now() - parsed.lastFetched > CACHE_EXPIRATION_MS) {
            localStorage.removeItem(key);
            return null;
        }
        return parsed as { data: T; lastFetched: number };
    } catch (error) {
        return null;
    }
};

const setCachedData = <T,>(key: string, data: T) => {
    if (typeof window === 'undefined') return;
    const cacheData = { data, lastFetched: Date.now() };
    localStorage.setItem(key, JSON.stringify(cacheData));
};

interface CompetitionsByCountry {
    [country: string]: {
        flag: string | null;
        leagues: ManagedCompetitionType[];
    };
}
interface GroupedClubCompetitions {
  [continent: string]: CompetitionsByCountry | { leagues: ManagedCompetitionType[] };
}
interface TeamsByContinent {
    [continent: string]: Team[]
}

type RenameType = 'league' | 'team' | 'player' | 'continent' | 'country' | 'coach' | 'status' | 'crown';
interface RenameState {
  id: string | number;
  name: string;
  purpose: 'rename' | 'note' | 'crown';
  note?: string;
  originalData?: any;
  originalName?: string;
}

const countryToContinent: { [key: string]: string } = {
    "World": "World", "England": "Europe", "Spain": "Europe", "Germany": "Europe", "Italy": "Europe", "France": "Europe",
    "Saudi Arabia": "Asia", "Japan": "Asia", "South Korea": "Asia", "China": "Asia", "Qatar": "Asia", "United Arab Emirates": "Asia", "Iran": "Asia", "Iraq": "Asia",
    "Egypt": "Africa", "Morocco": "Africa", "Tunisia": "Africa", "Algeria": "Africa", "Nigeria": "Africa", "Senegal": "Africa",
    "USA": "North America", "Mexico": "North America", "Canada": "North America",
    "Brazil": "South America", "Argentina": "South America",
    "New Zealand": "Oceania", "Fiji": "Oceania",
    "International": "World",
};

const continentOrder = ["World", "Europe", "Asia", "Africa", "South America", "North America", "Oceania", "Other"];
const WORLD_LEAGUES_KEYWORDS = ["world", "uefa", "champions league", "europa", "copa libertadores", "copa sudamericana", "caf champions", "afc champions", "conmebol", "concacaf"];

export function AllCompetitionsScreen({ navigate, goBack, canGoBack }: ScreenProps) {
    const { isAdmin, db } = useAdmin();
    const { user } = useAuth();
    const { toast } = useToast();
    
    const [favorites, setFavorites] = useState<Partial<Favorites>>({});
    const [renameItem, setRenameItem] = useState<RenameState | null>(null);
    const [isAddOpen, setAddOpen] = useState(false);
    const [customNames, setCustomNames] = useState<{ leagues: Map<number, string>, teams: Map<number, string>, countries: Map<string, string>, continents: Map<string, string> }>({ leagues: new Map(), teams: new Map(), countries: new Map(), continents: new Map() });
    const [managedCompetitions, setManagedCompetitions] = useState<ManagedCompetitionType[] | null>(null);
    const [nationalTeams, setNationalTeams] = useState<Team[] | null>(null);
    const [loadingClubData, setLoadingClubData] = useState(true);
    const [loadingNationalTeams, setLoadingNationalTeams] = useState(false);

    const getName = useCallback((type: 'league' | 'team' | 'country' | 'continent', id: string | number, defaultName: string) => {
        if (!defaultName) return '';
        const mapKey = type === 'league' ? 'leagues' : type === 'team' ? 'teams' : type === 'country' ? 'countries' : 'continents';
        const firestoreMap = customNames[mapKey];
        const customName = firestoreMap.get(id as any);
        if (customName) return customName;
        const hardcodedKey = `${type}s` as 'leagues' | 'teams' | 'countries' | 'continents';
        const hardcodedName = hardcodedTranslations[hardcodedKey]?.[id];
        if (hardcodedName) return hardcodedName;
        return defaultName;
    }, [customNames]);

    const fetchAllData = useCallback(async (forceRefresh = false) => {
        setLoadingClubData(true);

        const fetchCustomNames = async () => {
             if (!db) { 
                setCustomNames({ leagues: new Map(), teams: new Map(), countries: new Map(), continents: new Map() });
                return;
            };
            
            const [leaguesSnapshot, countriesSnapshot, continentsSnapshot, teamsSnapshot] = await Promise.all([
                getDocs(collection(db, 'leagueCustomizations')),
                getDocs(collection(db, 'countryCustomizations')),
                getDocs(collection(db, 'continentCustomizations')),
                getDocs(collection(db, 'teamCustomizations')),
            ]).catch(() => {
                toast({ variant: 'destructive', title: "خطأ", description: "فشل في تحميل بيانات التخصيص." });
                return [null, null, null, null];
            });

            const fetchedCustomNames = {
                leagues: new Map<number, string>(),
                countries: new Map<string, string>(),
                continents: new Map<string, string>(),
                teams: new Map<number, string>()
            };

            leaguesSnapshot?.forEach(d => fetchedCustomNames.leagues.set(Number(d.id), d.data().customName));
            countriesSnapshot?.forEach(d => fetchedCustomNames.countries.set(d.id, d.data().customName));
            continentsSnapshot?.forEach(d => fetchedCustomNames.continents.set(d.id, d.data().customName));
            teamsSnapshot?.forEach(d => fetchedCustomNames.teams.set(Number(d.id), d.data().customName));
            
            setCustomNames(fetchedCustomNames);
        };

        const fetchClubData = async () => {
             if (db) {
                 const handleSnapshot = (snapshot: any) => {
                    const fetchedCompetitions = snapshot.docs.map((doc: any) => doc.data() as ManagedCompetitionType);
                    const allCompetitions = [...fetchedCompetitions];
                    const managedLeagueIds = new Set(fetchedCompetitions.map(c => c.leagueId));
                    POPULAR_LEAGUES.forEach(popularLeague => {
                        if (!managedLeagueIds.has(popularLeague.id)) {
                             allCompetitions.push({
                                leagueId: popularLeague.id,
                                name: popularLeague.name,
                                logo: popularLeague.logo,
                                countryName: popularLeague.country,
                                countryFlag: popularLeague.country_flag,
                            });
                        }
                    });
                    setManagedCompetitions(allCompetitions);
                    if (isAdmin && fetchedCompetitions.length > 0) {
                        setCachedData(COMPETITIONS_CACHE_KEY, { managedCompetitions: fetchedCompetitions, lastFetched: Date.now() });
                    }
                };

                const handleError = (error: any) => {
                    console.error("Firestore 'managedCompetitions' error:", error);
                    toast({ variant: 'destructive', title: "خطأ", description: "فشل في تحميل البطولات." });
                    setManagedCompetitions([]);
                };

                 if (isAdmin) {
                     const cached = getCachedData<CompetitionsCache>(COMPETITIONS_CACHE_KEY);
                    if (cached?.data?.managedCompetitions && cached.data.managedCompetitions.length > 0 && !forceRefresh) {
                        setManagedCompetitions(cached.data.managedCompetitions);
                        return; 
                    }
                    try {
                        const compsSnapshot = await getDocs(collection(db, 'managedCompetitions'));
                        handleSnapshot(compsSnapshot);
                    } catch (error) {
                         errorEmitter.emit('permission-error', new FirestorePermissionError({
                            path: 'managedCompetitions',
                            operation: 'list',
                        }));
                        handleError(error);
                    }
                 } else {
                    onSnapshot(collection(db, 'managedCompetitions'), handleSnapshot, handleError);
                 }
                 return;
            }
            const allCompetitions = [...POPULAR_LEAGUES.map(l => ({ leagueId: l.id, name: l.name, logo: l.logo, countryName: l.country, countryFlag: l.country_flag }))];
            setManagedCompetitions(allCompetitions);
        };

        await fetchCustomNames();
        await fetchClubData();
        setLoadingClubData(false);
    }, [db, toast, isAdmin]);

    useEffect(() => {
        fetchAllData();
        let unsubscribe: (() => void) | null = null;
        if (user && !user.isAnonymous && db) {
            const favoritesRef = doc(db, 'users', user.uid, 'favorites', 'data');
            unsubscribe = onSnapshot(favoritesRef, (docSnap) => {
                setFavorites(docSnap.exists() ? (docSnap.data() as Favorites) : {});
            }, (error) => {
                 if(error.code === 'permission-denied') {
                    setFavorites(getLocalFavorites());
                } else {
                    errorEmitter.emit('permission-error', new FirestorePermissionError({
                        path: favoritesRef.path,
                        operation: 'get',
                    }));} else {
                const response = await fetch(`https://v3.football.api-sports.io/teams?country=${cachedCountries?.data?.map(c => c.name).join(',')}`, { headers });
                const result = await response.json();
                if (result?.response) {
                    const teams: Team[] = result.response.map((t: any) => ({
                        id: t.team.id,
                        name: t.team.name,
                        country: t.team.country,
                        logo: t.team.logo,
                    }));
                    setNationalTeams(teams);
                    setCachedData(TEAMS_CACHE_KEY, teams);
                }
            }
        } catch (error) {
            console.error("Error fetching national teams:", error);
            toast({ variant: 'destructive', title: "خطأ", description: "فشل في جلب بيانات المنتخبات." });
        } finally {
            setLoadingNationalTeams(false);
        }
    }, [toast]);

    return null; // أو يمكنك استبداله بالعرض المناسب للشاشة إذا لزم
                         }
                }
            });
        } else {
             setFavorites(getLocalFavorites());
        }
        return () => { if (unsubscribe) unsubscribe(); };
    }, [user, db, fetchAllData]);

    const sortedGroupedCompetitions = useMemo(() => {
        if (managedCompetitions === null) return null;
        const processedCompetitions = managedCompetitions.map(comp => ({ ...comp, name: getName('league', comp.leagueId, comp.name) }));
        const grouped: GroupedClubCompetitions = {};
        processedCompetitions.forEach(comp => {
            const countryName = comp.countryName;
            const continent = countryToContinent[countryName] || "Other";
            const isWorldLeague = WORLD_LEAGUES_KEYWORDS.some(keyword => comp.name.toLowerCase().includes(keyword)) || continent === 'World';
            if (isWorldLeague) {
                if (!grouped.World) grouped.World = { leagues: [] };
                (grouped.World as { leagues: ManagedCompetitionType[] }).leagues.push(comp);
            } else {
                if (!grouped[continent]) grouped[continent] = {};
                const continentGroup = grouped[continent] as CompetitionsByCountry;
                if (!continentGroup[countryName]) {
                    continentGroup[countryName] = { flag: comp.countryFlag, leagues: [] };
                }
                continentGroup[countryName].leagues.push(comp);
            }
        });
        const sortedGrouped: GroupedClubCompetitions = {};
        const continents = Object.keys(grouped).sort((a, b) => continentOrder.indexOf(a) - continentOrder.indexOf(b));
        for (const continent of continents) {
            if (continent === "World") {
                 const worldLeagues = (grouped.World as { leagues: ManagedCompetitionType[] }).leagues;
                 worldLeagues.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
                 sortedGrouped.World = { leagues: worldLeagues };
            } else {
                const countries = grouped[continent] as CompetitionsByCountry;
                const sortedCountries = Object.keys(countries).sort((a,b) => getName('country', a, a).localeCompare(getName('country', b, b), '
