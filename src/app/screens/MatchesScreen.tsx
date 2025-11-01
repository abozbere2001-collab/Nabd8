

"use client";

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import type { ScreenProps } from '@/app/page';
import { format, addDays, isToday, isYesterday, isTomorrow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useAdmin, useAuth, useFirestore } from '@/firebase/provider';
import { doc, onSnapshot, collection, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { Loader2, Search, Star, CalendarClock, Crown, Pencil, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { SearchSheet } from '@/components/SearchSheet';
import { ProfileButton } from '../AppContentWrapper';
import type { Fixture as FixtureType, Favorites, PredictionMatch } from '@/lib/types';
import { FixtureItem } from '@/components/FixtureItem';
import { hardcodedTranslations } from '@/lib/hardcoded-translations';
import { getLocalFavorites } from '@/lib/local-favorites';
import { POPULAR_LEAGUES } from '@/lib/popular-data';
import { useToast } from '@/hooks/use-toast';
import { RenameDialog } from '@/components/RenameDialog';
import { LeagueHeaderItem } from '@/components/LeagueHeaderItem';
import { CURRENT_SEASON } from '@/lib/constants';


interface GroupedFixtures {
    [leagueName: string]: {
        league: FixtureType['league'];
        fixtures: FixtureType[];
    }
}

const popularLeagueIds = new Set(POPULAR_LEAGUES.map(l => l.id));

const API_KEY = process.env.API_FOOTBALL_KEY;
const API_HOST = "v3.football.api-sports.io";


// Fixtures List Component
const FixturesList = React.memo((props: { 
    fixtures: FixtureType[], 
    loading: boolean,
    activeTab: string, 
    hasAnyFavorites: boolean,
    navigate: ScreenProps['navigate'],
    pinnedPredictionMatches: Set<number>,
    onPinToggle: (fixture: FixtureType) => void,
}) => {
    
    const groupedFixtures = useMemo(() => {
        return props.fixtures.reduce((acc, fixture) => {
            const leagueName = fixture.league.name;
            if (!acc[leagueName]) {
                acc[leagueName] = { league: fixture.league, fixtures: [] };
            }
            acc[leagueName].fixtures.push(fixture);
            return acc;
        }, {} as GroupedFixtures);
    }, [props.fixtures]);


    if (props.loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }
    
    if (props.activeTab === 'my-results' && !props.hasAnyFavorites) {
        return (
            <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-64 p-4">
                <p className="font-bold text-lg">لم تقم بإضافة أي مفضلات</p>
                <p className="text-sm">أضف فرقًا أو بطولات لترى مبارياتها هنا.</p>
                 <Button className="mt-4" onClick={() => props.navigate('AllCompetitions')}>استكشف البطولات</Button>
            </div>
        );
    }
    
    const noMatches = props.fixtures.length === 0;

    if (noMatches) {
        const message = props.activeTab === 'my-results'
            ? "لا توجد مباريات لمفضلاتك هذا اليوم."
            : "لا توجد مباريات مباشرة حاليًا.";
        return (
            <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-64 p-4">
                <p>{message}</p>
            </div>
        );
    }
    
    const sortedLeagues = Object.keys(groupedFixtures).sort((a,b) => a.localeCompare(b));

    return (
        <div className="space-y-4">
            {sortedLeagues.map(leagueName => {
                const { league, fixtures: leagueFixtures } = groupedFixtures[leagueName];
                return (
                    <div key={`${league.id}-${league.name}`}>
                       <div className="font-semibold text-foreground py-1 px-3 rounded-md bg-card border flex items-center gap-2 text-xs h-6 cursor-pointer" onClick={() => props.navigate('CompetitionDetails', { leagueId: league.id, title: league.name, logo: league.logo })}>
                           <Avatar className="h-4 w-4"><AvatarImage src={league.logo} alt={league.name} /></Avatar>
                           <span className="truncate">{league.name}</span>
                       </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 pt-1">
                            {leagueFixtures.map(f => (
                                <FixtureItem 
                                    key={f.fixture.id} 
                                    fixture={f} 
                                    navigate={props.navigate}
                                    isPinnedForPrediction={props.pinnedPredictionMatches.has(f.fixture.id)}
                                    onPinToggle={props.onPinToggle}
                                />
                            ))}
                        </div>
                    </div>
                )
            })}
        </div>
    );
});
FixturesList.displayName = 'FixturesList';


// Date Scroller
const formatDateKey = (date: Date): string => format(date, 'yyyy-MM-dd');

const getDayLabel = (date: Date) => {
    if (isToday(date)) return "اليوم";
    if (isYesterday(date)) return "الأمس";
    if (isTomorrow(date)) return "غداً";
    return format(date, "EEE", { locale: ar });
};

const DateScroller = ({ selectedDateKey, onDateSelect }: {selectedDateKey: string, onDateSelect: (dateKey: string) => void}) => {
    const dates = useMemo(() => {
        const today = new Date();
        const days = [];
        for (let i = -365; i <= 365; i++) {
            days.push(addDays(today, i));
        }
        return days;
    }, []);
    
    const scrollerRef = useRef<HTMLDivElement>(null);
    const selectedButtonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        const scroller = scrollerRef.current;
        const selectedButton = selectedButtonRef.current;

        if (scroller && selectedButton) {
            const scrollerRect = scroller.getBoundingClientRect();
            const selectedRect = selectedButton.getBoundingClientRect();
            
            const scrollOffset = selectedRect.left - scrollerRect.left - (scrollerRect.width / 2) + (selectedRect.width / 2);
            
            scroller.scrollTo({ left: scroller.scrollLeft + scrollOffset, behavior: 'smooth' });
        }
    }, [selectedDateKey]);

    return (
        <div ref={scrollerRef} className="flex flex-row-reverse overflow-x-auto pb-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {dates.map(date => {
                const dateKey = formatDateKey(date);
                const isSelected = dateKey === selectedDateKey;
                return (
                     <button
                        key={dateKey}
                        ref={isSelected ? selectedButtonRef : null}
                        className={cn(
                            "relative flex flex-col items-center justify-center h-auto py-1 px-2 min-w-[40px] rounded-lg transition-colors ml-2",
                            "text-foreground/80 hover:text-primary",
                            isSelected && "text-primary"
                        )}
                        onClick={() => onDateSelect(dateKey)}
                        data-state={isSelected ? 'active' : 'inactive'}
                    >
                        <span className="text-[10px] font-normal">{getDayLabel(date)}</span>
                        <span className="font-semibold text-sm">{format(date, 'd')}</span>
                        {isSelected && (
                          <span className="absolute bottom-0 h-0.5 w-3 rounded-full bg-primary transition-transform" />
                        )}
                    </button>
                )
            })}
        </div>
    );
}

