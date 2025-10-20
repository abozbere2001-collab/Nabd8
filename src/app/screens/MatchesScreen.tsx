
"use client";

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import type { ScreenProps } from '@/app/page';
import { format, addDays, isToday, isYesterday, isTomorrow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useAuth, useFirestore } from '@/firebase/provider';
import { doc, onSnapshot, collection, getDocs } from 'firebase/firestore';
import { Loader2, Search, Star, CalendarClock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { SearchSheet } from '@/components/SearchSheet';
import { ProfileButton } from '../AppContentWrapper';
import type { Fixture as FixtureType, Favorites } from '@/lib/types';
import { FixtureItem } from '@/components/FixtureItem';
import { hardcodedTranslations } from '@/lib/hardcoded-translations';
import { getLocalFavorites } from '@/lib/local-favorites';
import { POPULAR_LEAGUES } from '@/lib/popular-data';

interface GroupedFixtures {
    [leagueName: string]: {
        league: FixtureType['league'];
        fixtures: FixtureType[];
    }
}

const popularLeagueIds = new Set(POPULAR_LEAGUES.slice(0, 15).map(l => l.id));


// Fixtures List Component
const FixturesList = React.memo(({ 
    fixtures, 
    loading,
    activeTab, 
    hasAnyFavorites,
    favoritedLeagueIds,
    favoritedTeamIds,
    navigate,
}: { 
    fixtures: FixtureType[], 
    loading: boolean,
    activeTab: string, 
    hasAnyFavorites: boolean,
    favoritedLeagueIds: number[],
    favoritedTeamIds: number[],
    navigate: ScreenProps['navigate'],
}) => {
    
    const { favoriteTeamMatches, otherFixtures } = useMemo(() => {
        let favoriteTeamMatches: FixtureType[] = [];
        let otherFixtures: FixtureType[] = [];

        if (activeTab === 'my-results') {
             fixtures.forEach(f => {
                if (favoritedTeamIds.includes(f.teams.home.id) || favoritedTeamIds.includes(f.teams.away.id)) {
                    favoriteTeamMatches.push(f);
                } else if (favoritedLeagueIds.includes(f.league.id)) {
                    otherFixtures.push(f);
                }
            });
        } else {
            // For 'all-matches' tab
            otherFixtures = fixtures;
        }

        return { favoriteTeamMatches, otherFixtures };

    }, [fixtures, activeTab, favoritedTeamIds, favoritedLeagueIds]);


    const groupedOtherFixtures = useMemo(() => {
        return otherFixtures.reduce((acc, fixture) => {
            const leagueName = fixture.league.name;
            if (!acc[leagueName]) {
                acc[leagueName] = { league: fixture.league, fixtures: [] };
            }
            acc[leagueName].fixtures.push(fixture);
            return acc;
        }, {} as GroupedFixtures);
    }, [otherFixtures]);


    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }
    
    if (activeTab === 'my-results' && !hasAnyFavorites) {
        return (
            <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-64 p-4">
                <p className="font-bold text-lg">لم تقم بإضافة أي مفضلات</p>
                <p className="text-sm">أضف فرقًا أو بطولات لترى مبارياتها هنا.</p>
                 <Button className="mt-4" onClick={() => navigate('AllCompetitions')}>استكشف البطولات</Button>
            </div>
        );
    }
    
    const noMatches = fixtures.length === 0;

    if (noMatches) {
        const message = activeTab === 'my-results'
            ? "لا توجد مباريات لمفضلاتك هذا اليوم."
            : "لا توجد مباريات مباشرة حاليًا.";
        return (
            <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-64 p-4">
                <p>{message}</p>
            </div>
        );
    }
    
    const sortedLeagues = Object.keys(groupedOtherFixtures).sort((a,b) => a.localeCompare(b));

    return (
        <div className="space-y-4">
            {activeTab === 'my-results' && favoriteTeamMatches.length > 0 && (
                 <div>
                    <div className="font-semibold text-foreground py-1 px-3 rounded-md bg-card border flex items-center gap-2 text-xs h-6">
                        <Star className="h-4 w-4 text-yellow-400" />
                        <span className="truncate">مباريات فرقك المفضلة</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 pt-1">
                        {favoriteTeamMatches.map(f => (
                            <FixtureItem 
                                key={f.fixture.id} 
                                fixture={f} 
                                navigate={navigate}
                            />
                        ))}
                    </div>
                </div>
            )}

            {sortedLeagues.map(leagueName => {
                const { league, fixtures: leagueFixtures } = groupedOtherFixtures[leagueName];
                return (
                    <div key={`${league.id}-${league.name}`}>
                        <div 
                            className="font-bold text-foreground py-2 px-3 rounded-md bg-card border flex items-center gap-2 cursor-pointer h-10"
                            onClick={() => navigate('CompetitionDetails', { leagueId: league.id, title: league.name, logo: league.logo })}
                        >
                            <Avatar className="h-5 w-5">
                                <AvatarImage src={league.logo} alt={league.name} />
                            </Avatar>
                            <span className="truncate">{leagueName}</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 pt-1">
                            {leagueFixtures.map(f => (
                                <FixtureItem 
                                    key={f.fixture.id} 
                                    fixture={f} 
                                    navigate={navigate}
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

// Main Screen Component
export function MatchesScreen({ navigate, goBack, canGoBack, isVisible }: ScreenProps & { isVisible: boolean }) {
  const { user } = useAuth();
  const { db } = useFirestore();
  const [favorites, setFavorites] = useState<Partial<Favorites>>({});
  const [activeTab, setActiveTab] = useState<TabName>('my-results');
  
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  
  useEffect(() => {
    if (!selectedDateKey && typeof window !== 'undefined') {
      setSelectedDateKey(formatDateKey(new Date()));
    }
  }, [selectedDateKey]);

  const [matchesCache, setMatchesCache] = useState<Map<string, FixtureType[]>>(new Map());
  const [loading, setLoading] = useState(true);
    
  const [customNamesCache, setCustomNamesCache] = useState<{leagues: Map<number, string>, teams: Map<number, string>} | null>(null);

  const fetchAndProcessData = useCallback(async (dateKey: string, abortSignal: AbortSignal) => {
    setLoading(true);
      
    try {
        let localCustomNames = customNamesCache;
        if (!localCustomNames && db) {
            try {
                const [leaguesSnapshot, teamsSnapshot] = await Promise.all([
                    getDocs(collection(db, 'leagueCustomizations')),
                    getDocs(collection(db, 'teamCustomizations'))
                ]);
                
                if (abortSignal.aborted) return;
                
                const leagueNames = new Map<number, string>();
                leaguesSnapshot.forEach(doc => leagueNames.set(Number(doc.id), doc.data().customName));
                const teamNames = new Map<number, string>();
                teamsSnapshot.forEach(doc => teamNames.set(Number(doc.id), doc.data().customName));
                localCustomNames = { leagues: leagueNames, teams: teamNames };
                setCustomNamesCache(localCustomNames);
            } catch (e) {
                console.warn("Could not fetch custom names, proceeding without them.");
                localCustomNames = { leagues: new Map(), teams: new Map() };
                setCustomNamesCache(localCustomNames);
            }
        }


        const getDisplayName = (type: 'team' | 'league', id: number, defaultName: string) => {
            const firestoreMap = type === 'team' ? localCustomNames?.teams : localCustomNames?.leagues;
            const customName = firestoreMap?.get(id);
            if (customName) return customName;

            const hardcodedMap = type === 'team' ? hardcodedTranslations.teams : hardcodedTranslations.leagues;
            const hardcodedName = hardcodedMap[id as any];
            if(hardcodedName) return hardcodedName;

            return defaultName;
        };

        const url = activeTab === 'all-matches' ? '/api/football/fixtures?live=all' : `/api/football/fixtures?date=${dateKey}`;
        const response = await fetch(url, { signal: abortSignal });
        if (!response.ok) throw new Error(`Failed to fetch fixtures`);
        
        const data = await response.json();
        if (abortSignal.aborted) return;

        let rawFixtures: FixtureType[] = data.response || [];

        const currentFavorites = user ? favorites : getLocalFavorites();
        const hasFavs = (currentFavorites?.teams && Object.keys(currentFavorites.teams).length > 0) || (currentFavorites?.leagues && Object.keys(currentFavorites.leagues).length > 0);
        
        if (activeTab === 'my-results' && !hasFavs) {
            rawFixtures = rawFixtures.filter(f => popularLeagueIds.has(f.league.id));
        }

        const processedFixtures = rawFixtures.map(fixture => ({
            ...fixture,
            league: {
                ...fixture.league,
                name: getDisplayName('league', fixture.league.id, fixture.league.name)
            },
            teams: {
                home: {
                    ...fixture.teams.home,
                    name: getDisplayName('team', fixture.teams.home.id, fixture.teams.home.name)
                },
                away: {
                    ...fixture.teams.away,
                    name: getDisplayName('team', fixture.teams.away.id, fixture.teams.away.name)
                }
            }
        }));
        
        setMatchesCache(prev => new Map(prev).set(dateKey, processedFixtures));

      } catch (error) {
          if ((error as Error).name !== 'AbortError') {
            console.error("Failed to fetch and process data:", error);
            setMatchesCache(prev => new Map(prev).set(dateKey, []));
          }
      } finally {
          if (!abortSignal.aborted) {
            setLoading(false);
          }
      }
  }, [db, activeTab, user, favorites, customNamesCache]);


  useEffect(() => {
    if (user && db) {
        const docRef = doc(db, 'users', user.uid, 'favorites', 'data');
        const unsubscribe = onSnapshot(docRef, (doc) => {
            setFavorites(doc.data() as Favorites || { userId: user.uid });
        }, (error) => {
            const permissionError = new FirestorePermissionError({ path: docRef.path, operation: 'get' });
            errorEmitter.emit('permission-error', permissionError);
        });
        return () => unsubscribe();
    } else {
        setFavorites({});
    }
  }, [user, db]);
  
  
  useEffect(() => {
      if (isVisible && selectedDateKey) {
          const cacheKey = activeTab === 'all-matches' ? 'live' : selectedDateKey;
          if (matchesCache.has(cacheKey)) {
              setLoading(false);
              return;
          }
          const controller = new AbortController();
          fetchAndProcessData(cacheKey, controller.signal);
          return () => controller.abort();
      }
  }, [selectedDateKey, activeTab, isVisible, fetchAndProcessData, matchesCache]);


  const handleDateChange = (dateKey: string) => {
      setSelectedDateKey(dateKey);
  };
  
  const handleTabChange = (value: string) => {
    const tabValue = value as TabName;
    setActiveTab(tabValue);
    const cacheKey = tabValue === 'all-matches' ? 'live' : selectedDateKey;

    if (cacheKey && !matchesCache.has(cacheKey)) {
        const controller = new AbortController();
        fetchAndProcessData(cacheKey, controller.signal);
        return () => controller.abort();
    }
  };

  const currentFavorites = user ? favorites : getLocalFavorites();
  const favoritedTeamIds = useMemo(() => currentFavorites?.teams ? Object.keys(currentFavorites.teams).map(Number) : [], [currentFavorites.teams]);
  const favoritedLeagueIds = useMemo(() => currentFavorites?.leagues ? Object.keys(currentFavorites.leagues).map(Number) : [], [currentFavorites.leagues]);
  const hasAnyFavorites = favoritedLeagueIds.length > 0 || favoritedTeamIds.length > 0;
  
  const cacheKey = activeTab === 'all-matches' ? 'live' : selectedDateKey || '';
  const currentFixtures = matchesCache.get(cacheKey) || [];
    
  return (
    <div className="flex h-full flex-col bg-background">
        <ScreenHeader 
            title="" 
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
                 {selectedDateKey && activeTab === 'my-results' && (
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
            
            <TabsContent value="my-results" className="flex-1 overflow-y-auto p-1 space-y-4 mt-0" hidden={activeTab !== 'my-results'}>
                <FixturesList 
                    fixtures={currentFixtures}
                    loading={loading}
                    activeTab={activeTab}
                    favoritedLeagueIds={favoritedLeagueIds}
                    favoritedTeamIds={favoritedTeamIds}
                    hasAnyFavorites={hasAnyFavorites}
                    navigate={navigate}
                />
            </TabsContent>
            
            <TabsContent value="all-matches" className="flex-1 overflow-y-auto p-1 space-y-4 mt-0" hidden={activeTab !== 'all-matches'}>
                 <FixturesList 
                    fixtures={currentFixtures}
                    loading={loading}
                    activeTab={activeTab}
                    favoritedLeagueIds={favoritedLeagueIds}
                    favoritedTeamIds={favoritedTeamIds}
                    hasAnyFavorites={hasAnyFavorites}
                    navigate={navigate}
                />
            </TabsContent>

        </Tabs>
    </div>
  );
}

