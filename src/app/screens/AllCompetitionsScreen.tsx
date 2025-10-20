
"use client";

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Star, Pencil, Plus, Search, Heart, RefreshCcw, Users, Trophy, Loader2 } from 'lucide-react';
import type { ScreenProps } from '@/app/page';
import { Button } from '@/components/ui/button';
import { useAdmin, useAuth, useFirestore } from '@/firebase/provider';
import { doc, setDoc, collection, onSnapshot, getDocs, writeBatch, getDoc, deleteDoc, deleteField } from 'firebase/firestore';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ProfileButton } from '../AppContentWrapper';


// --- Persistent Cache Logic ---
const COMPETITIONS_CACHE_KEY = 'goalstack_competitions_cache';
const TEAMS_CACHE_KEY = 'goalstack_national_teams_cache';
const CACHE_EXPIRATION_MS = 60 * 24 * 60 * 60 * 1000; // 60 days

interface CompetitionsCache {
    managedCompetitions: ManagedCompetitionType[];
    customNames: { leagues: Record<string, string>, countries: Record<string, string>, continents: Record<string, string> };
    lastFetched: number;
}

const getCachedData = <T>(key: string): { data: T; lastFetched: number } | null => {
    if (typeof window === 'undefined') return null;
    try {
        const cachedData = localStorage.getItem(key);
        if (!cachedData) return null;
        return JSON.parse(cachedData) as { data: T; lastFetched: number };
    } catch (error) {
        return null;
    }
};

const setCachedData = <T>(key: string, data: T) => {
    if (typeof window === 'undefined') return;
    const cacheData = { data, lastFetched: Date.now() };
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
    "Brazil": "South America", "Argentina": "South America", "Colombia": "South America", "Chile": "South America", "Uruguay": "South America", "Peru": "South America", "Ecuador": "South America", "Paraguay": "South America", "Venezuela": "South America", "Bolivia": "Bolivia",
    "New-Zealand": "Oceania", "Fiji": "Oceania",
    "Other": "Other"
};

const continentOrder = ["World", "Europe", "Asia", "Africa", "South America", "North America", "Oceania", "Other"];
const WORLD_LEAGUES_KEYWORDS = ["world", "uefa", "champions league", "europa", "copa libertadores", "copa sudamericana", "caf champions", "afc champions", "conmebol", "concacaf"];


