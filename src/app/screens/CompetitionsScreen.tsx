
"use client";

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Star, Pencil, Plus, Trash2, Loader2 } from 'lucide-react';
import type { ScreenProps } from '@/app/page';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdmin, useAuth, useFirestore } from '@/firebase/provider';
import { doc, setDoc, deleteDoc, collection, onSnapshot, writeBatch, getDocs, query, orderBy, updateDoc, deleteField } from 'firebase/firestore';
import { RenameDialog } from '@/components/RenameDialog';
import { AddCompetitionDialog } from '@/components/AddCompetitionDialog';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';

interface ManagedCompetition {
    leagueId: number;
    name: string;
    logo: string;
    countryName: string;
    countryFlag: string | null;
}

interface Favorites {
    userId: string;
    leagues?: { [key: number]: any };
}

interface CompetitionsByCountry {
    [country: string]: {
        flag: string | null;
        leagues: ManagedCompetition[];
    };
}

interface GroupedCompetitions {
  [continent: string]: CompetitionsByCountry | { leagues: ManagedCompetition[] };
}

interface RenameState {
    isOpen: boolean;
    type: 'league' | 'country' | 'continent' | null;
    id: string;
    currentName: string;
}

const countryToContinent: { [key: string]: string } = {
    "World": "World",
    // Europe
    "England": "Europe", "Spain": "Europe", "Germany": "Europe", "Italy": "Europe", "France": "Europe",
    "Netherlands": "Europe", "Portugal": "Europe", "Belgium": "Europe", "Russia": "Europe", "Turkey": "Europe",
    "Greece": "Europe", "Switzerland": "Europe", "Austria": "Europe", "Denmark": "Europe", "Scotland": "Europe",
    "Sweden": "Europe", "Norway": "Europe", "Poland": "Europe", "Ukraine": "Europe", "Czech-Republic": "Europe",
    "Croatia": "Europe", "Romania": "Europe", "Serbia": "Europe", "Hungary": "Europe", "Finland": "Europe",
    "Ireland": "Europe", "Northern-Ireland": "Europe", "Wales": "Europe", "Iceland": "Europe", "Albania": "Europe",
    "Georgia": "Europe", "Latvia": "Europe", "Estonia": "Europe", "Lithuania": "Europe", "Luxembourg": "Europe",
    "Faroe-Islands": "Europe", "Malta": "Europe", "Andorra": "Europe", "San-Marino": "Europe", "Gibraltar": "Europe", "Kosovo": "Europe",
    "Bosnia-and-Herzegovina": "Europe", "Slovakia": "Europe", "Slovenia": "Europe", "Bulgaria": "Europe", "Cyprus": "Europe", "Azerbaijan": "Europe",
    "Armenia": "Europe", "Belarus": "Europe", "Moldova": "Europe", "North-Macedonia": "Europe", "Montenegro": "Europe",
    // Asia
    "Saudi-Arabia": "Asia", "Japan": "Asia", "South-Korea": "Asia", "China": "Asia", "Qatar": "Asia",
    "UAE": "Asia", "Iran": "Asia", "Iraq": "Asia", "Uzbekistan": "Asia", "Australia": "Asia", // Australia is in AFC
    "Jordan": "Asia", "Syria": "Asia", "Lebanon": "Asia", "Oman": "Asia", "Kuwait": "Asia", "Bahrain": "Asia",
    "India": "Asia", "Thailand": "Asia", "Vietnam": "Asia", "Malaysia": "Asia", "Indonesia": "Asia", "Singapore": "Asia",
    "Philippines": "Asia", "Hong-Kong": "Asia", "Palestine": "Asia", "Tajikistan": "Asia", "Turkmenistan": "Asia",
    "Kyrgyzstan": "Asia", "Bangladesh": "Asia", "Maldives": "Asia", "Cambodia": "Asia", "Myanmar": "Asia",
    // Africa
    "Egypt": "Africa", "Morocco": "Africa", "Tunisia": "Africa", "Algeria": "Africa", "Nigeria": "Africa",
    "Senegal": "Africa", "Ghana": "Africa", "Ivory-Coast": "Africa", "Cameroon": "Africa", "South-Africa": "Africa",
    "DR-Congo": "Africa", "Mali": "Africa", "Burkina-Faso": "Africa", "Guinea": "Africa", "Zambia": "Africa",
    "Cape-Verde": "Africa", "Uganda": "Africa", "Kenya": "Africa", "Tanzania": "Africa", "Sudan": "Africa",
    "Libya": "Africa", "Angola": "Africa", "Zimbabwe": "Africa", "Ethiopia": "Africa",
    // North America
    "USA": "North America", "Mexico": "North America", "Canada": "North America", "Costa-Rica": "North America",
    "Honduras": "North America", "Panama": "North America", "Jamaica": "North America", "El-Salvador": "North America",
    "Trinidad-and-Tobago": "North America", "Guatemala": "North America", "Nicaragua": "North America", "Cuba": "North America",
    // South America
    "Brazil": "South America", "Argentina": "South America", "Colombia": "South America", "Chile": "South America",
    "Uruguay": "South America", "Peru": "South America", "Ecuador": "South America", "Paraguay": "South America",
    "Venezuela": "South America", "Bolivia": "South America",
    // Oceania
    "New-Zealand": "Oceania", "Fiji": "Oceania"
};

