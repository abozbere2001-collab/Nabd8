
"use client";

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Star, Pencil, Plus, Search, Heart, RefreshCcw, Users, Trophy, Loader2 } from 'lucide-react';
import type { ScreenProps } from '@/app/page';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdmin, useAuth, useFirestore } from '@/firebase/provider';
import { doc, setDoc, collection, onSnapshot, query, updateDoc, deleteField, getDocs, writeBatch, getDoc, deleteDoc } from 'firebase/firestore';
import { RenameDialog } from '@/components/RenameDialog';
import { AddCompetitionDialog } from '@/components/AddCompetitionDialog';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import type { Favorites, ManagedCompetition as ManagedCompetitionType, Team } from '@/lib/types';
import { SearchSheet } from '@/components/SearchSheet';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from '@/hooks/use-toast';
import { hardcodedTranslations } from '@/lib/hardcoded-translations';
import { getLocalFavorites, setLocalFavorites } from '@/lib/local-favorites';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';


// --- Persistent Cache Logic ---
const COMPETITIONS_CACHE_KEY = 'goalstack_competitions_cache';
const TEAMS_CACHE_KEY = 'goalstack_national_teams_cache';
const CACHE_EXPIRATION_MS = 60 * 24 * 60 * 60 * 1000; // 60 days

interface Cache<T> {
    data: T;
    lastFetched: number;
}

const getCachedData = <T>(key: string): Cache<T> | null => {
    if (typeof window === 'undefined') return null;
    try {
        const cachedData = localStorage.getItem(key);
        if (!cachedData) return null;
        return JSON.parse(cachedData) as Cache<T>;
    } catch (error) {
        return null;
    }
};

const setCachedData = <T>(key: string, data: T) => {
    if (typeof window === 'undefined') return;
    const cacheData: Cache<T> = { data, lastFetched: Date.now() };
    localStorage.setItem(key, JSON.stringify(cacheData));
};

// --- TYPE DEFINITIONS ---
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

type RenameType = 'league' | 'team' | 'player' | 'continent' | 'country' | 'coach';
interface RenameState {
  id: string | number;
  name: string;
  originalName?: string;
  type: RenameType;
}

