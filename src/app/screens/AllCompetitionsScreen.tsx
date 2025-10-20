

"use client";

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Star, Pencil, Plus, Search, Heart, RefreshCcw } from 'lucide-react';
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

// --- Persistent Cache Logic ---
const COMPETITIONS_CACHE_KEY = 'goalstack_competitions_cache';
const CACHE_EXPIRATION_MS = 60 * 24 * 60 * 60 * 1000; // 60 days

interface CompetitionsCache {
    managedCompetitions: ManagedCompetitionType[];
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

const setCachedCompetitions = (data: Omit<CompetitionsCache, 'lastFetched'>) => {
    if (typeof window === 'undefined') return;
    const cacheData: CompetitionsCache = { ...data, lastFetched: Date.now() };
    localStorage.setItem(COMPETITIONS_CACHE_KEY, JSON.stringify(cacheData));
};


// --- TYPE DEFINITIONS ---
interface CompetitionsByCountry {
    [country: string]: {
        flag: string | null;
        leagues: ManagedCompetitionType[];
    };
}

interface GroupedCompetitions {
  [continent: string]: CompetitionsByCountry | { leagues: ManagedCompetitionType[] };
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
    "World": "World", "England": "Europe", "Spain": "Europe", "Germany": "Europe", "Italy": "Europe", "France": "Europe",
    "Netherlands": "Europe", "Portugal": "Europe", "Belgium": "Europe", "Russia": "Europe", "Turkey": "Europe",
    "Greece": "Europe", "Switzerland": "Europe", "Austria": "Europe", "Denmark": "Europe", "Scotland": "Europe",
    "Sweden": "Europe", "Norway": "Europe", "Poland": "Europe", "Ukraine": "Europe", "Czech-Republic": "Europe",
    "Croatia": "Europe", "Romania": "Europe", "Serbia": "Europe", "Hungary": "Europe", "Finland": "Europe",
    "Ireland": "Europe", "Northern-Ireland": "Europe", "Wales": "Europe", "Iceland": "Europe", "Albania": "Europe",
    "Georgia": "Europe", "Latvia": "Europe", "Estonia": "Europe", "Lithuania": "Europe", "Luxembourg": "Europe",
    "Faroe-Islands": "Europe", "Malta": "Europe", "Andorra": "Europe", "San-Marino": "Europe", "Gibraltar": "Europe", "Kosovo": "Europe",
    "Bosnia-and-Herzegovina": "Europe", "Slovakia": "Europe", "Slovenia": "Europe", "Bulgaria": "Europe", "Cyprus": "Europe", "Azerbaijan": "Europe",
    "Armenia": "Europe", "Belarus": "Europe", "Moldova": "Europe", "North-Macedonia": "Europe", "Montenegro": "Europe",
    "Saudi-Arabia": "Asia", "Japan": "Asia", "South-Korea": "Asia", "China": "Asia", "Qatar": "Asia",
    "UAE": "Asia", "Iran": "Asia", "Iraq": "Asia", "Uzbekistan": "Asia", "Australia": "Asia",
    "Jordan": "Asia", "Syria": "Asia", "Lebanon": "Asia", "Oman": "Asia", "Kuwait": "Kuwait", "Bahrain": "Bahrain",
    "India": "Asia", "Thailand": "Asia", "Vietnam": "Asia", "Malaysia": "Asia", "Indonesia": "Asia", "Singapore": "Singapore",
    "Philippines": "Asia", "Hong-Kong": "Asia", "Palestine": "Asia", "Tajikistan": "Asia", "Turkmenistan": "Asia",
    "Kyrgyzstan": "Asia", "Bangladesh": "Asia", "Maldives": "Asia", "Cambodia": "Asia", "Myanmar": "Asia",
    "Egypt": "Africa", "Morocco": "Africa", "Tunisia": "Africa", "Algeria": "Africa", "Nigeria": "Africa",
    "Senegal": "Africa", "Ghana": "Africa", "Ivory-Coast": "Africa", "Cameroon": "Africa", "South-Africa": "Africa",
    "DR-Congo": "Africa", "Mali": "Africa", "Burkina-Faso": "Africa", "Guinea": "Africa", "Zambia": "Africa",
    "Cape-Verde": "Africa", "Uganda": "Africa", "Kenya": "Africa", "Tanzania": "Africa", "Sudan": "Sudan",
    "Libya": "Africa", "Angola": "Africa", "Zimbabwe": "Africa", "Ethiopia": "Africa",
    "USA": "North America", "Mexico": "North America", "Canada": "North America", "Costa-Rica": "North America",
    "Honduras": "North America", "Panama": "North America", "Jamaica": "North America", "El-Salvador": "North America",
    "Trinidad-and-Tobago": "North America", "Guatemala": "North America", "Nicaragua": "North America", "Cuba": "North America",
    "Brazil": "South America", "Argentina": "South America", "Colombia": "South America", "Chile": "South America",
    "Uruguay": "South America", "Peru": "South America", "Ecuador": "South America", "Paraguay": "South America",
    "Venezuela": "South America", "Bolivia": "South America",
    "New-Zealand": "Oceania", "Fiji": "Oceania",
    "Other": "Other"
};

const continentOrder = ["World", "Europe", "Asia", "Africa", "South America", "North America", "Oceania", "Other"];
const WORLD_LEAGUES_KEYWORDS = ["world", "uefa", "champions league", "europa", "copa libertadores", "copa sudamericana", "caf champions", "afc champions", "conmebol", "concacaf"];


// --- MAIN SCREEN COMPONENT ---
export function AllCompetitionsScreen({ navigate, goBack, canGoBack }: ScreenProps) {
    const [managedCompetitions, setManagedCompetitions] = useState<ManagedCompetitionType[] | null>(null);
    const [loading, setLoading] = useState(true);
    const { isAdmin } = useAdmin();
    const { user } = useAuth();
    const { db } = useFirestore();
    const { toast } = useToast();
    const [favorites, setFavorites] = useState<Partial<Favorites>>({});
    const [renameItem, setRenameItem] = useState<RenameState | null>(null);
    const [isAddOpen, setAddOpen] = useState(false);

    const [customNames, setCustomNames] = useState<{ leagues: Map<number, string>, countries: Map<string, string>, continents: Map<string, string> }> | null>(null);

    const getName = useCallback((type: 'league' | 'country' | 'continent', id: string | number, defaultName: string) => {
        if (!customNames) return defaultName;

        const firestoreMap = type === 'league' ? customNames.leagues : type === 'country' ? customNames.countries : customNames.continents;
        const customName = firestoreMap?.get(id as any);
        if (customName) return customName;

        const hardcodedMap = hardcodedTranslations[type === 'league' ? 'leagues' : type === 'country' ? 'countries' : 'continents'];
        const hardcodedName = hardcodedMap[id as any];
        if(hardcodedName) return hardcodedName;

        return defaultName;
    }, [customNames]);

    useEffect(() => {
        let unsubscribe: (() => void) | null = null;
        if (user && db) {
            const docRef = doc(db, 'users', user.uid, 'favorites', 'data');
            unsubscribe = onSnapshot(docRef, (doc) => {
                setFavorites(doc.data() as Favorites || { userId: user.uid });
            }, (error) => {
                if (user) { 
                    errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'get' }));
                }
                setFavorites(getLocalFavorites());
            });
        } else {
            setFavorites(getLocalFavorites());
        }
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [user, db]);

     const fetchAllData = useCallback(async (forceRefresh = false) => {
        if (!db) return;
        setLoading(true);

        try {
            const cachedData = getCachedCompetitions();
            let cacheIsValid = false;

            if (cachedData && !forceRefresh) {
                try {
                    const cacheBusterRef = doc(db, 'appConfig', 'cache');
                    const cacheBusterSnap = await getDoc(cacheBusterRef);
                    const serverLastUpdated = cacheBusterSnap.exists() ? cacheBusterSnap.data().competitionsLastUpdated?.toMillis() : 0;
                    if (cachedData.lastFetched > serverLastUpdated && Date.now() - cachedData.lastFetched < CACHE_EXPIRATION_MS) {
                        cacheIsValid = true;
                    }
                } catch (e) {
                    console.warn("Could not check cache buster, proceeding as if cache is valid for now.");
                    cacheIsValid = true; 
                }
            }

            if (cacheIsValid && cachedData) {
                setManagedCompetitions(cachedData.managedCompetitions);
                setCustomNames({
                    leagues: new Map(Object.entries(cachedData.customNames.leagues).map(([k, v]) => [Number(k), v])),
                    countries: new Map(Object.entries(cachedData.customNames.countries)),
                    continents: new Map(Object.entries(cachedData.customNames.continents)),
                });
            } else {
                const compsSnapshot = await getDocs(collection(db, 'managedCompetitions'));
                const fetchedCompetitions = compsSnapshot.docs.map(doc => doc.data() as ManagedCompetitionType);
                let fetchedCustomNames = { leagues: {}, countries: {}, continents: {} };

                if (isAdmin) {
                    try {
                        const [leaguesSnapshot, countriesSnapshot, continentsSnapshot] = await Promise.all([
                            getDocs(collection(db, 'leagueCustomizations')),
                            getDocs(collection(db, 'countryCustomizations')),
                            getDocs(collection(db, 'continentCustomizations')),
                        ]);
                        fetchedCustomNames = {
                            leagues: Object.fromEntries(leaguesSnapshot.docs.map(doc => [doc.id, doc.data().customName])),
                            countries: Object.fromEntries(countriesSnapshot.docs.map(doc => [doc.id, doc.data().customName])),
                            continents: Object.fromEntries(continentsSnapshot.docs.map(doc => [doc.id, doc.data().customName])),
                        };
                    } catch (adminError) {
                        console.warn("Admin failed to fetch customizations, displaying public data only.", adminError);
                    }
                }

                setCachedCompetitions({ managedCompetitions: fetchedCompetitions, customNames: fetchedCustomNames });

                setManagedCompetitions(fetchedCompetitions);
                setCustomNames({
                    leagues: new Map(Object.entries(fetchedCustomNames.leagues).map(([k, v]) => [Number(k), v])),
                    countries: new Map(Object.entries(fetchedCustomNames.countries)),
                    continents: new Map(Object.entries(fetchedCustomNames.continents)),
                });
            }
        } catch (error) {
            console.error("Failed to fetch competitions data:", error);
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: 'managedCompetitions or appConfig/cache',
                operation: 'list',
            }));
            setManagedCompetitions([]); // Set to empty array on error to stop loading
        } finally {
            setLoading(false);
        }
    }, [db, isAdmin]);
    
    const handleAdminRefresh = async () => {
        if (!db) return;
        toast({ title: 'بدء التحديث...', description: 'جاري تحديث بيانات البطولات لجميع المستخدمين.' });
        try {
            const cacheBusterRef = doc(db, 'appConfig', 'cache');
            await setDoc(cacheBusterRef, { competitionsLastUpdated: new Date() }, { merge: true });
            await fetchAllData(true); // Force refresh for the admin's own view
            toast({ title: 'نجاح', description: 'تم إرسال طلب التحديث. قد يستغرق بعض الوقت ليظهر لدى المستخدمين.' });
        } catch (error) {
            console.error("Error forcing refresh:", error);
            const permissionError = new FirestorePermissionError({ path: 'appConfig/cache', operation: 'write' });
            errorEmitter.emit('permission-error', permissionError);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في فرض التحديث.' });
        }
    };


    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    const handleFavoriteLeague = useCallback((item: ManagedCompetitionType, type: 'star' | 'heart') => {
        const itemId = item.leagueId;
        
        const currentFavorites = user && db ? favorites : getLocalFavorites();
        const newFavorites = JSON.parse(JSON.stringify(currentFavorites));

        let updateData: any;
        
        if (type === 'star') {
            const isCurrentlyFavorited = !!newFavorites.leagues?.[itemId];
            if (isCurrentlyFavorited) {
                if (newFavorites.leagues) delete newFavorites.leagues[itemId];
                updateData = { [`leagues.${itemId}`]: deleteField() };
            } else {
                if (!newFavorites.leagues) newFavorites.leagues = {};
                const favData = { name: item.name, leagueId: itemId, logo: item.logo };
                newFavorites.leagues[itemId] = favData;
                updateData = { [`leagues.${itemId}`]: favData };
            }
        } else { // 'heart' for ourLeague
            const isCurrentlyFavorited = newFavorites.ourLeagueId === itemId;
             if (isCurrentlyFavorited) {
                delete newFavorites.ourLeagueId;
                updateData = { ourLeagueId: deleteField() };
            } else {
                newFavorites.ourLeagueId = itemId;
                updateData = { ourLeagueId: itemId };
            }
        }
        
        setFavorites(newFavorites);

        if (user && db) {
            const favRef = doc(db, 'users', user.uid, 'favorites', 'data');
            setDoc(favRef, updateData, { merge: true }).catch(serverError => {
                setFavorites(currentFavorites); // Revert on error
                const permissionError = new FirestorePermissionError({ path: favRef.path, operation: 'update', requestResourceData: updateData });
                errorEmitter.emit('permission-error', permissionError);
            });
        } else {
            setLocalFavorites(newFavorites);
        }
    }, [user, db, favorites]);


    const sortedGroupedCompetitions = useMemo(() => {
        if (!managedCompetitions || !customNames) return null;

        const processedCompetitions = managedCompetitions.map(comp => ({
            ...comp,
            name: getName('league', comp.leagueId, comp.name),
        }));

        const grouped: GroupedCompetitions = {};

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
        
        const sortWithCustomPriority = (arr: string[], customNamesMap: Map<string, string>) => {
            return arr.sort((a, b) => {
                const aIsCustom = customNamesMap.has(a);
                const bIsCustom = customNamesMap.has(b);
                if (aIsCustom && !bIsCustom) return -1;
                if (!aIsCustom && bIsCustom) return 1;
                return getName('country', a, a).localeCompare(getName('country', b, b), 'ar');
            });
        };
        
        const sortedGrouped: GroupedCompetitions = {};
        const continents = Object.keys(grouped).sort((a, b) => continentOrder.indexOf(a) - continentOrder.indexOf(b));

        for (const continent of continents) {
            if (continent === "World") {
                 const worldLeagues = (grouped.World as { leagues: ManagedCompetitionType[] }).leagues;
                 worldLeagues.sort((a, b) => {
                    const aIsCustom = customNames.leagues.has(a.leagueId);
                    const bIsCustom = customNames.leagues.has(b.leagueId);
                    if (aIsCustom && !bIsCustom) return -1;
                    if (!aIsCustom && bIsCustom) return 1;
                    return a.name.localeCompare(b.name);
                 });
                 sortedGrouped.World = { leagues: worldLeagues };
            } else {
                const countries = grouped[continent] as CompetitionsByCountry;
                const sortedCountries = sortWithCustomPriority(Object.keys(countries), customNames.countries);
                
                const sortedCountriesObj: CompetitionsByCountry = {};
                for (const country of sortedCountries) {
                    countries[country].leagues.sort((a, b) => {
                        const aIsCustom = customNames.leagues.has(a.leagueId);
                        const bIsCustom = customNames.leagues.has(b.leagueId);
                        if (aIsCustom && !bIsCustom) return -1;
                        if (!aIsCustom && bIsCustom) return 1;
                        return a.name.localeCompare(b.name);
                    });
                    sortedCountriesObj[country] = countries[country];
                }
                sortedGrouped[continent] = sortedCountriesObj;
            }
        }
        
        return sortedGrouped;

    }, [managedCompetitions, getName, customNames]);

    const handleSaveRename = (type: RenameType, id: string | number, newName: string) => {
      if (!db) return;
      const collectionName = `${type}Customizations`;
      const docId = String(id);
      
      const originalItem = managedCompetitions?.find(c => String(c.leagueId) === docId);

      const data = { customName: newName };

      if (!newName || (originalItem && newName === originalItem.name)) {
          deleteDoc(doc(db, collectionName, docId)).then(() => {
              localStorage.removeItem(COMPETITIONS_CACHE_KEY); // Invalidate cache
              fetchAllData();
              toast({ title: 'نجاح', description: 'تمت إزالة الاسم المخصص.' });
          }).catch(serverError => {
              const permissionError = new FirestorePermissionError({ path: doc(db, collectionName, docId).path, operation: 'delete' });
              errorEmitter.emit('permission-error', permissionError);
          });
      } else {
          setDoc(doc(db, collectionName, docId), data)
              .then(() => {
                  localStorage.removeItem(COMPETITIONS_CACHE_KEY); // Invalidate cache
                  fetchAllData();
                  toast({ title: 'نجاح', description: 'تم حفظ الاسم المخصص.' });
              })
              .catch(serverError => {
                  const permissionError = new FirestorePermissionError({ path: doc(db, collectionName, docId).path, operation: 'create', requestResourceData: data });
                  errorEmitter.emit('permission-error', permissionError);
              });
      }
      setRenameItem(null);
    };

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
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loading ? (
                    Array.from({ length: 10 }).map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full rounded-lg" />
                    ))
                ) : managedCompetitions && managedCompetitions.length > 0 && sortedGroupedCompetitions && customNames ? (
                    <Accordion type="multiple" className="w-full space-y-4" >
                        {Object.entries(sortedGroupedCompetitions).map(([continent, content]) => (
                             <AccordionItem value={continent} key={continent} className="rounded-lg border bg-card/50">
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
                                                    <li key={comp.leagueId} 
                                                        className="flex w-full items-center justify-between p-3 h-12 hover:bg-accent/80 transition-colors rounded-md group"
                                                    >
                                                        <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => navigate('CompetitionDetails', { title: comp.name, leagueId: comp.leagueId, logo: comp.logo })}>
                                                            <img src={comp.logo} alt={comp.name} className="h-6 w-6 object-contain" />
                                                            <span className="text-sm truncate">{comp.name}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleFavoriteLeague(comp, 'heart'); }}>
                                                                <Heart className={favorites.ourLeagueId === comp.leagueId ? "h-5 w-5 text-red-500 fill-current" : "h-5 w-5 text-muted-foreground/50"} />
                                                            </Button>
                                                            {isAdmin && (
                                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setRenameItem({ type: 'league', id: comp.leagueId, name: comp.name, originalName: managedCompetitions.find(c => c.leagueId === comp.leagueId)?.name }) }}>
                                                                    <Pencil className="h-4 w-4 text-muted-foreground/80" />
                                                                </Button>
                                                            )}
                                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleFavoriteLeague(comp, 'star'); }}>
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
                                                            <li key={comp.leagueId} 
                                                                className="flex w-full items-center justify-between p-3 h-12 hover:bg-accent/80 transition-colors rounded-md group"
                                                            >
                                                                <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => navigate('CompetitionDetails', { title: comp.name, leagueId: comp.leagueId, logo: comp.logo })}>
                                                                    <img src={comp.logo} alt={comp.name} className="h-6 w-6 object-contain" />
                                                                    <span className="text-sm truncate">{comp.name}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1">
                                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleFavoriteLeague(comp, 'heart'); }}>
                                                                        <Heart className={favorites.ourLeagueId === comp.leagueId ? "h-5 w-5 text-red-500 fill-current" : "h-5 w-5 text-muted-foreground/50"} />
                                                                    </Button>
                                                                    {isAdmin && (
                                                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setRenameItem({ type: 'league', id: comp.leagueId, name: comp.name, originalName: managedCompetitions.find(c => c.leagueId === comp.leagueId)?.name }) }}>
                                                                            <Pencil className="h-4 w-4 text-muted-foreground/80" />
                                                                        </Button>
                                                                    )}
                                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleFavoriteLeague(comp, 'star'); }}>
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
                ) : (
                    <div className="text-center text-muted-foreground py-10">
                        <p className="text-lg font-semibold">لم تتم إضافة بطولات بعد.</p>
                        {isAdmin && <p>انقر على زر الإضافة لبدء إدارة البطولات.</p>}
                    </div>
                )}
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
                    localStorage.removeItem(COMPETITIONS_CACHE_KEY); // Invalidate cache on close to refetch
                    fetchAllData();
                }
            }} />
        </div>
    );
}

