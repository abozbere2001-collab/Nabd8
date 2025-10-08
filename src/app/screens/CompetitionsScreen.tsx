
"use client";

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Star, Pencil, Plus, Trash2, Loader2, Copy, Users } from 'lucide-react';
import type { ScreenProps } from '@/app/page';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdmin, useAuth, useFirestore } from '@/firebase/provider';
import { doc, setDoc, deleteDoc, collection, onSnapshot, writeBatch, getDocs, query, orderBy, updateDoc, deleteField } from 'firebase/firestore';
import { RenameDialog } from '@/components/RenameDialog';
import { AddCompetitionDialog } from '@/components/AddCompetitionDialog';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import type { Team, Player as PlayerType, Favorites } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';


// --- TYPE DEFINITIONS ---
interface ApiLeague {
  league: { id: number; name: string; type: string; logo: string; };
  country: { name: string; code: string; flag: string | null; };
  seasons: { year: number; }[];
}

interface ManagedCompetition {
    leagueId: number;
    name: string;
    logo: string;
    countryName: string;
    countryFlag: string | null;
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
    type: 'league' | 'country' | 'continent' | 'player' | 'team' | null;
    id: string;
    currentName: string;
}

interface PlayerInfoFromApi {
    player: PlayerType;
    statistics: any[];
}


// --- CONSTANTS ---
const CURRENT_SEASON = 2025;
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


// --- CHILD COMPONENTS ---

const PlayerItem = ({ player, onFavorite, isFavorited, onRename, isAdmin }: { player: PlayerType, onFavorite: (player: PlayerType) => void, isFavorited: boolean, onRename: (id: number, name: string) => void, isAdmin: boolean }) => (
    <div className="flex items-center gap-2 py-1 px-2 rounded-md hover:bg-slate-700/50">
        <Avatar className="h-6 w-6"><AvatarImage src={player.photo} /><AvatarFallback>{player.name.charAt(0)}</AvatarFallback></Avatar>
        <span className="flex-1 text-xs truncate">{player.name}</span>
        {isAdmin && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onRename(player.id, player.name); }}><Pencil className="h-3 w-3" /></Button>}
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onFavorite(player); }}><Star className={cn("h-4 w-4", isFavorited ? "text-yellow-400 fill-current" : "text-muted-foreground/50")} /></Button>
    </div>
);

const TeamItem = ({ team, onFavorite, isFavorited, onRename, isAdmin, favorites, onPlayerFavorite, onPlayerRename }: { team: Team, onFavorite: (team: Team) => void, isFavorited: boolean, onRename: (id: number, name: string) => void, isAdmin: boolean, favorites: Favorites, onPlayerFavorite: (player: PlayerType) => void, onPlayerRename: (id: number, name: string) => void }) => {
    const [players, setPlayers] = useState<PlayerInfoFromApi[]>([]);
    const [loadingPlayers, setLoadingPlayers] = useState(false);

    const fetchPlayers = async () => {
        setLoadingPlayers(true);
        try {
            const res = await fetch(`/api/football/players?team=${team.id}&season=${CURRENT_SEASON}`);
            const data = await res.json();
            setPlayers(data.response || []);
        } catch (error) {
            console.error('Failed to fetch players:', error);
        } finally {
            setLoadingPlayers(false);
        }
    };
    
    return (
        <Accordion type="single" collapsible className="w-full">
            <AccordionItem value={`team-${team.id}`} className="border-none">
                 <div className="flex items-center gap-2 py-1 px-2 rounded-md hover:bg-slate-600/50">
                    <AccordionTrigger onClick={fetchPlayers} className="flex-1 p-0 hover:no-underline">
                        <div className="flex items-center gap-2">
                           <Avatar className="h-6 w-6"><AvatarImage src={team.logo} /><AvatarFallback>{team.name.charAt(0)}</AvatarFallback></Avatar>
                           <span className="flex-1 text-sm truncate">{team.name}</span>
                        </div>
                    </AccordionTrigger>
                    {isAdmin && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onRename(team.id, team.name); }}><Pencil className="h-4 w-4" /></Button>}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onFavorite(team); }}><Star className={cn("h-5 w-5", isFavorited ? "text-yellow-400 fill-current" : "text-muted-foreground/50")} /></Button>
                </div>
                <AccordionContent className="pt-2 pl-6">
                    {loadingPlayers ? <Loader2 className="h-4 w-4 animate-spin my-2 mx-auto" /> : (
                         players.length > 0 ? (
                            players.map(({ player }) => (
                                <PlayerItem 
                                    key={player.id} 
                                    player={player} 
                                    onFavorite={onPlayerFavorite} 
                                    isFavorited={!!favorites?.players?.[player.id]}
                                    onRename={onPlayerRename}
                                    isAdmin={isAdmin}
                                />
                            ))
                         ) : <p className="text-xs text-muted-foreground p-2">لا يوجد لاعبون متاحون.</p>
                    )}
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    );
};