// --- CONSTANTS ---
const countryToContinent: { [key: string]: string } = {
    "World": "World", "England": "Europe", "Spain": "Europe", "Germany": "Europe", "Italy": "Europe", "France": "Europe", "Netherlands": "Europe", "Portugal": "Europe", "Belgium": "Europe", "Russia": "Europe", "Turkey": "Europe", "Greece": "Europe", "Switzerland": "Europe", "Austria": "Europe", "Denmark": "Europe", "Scotland": "Europe", "Sweden": "Europe", "Norway": "Europe", "Poland": "Europe", "Ukraine": "Europe", "Czech-Republic": "Europe", "Croatia": "Europe", "Romania": "Europe", "Serbia": "Europe", "Hungary": "Europe", "Finland": "Europe", "Ireland": "Europe", "Northern-Ireland": "Europe", "Wales": "Europe", "Iceland": "Europe", "Albania": "Europe", "Georgia": "Europe", "Latvia": "Europe", "Estonia": "Europe", "Lithuania": "Europe", "Luxembourg": "Europe", "Faroe-Islands": "Europe", "Malta": "Europe", "Andorra": "Europe", "San-Marino": "Europe", "Gibraltar": "Europe", "Kosovo": "Europe", "Bosnia-and-Herzegovina": "Europe", "Slovakia": "Europe", "Slovenia": "Europe", "Bulgaria": "Europe", "Cyprus": "Europe", "Azerbaijan": "Europe", "Armenia": "Europe", "Belarus": "Europe", "Moldova": "Europe", "North-Macedonia": "Europe", "Montenegro": "Europe",
    "Saudi-Arabia": "Asia", "Japan": "Asia", "South-Korea": "Asia", "China": "Asia", "Qatar": "Asia", "UAE": "Asia", "Iran": "Asia", "Iraq": "Asia", "Uzbekistan": "Asia", "Australia": "Asia", "Jordan": "Asia", "Syria": "Asia", "Lebanon": "Asia", "Oman": "Asia", "Kuwait": "Kuwait", "Bahrain": "Bahrain", "India": "Asia", "Thailand": "Asia", "Vietnam": "Asia", "Malaysia": "Asia", "Indonesia": "Asia", "Singapore": "Singapore", "Philippines": "Asia", "Hong-Kong": "Asia", "Palestine": "Asia", "Tajikistan": "Asia", "Turkmenistan": "Asia", "Kyrgyzstan": "Asia", "Bangladesh": "Asia", "Maldives": "Asia", "Cambodia": "Asia", "Myanmar": "Asia",
    "Egypt": "Africa", "Morocco": "Africa", "Tunisia": "Africa", "Algeria": "Africa", "Nigeria": "Africa", "Senegal": "Africa", "Ghana": "Africa", "Ivory-Coast": "Africa", "Cameroon": "Africa", "South-Africa": "Africa", "DR-Congo": "Africa", "Mali": "Africa", "Burkina-Faso": "Africa", "Guinea": "Africa", "Zambia": "Africa", "Cape-Verde": "Africa", "Uganda": "Africa", "Kenya": "Africa", "Tanzania": "Africa", "Sudan": "Sudan", "Libya": "Africa", "Angola": "Africa", "Zimbabwe": "Africa", "Ethiopia": "Africa",
    "USA": "North America", "Mexico": "North America", "Canada": "North America", "Costa-Rica": "North America", "Honduras": "North America", "Panama": "North America", "Jamaica": "North America", "El-Salvador": "North America", "Trinidad-and-Tobago": "North America", "Guatemala": "North America", "Nicaragua": "North America", "Cuba": "North America",
    "Brazil": "South America", "Argentina": "South America", "Colombia": "South America", "Chile": "South America", "Uruguay": "South America", "Peru": "South America", "Ecuador": "South America", "Paraguay": "South America", "Venezuela": "South America", "Bolivia": "South America",
    "New-Zealand": "Oceania", "Fiji": "Oceania",
    "Other": "Other"
};

const continentOrder = ["World", "Europe", "Asia", "Africa", "South America", "North America", "Oceania", "Other"];
const WORLD_LEAGUES_KEYWORDS = ["world", "uefa", "champions league", "europa", "copa libertadores", "copa sudamericana", "caf champions", "afc champions", "conmebol", "concacaf"];


