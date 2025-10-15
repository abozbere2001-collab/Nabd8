
"use client";

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Star, Pencil, Plus, Search } from 'lucide-react';
import type { ScreenProps } from '@/app/page';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdmin, useAuth, useFirestore } from '@/firebase/provider';
import { doc, setDoc, collection, onSnapshot, query, updateDoc, deleteField, getDocs } from 'firebase/firestore';
import { RenameDialog } from '@/components/RenameDialog';
import { AddCompetitionDialog } from '@/components/AddCompetitionDialog';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import type { Favorites, ManagedCompetition as ManagedCompetitionType } from '@/lib/types';
import { SearchSheet } from '@/components/SearchSheet';
import { ProfileButton } from '../AppContentWrapper';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";


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

interface RenameState {
    isOpen: boolean;
    type: 'league' | 'country' | 'continent' | null;
    id: string;
    currentName: string;
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
    "Jordan": "Asia", "Syria": "Asia", "Lebanon": "Asia", "Oman": "Asia", "Kuwait": "Asia", "Bahrain": "Asia",
    "India": "Asia", "Thailand": "Asia", "Vietnam": "Asia", "Malaysia": "Asia", "Indonesia": "Asia", "Singapore": "Asia",
    "Philippines": "Asia", "Hong-Kong": "Asia", "Palestine": "Asia", "Tajikistan": "Asia", "Turkmenistan": "Asia",
    "Kyrgyzstan": "Asia", "Bangladesh": "Asia", "Maldives": "Asia", "Cambodia": "Asia", "Myanmar": "Asia",
    "Egypt": "Africa", "Morocco": "Africa", "Tunisia": "Africa", "Algeria": "Africa", "Nigeria": "Africa",
    "Senegal": "Africa", "Ghana": "Africa", "Ivory-Coast": "Africa", "Cameroon": "Africa", "South-Africa": "Africa",
    "DR-Congo": "Africa", "Mali": "Africa", "Burkina-Faso": "Africa", "Guinea": "Africa", "Zambia": "Africa",
    "Cape-Verde": "Africa", "Uganda": "Africa", "Kenya": "Africa", "Tanzania": "Africa", "Sudan": "Africa",
    "Libya": "Africa", "Angola": "Africa", "Zimbabwe": "Africa", "Ethiopia": "Africa",
    "USA": "North America", "Mexico": "North America", "Canada": "North America", "Costa-Rica": "North America",
    "Honduras": "North America", "Panama": "North America", "Jamaica": "North America", "El-Salvador": "North America",
    "Trinidad-and-Tobago": "North America", "Guatemala": "North America", "Nicaragua": "North America", "Cuba": "North America",
    "Brazil": "South America", "Argentina": "South America", "Colombia": "South America", "Chile": "South America",
    "Uruguay": "South America", "Peru": "South America", "Ecuador": "South America", "Paraguay": "South America",
    "Venezuela": "South America", "Bolivia": "South America",
    "New-Zealand": "Oceania", "Fiji": "Oceania"
};
const continentOrder = ["World", "Europe", "Asia", "Africa", "South America", "North America", "Oceania"];
const WORLD_LEAGUES_KEYWORDS = ["world", "uefa", "champions league", "europa", "copa libertadores", "copa sudamericana", "caf champions", "afc champions", "conmebol", "concacaf"];