const LeagueItem = ({ comp, navigate, onFavorite, isFavorited, onRename, isAdmin, favorites, onTeamFavorite, onPlayerFavorite, onTeamRename, onPlayerRename }: { comp: ManagedCompetition, navigate: ScreenProps['navigate'], onFavorite: (comp: ManagedCompetition) => void, isFavorited: boolean, onRename: (id: number, name: string) => void, isAdmin: boolean, favorites: Favorites, onTeamFavorite: (team: Team) => void, onPlayerFavorite: (player: PlayerType) => void, onTeamRename: (id: number, name: string) => void, onPlayerRename: (id: number, name: string) => void }) => {
    const [teams, setTeams] = useState<{team: Team}[]>([]);
    const [loadingTeams, setLoadingTeams] = useState(false);
    
    const fetchTeams = async () => {
        setLoadingTeams(true);
        try {
            const res = await fetch(`/api/football/teams?league=${comp.leagueId}&season=${CURRENT_SEASON}`);
            const data = await res.json();
            setTeams(data.response || []);
        } catch (error) {
            console.error("Failed to fetch teams", error);
        } finally {
            setLoadingTeams(false);
        }
    };
    
    return (
        <Accordion type="single" collapsible className="w-full">
            <AccordionItem value={`league-${comp.leagueId}`} className="border-none">
                <div className="flex w-full items-center justify-between p-3 hover:bg-accent/80 transition-colors rounded-md group">
                    <AccordionTrigger onClick={fetchTeams} className="flex-1 p-0 hover:no-underline">
                         <div className="flex items-center gap-3">
                           <img src={comp.logo} alt={comp.name} className="h-6 w-6 object-contain" />
                           <span className="text-sm">{comp.name}</span>
                        </div>
                    </AccordionTrigger>
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); navigate('CompetitionDetails', { title: comp.name, leagueId: comp.leagueId, logo: comp.logo }) }}>
                            <Users className="h-4 w-4" />
                        </Button>
                        {isAdmin && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); onRename(comp.leagueId, comp.name); }}>
                                <Pencil className="h-4 w-4 text-muted-foreground/80" />
                            </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); onFavorite(comp); }}>
                            <Star className={isFavorited ? "h-5 w-5 text-yellow-400 fill-current" : "h-5 w-5 text-muted-foreground/50"} />
                        </Button>
                    </div>
                </div>
                <AccordionContent className="pt-2 pl-6">
                    {loadingTeams ? <Loader2 className="h-4 w-4 animate-spin my-2 mx-auto" /> : (
                        teams.length > 0 ? (
                            teams.map(({ team }) => (
                                <TeamItem 
                                    key={team.id}
                                    team={team} 
                                    onFavorite={onTeamFavorite}
                                    isFavorited={!!favorites?.teams?.[team.id]}
                                    onRename={onTeamRename}
                                    isAdmin={isAdmin}
                                    favorites={favorites}
                                    onPlayerFavorite={onPlayerFavorite}
                                    onPlayerRename={onPlayerRename}
                                />
                            ))
                        ) : <p className="text-xs text-muted-foreground p-2">لا توجد فرق متاحة.</p>
                    )}
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    );
};