// --- National Teams Component ---
const NationalTeamsTab = ({ navigate, onFavoriteToggle, favorites, isAdmin, onRename, getName }: { navigate: ScreenProps['navigate'], onFavoriteToggle: (item: Team, type: 'star' | 'heart') => void, favorites: Partial<Favorites>, isAdmin: boolean, onRename: (type: RenameType, id: string | number, name: string, originalName?: string) => void, getName: (type: 'team' | 'country' | 'continent', id: string | number, defaultName: string) => string }) => {
    const [nationalTeams, setNationalTeams] = useState<Team[] | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTeams = async () => {
            setLoading(true);
            const cached = getCachedData<Team[]>(TEAMS_CACHE_KEY);
            if (cached && Date.now() - cached.lastFetched < CACHE_EXPIRATION_MS) {
                setNationalTeams(cached.data);
                setLoading(false);
                return;
            }

            try {
                const res = await fetch('/api/football/teams?country=all');
                if (!res.ok) throw new Error('Failed to fetch teams');
                const data = await res.json();
                const teams = (data.response || []).map((r: {team: Team}) => r.team).filter((t: Team) => t.national);
                setCachedData(TEAMS_CACHE_KEY, teams);
                setNationalTeams(teams);
            } catch (error) {
                console.error("Error fetching national teams:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchTeams();
    }, []);

    const groupedTeams = useMemo(() => {
        if (!nationalTeams) return null;

        const processedTeams = nationalTeams.map(team => ({
            ...team,
            name: getName('team', team.id, team.name),
        }));

        const grouped: TeamsByContinent = {};
        processedTeams.forEach(team => {
            const continent = countryToContinent[team.name] || "Other";
            if (!grouped[continent]) grouped[continent] = [];
            grouped[continent].push(team);
        });

        Object.keys(grouped).forEach(continent => {
            grouped[continent].sort((a,b) => a.name.localeCompare(b.name, 'ar'));
        });
        
        return grouped;
    }, [nationalTeams, getName]);

    if (loading) {
        return Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />);
    }

    if (!groupedTeams) {
        return <p className="text-center py-8 text-muted-foreground">فشل تحميل المنتخبات.</p>;
    }
    
    return (
      <Accordion type="multiple" className="w-full space-y-4">
        {continentOrder.filter(c => groupedTeams[c]).map(continent => (
          <AccordionItem value={continent} key={continent} className="rounded-lg border bg-card/50">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <h3 className="text-lg font-bold">{getName('continent', continent, continent)}</h3>
            </AccordionTrigger>
            <AccordionContent className="p-1">
              <ul className="flex flex-col">{
                groupedTeams[continent].map(team =>
                  <li key={team.id} className="flex w-full items-center justify-between p-3 h-12 hover:bg-accent/80 transition-colors rounded-md group">
                    <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => navigate('TeamDetails', { teamId: team.id })}>
                      <Avatar className="h-6 w-6"><AvatarImage src={team.logo} alt={team.name} /></Avatar>
                      <span className="text-sm truncate">{team.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); onFavoriteToggle(team, 'heart'); }}>
                        <Heart className={favorites.ourBallTeams?.[team.id] ? "h-5 w-5 text-red-500 fill-current" : "h-5 w-5 text-muted-foreground/50"} />
                      </Button>
                      {isAdmin && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); onRename('team', team.id, team.name, nationalTeams?.find(t => t.id === team.id)?.name) }}>
                          <Pencil className="h-4 w-4 text-muted-foreground/80" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); onFavoriteToggle(team, 'star'); }}>
                        <Star className={favorites.teams?.[team.id] ? "h-5 w-5 text-yellow-400 fill-current" : "h-5 w-5 text-muted-foreground/50"} />
                      </Button>
                    </div>
                  </li>
                )
              }</ul>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    );
}