// --- MAIN SCREEN COMPONENT ---
export function CompetitionsScreen({ navigate, goBack, canGoBack }: ScreenProps) {
    const [managedCompetitions, setManagedCompetitions] = useState<ManagedCompetitionType[] | null>(null);
    const [loading, setLoading] = useState(true);
    const { isAdmin } = useAdmin();
    const { user } = useAuth();
    const { db } = useFirestore();
    const [favorites, setFavorites] = useState<Favorites>({ userId: '', leagues: {}, teams: {}, players: {} });
    const [renameState, setRenameState] = useState<RenameState>({ isOpen: false, type: null, id: '', currentName: '' });
    const [isAddOpen, setAddOpen] = useState(false);

    const [customNames, setCustomNames] = useState<{ leagues: Map<number, string>, countries: Map<string, string>, continents: Map<string, string> }>({ leagues: new Map(), countries: new Map(), continents: new Map() });

    const getName = useCallback((type: 'league' | 'country' | 'continent', id: string | number, defaultName: string) => {
        const key = `${type}s` as keyof typeof customNames;
        const map = customNames[key] as Map<string|number, string>;
        return map?.get(id) || defaultName;
    }, [customNames]);

    useEffect(() => {
        if (!user || !db) return;
        const docRef = doc(db, 'favorites', user.uid);
        const unsubscribe = onSnapshot(docRef, (doc) => {
            setFavorites(doc.data() as Favorites || { userId: user.uid, leagues: {}, teams: {}, players: {} });
        }, (error) => {
            const permissionError = new FirestorePermissionError({ path: docRef.path, operation: 'get' });
            errorEmitter.emit('permission-error', permissionError);
        });
        return () => unsubscribe();
    }, [user, db]);

    const fetchAllCustomNames = useCallback(async () => {
        if (!db) return;
        try {
            const [leaguesSnapshot] = await Promise.all([
                getDocs(collection(db, 'leagueCustomizations')),
            ]);
            
            const names = {
                leagues: new Map<number, string>(),
                countries: new Map<string, string>(),
                continents: new Map<string, string>(),
            };

            leaguesSnapshot.forEach(doc => names.leagues.set(Number(doc.id), doc.data().customName));
            
            setCustomNames(names);

        } catch (error) {
            const permissionError = new FirestorePermissionError({ path: 'customizations collections', operation: 'list' });
            errorEmitter.emit('permission-error', permissionError);
        }
    }, [db]);

    useEffect(() => {
        if (!db) return;
        setLoading(true);
        fetchAllCustomNames();
        const compsRef = collection(db, 'managedCompetitions');
        
        const unsubscribe = onSnapshot(query(compsRef), (snapshot) => {
            const fetchedCompetitions = snapshot.docs.map(doc => doc.data() as ManagedCompetitionType);
            setManagedCompetitions(fetchedCompetitions);
            setLoading(false);
        }, (error) => {
            setManagedCompetitions([]);
            setLoading(false);
            const permissionError = new FirestorePermissionError({ path: 'managedCompetitions', operation: 'list' });
            errorEmitter.emit('permission-error', permissionError);
        });

        return () => unsubscribe();
    }, [db, fetchAllCustomNames]);

    const handleFavorite = useCallback(async (item: ManagedCompetitionType) => {
        if (!user || !db) return;
        
        const favRef = doc(db, 'favorites', user.uid);
        const itemId = item.leagueId;
        const fieldPath = `leagues.${itemId}`;
        const isFavorited = !!favorites?.leagues?.[itemId];

        let favoriteData: Partial<Favorites> = { userId: user.uid };
        
        const payload = { 
            name: getName('league', itemId, item.name),
            leagueId: itemId,
            logo: item.logo
        };
        
        favoriteData.leagues = { [itemId]: payload };

        const operation = isFavorited
            ? updateDoc(favRef, { [fieldPath]: deleteField() })
            : setDoc(favRef, favoriteData, { merge: true });

        operation.catch(serverError => {
            const permissionError = new FirestorePermissionError({
                path: favRef.path,
                operation: isFavorited ? 'update' : 'create',
                requestResourceData: favoriteData
            });
            errorEmitter.emit('permission-error', permissionError);
        });

    }, [user, db, favorites, getName]);


    const sortedGroupedCompetitions = useMemo(() => {
        if (!managedCompetitions) return null;

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

    const handleSaveRename = (newName: string) => {
        if (!renameState.type || !renameState.id || !db) return;
        
        const collectionName = `${renameState.type}Customizations`;
        const docId = renameState.id;
        
        const docRef = doc(db, collectionName, String(docId));
        const data = { customName: newName };
        setDoc(docRef, data)
            .then(() => fetchAllCustomNames())
            .catch(serverError => {
                const permissionError = new FirestorePermissionError({ path: docRef.path, operation: 'create', requestResourceData: data });
                errorEmitter.emit('permission-error', permissionError);
            });
        setRenameState({ isOpen: false, type: null, id: '', currentName: '' });
    };
  
    const openRenameDialog = (type: RenameState['type'], id: string | number, currentName: string) => {
      setRenameState({ isOpen: true, type, id: String(id), currentName });
    };

    const itemTypeMap: {[key: string]: string} = { league: 'البطولة', country: 'الدولة', continent: 'القارة' };

    return (
        <div className="flex h-full flex-col bg-background">
            <ScreenHeader 
                title="البطولات" 
                onBack={goBack} 
                canGoBack={canGoBack} 
                actions={
                  <div className="flex items-center gap-1">
                      <SearchSheet navigate={navigate}>
                          <Button variant="ghost" size="icon">
                              <Search className="h-5 w-5" />
                          </Button>
                      </SearchSheet>
                      <ProfileButton/>
                  </div>
                }
            />
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loading ? (
                    Array.from({ length: 10 }).map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full rounded-lg" />
                    ))
                ) : managedCompetitions && managedCompetitions.length > 0 && sortedGroupedCompetitions ? (
                    <Accordion type="multiple" className="w-full space-y-4" >
                        {Object.entries(sortedGroupedCompetitions).map(([continent, content]) => (
                             <AccordionItem value={continent} key={continent} className="rounded-lg border bg-card/50">
                                <div className="flex items-center px-4 py-3">
                                    <AccordionTrigger className="hover:no-underline flex-1">
                                        <h3 className="text-lg font-bold">{getName('continent', continent, continent)}</h3>
                                    </AccordionTrigger>
                                    {isAdmin && (<Button variant="ghost" size="icon" className="h-9 w-9 mr-2" onClick={(e) => { e.stopPropagation(); openRenameDialog('continent', continent, getName('continent', continent, continent)); }}>
                                            <Pencil className="h-4 w-4 text-muted-foreground/80" />
                                    </Button>)}
                                </div>
                                <AccordionContent className="p-2">
                                     {"leagues" in content ? (
                                        <div className="p-1">
                                            <ul className="flex flex-col">{
                                                (content.leagues as ManagedCompetitionType[]).map(comp => 
                                                    <li key={comp.leagueId} 
                                                        className="flex w-full items-center justify-between p-3 hover:bg-accent/80 transition-colors rounded-md group cursor-pointer"
                                                        onClick={() => navigate('CompetitionDetails', { title: comp.name, leagueId: comp.leagueId, logo: comp.logo })}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                        <img src={comp.logo} alt={comp.name} className="h-6 w-6 object-contain" />
                                                        <span className="text-sm">{comp.name}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            {isAdmin && (
                                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); openRenameDialog('league', comp.leagueId, comp.name); }}>
                                                                    <Pencil className="h-4 w-4 text-muted-foreground/80" />
                                                                </Button>
                                                            )}
                                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleFavorite(comp); }}>
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
                                                    <div className="flex items-center px-4 py-3">
                                                        <AccordionTrigger className="hover:no-underline flex-1">
                                                          <div className="flex items-center gap-3">
                                                              {flag && <img src={flag} alt={country} className="h-5 w-7 object-contain" />}
                                                              <span className="font-semibold">{getName('country', country, country)}</span>
                                                          </div>
                                                        </AccordionTrigger>
                                                        {isAdmin && <Button variant="ghost" size="icon" className="h-9 w-9 mr-2" onClick={(e) => { e.stopPropagation(); openRenameDialog('country', country, getName('country', country, country)); }}><Pencil className="h-4 w-4 text-muted-foreground/80" /></Button>}
                                                      </div>
                                                    <AccordionContent className="p-1">
                                                        <ul className="flex flex-col">{leagues.map(comp => 
                                                            <li key={comp.leagueId} 
                                                                className="flex w-full items-center justify-between p-3 hover:bg-accent/80 transition-colors rounded-md group cursor-pointer"
                                                                onClick={() => navigate('CompetitionDetails', { title: comp.name, leagueId: comp.leagueId, logo: comp.logo })}
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                <img src={comp.logo} alt={comp.name} className="h-6 w-6 object-contain" />
                                                                <span className="text-sm">{comp.name}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    {isAdmin && (
                                                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); openRenameDialog('league', comp.leagueId, comp.name); }}>
                                                                            <Pencil className="h-4 w-4 text-muted-foreground/80" />
                                                                        </Button>
                                                                    )}
                                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleFavorite(comp); }}>
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

            {isAdmin && (
                <Button className="absolute bottom-24 right-4 h-14 w-14 rounded-full shadow-lg" size="icon" onClick={() => setAddOpen(true)}>
                    <Plus className="h-6 w-6" />
                </Button>
            )}

            <RenameDialog isOpen={renameState.isOpen} onOpenChange={(isOpen) => setRenameState({ ...renameState, isOpen })} currentName={renameState.currentName} onSave={handleSaveRename} itemType={renameState.type ? itemTypeMap[renameState.type] : "العنصر"} />
            <AddCompetitionDialog isOpen={isAddOpen} onOpenChange={setAddOpen} />
        </div>
    );
}