// --- MAIN SCREEN COMPONENT ---
export function CompetitionsScreen({ navigate, goBack, canGoBack, headerActions }: ScreenProps & { headerActions?: React.ReactNode }) {
    const [managedCompetitions, setManagedCompetitions] = useState<ManagedCompetition[] | null>(null);
    const [loading, setLoading] = useState(true);
    const { isAdmin } = useAdmin();
    const { user } = useAuth();
    const { db } = useFirestore();
    const { toast } = useToast();
    const [favorites, setFavorites] = useState<Favorites>({ userId: '', leagues: {}, teams: {}, players: {} });
    const [renameState, setRenameState] = useState<RenameState>({ isOpen: false, type: null, id: '', currentName: '' });
    const [isAddOpen, setAddOpen] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const [customNames, setCustomNames] = useState<{ leagues: Map<number, string>, countries: Map<string, string>, continents: Map<string, string>, teams: Map<number, string>, players: Map<number, string> }>({ leagues: new Map(), countries: new Map(), continents: new Map(), teams: new Map(), players: new Map() });

    const getName = useCallback((type: 'league' | 'country' | 'continent' | 'team' | 'player', id: string | number, defaultName: string) => {
        const key = `${type}s` as keyof typeof customNames;
        return customNames[key]?.get(id as any) || defaultName;
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
            const [leaguesSnapshot, countriesSnapshot, continentsSnapshot, teamsSnapshot, playersSnapshot] = await Promise.all([
                getDocs(collection(db, 'leagueCustomizations')),
                getDocs(collection(db, 'countryCustomizations')),
                getDocs(collection(db, 'continentCustomizations')),
                getDocs(collection(db, 'teamCustomizations')),
                getDocs(collection(db, 'playerCustomizations'))
            ]);
            
            const names = {
                leagues: new Map<number, string>(),
                countries: new Map<string, string>(),
                continents: new Map<string, string>(),
                teams: new Map<number, string>(),
                players: new Map<number, string>()
            };

            leaguesSnapshot.forEach(doc => names.leagues.set(Number(doc.id), doc.data().customName));
            countriesSnapshot.forEach(doc => names.countries.set(doc.id, doc.data().customName));
            continentsSnapshot.forEach(doc => names.continents.set(doc.id, doc.data().customName));
            teamsSnapshot.forEach(doc => names.teams.set(Number(doc.id), doc.data().customName));
            playersSnapshot.forEach(doc => names.players.set(Number(doc.id), doc.data().customName));
            
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
            const fetchedCompetitions = snapshot.docs.map(doc => doc.data() as ManagedCompetition);
            setManagedCompetitions(fetchedCompetitions);
            setLoading(false);
        }, (error) => {
            const permissionError = new FirestorePermissionError({ path: compsRef.path, operation: 'list' });
            errorEmitter.emit('permission-error', permissionError);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [db, fetchAllCustomNames]);

    const handleFavorite = useCallback(async (type: 'league' | 'team' | 'player', item: any) => {
        if (!user || !db) return;
        
        const favRef = doc(db, 'favorites', user.uid);
        const itemId = item.id ?? item.leagueId;
        const itemPath = `${type}s`;
        const fieldPath = `${itemPath}.${itemId}`;
        const isFavorited = !!(favorites as any)?.[itemPath]?.[itemId];

        let favoriteData: Partial<Favorites> = { userId: user.uid };
        
        const payload: any = { name: getName(type, itemId, item.name) };
         if (type === 'league') {
          payload.leagueId = itemId;
          payload.logo = item.logo;
        } else if (type === 'team') {
          payload.teamId = itemId;
          payload.logo = item.logo;
        } else if (type === 'player') {
          payload.playerId = itemId;
          payload.photo = item.photo;
        }
        
        favoriteData[itemPath as 'leagues' | 'teams' | 'players'] = { [itemId]: payload };

        try {
            if (isFavorited) {
                await updateDoc(favRef, { [fieldPath]: deleteField() });
            } else {
                await setDoc(favRef, favoriteData, { merge: true });
            }
        } catch (error) {
             const permissionError = new FirestorePermissionError({ 
                path: favRef.path, 
                operation: isFavorited ? 'update' : 'create',
                requestResourceData: favoriteData 
            });
            errorEmitter.emit('permission-error', permissionError);
        }
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
                const aIsCustom = customNamesMap.has(a);
                const bIsCustom = customNamesMap.has(b);
                if (aIsCustom && !bIsCustom) return -1;
                if (!aIsCustom && bIsCustom) return 1;
                return a.localeCompare(b);
            });
        };
        
        const sortedGrouped: GroupedCompetitions = {};
        const continents = Object.keys(grouped).sort((a, b) => continentOrder.indexOf(a) - continentOrder.indexOf(b));

        for (const continent of continents) {
            if (continent === "World") {
                 const worldLeagues = (grouped.World as { leagues: ManagedCompetition[] }).leagues;
                 worldLeagues.sort((a, b) => a.name.localeCompare(b.name));
                 sortedGrouped.World = { leagues: worldLeagues };
            } else {
                const countries = grouped[continent] as CompetitionsByCountry;
                const sortedCountries = sortWithCustomPriority(Object.keys(countries), customNames.countries);
                
                const sortedCountriesObj: CompetitionsByCountry = {};
                for (const country of sortedCountries) {
                    countries[country].leagues.sort((a, b) => a.name.localeCompare(b.name));
                    sortedCountriesObj[country] = countries[country];
                }
                sortedGrouped[continent] = sortedCountriesObj;
            }
        }
        
        return sortedGrouped;

    }, [managedCompetitions, getName, customNames.countries]);

    const handleSaveRename = async (newName: string) => {
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


    const itemTypeMap: {[key: string]: string} = { league: 'البطولة', country: 'الدولة', continent: 'القارة', team: 'الفريق', player: 'اللاعب' };

    return (
        <div className="flex h-full flex-col bg-background">
            <ScreenHeader title="البطولات" onBack={goBack} canGoBack={canGoBack} actions={headerActions} />
            <div className="flex-1 overflow-y-auto p-4">
                {loading ? (
                    <div className="space-y-4">
                        {Array.from({ length: 10 }).map((_, i) => (
                            <div key={i} className="rounded-lg border bg-card p-4"><Skeleton className="h-6 w-1/3" /></div>
                        ))}
                    </div>
                ) : managedCompetitions && managedCompetitions.length > 0 ? (
                    <Accordion type="multiple" className="w-full space-y-4">
                        {Object.entries(sortedGroupedCompetitions || {}).map(([continent, content]) => (
                            <AccordionItem value={continent} key={continent} className="rounded-lg border bg-card">
                                <div className="flex w-full items-center justify-between">
                                    <AccordionTrigger className="px-4 text-lg font-bold flex-1 hover:no-underline">{getName('continent', continent, continent)}</AccordionTrigger>
                                    {isAdmin && (<Button variant="ghost" size="icon" className="h-9 w-9 mr-2" onClick={(e) => { e.stopPropagation(); openRenameDialog('continent', continent, getName('continent', continent, continent)); }}>
                                            <Pencil className="h-4 w-4 text-muted-foreground/80" />
                                    </Button>)}
                                </div>
                                <AccordionContent className="px-1">
                                    {"leagues" in content ? (
                                        <ul className="flex flex-col">{(content.leagues as ManagedCompetition[]).map(comp => 
                                             <LeagueItem 
                                                key={comp.leagueId}
                                                comp={{...comp, name: getName('league', comp.leagueId, comp.name)}}
                                                navigate={navigate}
                                                onFavorite={() => handleFavorite('league', comp)}
                                                isFavorited={!!favorites.leagues?.[comp.leagueId]}
                                                onRename={(id, name) => openRenameDialog('league', id, name)}
                                                isAdmin={isAdmin}
                                                favorites={favorites}
                                                onTeamFavorite={(team) => handleFavorite('team', team)}
                                                onPlayerFavorite={(player) => handleFavorite('player', player)}
                                                onTeamRename={(id, name) => openRenameDialog('team', id, name)}
                                                onPlayerRename={(id, name) => openRenameDialog('player', id, name)}
                                             />
                                        )}</ul>
                                    ) : (
                                        <Accordion type="multiple" className="w-full space-y-2 px-2">
                                            {Object.entries(content as CompetitionsByCountry).map(([country, { flag, leagues }]) => (
                                                <AccordionItem value={country} key={country} className="rounded-lg border bg-background">
                                                    <div className="flex w-full items-center justify-between">
                                                        <AccordionTrigger className="px-4 text-base font-semibold flex-1 hover:no-underline">
                                                          <div className="flex items-center gap-3">
                                                              {flag && <img src={flag} alt={country} className="h-5 w-7 object-contain" />}
                                                              <span>{getName('country', country, country)}</span>
                                                          </div>
                                                        </AccordionTrigger>
                                                         <div className="flex items-center pr-2">
                                                            {isAdmin && <Button variant="ghost" size="icon" className="h-9 w-9" onClick={(e) => { e.stopPropagation(); openRenameDialog('country', country, getName('country', country, country)); }}><Pencil className="h-4 w-4 text-muted-foreground/80" /></Button>}
                                                        </div>
                                                    </div>
                                                    <AccordionContent className="px-1">
                                                        <ul className="flex flex-col">{leagues.map(comp => 
                                                             <LeagueItem 
                                                                key={comp.leagueId}
                                                                comp={{...comp, name: getName('league', comp.leagueId, comp.name)}}
                                                                navigate={navigate}
                                                                onFavorite={() => handleFavorite('league', comp)}
                                                                isFavorited={!!favorites.leagues?.[comp.leagueId]}
                                                                onRename={(id, name) => openRenameDialog('league', id, name)}
                                                                isAdmin={isAdmin}
                                                                favorites={favorites}
                                                                onTeamFavorite={(team) => handleFavorite('team', team)}
                                                                onPlayerFavorite={(player) => handleFavorite('player', player)}
                                                                onTeamRename={(id, name) => openRenameDialog('team', id, name)}
                                                                onPlayerRename={(id, name) => openRenameDialog('player', id, name)}
                                                             />
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

    