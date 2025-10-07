"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Star, Pencil } from 'lucide-react';
import type { ScreenProps } from '@/app/page';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdmin } from '@/firebase/provider';
import { useFirebase } from '@/firebase/provider';
import { db } from '@/lib/firebase-client';
import { doc, setDoc, onSnapshot, updateDoc, deleteField, collection, getDocs } from 'firebase/firestore';
import { RenameDialog } from '@/components/RenameDialog';


interface Competition {
  league: {
    id: number;
    name: string;
    logo: string;
  };
  country: {
    name: string;
    flag: string | null;
  };
}

interface Favorites {
    leagues?: { [key: number]: any };
    teams?: { [key: number]: any };
}

interface LeaguesByCountry {
    [country: string]: {
        flag: string | null;
        leagues: Competition[];
    };
}

interface GroupedCompetitions {
  [continent: string]: LeaguesByCountry | { leagues: Competition[] };
}

interface RenameState {
    isOpen: boolean;
    type: 'league' | 'country' | 'continent' | null;
    id: string; // Can be leagueId, country name, or continent name
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

export function CompetitionsScreen({ navigate, goBack, canGoBack }: ScreenProps) {
  const [competitions, setCompetitions] = useState<GroupedCompetitions | null>(null);
  const [loading, setLoading] = useState(true);
  const { isAdmin } = useAdmin();
  const { user } = useFirebase();
  const [favorites, setFavorites] = useState<Favorites>({ leagues: {}, teams: {} });
  const [renameState, setRenameState] = useState<RenameState>({ isOpen: false, type: null, id: '', currentName: '' });
  const [customLeagueNames, setCustomLeagueNames] = useState<Map<number, string>>(new Map());
  const [customCountryNames, setCustomCountryNames] = useState<Map<string, string>>(new Map());
  const [customContinentNames, setCustomContinentNames] = useState<Map<string, string>>(new Map());


  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'favorites', user.uid), (doc) => {
        setFavorites(doc.data() as Favorites || { leagues: {}, teams: {} });
    });
    return () => unsub();
  }, [user]);

  const fetchAllCustomNames = useCallback(async () => {
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

      return { leagueNames, countryNames, continentNames };
  }, []);

  const toggleLeagueFavorite = async (comp: Competition) => {
    if (!user) return;
    const leagueId = comp.league.id;
    const favRef = doc(db, 'favorites', user.uid);
    const fieldPath = `leagues.${leagueId}`;
    const isFavorited = favorites?.leagues?.[leagueId];
    const leagueName = customLeagueNames.get(leagueId) || comp.league.name;

    if (isFavorited) {
        await updateDoc(favRef, { [fieldPath]: deleteField() });
    } else {
        await setDoc(favRef, { 
            leagues: { 
                [leagueId]: {
                    leagueId: comp.league.id,
                    name: leagueName,
                    logo: comp.league.logo,
                }
            } 
        }, { merge: true });
    }
  };

  useEffect(() => {
    async function fetchCompetitions() {
      try {
        setLoading(true);
        const [leaguesResponse, { leagueNames, countryNames, continentNames }] = await Promise.all([
            fetch('/api/football/leagues'),
            fetchAllCustomNames()
        ]);
        
        if (!leaguesResponse.ok) {
            const errorBody = await leaguesResponse.text();
            console.error('Failed to fetch competitions:', errorBody);
            throw new Error(`Failed to fetch competitions. Status: ${leaguesResponse.status}`);
        }
        const data = await leaguesResponse.json();
        
        if (data.errors && Object.keys(data.errors).length > 0) {
            console.error("API Errors:", data.errors);
            throw new Error("API returned errors. Check your API key or request parameters.");
        }
        
        const groupedByContinent: GroupedCompetitions = {};

        (data.response as Competition[]).forEach(comp => {
            const countryName = comp.country.name;
            const continent = countryToContinent[countryName] || "Other";

            if (continent === "World") {
                if (!groupedByContinent.World) {
                    groupedByContinent.World = { leagues: [] };
                }
                (groupedByContinent.World as { leagues: Competition[] }).leagues.push(comp);
            } else {
                if (!groupedByContinent[continent]) {
                    groupedByContinent[continent] = {};
                }
                const continentGroup = groupedByContinent[continent] as LeaguesByCountry;
                if (!continentGroup[countryName]) {
                    continentGroup[countryName] = { flag: comp.country.flag, leagues: [] };
                }
                continentGroup[countryName].leagues.push(comp);
            }
        });
        
        const sortedGrouped: GroupedCompetitions = {};
        continentOrder.forEach(continent => {
            if (groupedByContinent[continent]) {
                if (continent === "World") {
                    const worldLeagues = (groupedByContinent.World as { leagues: Competition[] }).leagues;
                    worldLeagues.sort((a,b) => a.league.name.localeCompare(b.league.name));
                    sortedGrouped.World = { leagues: worldLeagues };
                } else {
                    const countries = groupedByContinent[continent] as LeaguesByCountry;
                    const sortedCountries = Object.keys(countries).sort((a,b) => a.localeCompare(b));
                    
                    const sortedCountriesObj: LeaguesByCountry = {};
                    for (const country of sortedCountries) {
                        countries[country].leagues.sort((a,b) => a.league.name.localeCompare(b.league.name));
                        sortedCountriesObj[country] = countries[country];
                    }
                    sortedGrouped[continent] = sortedCountriesObj;
                }
            }
        });

        if (groupedByContinent.Other) {
             sortedGrouped.Other = groupedByContinent.Other;
        }

        setCompetitions(sortedGrouped);

      } catch (error) {
        console.error("Error fetching competitions:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchCompetitions();
  }, [fetchAllCustomNames]);

  const handleSaveRename = async (newName: string) => {
    if (!renameState.type || !renameState.id) return;
    
    let collectionName = '';
    let docId = renameState.id;

    switch (renameState.type) {
        case 'league':
            collectionName = 'leagueCustomizations';
            break;
        case 'country':
            collectionName = 'countryCustomizations';
            break;
        case 'continent':
            collectionName = 'continentCustomizations';
            break;
    }
    
    if (collectionName) {
        const customNameRef = doc(db, collectionName, docId);
        await setDoc(customNameRef, { customName: newName });
    
        // Optimistically update UI
        if (renameState.type === 'league') {
             setCustomLeagueNames(prev => new Map(prev).set(Number(docId), newName));
        } else if (renameState.type === 'country') {
             setCustomCountryNames(prev => new Map(prev).set(docId, newName));
        } else if (renameState.type === 'continent') {
             setCustomContinentNames(prev => new Map(prev).set(docId, newName));
        }
    }

    setRenameState({ isOpen: false, type: null, id: '', currentName: '' });
  };
  
  const getLeagueName = (comp: Competition) => customLeagueNames.get(comp.league.id) || comp.league.name;
  const getCountryName = (name: string) => customCountryNames.get(name) || name;
  const getContinentName = (name: string) => customContinentNames.get(name) || name;

  const openRenameDialog = (type: RenameState['type'], id: string, currentName: string) => {
      setRenameState({ isOpen: true, type, id, currentName });
  };


  const renderLeagueItem = (comp: Competition) => (
    <li key={comp.league.id}>
      <div
        className="flex w-full items-center justify-between p-3 hover:bg-accent transition-colors rounded-md cursor-pointer"
        onClick={() => navigate('CompetitionDetails', { title: getLeagueName(comp), leagueId: comp.league.id, logo: comp.league.logo })}
      >
        <div className="flex items-center gap-3">
          <img src={comp.league.logo} alt={comp.league.name} className="h-6 w-6 object-contain" />
          <span className="text-sm">{getLeagueName(comp)}</span>
        </div>
        <div className="flex items-center gap-1">
            {isAdmin && (
                <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => {
                    e.stopPropagation();
                    openRenameDialog('league', String(comp.league.id), getLeagueName(comp));
                }}
                >
                <Pencil className="h-4 w-4 text-muted-foreground/80" />
                </Button>
            )}
            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleLeagueFavorite(comp);
                }}
            >
              <Star className={favorites?.leagues?.[comp.league.id] ? "h-5 w-5 text-yellow-400 fill-current" : "h-5 w-5 text-muted-foreground/50"} />
            </Button>
        </div>
      </div>
    </li>
  );

  const itemTypeMap = {
    league: 'البطولة',
    country: 'الدولة',
    continent: 'القارة'
  };

  const renderContinentHeader = (continent: string) => (
    <div className="flex w-full items-center justify-between">
        <AccordionTrigger className="px-4 text-lg font-bold flex-1">
           {getContinentName(continent)}
        </AccordionTrigger>
        {isAdmin && (
            <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 mr-2"
                onClick={(e) => {
                    e.stopPropagation();
                    openRenameDialog('continent', continent, getContinentName(continent));
                }}
            >
                <Pencil className="h-4 w-4 text-muted-foreground/80" />
            </Button>
        )}
   </div>
  )

  const renderCountryHeader = (country: string, flag: string | null) => (
    <div className="flex w-full items-center justify-between">
        <AccordionTrigger className="px-4 text-base font-semibold flex-1">
            <div className="flex items-center gap-3">
                {flag && <img src={flag} alt={country} className="h-5 w-7 object-contain" />}
                <span>{getCountryName(country)}</span>
            </div>
        </AccordionTrigger>
        {isAdmin && (
            <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 mr-2"
                onClick={(e) => {
                    e.stopPropagation();
                    openRenameDialog('country', country, getCountryName(country));
                }}
            >
                <Pencil className="h-4 w-4 text-muted-foreground/80" />
            </Button>
        )}
    </div>
  )

  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader title="البطولات" onBack={goBack} canGoBack={canGoBack} />
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="rounded-lg border bg-card p-4">
                <Skeleton className="h-6 w-1/3" />
              </div>
            ))}
          </div>
        ) : competitions ? (
          <>
          <Accordion type="multiple" className="w-full space-y-4" defaultValue={['World', 'Europe', 'Asia']}>
            {Object.entries(competitions).map(([continent, content]) => (
              <AccordionItem value={continent} key={continent} className="rounded-lg border bg-card">
                {renderContinentHeader(continent)}
                <AccordionContent className="px-1">
                  {"leagues" in content ? (
                     <ul className="flex flex-col">
                        {(content.leagues as Competition[]).map(renderLeagueItem)}
                      </ul>
                  ) : (
                    <Accordion type="multiple" className="w-full space-y-2 px-2">
                         {Object.entries(content as LeaguesByCountry).map(([country, { flag, leagues }]) => (
                             <AccordionItem value={country} key={country} className="rounded-lg border bg-background">
                                {renderCountryHeader(country, flag)}
                                <AccordionContent className="px-1">
                                    <ul className="flex flex-col">
                                        {leagues.map(renderLeagueItem)}
                                    </ul>
                                </AccordionContent>
                             </AccordionItem>
                         ))}
                    </Accordion>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <RenameDialog
              isOpen={renameState.isOpen}
              onOpenChange={(isOpen) => setRenameState({ ...renameState, isOpen })}
              currentName={renameState.currentName}
              onSave={handleSaveRename}
              itemType={renameState.type ? itemTypeMap[renameState.type] : "العنصر"}
          />
          </>
        ) : (
          <div className="text-center text-muted-foreground py-10">فشل في تحميل البطولات. يرجى التحقق من مفتاح API أو المحاولة مرة أخرى لاحقًا.</div>
        )}
      </div>
    </div>
  );
}