const continentOrder = ["World", "Europe", "Asia", "Africa", "South America", "North America", "Oceania"];

export function CompetitionsScreen({ navigate, goBack, canGoBack, headerActions }: ScreenProps & { headerActions?: React.ReactNode }) {
    const [competitions, setCompetitions] = useState<ManagedCompetition[] | null>(null);
    const [loading, setLoading] = useState(true);
    const { isAdmin } = useAdmin();
    const { user } = useAuth();
    const { db } = useFirestore();
    const [favorites, setFavorites] = useState<Favorites>({ userId: '', leagues: {} });
    const [renameState, setRenameState] = useState<RenameState>({ isOpen: false, type: null, id: '', currentName: '' });
    const [isAddOpen, setAddOpen] = useState(false);

    const [customLeagueNames, setCustomLeagueNames] = useState<Map<number, string>>(new Map());
    const [customCountryNames, setCustomCountryNames] = useState<Map<string, string>>(new Map());
    const [customContinentNames, setCustomContinentNames] = useState<Map<string, string>>(new Map());

    const getLeagueName = useCallback((comp: ManagedCompetition) => customLeagueNames.get(comp.leagueId) || comp.name, [customLeagueNames]);
    const getCountryName = useCallback((name: string) => customCountryNames.get(name) || name, [customCountryNames]);
    const getContinentName = useCallback((name: string) => customContinentNames.get(name) || name, [customContinentNames]);

    useEffect(() => {
        if (!user) return;
        const docRef = doc(db, 'favorites', user.uid);
        const unsubscribe = onSnapshot(docRef, (doc) => {
            setFavorites(doc.data() as Favorites || { userId: user.uid, leagues: {} });
        }, (error) => {
            const permissionError = new FirestorePermissionError({ path: docRef.path, operation: 'get' });
            errorEmitter.emit('permission-error', permissionError);
        });
        return () => unsubscribe();
    }, [user, db]);

    const fetchAllCustomNames = useCallback(async () => {
        try {
            const [leaguesSnapshot, countriesSnapshot, continentsSnapshot] = await Promise.all([
                getDocs(collection(db, 'leagueCustomizations')),
                getDocs(collection(db, 'countryCustomizations')),
                getDocs(collection(db, 'continentCustomizations'))
            ]);
            
            const leagueNames = new Map<number, string>();
            leaguesSnapshot.forEach(doc => leagueNames.set(Number(doc.id), doc.data().customName));
            setCustomLeagueNames(leagueNames);

            const countryNames = new Map<string, string>();
            countriesSnapshot.forEach(doc => countryNames.set(doc.id, doc.data().customName));
            setCustomCountryNames(countryNames);

            const continentNames = new Map<string, string>();
            continentsSnapshot.forEach(doc => continentNames.set(doc.id, doc.data().customName));
            setCustomContinentNames(continentNames);
        } catch (error) {
            console.error("Failed to fetch custom names:", error);
            const permissionError = new FirestorePermissionError({ path: 'customizations collections', operation: 'list' });
            errorEmitter.emit('permission-error', permissionError);
        }
    }, [db]);

    useEffect(() => {
        setLoading(true);
        fetchAllCustomNames();
        const compsRef = collection(db, 'managedCompetitions');
        const q = query(compsRef, orderBy('name', 'asc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedCompetitions = snapshot.docs.map(doc => doc.data() as ManagedCompetition);
            setCompetitions(fetchedCompetitions);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching managed competitions:", error);
            const permissionError = new FirestorePermissionError({ path: compsRef.path, operation: 'list' });
            errorEmitter.emit('permission-error', permissionError);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [db, fetchAllCustomNames]);

    const toggleLeagueFavorite = async (comp: ManagedCompetition) => {
        if (!user) return;
        const leagueId = comp.leagueId;
        const favRef = doc(db, 'favorites', user.uid);
        const fieldPath = `leagues.${leagueId}`;
        const isFavorited = favorites?.leagues?.[leagueId];
        const leagueName = getLeagueName(comp);

        const favoriteData = { leagues: { [leagueId]: { leagueId: comp.leagueId, name: leagueName, logo: comp.logo } } };

        try {
            if (isFavorited) {
                await updateDoc(favRef, { [fieldPath]: deleteField() });
            } else {
                await setDoc(favRef, { ...favoriteData, userId: user.uid }, { merge: true });
            }
        } catch (error) {
            const permissionError = new FirestorePermissionError({ path: favRef.path, operation: isFavorited ? 'update' : 'create', requestResourceData: favoriteData });
            errorEmitter.emit('permission-error', permissionError);
        }
    };

    const handleDeleteCompetition = async (leagueId: number) => {
        const docRef = doc(db, 'managedCompetitions', String(leagueId));
        try {
            await deleteDoc(docRef);
        } catch (error) {
            const permissionError = new FirestorePermissionError({ path: docRef.path, operation: 'delete' });
            errorEmitter.emit('permission-error', permissionError);
        }
    }

    const sortedGroupedCompetitions = useMemo(() => {
        if (!competitions) return null;

        const grouped: GroupedCompetitions = {};

        competitions.forEach(comp => {
            const countryName = comp.countryName;
            const continent = countryToContinent[countryName] || "Other";

            if (continent === "World") {
                if (!grouped.World) grouped.World = { leagues: [] };
                (grouped.World as { leagues: ManagedCompetition[] }).leagues.push(comp);
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
                const aHasCustom = customNamesMap.has(a);
                const bHasCustom = customNamesMap.has(b);
                if (aHasCustom && !bHasCustom) return -1;
                if (!aHasCustom && bHasCustom) return 1;
                return getContinentName(a).localeCompare(getContinentName(b));
            });
        };

        const sortedGrouped: GroupedCompetitions = {};
        const sortedContinents = continentOrder.filter(c => grouped[c]);
        sortWithCustomPriority(sortedContinents, customContinentNames);

        for (const continent of sortedContinents) {
             if (continent === "World") {
                const worldLeagues = (grouped.World as { leagues: ManagedCompetition[] }).leagues;
                worldLeagues.sort((a,b) => {
                    const aHasCustom = customLeagueNames.has(a.leagueId);
                    const bHasCustom = customLeagueNames.has(b.leagueId);
                    if (aHasCustom && !bHasCustom) return -1;
                    if (!aHasCustom && bHasCustom) return 1;
                    return getLeagueName(a).localeCompare(getLeagueName(b));
                });
                sortedGrouped.World = { leagues: worldLeagues };
            } else {
                const countries = grouped[continent] as CompetitionsByCountry;
                const sortedCountries = Object.keys(countries);
                sortWithCustomPriority(sortedCountries, customCountryNames);
                
                const sortedCountriesObj: CompetitionsByCountry = {};
                for (const country of sortedCountries) {
                    countries[country].leagues.sort((a, b) => {
                       const aHasCustom = customLeagueNames.has(a.leagueId);
                       const bHasCustom = customLeagueNames.has(b.leagueId);
                       if (aHasCustom && !bHasCustom) return -1;
                       if (!aHasCustom && bHasCustom) return 1;
                       return getLeagueName(a).localeCompare(getLeagueName(b));
                    });
                    sortedCountriesObj[country] = countries[country];
                }
                sortedGrouped[continent] = sortedCountriesObj;
            }
        }
        
        if (grouped.Other) sortedGrouped.Other = grouped.Other;

        return sortedGrouped;

    }, [competitions, customLeagueNames, customCountryNames, customContinentNames, getLeagueName, getContinentName]);

    const handleSaveRename = async (newName: string) => {
        if (!renameState.type || !renameState.id) return;
        
        let collectionName = '';
        let docId = renameState.id;

        switch (renameState.type) {
            case 'league': collectionName = 'leagueCustomizations'; break;
            case 'country': collectionName = 'countryCustomizations'; break;
            case 'continent': collectionName = 'continentCustomizations'; break;
        }
        
        if (collectionName) {
            const docRef = doc(db, collectionName, docId);
            const data = { customName: newName };
            try {
                await setDoc(docRef, data);
                await fetchAllCustomNames();
            } catch (error) {
                const permissionError = new FirestorePermissionError({ path: docRef.path, operation: 'create', requestResourceData: data });
                errorEmitter.emit('permission-error', permissionError);
            }
        }
        setRenameState({ isOpen: false, type: null, id: '', currentName: '' });
    };
  
    const openRenameDialog = (type: RenameState['type'], id: string, currentName: string) => {
      setRenameState({ isOpen: true, type, id, currentName });
    };

    const renderLeagueItem = (comp: ManagedCompetition) => (
        <li key={comp.leagueId}>
            <div className="flex w-full items-center justify-between p-3 hover:bg-accent transition-colors rounded-md cursor-pointer" onClick={() => navigate('CompetitionDetails', { title: getLeagueName(comp), leagueId: comp.leagueId, logo: comp.logo })}>
                <div className="flex items-center gap-3">
                    <img src={comp.logo} alt={comp.name} className="h-6 w-6 object-contain" />
                    <div className="text-sm">{getLeagueName(comp)}</div>
                </div>
                <div className="flex items-center gap-1">
                    {isAdmin && (<>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleDeleteCompetition(comp.leagueId); }}>
                            <Trash2 className="h-4 w-4 text-destructive/80" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); openRenameDialog('league', String(comp.leagueId), getLeagueName(comp)); }}>
                            <Pencil className="h-4 w-4 text-muted-foreground/80" />
                        </Button>
                    </>)}
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); toggleLeagueFavorite(comp); }}>
                        <Star className={favorites?.leagues?.[comp.leagueId] ? "h-5 w-5 text-yellow-400 fill-current" : "h-5 w-5 text-muted-foreground/50"} />
                    </Button>
                </div>
            </div>
        </li>
    );

    const itemTypeMap = { league: 'البطولة', country: 'الدولة', continent: 'القارة' };

    return (
        <div className="flex h-full flex-col bg-background">
            <ScreenHeader title="البطولات" onBack={goBack} canGoBack={canGoBack} actions={headerActions} />
            <div className="flex-1 overflow-y-auto p-4">
                {loading ? (
                    <div className="space-y-4">
                        {Array.from({ length: 10 }).map((_, i) => (
                            <div key={i} className="rounded-lg border bg-card p-4">
                                <Skeleton className="h-6 w-1/3" />
                            </div>
                        ))}
                    </div>
                ) : competitions && competitions.length > 0 ? (
                    <Accordion type="multiple" className="w-full space-y-4">
                        {Object.entries(sortedGroupedCompetitions || {}).map(([continent, content]) => (
                            <AccordionItem value={continent} key={continent} className="rounded-lg border bg-card">
                                <div className="flex w-full items-center justify-between">
                                    <AccordionTrigger className="px-4 text-lg font-bold flex-1 hover:no-underline">{getContinentName(continent)}</AccordionTrigger>
                                    {isAdmin && (<Button variant="ghost" size="icon" className="h-9 w-9 mr-2" onClick={(e) => { e.stopPropagation(); openRenameDialog('continent', continent, getContinentName(continent)); }}>
                                            <Pencil className="h-4 w-4 text-muted-foreground/80" />
                                    </Button>)}
                                </div>
                                <AccordionContent className="px-1">
                                    {"leagues" in content ? (
                                        <ul className="flex flex-col">{(content.leagues as ManagedCompetition[]).map(renderLeagueItem)}</ul>
                                    ) : (
                                        <Accordion type="multiple" className="w-full space-y-2 px-2">
                                            {Object.entries(content as CompetitionsByCountry).map(([country, { flag, leagues }]) => (
                                                <AccordionItem value={country} key={country} className="rounded-lg border bg-background">
                                                    <div className="flex w-full items-center justify-between">
                                                        <AccordionTrigger className="px-4 text-base font-semibold flex-1 hover:no-underline">
                                                            <div className="flex items-center gap-3">
                                                                {flag && <img src={flag} alt={country} className="h-5 w-7 object-contain" />}
                                                                <span>{getCountryName(country)}</span>
                                                            </div>
                                                        </AccordionTrigger>
                                                        {isAdmin && (<Button variant="ghost" size="icon" className="h-9 w-9 mr-2" onClick={(e) => { e.stopPropagation(); openRenameDialog('country', country, getCountryName(country)); }}>
                                                                <Pencil className="h-4 w-4 text-muted-foreground/80" />
                                                        </Button>)}
                                                    </div>
                                                    <AccordionContent className="px-1">
                                                        <ul className="flex flex-col">{leagues.map(renderLeagueItem)}</ul>
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

    

    