// --- Club Competitions Component ---
const ClubCompetitionsTab = ({ navigate, onFavoriteToggle, favorites, isAdmin, onRename, getName }: { navigate: ScreenProps['navigate'], onFavoriteToggle: (item: ManagedCompetitionType, type: 'star' | 'heart') => void, favorites: Partial<Favorites>, isAdmin: boolean, onRename: (type: RenameType, id: string | number, name: string, originalName?: string) => void, getName: (type: 'league' | 'country' | 'continent', id: string | number, defaultName: string) => string }) => {
    const [managedCompetitions, setManagedCompetitions] = useState<ManagedCompetitionType[] | null>(null);
    const [customNames, setCustomNames] = useState<{ leagues: Map<number, string>, countries: Map<string, string>, continents: Map<string, string> } | null>(null);
    const [loading, setLoading] = useState(true);
    const { db } = useFirestore();
    const { toast } = useToast();

    const fetchAllData = useCallback(async (forceRefresh = false) => {
        if (!db) return;
        setLoading(true);

        try {
            const cachedData = getCachedData<{ managedCompetitions: ManagedCompetitionType[], customNames: any }>(COMPETITIONS_CACHE_KEY);
            let serverLastUpdated = 0;
            try {
                const cacheBusterRef = doc(db, 'appConfig', 'cache');
                const cacheBusterSnap = await getDoc(cacheBusterRef);
                serverLastUpdated = cacheBusterSnap.exists() ? cacheBusterSnap.data().competitionsLastUpdated?.toMillis() : 0;
            } catch (e) { console.warn("Could not check cache-buster."); }

            if (cachedData && !forceRefresh && cachedData.lastFetched > serverLastUpdated && Date.now() - cachedData.lastFetched < CACHE_EXPIRATION_MS) {
                setManagedCompetitions(cachedData.data.managedCompetitions);
                setCustomNames({
                    leagues: new Map(Object.entries(cachedData.data.customNames.leagues || {}).map(([k, v]) => [Number(k), v as string])),
                    countries: new Map(Object.entries(cachedData.data.customNames.countries || {})),
                    continents: new Map(Object.entries(cachedData.data.customNames.continents || {})),
                });
            } else {
                const compsSnapshot = await getDocs(collection(db, 'managedCompetitions'));
                const fetchedCompetitions = compsSnapshot.docs.map(d => d.data() as ManagedCompetitionType);
                let fetchedCustomNames = { leagues: {}, countries: {}, continents: {} };

                if (isAdmin) {
                    try {
                        const [leaguesSnapshot, countriesSnapshot, continentsSnapshot] = await Promise.all([
                            getDocs(collection(db, 'leagueCustomizations')),
                            getDocs(collection(db, 'countryCustomizations')),
                            getDocs(collection(db, 'continentCustomizations')),
                        ]);
                        fetchedCustomNames.leagues = Object.fromEntries(leaguesSnapshot.docs.map(d => [d.id, d.data().customName]));
                        fetchedCustomNames.countries = Object.fromEntries(countriesSnapshot.docs.map(d => [d.id, d.data().customName]));
                        fetchedCustomNames.continents = Object.fromEntries(continentsSnapshot.docs.map(d => [d.id, d.data().customName]));
                    } catch (adminError) { console.warn("Admin failed to fetch customizations.", adminError); }
                }
                setCachedData(COMPETITIONS_CACHE_KEY, { managedCompetitions: fetchedCompetitions, customNames: fetchedCustomNames });
                setManagedCompetitions(fetchedCompetitions);
                setCustomNames({
                    leagues: new Map(Object.entries(fetchedCustomNames.leagues).map(([k, v]) => [Number(k), v as string])),
                    countries: new Map(Object.entries(fetchedCustomNames.countries)),
                    continents: new Map(Object.entries(fetchedCustomNames.continents)),
                });
            }
        } catch (error) {
            console.error("Failed to fetch competitions data:", error);
            if (error instanceof Error && (error.message.includes('permission-denied') || error.message.includes('insufficient permissions'))) {
                toast({ variant: "destructive", title: "خطأ في الصلاحيات", description: "فشل تحميل بعض البيانات." });
            }
            setManagedCompetitions([]);
        } finally {
            setLoading(false);
        }
    }, [db, isAdmin, toast]);
    
    useEffect(() => { fetchAllData(); }, [fetchAllData]);

    const sortedGroupedCompetitions = useMemo(() => {
        if (!managedCompetitions || !customNames) return null;
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
                const sortedCountries = Object.keys(countries).sort((a,b) => getName('country', a, a).localeCompare(getName('country', b, b), 'ar'));
                const sortedCountriesObj: CompetitionsByCountry = {};
                for (const country of sortedCountries) {
                    countries[country].leagues.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
                    sortedCountriesObj[country] = countries[country];
                }
                sortedGrouped[continent] = sortedCountriesObj;
            }
        }
        return sortedGrouped;
    }, [managedCompetitions, getName, customNames]);

    if (loading) {
        return Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />);
    }

    if (!managedCompetitions || !sortedGroupedCompetitions || !customNames) {
        return <p className="text-center py-8 text-muted-foreground">لم تتم إضافة بطولات بعد.</p>;
    }

    return (
        <Accordion type="multiple" className="w-full space-y-4">
            {Object.entries(sortedGroupedCompetitions).map(([continent, content]) => (
                 <AccordionItem value={continent} key={continent} className="rounded-lg border bg-card/50">
                    <div className="flex items-center px-4 py-3 h-12">
                        <AccordionTrigger className="hover:no-underline flex-1">
                            <h3 className="text-lg font-bold">{getName('continent', continent, continent)}</h3>
                        </AccordionTrigger>
                        {isAdmin && (<Button variant="ghost" size="icon" className="h-9 w-9 mr-2" onClick={(e) => { e.stopPropagation(); onRename('continent', continent, getName('continent', continent, continent), continent); }}>
                                <Pencil className="h-4 w-4 text-muted-foreground/80" />
                        </Button>)}
                    </div>
                    <AccordionContent className="p-2">
                         {"leagues" in content ? (
                            <div className="p-1">
                                <ul className="flex flex-col">{
                                    (content.leagues as ManagedCompetitionType[]).map(comp => 
                                        <li key={comp.leagueId} className="flex w-full items-center justify-between p-3 h-12 hover:bg-accent/80 transition-colors rounded-md group">
                                            <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => navigate('CompetitionDetails', { title: comp.name, leagueId: comp.leagueId, logo: comp.logo })}>
                                                <img src={comp.logo} alt={comp.name} className="h-6 w-6 object-contain" />
                                                <span className="text-sm truncate">{comp.name}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); onFavoriteToggle(comp, 'heart'); }}>
                                                    <Heart className={favorites.ourLeagueId === comp.leagueId ? "h-5 w-5 text-red-500 fill-current" : "h-5 w-5 text-muted-foreground/50"} />
                                                </Button>
                                                {isAdmin && (
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); onRename('league', comp.leagueId, comp.name, managedCompetitions.find(c => c.leagueId === comp.leagueId)?.name) }}>
                                                        <Pencil className="h-4 w-4 text-muted-foreground/80" />
                                                    </Button>
                                                )}
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); onFavoriteToggle(comp, 'star'); }}>
                                                    <Star className={favorites.leagues?.[comp.leagueId] ? "h-5 w-5 text-yellow-400 fill-current" : "h-5 w-5 text-muted-foreground/50"} />
                                                </Button>
                                            </div>
                                        </li>
                                    )
                                }</ul>
                            </div>
                        ) : (
                            <Accordion type="multiple" className="w-full space-y-2">
                                {Object.entries(content as CompetitionsByCountry).map(([country, { flag, leagues }]) => (
                                     <AccordionItem value={country} key={country} className="rounded-lg border bg-card/50">
                                        <div className="flex items-center px-4 py-3 h-12">
                                            <AccordionTrigger className="hover:no-underline flex-1">
                                              <div className="flex items-center gap-3">
                                                  {flag && <img src={flag} alt={country} className="h-5 w-7 object-contain" />}
                                                  <span className="font-semibold">{getName('country', country, country)}</span>
                                              </div>
                                            </AccordionTrigger>
                                            {isAdmin && <Button variant="ghost" size="icon" className="h-9 w-9 mr-2" onClick={(e) => { e.stopPropagation(); onRename('country', country, getName('country', country, country), country); }}><Pencil className="h-4 w-4 text-muted-foreground/80" /></Button>}
                                          </div>
                                        <AccordionContent className="p-1">
                                            <ul className="flex flex-col">{leagues.map(comp => 
                                                <li key={comp.leagueId} className="flex w-full items-center justify-between p-3 h-12 hover:bg-accent/80 transition-colors rounded-md group">
                                                    <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => navigate('CompetitionDetails', { title: comp.name, leagueId: comp.leagueId, logo: comp.logo })}>
                                                        <img src={comp.logo} alt={comp.name} className="h-6 w-6 object-contain" />
                                                        <span className="text-sm truncate">{comp.name}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); onFavoriteToggle(comp, 'heart'); }}>
                                                            <Heart className={favorites.ourLeagueId === comp.leagueId ? "h-5 w-5 text-red-500 fill-current" : "h-5 w-5 text-muted-foreground/50"} />
                                                        </Button>
                                                        {isAdmin && (
                                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); onRename('league', comp.leagueId, comp.name, managedCompetitions.find(c => c.leagueId === comp.leagueId)?.name) }}>
                                                                <Pencil className="h-4 w-4 text-muted-foreground/80" />
                                                            </Button>
                                                        )}
                                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); onFavoriteToggle(comp, 'star'); }}>
                                                            <Star className={favorites.leagues?.[comp.leagueId] ? "h-5 w-5 text-yellow-400 fill-current" : "h-5 w-5 text-muted-foreground/50"} />
                                                        </Button>
                                                    </div>
                                                </li>
                                            )}</ul>
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                        )}
                    </AccordionContent>
                </AccordionItem>
            ))}
        </Accordion>
    );
};