// --- MAIN SCREEN COMPONENT ---
export function AllCompetitionsScreen({ navigate, goBack, canGoBack }: ScreenProps) {
    const { isAdmin, db } = useAdmin();
    const { user } = useAuth();
    const { toast } = useToast();
    
    const [favorites, setFavorites] = useState<Partial<Favorites>>({});
    const [renameItem, setRenameItem] = useState<RenameState | null>(null);
    const [isAddOpen, setAddOpen] = useState(false);
    
    const [customNames, setCustomNames] = useState<{ leagues: Map<number, string>, teams: Map<number, string>, countries: Map<string, string>, continents: Map<string, string> } | null>(null);

    const [managedCompetitions, setManagedCompetitions] = useState<ManagedCompetitionType[] | null>(null);
    const [nationalTeams, setNationalTeams] = useState<Team[] | null>(null);
    const [loadingData, setLoadingData] = useState(true);


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

    const fetchAllData = useCallback(async (forceRefresh = false) => {
        setLoadingData(true);
    
        const fetchClubData = async () => {
          if (!db) return { competitions: [], customNames: { leagues: new Map(), countries: new Map(), continents: new Map() } };
          
          const cached = getCachedData<CompetitionsCache>(COMPETITIONS_CACHE_KEY);
          let serverLastUpdated = 0;
          try {
            const cacheBusterRef = doc(db, 'appConfig', 'cache');
            const cacheBusterSnap = await getDoc(cacheBusterRef);
            serverLastUpdated = cacheBusterSnap.exists() ? cacheBusterSnap.data().competitionsLastUpdated?.toMillis() : 0;
          } catch (e) { console.warn("Could not check cache-buster."); }
    
          if (cached?.data && !forceRefresh && cached.lastFetched > serverLastUpdated && Date.now() - cached.lastFetched < CACHE_EXPIRATION_MS) {
            return {
              competitions: cached.data.managedCompetitions,
              customNames: {
                leagues: new Map(Object.entries(cached.data.customNames.leagues || {})),
                countries: new Map(Object.entries(cached.data.customNames.countries || {})),
                continents: new Map(Object.entries(cached.data.customNames.continents || {}))
              }
            };
          }
    
          try {
            const compsSnapshot = await getDocs(collection(db, 'managedCompetitions'));
            const fetchedCompetitions = compsSnapshot.docs.map(d => d.data() as ManagedCompetitionType);
            
            let fetchedCustomNames = { leagues: new Map<number, string>(), countries: new Map<string, string>(), continents: new Map<string, string>() };

            if (isAdmin) {
              const [leaguesSnapshot, countriesSnapshot, continentsSnapshot] = await Promise.all([
                getDocs(collection(db, 'leagueCustomizations')),
                getDocs(collection(db, 'countryCustomizations')),
                getDocs(collection(db, 'continentCustomizations')),
              ]);
              leaguesSnapshot.docs.forEach(d => fetchedCustomNames.leagues.set(Number(d.id), d.data().customName));
              countriesSnapshot.docs.forEach(d => fetchedCustomNames.countries.set(d.id, d.data().customName));
              continentsSnapshot.docs.forEach(d => fetchedCustomNames.continents.set(d.id, d.data().customName));
            }
            
            const cachePayload: CompetitionsCache = { 
                managedCompetitions: fetchedCompetitions, 
                customNames: {
                    leagues: Object.fromEntries(fetchedCustomNames.leagues),
                    countries: Object.fromEntries(fetchedCustomNames.countries),
                    continents: Object.fromEntries(fetchedCustomNames.continents),
                },
                lastFetched: Date.now()
            };
            setCachedData(COMPETITIONS_CACHE_KEY, cachePayload);
    
            return {
              competitions: fetchedCompetitions,
              customNames: fetchedCustomNames
            };
          } catch (error) {
            console.error("Failed to fetch competitions data:", error);
            if (error instanceof Error && (error.message.includes('permission-denied') || error.message.includes('insufficient permissions'))) {
                toast({ variant: "destructive", title: "خطأ في الصلاحيات", description: "فشل تحميل بيانات البطولات." });
            }
            return { competitions: [], customNames: { leagues: new Map(), countries: new Map(), continents: new Map() } };
          }
        };
    
        const fetchNationalTeams = async () => {
          const cached = getCachedData<Team[]>(TEAMS_CACHE_KEY);
          if (cached && !forceRefresh && Date.now() - cached.lastFetched < CACHE_EXPIRATION_MS) {
            return cached.data;
          }
    
          try {
            const res = await fetch('/api/football/teams?country=all');
            if (!res.ok) throw new Error('Failed to fetch teams');
            const data = await res.json();
            const teams = (data.response || []).map((r: {team: Team}) => r.team).filter((t: Team) => t.national);
            setCachedData(TEAMS_CACHE_KEY, teams);
            return teams;
          } catch (error) {
            console.error("Error fetching national teams:", error);
            return [];
          }
        };
        
        const [clubResult, teamsResult, customTeamsSnapshot] = await Promise.all([
          fetchClubData(),
          fetchNationalTeams(),
          isAdmin ? getDocs(collection(db, 'teamCustomizations')) : Promise.resolve({ docs: [] })
        ]);
    
        const teamNamesMap = new Map<number, string>();
        customTeamsSnapshot.docs.forEach(doc => teamNamesMap.set(Number(doc.id), doc.data().customName));
        
        setManagedCompetitions(clubResult.competitions);
        setNationalTeams(teamsResult);
        setCustomNames({
          leagues: clubResult.customNames.leagues,
          countries: clubResult.customNames.countries,
          continents: clubResult.customNames.continents,
          teams: teamNamesMap
        });
        setLoadingData(false);
      }, [db, isAdmin, toast]);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

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
    
    const groupedNationalTeams = useMemo(() => {
        if (!nationalTeams || !customNames) return null;

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
    }, [nationalTeams, getName, customNames]);


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
             if (type === 'heart') { 
                const isCurrentlyOurLeague = newFavorites.ourLeagueId === itemId;
                 if (isCurrentlyOurLeague) {
                    delete newFavorites.ourLeagueId;
                    updateData = { ourLeagueId: deleteField() };
                } else {
                    newFavorites.ourLeagueId = itemId;
                    updateData = { ourLeagueId: itemId };
                }
            } else { 
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
          fetchAllData(true);
          toast({ title: 'نجاح', description: 'تم حفظ التغييرات.' });
      }).catch(serverError => {
          const permissionError = new FirestorePermissionError({ path: doc(db, collectionName, docId).path, operation: 'write' });
          errorEmitter.emit('permission-error', permissionError);
      });
      setRenameItem(null);
    };

    const handleAdminRefresh = async () => {
        if (!db) return;
        toast({ title: 'بدء التحديث...', description: 'جاري تحديث بيانات البطولات والمنتخبات لجميع المستخدمين.' });
        try {
            const cacheBusterRef = doc(db, 'appConfig', 'cache');
            await setDoc(cacheBusterRef, { competitionsLastUpdated: new Date() }, { merge: true });
            localStorage.removeItem(COMPETITIONS_CACHE_KEY);
            localStorage.removeItem(TEAMS_CACHE_KEY);
            await fetchAllData(true);
            toast({ title: 'نجاح', description: 'تم تحديث البيانات بنجاح.' });
        } catch (error) {
            const permissionError = new FirestorePermissionError({ path: 'appConfig/cache', operation: 'write' });
            errorEmitter.emit('permission-error', permissionError);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في فرض التحديث.' });
        }
    };


    const renderNationalTeams = () => {
        if (!groupedNationalTeams) return null;

        return continentOrder.filter(c => groupedNationalTeams[c]).map(continent => (
            <AccordionItem value={`national-${continent}`} key={`national-${continent}`} className="rounded-lg border bg-card/50">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <h3 className="text-lg font-bold">{getName('continent', continent, continent)}</h3>
              </AccordionTrigger>
              <AccordionContent className="p-1">
                <ul className="flex flex-col">{
                  groupedNationalTeams[continent].map(team =>
                    <li key={team.id} className="flex w-full items-center justify-between p-3 h-12 hover:bg-accent/80 transition-colors rounded-md group">
                      <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => navigate('TeamDetails', { teamId: team.id })}>
                        <Avatar className="h-6 w-6"><AvatarImage src={team.logo} alt={team.name} /></Avatar>
                        <span className="text-sm truncate">{team.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleFavorite(team, 'heart'); }}>
                          <Heart className={favorites.ourBallTeams?.[team.id] ? "h-5 w-5 text-red-500 fill-current" : "h-5 w-5 text-muted-foreground/50"} />
                        </Button>
                        {isAdmin && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setRenameItem({ type: 'team', id: team.id, name: team.name, originalName: nationalTeams?.find(t => t.id === team.id)?.name}) }}>
                            <Pencil className="h-4 w-4 text-muted-foreground/80" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleFavorite(team, 'star'); }}>
                          <Star className={favorites.teams?.[team.id] ? "h-5 w-5 text-yellow-400 fill-current" : "h-5 w-5 text-muted-foreground/50"} />
                        </Button>
                      </div>
                    </li>
                  )
                }</ul>
              </AccordionContent>
            </AccordionItem>
          ));
    }


    const renderClubCompetitions = () => {
        if (!sortedGroupedCompetitions) return null;
        
        return Object.entries(sortedGroupedCompetitions).map(([continent, content]) => (
            <AccordionItem value={`club-${continent}`} key={`club-${continent}`} className="rounded-lg border bg-card/50">
               <div className="flex items-center px-4 py-3 h-12">
                   <AccordionTrigger className="hover:no-underline flex-1">
                       <h3 className="text-lg font-bold">{getName('continent', continent, continent)}</h3>
                   </AccordionTrigger>
                   {isAdmin && (<Button variant="ghost" size="icon" className="h-9 w-9 mr-2" onClick={(e) => { e.stopPropagation(); setRenameItem({ type: 'continent', id: continent, name: getName('continent', continent, continent), originalName: continent }); }}>
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
                                           <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleFavorite(comp, 'heart'); }}>
                                               <Heart className={favorites.ourLeagueId === comp.leagueId ? "h-5 w-5 text-red-500 fill-current" : "h-5 w-5 text-muted-foreground/50"} />
                                           </Button>
                                           {isAdmin && (
                                               <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setRenameItem({ type: 'league', id: comp.leagueId, name: comp.name, originalName: managedCompetitions?.find(c => c.leagueId === comp.leagueId)?.name}) }}>
                                                   <Pencil className="h-4 w-4 text-muted-foreground/80" />
                                               </Button>
                                           )}
                                           <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleFavorite(comp, 'star'); }}>
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
                                       {isAdmin && <Button variant="ghost" size="icon" className="h-9 w-9 mr-2" onClick={(e) => { e.stopPropagation(); setRenameItem({ type: 'country', id: country, name: getName('country', country, country), originalName: country }); }}><Pencil className="h-4 w-4 text-muted-foreground/80" /></Button>}
                                     </div>
                                   <AccordionContent className="p-1">
                                       <ul className="flex flex-col">{leagues.map(comp => 
                                           <li key={comp.leagueId} className="flex w-full items-center justify-between p-3 h-12 hover:bg-accent/80 transition-colors rounded-md group">
                                               <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => navigate('CompetitionDetails', { title: comp.name, leagueId: comp.leagueId, logo: comp.logo })}>
                                                   <img src={comp.logo} alt={comp.name} className="h-6 w-6 object-contain" />
                                                   <span className="text-sm truncate">{comp.name}</span>
                                               </div>
                                               <div className="flex items-center gap-1">
                                                   <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleFavorite(comp, 'heart'); }}>
                                                       <Heart className={favorites.ourLeagueId === comp.leagueId ? "h-5 w-5 text-red-500 fill-current" : "h-5 w-5 text-muted-foreground/50"} />
                                                   </Button>
                                                   {isAdmin && (
                                                       <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setRenameItem({ type: 'league', id: comp.leagueId, name: comp.name, originalName: managedCompetitions?.find(c => c.leagueId === comp.leagueId)?.name}) }}>
                                                           <Pencil className="h-4 w-4 text-muted-foreground/80" />
                                                       </Button>
                                                   )}
                                                   <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleFavorite(comp, 'star'); }}>
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
       ));
    }


    if (loadingData || !customNames) {
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
                title={"كل البطولات"} 
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
                      <ProfileButton />
                  </div>
                }
            />
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                 <Accordion type="multiple" className="w-full space-y-4" defaultValue={['national-teams']}>
                    <AccordionItem value="national-teams" className="rounded-lg border bg-card/50">
                        <AccordionTrigger className="px-4 py-3 hover:no-underline">
                            <div className="flex items-center gap-3">
                                <Users className="h-6 w-6 text-primary"/>
                                <h3 className="text-lg font-bold">المنتخبات</h3>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="p-2">
                             <Accordion type="multiple" className="w-full space-y-2">
                                {renderNationalTeams()}
                             </Accordion>
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="club-competitions" className="rounded-lg border bg-card/50">
                        <AccordionTrigger className="px-4 py-3 hover:no-underline">
                            <div className="flex items-center gap-3">
                                <Trophy className="h-6 w-6 text-primary"/>
                                <h3 className="text-lg font-bold">بطولات الأندية</h3>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="p-2">
                            <Accordion type="multiple" className="w-full space-y-2">
                                {renderClubCompetitions()}
                            </Accordion>
                        </AccordionContent>
                    </AccordionItem>
                 </Accordion>
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
                    fetchAllData(true);
                }
            }} />
        </div>
    );
}

