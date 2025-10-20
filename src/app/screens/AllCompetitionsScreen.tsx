
"use client";

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Star, Pencil, Plus, Search, Heart, RefreshCcw, Users, Trophy, Loader2 } from 'lucide-react';
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
import { ProfileButton } from '../AppContentWrapper';
import { hardcodedTranslations } from '@/lib/hardcoded-translations';

// --- Persistent Cache Logic ---
const COMPETITIONS_CACHE_KEY = 'goalstack_competitions_cache';
const COUNTRIES_CACHE_KEY = 'goalstack_countries_cache';
const TEAMS_CACHE_KEY = 'goalstack_national_teams_cache';
const CACHE_EXPIRATION_MS = 60 * 24 * 60 * 60 * 1000; // 60 days

interface CompetitionsCache {
    managedCompetitions: ManagedCompetitionType[];
    lastFetched: number;
}


const getCachedData = <T>(key: string): { data: T; lastFetched: number } | null => {
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

type RenameType = 'league' | 'team' | 'player' | 'continent' | 'country' | 'coach' | 'status';
interface RenameState {
  id: string | number;
  name: string;
  type: RenameType;
  purpose: 'rename' | 'note';
  note?: string;
  originalData?: any;
  originalName?: string;
}

// --- CONSTANTS ---
const countryToContinent: { [key: string]: string } = {
    "World": "World", "England": "Europe", "Spain": "Europe", "Germany": "Europe", "Italy": "Europe", "France": "Europe", "Netherlands": "Europe", "Portugal": "Europe", "Belgium": "Europe", "Russia": "Europe", "Turkey": "Europe", "Greece": "Europe", "Switzerland": "Europe", "Austria": "Europe", "Denmark": "Europe", "Scotland": "Europe", "Sweden": "Europe", "Norway": "Europe", "Poland": "Europe", "Ukraine": "Europe", "Czech-Republic": "Europe", "Croatia": "Europe", "Romania": "Europe", "Serbia": "Europe", "Hungary": "Europe", "Finland": "Europe", "Ireland": "Europe", "Northern-Ireland": "Europe", "Wales": "Europe", "Iceland": "Europe", "Albania": "Europe", "Georgia": "Europe", "Latvia": "Europe", "Estonia": "Europe", "Lithuania": "Europe", "Luxembourg": "Europe", "Faroe-Islands": "Europe", "Malta": "Europe", "Andorra": "Europe", "San-Marino": "Europe", "Gibraltar": "Europe", "Kosovo": "Europe", "Bosnia-and-Herzegovina": "Europe", "Slovakia": "Europe", "Slovenia": "Europe", "Bulgaria": "Europe", "Cyprus": "Europe", "Azerbaijan": "Europe", "Armenia": "Europe", "Belarus": "Europe", "Moldova": "Europe", "North-Macedonia": "Europe", "Montenegro": "Europe",
    "Saudi Arabia": "Asia", "Japan": "Asia", "South Korea": "Asia", "China": "Asia", "Qatar": "Asia", "United Arab Emirates": "Asia", "Iran": "Asia", "Iraq": "Asia", "Uzbekistan": "Asia", "Australia": "Asia", "Jordan": "Asia", "Syria": "Asia", "Lebanon": "Asia", "Oman": "Asia", "Kuwait": "Asia", "Bahrain": "Asia", "India": "Asia", "Thailand": "Asia", "Vietnam": "Asia", "Malaysia": "Asia", "Indonesia": "Asia", "Singapore": "Asia", "Philippines": "Asia", "Hong Kong": "Asia", "Palestine": "Asia", "Tajikistan": "Asia", "Turkmenistan": "Asia", "Kyrgyzstan": "Asia", "Bangladesh": "Asia", "Maldives": "Asia", "Cambodia": "Asia", "Myanmar": "Asia",
    "Egypt": "Africa", "Morocco": "Africa", "Tunisia": "Africa", "Algeria": "Africa", "Nigeria": "Africa", "Senegal": "Africa", "Ghana": "Africa", "Ivory Coast": "Africa", "Cameroon": "Africa", "South Africa": "Africa", "DR Congo": "Africa", "Mali": "Africa", "Burkina Faso": "Africa", "Guinea": "Africa", "Zambia": "Africa", "Cape Verde": "Africa", "Uganda": "Africa", "Kenya": "Africa", "Tanzania": "Africa", "Sudan": "Africa", "Libya": "Africa", "Angola": "Africa", "Zimbabwe": "Africa", "Ethiopia": "Africa",
    "USA": "North America", "Mexico": "North America", "Canada": "North America", "Costa Rica": "North America", "Honduras": "North America", "Panama": "North America", "Jamaica": "North America", "El Salvador": "North America", "Trinidad and Tobago": "North America", "Guatemala": "North America", "Nicaragua": "North America", "Cuba": "North America",
    "Brazil": "South America", "Argentina": "South America", "Colombia": "South America", "Chile": "South America", "Uruguay": "South America", "Peru": "South America", "Ecuador": "South America", "Paraguay": "South America", "Venezuela": "South America", "Bolivia": "South America",
    "New Zealand": "Oceania", "Fiji": "Oceania",
    "International": "World",
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
        if (!db) {
            setLoadingClubData(false);
            setManagedCompetitions([]);
            return;
        }

        const fetchCustomNames = async () => {
             if (!db) {
                setCustomNames({ leagues: new Map(), teams: new Map(), countries: new Map(), continents: new Map() });
                return;
            };
            try {
                 const [leaguesSnapshot, countriesSnapshot, continentsSnapshot, teamsSnapshot] = await Promise.all([
                    getDocs(collection(db, 'leagueCustomizations')),
                    getDocs(collection(db, 'countryCustomizations')),
                    getDocs(collection(db, 'continentCustomizations')),
                    getDocs(collection(db, 'teamCustomizations')),
                ]);

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

            } catch(e) {
                 console.warn("Could not fetch custom names, this is expected for guests/non-admins");
                 setCustomNames({ leagues: new Map(), teams: new Map(), countries: new Map(), continents: new Map() });
            }
        };

        const fetchClubData = async () => {
            const cached = getCachedData<CompetitionsCache>(COMPETITIONS_CACHE_KEY);
            let serverLastUpdated = 0;
            if (db) {
                try {
                    const cacheBusterRef = doc(db, 'appConfig', 'cache');
                    const cacheBusterSnap = await getDoc(cacheBusterRef);
                    serverLastUpdated = cacheBusterSnap.exists() ? cacheBusterSnap.data().competitionsLastUpdated?.toMillis() : 0;
                } catch (e) { console.warn("Could not check cache-buster."); }
            }
            
             if (cached?.data?.managedCompetitions && cached.data.managedCompetitions.length > 0 && !forceRefresh && cached.lastFetched > serverLastUpdated) {
                setManagedCompetitions(cached.data.managedCompetitions);
                return; 
            }

            if (!db) {
                setManagedCompetitions([]);
                return;
            }

            try {
                const compsSnapshot = await getDocs(collection(db, 'managedCompetitions'));
                const fetchedCompetitions = compsSnapshot.docs.map(d => d.data() as ManagedCompetitionType);
                setManagedCompetitions(fetchedCompetitions);
                setCachedData(COMPETITIONS_CACHE_KEY, { managedCompetitions: fetchedCompetitions, lastFetched: Date.now() });
            } catch (error) {
                console.error("Permission error fetching managed competitions for admin:", error);
            }
        };

        await Promise.all([
            fetchCustomNames(),
            fetchClubData()
        ]);
        
        setLoadingClubData(false);

    }, [db, toast]);


    useEffect(() => {
        fetchAllData();
    
        let unsubscribe: (() => void) | null = null;
        if (user && db) {
            const favoritesRef = doc(db, 'users', user.uid, 'favorites', 'data');
            unsubscribe = onSnapshot(favoritesRef, (docSnap) => {
                setFavorites(docSnap.exists() ? (docSnap.data() as Favorites) : {});
            }, (error) => {
                const permissionError = new FirestorePermissionError({
                    path: favoritesRef.path,
                    operation: 'get',
                });
                errorEmitter.emit('permission-error', permissionError);
            });
        } else {
             setFavorites(getLocalFavorites());
        }

        return () => {
          if (unsubscribe) unsubscribe();
        };
    }, [user, db, fetchAllData]);


    const sortedGroupedCompetitions = useMemo(() => {
        if (!managedCompetitions) return null;
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
    }, [managedCompetitions, getName]);
    
    const groupedNationalTeams = useMemo(() => {
        if (!nationalTeams) return null;

        const processedTeams = nationalTeams.map(team => ({
            ...team,
            name: getName('team', team.id, team.name),
        }));

        const grouped: TeamsByContinent = {};
        processedTeams.forEach(team => {
            const continent = countryToContinent[team.country || team.name] || "Other";
            if (!grouped[continent]) grouped[continent] = [];
            grouped[continent].push(team);
        });

        Object.keys(grouped).forEach(continent => {
            grouped[continent].sort((a,b) => a.name.localeCompare(b.name, 'ar'));
        });
        
        return grouped;
    }, [nationalTeams, getName]);
    
    const fetchNationalTeams = useCallback(async () => {
        const cached = getCachedData<Team[]>(TEAMS_CACHE_KEY);
        if (cached?.data && cached.data.length > 0) {
            setNationalTeams(cached.data);
            return;
        }

        setLoadingNationalTeams(true);
        toast({ title: 'جاري جلب بيانات المنتخبات...', description: 'قد تستغرق هذه العملية دقيقة في المرة الأولى.' });
    
        try {
            let countries: { name: string }[] = [];
            const cachedCountries = getCachedData<{ name: string }[]>(COUNTRIES_CACHE_KEY);
            if (cachedCountries?.data) {
                countries = cachedCountries.data;
            } else {
                const countriesRes = await fetch('/api/football/countries');
                if (!countriesRes.ok) throw new Error('Failed to fetch countries');
                const countriesData = await countriesRes.json();
                countries = countriesData.response || [];
                setCachedData(COUNTRIES_CACHE_KEY, countries);
            }

            const teamPromises = countries.map(country => 
                fetch(`/api/football/teams?country=${country.name}`)
                    .then(res => res.ok ? res.json() : { response: [] })
                    .then(data => (data.response || []).filter((r: { team: Team }) => r.team.national).map((r: { team: Team}) => r.team))
                    .catch(() => []) // return empty array on error for a specific country
            );
    
            const results = await Promise.all(teamPromises);
            const nationalTeamsData = results.flat(); // Flatten the array of arrays
            
            setCachedData(TEAMS_CACHE_KEY, nationalTeamsData);
            setNationalTeams(nationalTeamsData);

        } catch (error) {
            console.error("Error fetching national teams:", error);
            toast({ variant: 'destructive', title: "خطأ", description: "فشل في جلب بيانات المنتخبات الوطنية." });
        } finally {
            setLoadingNationalTeams(false);
        }
    }, [toast]);

    const handleNationalTeamsAccordionOpen = (value: string[]) => {
        if (value.includes('national-teams') && !nationalTeams && !loadingNationalTeams) {
            fetchNationalTeams();
        }
    };

    const handleFavorite = useCallback((item: ManagedCompetitionType | Team, type: 'star' | 'heart') => {
        if (!user) {
            toast({
                variant: 'destructive',
                title: 'ميزة للمستخدمين المسجلين',
                description: 'يرجى تسجيل الدخول لاستخدام هذه الميزة.',
                action: <Button onClick={() => navigate('Login')}>تسجيل الدخول</Button>
            });
            return;
        }

        if (!db) return;

        const isLeague = 'leagueId' in item;
        const itemId = isLeague ? (item as ManagedCompetitionType).leagueId : (item as Team).id;
        const favDocRef = doc(db, 'users', user.uid, 'favorites', 'data');
        
        const itemType = isLeague ? 'leagues' : 'teams';
        const currentItem = favorites[itemType]?.[itemId];
        const isHearted = currentItem?.isHearted || false;
        const isStarred = !!currentItem; // A star is just existing in the map

        let fieldPath;
        let updateData: any;

        if (type === 'heart') {
            if (isLeague) {
                // Unheart any other league
                const updates: {[key: string]: any} = {};
                Object.keys(favorites.leagues || {}).forEach(id => {
                    updates[`leagues.${id}.isHearted`] = false;
                });
                 // Heart the new one
                fieldPath = `leagues.${itemId}.isHearted`;
                updates[fieldPath] = !isHearted; // Toggle
                // Make sure it's also starred
                if (!isStarred) {
                   updates[`leagues.${itemId}.name`] = item.name;
                   updates[`leagues.${itemId}.logo`] = item.logo;
                   updates[`leagues.${itemId}.leagueId`] = itemId;
                }
                updateDoc(favDocRef, updates).catch(err => errorEmitter.emit('permission-error', new FirestorePermissionError({path: favDocRef.path, operation: 'update', requestResourceData: updates})));

            } else { // Team heart
                fieldPath = `teams.${itemId}.isHearted`;
                updateData = { [fieldPath]: !isHearted };
                 // Make sure it's also starred
                if (!isStarred) {
                   updateData[`teams.${itemId}.name`] = item.name;
                   updateData[`teams.${itemId}.logo`] = item.logo;
                   updateData[`teams.${itemId}.teamId`] = itemId;
                   updateData[`teams.${itemId}.type`] = (item as Team).national ? 'National' : 'Club';
                }
                updateDoc(favDocRef, updateData).catch(err => errorEmitter.emit('permission-error', new FirestorePermissionError({path: favDocRef.path, operation: 'update', requestResourceData: updateData})));
            }

        } else { // Star Favorite
            fieldPath = `${itemType}.${itemId}`;
            if (isStarred) {
                // If it's hearted, just remove the star part by setting it to a minimal object, otherwise delete the whole field
                if (isHearted) {
                    updateData = { [fieldPath]: { ...currentItem, name: item.name } }; // Reset everything but hearted status
                    delete updateData[fieldPath].notificationsEnabled; // Example of resetting
                } else {
                    updateData = { [fieldPath]: deleteField() };
                }
            } else {
                 const favData = isLeague
                    ? { name: item.name, leagueId: itemId, logo: item.logo, notificationsEnabled: true }
                    : { name: item.name, teamId: itemId, logo: item.logo, type: (item as Team).national ? 'National' : 'Club', notificationsEnabled: true };
                updateData = { [fieldPath]: favData };
            }
             updateDoc(favDocRef, updateData).catch(err => errorEmitter.emit('permission-error', new FirestorePermissionError({path: favDocRef.path, operation: 'update', requestResourceData: updateData})));
        }
    }, [user, db, favorites, toast, navigate]);



    const handleSaveRenameOrNote = (type: RenameType, id: string | number, newName: string, newNote?: string) => {
        if (!renameItem) return;
        
        if (renameItem.purpose === 'rename' && isAdmin && db) {
            const collectionName = `${type}Customizations`;
            const docId = String(id);
            const originalName = renameItem?.originalName;
            const data = { customName: newName };

            const op = (newName && newName.trim() && newName !== originalName)
                ? setDoc(doc(db, collectionName, docId), data)
                : deleteDoc(doc(db, collectionName, docId));

            op.then(() => {
                fetchAllData(true);
                toast({ title: 'نجاح', description: 'تم حفظ التغييرات.' });
            }).catch(serverError => {
                const permissionError = new FirestorePermissionError({ path: doc(db, collectionName, docId).path, operation: 'write', requestResourceData: data });
                errorEmitter.emit('permission-error', permissionError);
            });
        }
        
         if (renameItem.purpose === 'note' && user && !user.isAnonymous && db) {
            const favDocRef = doc(db, 'users', user.uid, 'favorites', 'data');
            const itemData = renameItem.originalData as Team;
            const fieldPath = `teams.${itemData.id}.note`;
            const updateData = { [fieldPath]: newNote || deleteField() };
        
            updateDoc(favDocRef, updateData).then(() => {
                toast({ title: 'نجاح', description: 'تم حفظ الملاحظة.' });
            }).catch(err => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({ path: favDocRef.path, operation: 'update', requestResourceData: updateData }))
            });
        }
        setRenameItem(null);
    };
    
    const handleOpenRename = (type: RenameType, id: number | string, name: string, originalName?: string) => {
        if (!isAdmin) return;
        setRenameItem({
            type: type,
            id: id,
            name: name,
            originalName: originalName || name,
            purpose: 'rename',
        });
    };

    const handleAdminRefresh = async () => {
        localStorage.removeItem(COMPETITIONS_CACHE_KEY);
        localStorage.removeItem(TEAMS_CACHE_KEY);
        localStorage.removeItem(COUNTRIES_CACHE_KEY);
        toast({ title: 'بدء التحديث...', description: 'جاري تحديث بيانات البطولات والمنتخبات.' });
        
        if (db) {
            const cacheBusterRef = doc(db, 'appConfig', 'cache');
            setDoc(cacheBusterRef, { competitionsLastUpdated: new Date() }, { merge: true })
                .catch(error => {
                    const permissionError = new FirestorePermissionError({ path: 'appConfig/cache', operation: 'write', requestResourceData: { competitionsLastUpdated: '...' } });
                    errorEmitter.emit('permission-error', permissionError);
                    toast({ variant: 'destructive', title: 'خطأ في الصلاحيات', description: 'فشل في فرض التحديث للآخرين.' });
                });
        }
        
        await fetchAllData(true);
        await fetchNationalTeams();
        toast({ title: 'نجاح', description: 'تم تحديث البيانات بنجاح.' });
    };


    const renderNationalTeams = () => {
        if (loadingNationalTeams) return <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin"/></div>;
        if (!groupedNationalTeams) return null;

        return continentOrder.filter(c => groupedNationalTeams[c]).map(continent => (
            <AccordionItem value={`national-${continent}`} key={`national-${continent}`} className="rounded-lg border bg-card/50">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <h3 className="text-lg font-bold">{getName('continent', continent, continent)}</h3>
              </AccordionTrigger>
              <AccordionContent className="p-1">
                <ul className="flex flex-col">{
                  groupedNationalTeams[continent].map(team => {
                     const isHearted = !!favorites.teams?.[team.id]?.isHearted;
                     const isStarred = !!favorites.teams?.[team.id];
                     return (
                         <li key={team.id} className="flex w-full items-center justify-between p-3 h-12 hover:bg-accent/80 transition-colors rounded-md group">
                           <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => navigate('TeamDetails', { teamId: team.id })}>
                             <Avatar className="h-6 w-6"><AvatarImage src={team.logo} alt={team.name} /></Avatar>
                             <span className="text-sm truncate">{team.name}</span>
                           </div>
                           <div className="flex items-center gap-1">
                             <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleFavorite(team, 'heart'); }}>
                                <Heart className={isHearted ? "h-5 w-5 text-red-500 fill-current" : "h-5 w-5 text-muted-foreground/50"} />
                             </Button>
                             {isAdmin && (
                               <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleOpenRename('team', team.id, team.name, nationalTeams?.find(t => t.id === team.id)?.name) }}>
                                 <Pencil className="h-4 w-4 text-muted-foreground/80" />
                               </Button>
                             )}
                             <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleFavorite(team, 'star'); }}>
                               <Star className={isStarred ? "h-5 w-5 text-yellow-400 fill-current" : "h-5 w-5 text-muted-foreground/50"} />
                             </Button>
                           </div>
                         </li>
                     )
                  })
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
                   {isAdmin && (<Button variant="ghost" size="icon" className="h-9 w-9 mr-2" onClick={(e) => { e.stopPropagation(); handleOpenRename('continent', continent, getName('continent', continent, continent), continent); }}>
                           <Pencil className="h-4 w-4 text-muted-foreground/80" />
                   </Button>)}
               </div>
               <AccordionContent className="p-2">
                    {"leagues" in content ? (
                       <div className="p-1">
                           <ul className="flex flex-col">{
                               (content.leagues as ManagedCompetitionType[]).map(comp => {
                                  const isHearted = !!favorites.leagues?.[comp.leagueId]?.isHearted;
                                  const isStarred = !!favorites.leagues?.[comp.leagueId];
                                   return (
                                       <li key={comp.leagueId} className="flex w-full items-center justify-between p-3 h-12 hover:bg-accent/80 transition-colors rounded-md group">
                                           <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => navigate('CompetitionDetails', { title: comp.name, leagueId: comp.leagueId, logo: comp.logo })}>
                                               <img src={comp.logo} alt={comp.name} className="h-6 w-6 object-contain" />
                                               <span className="text-sm truncate">{comp.name}</span>
                                           </div>
                                           <div className="flex items-center gap-1">
                                               <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleFavorite(comp, 'heart'); }}>
                                                   <Heart className={isHearted ? "h-5 w-5 text-red-500 fill-current" : "h-5 w-5 text-muted-foreground/50"} />
                                               </Button>
                                               {isAdmin && (
                                                   <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleOpenRename('league', comp.leagueId, comp.name, managedCompetitions?.find(c => c.leagueId === comp.leagueId)?.name) }}>
                                                       <Pencil className="h-4 w-4 text-muted-foreground/80" />
                                                   </Button>
                                               )}
                                               <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleFavorite(comp, 'star'); }}>
                                                   <Star className={isStarred ? "h-5 w-5 text-yellow-400 fill-current" : "h-5 w-5 text-muted-foreground/50"} />
                                               </Button>
                                           </div>
                                       </li>
                                   )
                               })
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
                                       {isAdmin && <Button variant="ghost" size="icon" className="h-9 w-9 mr-2" onClick={(e) => { e.stopPropagation(); handleOpenRename('country', country, getName('country', country, country), country); }}><Pencil className="h-4 w-4 text-muted-foreground/80" /></Button>}
                                     </div>
                                   <AccordionContent className="p-1">
                                       <ul className="flex flex-col">{leagues.map(comp => {
                                             const isHearted = !!favorites.leagues?.[comp.leagueId]?.isHearted;
                                             const isStarred = !!favorites.leagues?.[comp.leagueId];
                                           return (
                                               <li key={comp.leagueId} className="flex w-full items-center justify-between p-3 h-12 hover:bg-accent/80 transition-colors rounded-md group">
                                                   <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => navigate('CompetitionDetails', { title: comp.name, leagueId: comp.leagueId, logo: comp.logo })}>
                                                       <img src={comp.logo} alt={comp.name} className="h-6 w-6 object-contain" />
                                                       <span className="text-sm truncate">{comp.name}</span>
                                                   </div>
                                                   <div className="flex items-center gap-1">
                                                       <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleFavorite(comp, 'heart'); }}>
                                                            <Heart className={isHearted ? "h-5 w-5 text-red-500 fill-current" : "h-5 w-5 text-muted-foreground/50"} />
                                                       </Button>
                                                       {isAdmin && (
                                                           <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleOpenRename('league', comp.leagueId, comp.name, managedCompetitions?.find(c => c.leagueId === comp.leagueId)?.name) }}>
                                                               <Pencil className="h-4 w-4 text-muted-foreground/80" />
                                                           </Button>
                                                       )}
                                                       <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleFavorite(comp, 'star'); }}>
                                                           <Star className={isStarred ? "h-5 w-5 text-yellow-400 fill-current" : "h-5 w-5 text-muted-foreground/50"} />
                                                       </Button>
                                                   </div>
                                               </li>
                                           )
                                       })}</ul>
                                   </AccordionContent>
                               </AccordionItem>
                           ))}
                       </Accordion>
                   )}
               </AccordionContent>
           </AccordionItem>
       ));
    }


    if (loadingClubData) {
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
                 <Accordion type="multiple" className="w-full space-y-4" onValueChange={handleNationalTeamsAccordionOpen} defaultValue={["club-competitions"]}>
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
                onSave={handleSaveRenameOrNote}
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

    