// --- MAIN SCREEN COMPONENT ---
export function AllCompetitionsScreen({ navigate, goBack, canGoBack }: ScreenProps) {
    const { isAdmin } = useAdmin();
    const { user, db } = useAuth();
    const { toast } = useToast();
    
    const [favorites, setFavorites] = useState<Partial<Favorites>>({});
    const [renameItem, setRenameItem] = useState<RenameState | null>(null);
    const [isAddOpen, setAddOpen] = useState(false);
    
    const [customNames, setCustomNames] = useState<{ leagues: Map<number, string>, teams: Map<number, string>, countries: Map<string, string>, continents: Map<string, string> } | null>(null);

    const getName = useCallback((type: 'league' | 'team' | 'country' | 'continent', id: string | number, defaultName: string) => {
        if (!customNames) return defaultName;

        const firestoreMap = type === 'league' ? customNames.leagues : type === 'team' ? customNames.teams : type === 'country' ? customNames.countries : customNames.continents;
        const customName = firestoreMap?.get(id as any);
        if (customName) return customName;

        const hardcodedKey = type === 'league' ? 'leagues' : type === 'team' ? 'teams' : type === 'country' ? 'countries' : 'continents';
        const hardcodedName = hardcodedTranslations[hardcodedKey]?.[id as any];
        if(hardcodedName) return hardcodedName;

        return defaultName;
    }, [customNames]);

    useEffect(() => {
        if (!db) {
             setCustomNames({ leagues: new Map(), teams: new Map(), countries: new Map(), continents: new Map() });
             return;
        };

        const fetchCustomNames = async () => {
             const [leaguesSnapshot, teamsSnapshot, countriesSnapshot, continentsSnapshot] = await Promise.all([
                getDocs(collection(db, 'leagueCustomizations')),
                getDocs(collection(db, 'teamCustomizations')),
                getDocs(collection(db, 'countryCustomizations')),
                getDocs(collection(db, 'continentCustomizations')),
            ]).catch(() => {
                console.warn("Could not fetch some or all custom names. This is expected for non-admins.");
                return [null, null, null, null];
            });
            const newCustomNames = { leagues: new Map(), teams: new Map(), countries: new Map(), continents: new Map() };
            leaguesSnapshot?.docs.forEach(d => newCustomNames.leagues.set(Number(d.id), d.data().customName));
            teamsSnapshot?.docs.forEach(d => newCustomNames.teams.set(Number(d.id), d.data().customName));
            countriesSnapshot?.docs.forEach(d => newCustomNames.countries.set(d.id, d.data().customName));
            continentsSnapshot?.docs.forEach(d => newCustomNames.continents.set(d.id, d.data().customName));
            setCustomNames(newCustomNames);
        };
        fetchCustomNames();
    }, [db]);


    useEffect(() => {
        let unsubscribe: (() => void) | null = null;
        if (user && db) {
            const docRef = doc(db, 'users', user.uid, 'favorites', 'data');
            unsubscribe = onSnapshot(docRef, (doc) => {
                setFavorites(doc.data() as Favorites || { userId: user.uid });
            }, (error) => {
                if (user) errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'get' }));
                setFavorites(getLocalFavorites());
            });
        } else {
            setFavorites(getLocalFavorites());
        }
        return () => { if (unsubscribe) unsubscribe(); };
    }, [user, db]);

    const handleFavorite = useCallback((item: ManagedCompetitionType | Team, type: 'star' | 'heart') => {
        const itemId = 'leagueId' in item ? item.leagueId : item.id;
        const itemType: 'leagues' | 'teams' = 'leagueId' in item ? 'leagues' : 'teams';

        const currentFavorites = user && db ? favorites : getLocalFavorites();
        const newFavorites = JSON.parse(JSON.stringify(currentFavorites));
        
        let updateData: any;

        if (itemType === 'leagues') {
            const comp = item as ManagedCompetitionType;
             if (type === 'heart') { // 'heart' for ourLeague
                const isCurrentlyOurLeague = newFavorites.ourLeagueId === itemId;
                 if (isCurrentlyOurLeague) {
                    delete newFavorites.ourLeagueId;
                    updateData = { ourLeagueId: deleteField() };
                } else {
                    newFavorites.ourLeagueId = itemId;
                    updateData = { ourLeagueId: itemId };
                }
            } else { // 'star' for regular favorite leagues
                const isCurrentlyStarred = !!newFavorites.leagues?.[itemId];
                if (isCurrentlyStarred) {
                    if (newFavorites.leagues) delete newFavorites.leagues[itemId];
                    updateData = { [`leagues.${itemId}`]: deleteField() };
                } else {
                    if (!newFavorites.leagues) newFavorites.leagues = {};
                    const favData = { name: comp.name, leagueId: itemId, logo: comp.logo };
                    newFavorites.leagues[itemId] = favData;
                    updateData = { [`leagues.${itemId}`]: favData };
                }
            }
        } else { // 'teams'
            const team = item as Team;
            if (type === 'heart') {
                const isCurrentlyOurBall = !!newFavorites.ourBallTeams?.[itemId];
                if (isCurrentlyOurBall) {
                     if (newFavorites.ourBallTeams) delete newFavorites.ourBallTeams[itemId];
                    updateData = { [`ourBallTeams.${itemId}`]: deleteField() };
                } else {
                    if (!newFavorites.ourBallTeams) newFavorites.ourBallTeams = {};
                    const favData = { name: team.name, teamId: itemId, logo: team.logo, type: team.national ? 'National' : 'Club' };
                    newFavorites.ourBallTeams[itemId] = favData;
                    updateData = { [`ourBallTeams.${itemId}`]: favData };
                }
            } else {
                 const isCurrentlyStarred = !!newFavorites.teams?.[itemId];
                if (isCurrentlyStarred) {
                    if (newFavorites.teams) delete newFavorites.teams[itemId];
                    updateData = { [`teams.${itemId}`]: deleteField() };
                } else {
                    if (!newFavorites.teams) newFavorites.teams = {};
                    const favData = { name: team.name, teamId: itemId, logo: team.logo, type: team.national ? 'National' : 'Club' };
                    newFavorites.teams[itemId] = favData;
                    updateData = { [`teams.${itemId}`]: favData };
                }
            }
        }
        
        setFavorites(newFavorites);

        if (user && db) {
            const favRef = doc(db, 'users', user.uid, 'favorites', 'data');
            setDoc(favRef, updateData, { merge: true }).catch(serverError => {
                setFavorites(currentFavorites);
                const permissionError = new FirestorePermissionError({ path: favRef.path, operation: 'update', requestResourceData: updateData });
                errorEmitter.emit('permission-error', permissionError);
            });
        } else {
            setLocalFavorites(newFavorites);
        }
    }, [user, db, favorites]);

    const handleSaveRename = (type: RenameType, id: string | number, newName: string) => {
      if (!db) return;
      const collectionName = `${type}Customizations`;
      const docId = String(id);
      
      const originalName = renameItem?.originalName;
      const data = { customName: newName };

      const op = (newName && newName !== originalName)
        ? setDoc(doc(db, collectionName, docId), data)
        : deleteDoc(doc(db, collectionName, docId));

      op.then(() => {
          localStorage.removeItem(COMPETITIONS_CACHE_KEY); 
          localStorage.removeItem(TEAMS_CACHE_KEY); 
          toast({ title: 'نجاح', description: 'تم حفظ التغييرات.' });
          // The components will refetch on their own
      }).catch(serverError => {
          const permissionError = new FirestorePermissionError({ path: doc(db, collectionName, docId).path, operation: 'write' });
          errorEmitter.emit('permission-error', permissionError);
      });
      setRenameItem(null);
    };

    const handleAdminRefresh = async () => {
        if (!db) return;
        toast({ title: 'بدء التحديث...', description: 'جاري تحديث بيانات البطولات لجميع المستخدمين.' });
        try {
            const cacheBusterRef = doc(db, 'appConfig', 'cache');
            await setDoc(cacheBusterRef, { competitionsLastUpdated: new Date() }, { merge: true });
            localStorage.removeItem(COMPETITIONS_CACHE_KEY);
            localStorage.removeItem(TEAMS_CACHE_KEY);
            toast({ title: 'نجاح', description: 'تم مسح ذاكرة التخزين المؤقت. سيتم جلب البيانات الجديدة عند إعادة فتح الشاشة.' });
        } catch (error) {
            const permissionError = new FirestorePermissionError({ path: 'appConfig/cache', operation: 'write' });
            errorEmitter.emit('permission-error', permissionError);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في فرض التحديث.' });
        }
    };

    if (!customNames) {
        return (
             <div className="flex h-full flex-col bg-background">
                <ScreenHeader title="كل البطولات" onBack={goBack} canGoBack={canGoBack} />
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col bg-background">
            <ScreenHeader 
                title="كل البطولات" 
                onBack={goBack} 
                canGoBack={canGoBack} 
                actions={
                  <div className="flex items-center gap-1">
                      <SearchSheet navigate={navigate}>
                          <Button variant="ghost" size="icon">
                              <Search className="h-5 w-5" />
                          </Button>
                      </SearchSheet>
                      {isAdmin && (
                        <>
                            <Button size="icon" variant="ghost" onClick={handleAdminRefresh}>
                                <RefreshCcw className="h-5 w-5" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => setAddOpen(true)}>
                                <Plus className="h-5 w-5" />
                            </Button>
                        </>
                      )}
                  </div>
                }
            />
            <div className="flex-1 overflow-y-auto">
                 <Tabs defaultValue="clubs" className="w-full">
                    <div className="sticky top-0 bg-background z-10 px-1 pt-1">
                        <div className="bg-card text-card-foreground rounded-b-lg border-x border-b shadow-md">
                            <TabsList className="grid w-full grid-cols-2 bg-transparent p-0 h-11">
                                <TabsTrigger value="national-teams" className="data-[state=active]:shadow-none"><Users className="ml-1 h-4 w-4"/>المنتخبات</TabsTrigger>
                                <TabsTrigger value="clubs" className="data-[state=active]:shadow-none"><Trophy className="ml-1 h-4 w-4"/>الأندية</TabsTrigger>
                            </TabsList>
                        </div>
                    </div>
                    <TabsContent value="clubs" className="p-4 mt-0 space-y-4">
                         <ClubCompetitionsTab 
                            navigate={navigate}
                            favorites={favorites}
                            isAdmin={isAdmin}
                            onFavoriteToggle={handleFavorite}
                            onRename={(type, id, name, originalName) => setRenameItem({ type, id, name, originalName })}
                            getName={getName}
                         />
                    </TabsContent>
                    <TabsContent value="national-teams" className="p-4 mt-0 space-y-4">
                         <NationalTeamsTab 
                            navigate={navigate}
                            favorites={favorites}
                            isAdmin={isAdmin}
                            onFavoriteToggle={handleFavorite}
                            onRename={(type, id, name, originalName) => setRenameItem({ type, id, name, originalName })}
                            getName={getName}
                         />
                    </TabsContent>
                 </Tabs>
            </div>
            
            {renameItem && <RenameDialog
                isOpen={!!renameItem}
                onOpenChange={(isOpen) => !isOpen && setRenameItem(null)}
                item={renameItem}
                onSave={(type, id, newName) => handleSaveRename(type, id, newName)}
            />}
            <AddCompetitionDialog isOpen={isAddOpen} onOpenChange={(isOpen) => {
                setAddOpen(isOpen);
                if(!isOpen) {
                    localStorage.removeItem(COMPETITIONS_CACHE_KEY); 
                }
            }} />
        </div>
    );
}