type TabName = 'my-results' | 'all-matches';

const tabs: {id: TabName, label: string}[] = [
    { id: 'all-matches', label: 'مباشر' },
    { id: 'my-results', label: 'نتائجي' },
];

type RenameType = 'league' | 'team' | 'player' | 'continent' | 'country' | 'coach' | 'status';

// Main Screen Component
export function MatchesScreen({ navigate, goBack, canGoBack, isVisible }: ScreenProps & { isVisible: boolean }) {
  const { user } = useAuth();
  const { db, isAdmin } = useAdmin();
  const { toast } = useToast();
  const [favorites, setFavorites] = useState<Partial<Favorites>>({});
  const [activeTab, setActiveTab] = useState<TabName>('my-results');
  
  const [selectedDateKey, setSelectedDateKey] = useState<string>(formatDateKey(new Date()));
  
  const [matchesCache, setMatchesCache] = useState<Map<string, FixtureType[]>>(new Map());
  const [loading, setLoading] = useState(true);
    
  const [customNamesCache, setCustomNamesCache] = useState<{leagues: Map<number, string>, teams: Map<number, string>} | null>(null);
  const [pinnedPredictionMatches, setPinnedPredictionMatches] = useState(new Set<number>());


  useEffect(() => {
    if (!db || !isAdmin) return;
    const unsub = onSnapshot(collection(db, 'predictions'), (snapshot) => {
        const newPinnedSet = new Set<number>();
        snapshot.forEach(doc => newPinnedSet.add(Number(doc.id)));
        setPinnedPredictionMatches(newPinnedSet);
    }, (error) => {
        console.error("Permission error listening to predictions:", error);
    });
    return () => unsub();
  }, [db, isAdmin]);


  const handlePinToggle = useCallback((fixture: FixtureType) => {
    if (!db) return;
    const fixtureId = fixture.fixture.id;
    const isPinned = pinnedPredictionMatches.has(fixtureId);
    const docRef = doc(db, 'predictions', String(fixtureId));

    if (isPinned) {
        deleteDoc(docRef).then(() => {
            toast({ title: "تم إلغاء التثبيت", description: "تمت إزالة المباراة من التوقعات." });
        }).catch(err => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'delete' }));
        });
    } else {
        const data: PredictionMatch = { fixtureData: fixture };
        setDoc(docRef, data).then(() => {
            toast({ title: "تم التثبيت", description: "أصبحت المباراة متاحة الآن للتوقع." });
        }).catch(err => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'create', requestResourceData: data }));
        });
    }
  }, [db, pinnedPredictionMatches, toast]);


  const fetchAndProcessData = useCallback(async (dateKey: string, abortSignal: AbortSignal) => {
    setLoading(true);

    try {
        const getDisplayName = (type: 'team' | 'league', id: number, defaultName: string) => {
            if (!customNamesCache) return defaultName;
            const firestoreMap = type === 'team' ? customNamesCache.teams : customNamesCache.leagues;
            const customName = firestoreMap?.get(id);
            if (customName) return customName;

            const hardcodedMap = type === 'team' ? hardcodedTranslations.teams : hardcodedTranslations.leagues;
            const hardcodedName = hardcodedMap[id as any];
            if(hardcodedName) return hardcodedName;

            return defaultName;
        };
        
        let url;
        let fixturesToFetch: Promise<any>[] = [];
        const headers = { 'x-rapidapi-key': API_KEY!, 'x-rapidapi-host': API_HOST };

        if (activeTab === 'all-matches') {
            url = `https://v3.football.api-sports.io/fixtures?live=all`;
            fixturesToFetch.push(fetch(url, { headers }).then(res => res.json()));
        } else {
            const currentFavorites = user && !user.isAnonymous ? favorites : getLocalFavorites();
            const teamIds = Object.keys(currentFavorites.teams || {});
            const leagueIds = Object.keys(currentFavorites.leagues || {});
            const hasFavorites = teamIds.length > 0 || leagueIds.length > 0;

            if (hasFavorites) {
                if (leagueIds.length > 0) {
                    const leagueQuery = `ids=${leagueIds.join('-')}`;
                    fixturesToFetch.push(fetch(`https://v3.football.api-sports.io/fixtures?date=${dateKey}&${leagueQuery}`, { headers }).then(res => res.json()));
                }
                teamIds.forEach(teamId => {
                    fixturesToFetch.push(fetch(`https://v3.football.api-sports.io/fixtures?date=${dateKey}&team=${teamId}`, { headers }).then(res => res.json()));
                });
            } else {
                // No favorites, fetch popular leagues
                const popularLeaguesQuery = `ids=${Array.from(popularLeagueIds).join('-')}`;
                fixturesToFetch.push(fetch(`https://v3.football.api-sports.io/fixtures?date=${dateKey}&${popularLeaguesQuery}`, { headers }).then(res => res.json()));
            }
        }

        const responses = await Promise.all(fixturesToFetch);
        if (abortSignal.aborted) return;
        
        const allFixtures: FixtureType[] = [];
        const fixtureIds = new Set<number>();
        
        responses.forEach(data => {
            if (data.response) {
                data.response.forEach((fixture: FixtureType) => {
                    if (!fixtureIds.has(fixture.fixture.id)) {
                        allFixtures.push(fixture);
                        fixtureIds.add(fixture.fixture.id);
                    }
                });
            }
        });

        const processedFixtures = allFixtures.map(fixture => ({
            ...fixture,
            league: {
                ...fixture.league,
                name: getDisplayName('league', fixture.league.id, fixture.league.name)
            },
            teams: {
                home: { ...fixture.teams.home, name: getDisplayName('team', fixture.teams.home.id, fixture.teams.home.name) },
                away: { ...fixture.teams.away, name: getDisplayName('team', fixture.teams.away.id, fixture.teams.away.name) }
            }
        }));

        const cacheKey = activeTab === 'all-matches' ? 'live' : dateKey;
        setMatchesCache(prev => new Map(prev).set(cacheKey, processedFixtures));

    } catch (error) {
        if ((error as Error).name !== 'AbortError') {
            toast({
                variant: "destructive",
                title: "خطأ في الشبكة",
                description: "فشل في تحميل المباريات. يرجى التحقق من اتصالك بالإنترنت.",
            });
            const cacheKey = activeTab === 'all-matches' ? 'live' : dateKey;
            setMatchesCache(prev => new Map(prev).set(cacheKey, []));
        }
    } finally {
        if (!abortSignal.aborted) {
            setLoading(false);
        }
    }
  }, [activeTab, customNamesCache, toast, favorites, user]);


  useEffect(() => {
    const fetchNames = async () => {
        if (!customNamesCache && db) {
            try {
                const [leaguesSnapshot, teamsSnapshot] = await Promise.all([
                    getDocs(collection(db, 'leagueCustomizations')),
                    getDocs(collection(db, 'teamCustomizations'))
                ]);
                
                const leagueNames = new Map<number, string>();
                leaguesSnapshot?.forEach(doc => leagueNames.set(Number(doc.id), doc.data().customName));
                const teamNames = new Map<number, string>();
                teamsSnapshot?.forEach(doc => teamNames.set(Number(doc.id), doc.data().customName));
                
                setCustomNamesCache({ leagues: leagueNames, teams: teamNames });
            } catch(e) {
                console.warn("Could not fetch custom names", e);
                setCustomNamesCache({ leagues: new Map(), teams: new Map() });
            }
        }
    };
    fetchNames();

    if (user && db && !user.isAnonymous) {
        const docRef = doc(db, 'users', user.uid, 'favorites', 'data');
        const unsubscribe = onSnapshot(docRef, (doc) => {
            setFavorites(doc.data() as Favorites || { userId: user.uid });
        }, (error) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'get' }));
            setFavorites(getLocalFavorites()); // Fallback for permission issues
        });
        return () => unsubscribe();
    } else {
        const handleLocalFavoritesChange = () => setFavorites(getLocalFavorites());
        setFavorites(getLocalFavorites());
        window.addEventListener('localFavoritesChanged', handleLocalFavoritesChange);
        return () => window.removeEventListener('localFavoritesChanged', handleLocalFavoritesChange);
    }
  }, [user, db, customNamesCache]);
  
  
  useEffect(() => {
      if (isVisible && (selectedDateKey || activeTab === 'all-matches')) {
          const cacheKey = activeTab === 'all-matches' ? 'live' : selectedDateKey;
          
          if (matchesCache.has(cacheKey)) {
             setLoading(false);
             return;
          }

          const controller = new AbortController();
          fetchAndProcessData(selectedDateKey, controller.signal);
          return () => controller.abort();
      }
  }, [activeTab, isVisible, selectedDateKey, fetchAndProcessData, matchesCache]);


  const handleDateChange = (dateKey: string) => {
      setSelectedDateKey(dateKey);
  };
  
  const handleTabChange = (value: string) => {
    const tabValue = value as TabName;
    setActiveTab(tabValue);
  };
  
  const hasAnyFavorites = (Object.keys(favorites.teams || {}).length > 0 || Object.keys(favorites.leagues || {}).length > 0);
  
  const cacheKey = activeTab === 'all-matches' ? 'live' : selectedDateKey || '';
  const currentFixtures = matchesCache.get(cacheKey) || [];
    
  return (
    <div className="flex h-full flex-col bg-background">
        <ScreenHeader 
            title="نبض الملاعب"
            canGoBack={false}
            onBack={() => {}} 
            actions={
               <div className="flex items-center gap-2">
                  <SearchSheet navigate={navigate}>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Search className="h-5 w-5" />
                      </Button>
                  </SearchSheet>
                  <ProfileButton />
              </div>
            }
        />
        
        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-1 flex-col min-h-0">
            <div className="sticky top-0 z-10 px-1 pt-1 bg-background">
                <div className="bg-card text-card-foreground rounded-b-lg border-x border-b shadow-md">
                    <TabsList className={cn("grid w-full bg-transparent p-0 h-11", `grid-cols-${tabs.length}`)}>
                        {tabs.map(tab => (
                            <TabsTrigger key={tab.id} value={tab.id} className="data-[state=active]:shadow-none">{tab.label}</TabsTrigger>
                        ))}
                    </TabsList>
                </div>
                 {activeTab === 'my-results' && (
                     <div className="relative bg-card py-2 border-x border-b rounded-b-lg shadow-md -mt-1">
                        <DateScroller selectedDateKey={selectedDateKey} onDateSelect={handleDateChange} />
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7"
                            onClick={() => handleDateChange(formatDateKey(new Date()))}
                            disabled={isToday(new Date(selectedDateKey))}
                         >
                            <CalendarClock className="h-4 w-4"/>
                         </Button>
                    </div>
                 )}
            </div>
            
            <div className="flex-1 overflow-y-auto p-1 space-y-4 mt-4">
                 <FixturesList 
                    fixtures={currentFixtures}
                    loading={loading}
                    activeTab={activeTab}
                    hasAnyFavorites={hasAnyFavorites}
                    navigate={navigate}
                    pinnedPredictionMatches={pinnedPredictionMatches}
                    onPinToggle={handlePinToggle}
                />
            </div>

        </Tabs>
    </div>
  );
}
