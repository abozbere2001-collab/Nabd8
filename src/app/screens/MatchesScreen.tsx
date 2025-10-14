

"use client";

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import type { ScreenProps } from '@/app/page';
import { format, addDays, isToday, isYesterday, isTomorrow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useAuth, useFirestore, useAdmin } from '@/firebase/provider';
import { doc, onSnapshot, collection, getDocs } from 'firebase/firestore';
import { Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { SearchSheet } from '@/components/SearchSheet';
import { ProfileButton } from '../AppContentWrapper';
import type { Fixture as FixtureType, Favorites, MatchDetails } from '@/lib/types';
import { GlobalPredictionsScreen } from './GlobalPredictionsScreen';
import { FixtureItem } from '@/components/FixtureItem';
import { isMatchLive } from '@/lib/matchStatus';

interface GroupedFixtures {
    [leagueName: string]: {
        league: FixtureType['league'];
        fixtures: FixtureType[];
    }
}


// Fixtures List Component
const FixturesList = ({ 
    fixtures, 
    loading,
    activeTab, 
    showLiveOnly,
    hasAnyFavorites,
    favoritedLeagueIds,
    favoritedTeamIds,
    navigate,
}: { 
    fixtures: FixtureType[], 
    loading: boolean,
    activeTab: string, 
    showLiveOnly: boolean,
    hasAnyFavorites: boolean,
    favoritedLeagueIds: number[],
    favoritedTeamIds: number[],
    navigate: ScreenProps['navigate'],
}) => {
    
    const filteredFixtures = useMemo(() => {
        let fixturesToFilter = fixtures;

        // "All Matches" tab is now "Live Matches"
        if (activeTab === 'all-matches') {
            return fixturesToFilter.filter(f => isMatchLive(f.fixture.status));
        }
        
        if (activeTab === 'my-results'){
             return fixturesToFilter.filter(f => 
                favoritedTeamIds.includes(f.teams.home.id) ||
                favoritedTeamIds.includes(f.teams.away.id) ||
                favoritedLeagueIds.includes(f.league.id)
            );
        }
        return [];
    }, [fixtures, activeTab, favoritedTeamIds, favoritedLeagueIds, showLiveOnly]);

    const groupedFixtures = useMemo(() => {
        return filteredFixtures.reduce((acc, fixture) => {
            const leagueName = fixture.league.name;
            if (!acc[leagueName]) {
                acc[leagueName] = { league: fixture.league, fixtures: [] };
            }
            acc[leagueName].fixtures.push(fixture);
            return acc;
        }, {} as GroupedFixtures);
    }, [filteredFixtures]);

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
                <p className="text-sm">أضف فرقا أو بطولات لترى مبارياتها هنا.</p>
            </div>
        );
    }
    
    const liveMatchesCount = fixtures.filter(f => isMatchLive(f.fixture.status)).length;

    if (activeTab === 'all-matches' && liveMatchesCount === 0) {
        return (
             <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-64 p-4">
                <p>لا توجد مباريات مباشرة حاليًا.</p>
            </div>
        )
    }

    if (fixtures.length > 0 && filteredFixtures.length === 0 && activeTab === 'my-results') {
       return (
            <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-64 p-4">
                <p className="font-bold text-lg">لا توجد مباريات لمفضلاتك هذا اليوم</p>
            </div>
        );
    }

    if (Object.keys(groupedFixtures).length === 0 && activeTab !== 'all-matches') {
        return (
            <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-64 p-4">
                <p>لا توجد مباريات لهذا اليوم.</p>
            </div>
        );
    }
    
    const sortedLeagues = Object.keys(groupedFixtures).sort((a,b) => {
        const leagueA = groupedFixtures[a];
        const leagueB = groupedFixtures[b];
        
        const aIsFavorite = leagueA.fixtures.some(f => favoritedTeamIds.includes(f.teams.home.id) || favoritedTeamIds.includes(f.teams.away.id)) || favoritedLeagueIds.includes(leagueA.league.id);
        const bIsFavorite = leagueB.fixtures.some(f => favoritedTeamIds.includes(f.teams.home.id) || favoritedTeamIds.includes(f.teams.away.id)) || favoritedLeagueIds.includes(leagueB.league.id);

        if (aIsFavorite && !bIsFavorite) return -1;
        if (!aIsFavorite && bIsFavorite) return 1;
        
        return a.localeCompare(b);
    });

    return (
        <div className="space-y-4">
            {sortedLeagues.map(leagueName => {
                const { league, fixtures } = groupedFixtures[leagueName];
                return (
                    <div key={league.id}>
                        <div 
                            className="font-bold text-foreground py-2 px-3 rounded-md bg-card border flex items-center gap-2 cursor-pointer"
                            onClick={() => navigate('CompetitionDetails', { leagueId: league.id, title: league.name, logo: league.logo })}
                        >
                            <Avatar className="h-5 w-5">
                                <AvatarImage src={league.logo} alt={league.name} />
                            </Avatar>
                            <span className="truncate">{leagueName}</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 pt-1">
                            {fixtures.map(f => <FixtureItem key={f.fixture.id} fixture={f} navigate={navigate} />)}
                        </div>
                    </div>
                )
            })}
        </div>
    );
};

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
        <div ref={scrollerRef} className="flex flex-row-reverse overflow-x-auto pb-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {dates.map(date => {
                const dateKey = formatDateKey(date);
                const isSelected = dateKey === selectedDateKey;
                return (
                     <button
                        key={dateKey}
                        ref={isSelected ? selectedButtonRef : null}
                        className={cn(
                            "relative flex flex-col items-center justify-center h-auto py-1 px-2.5 min-w-[48px] rounded-lg transition-colors ml-2",
                            "text-foreground/80 hover:text-primary",
                            isSelected && "text-primary"
                        )}
                        onClick={() => onDateSelect(dateKey)}
                        data-state={isSelected ? 'active' : 'inactive'}
                    >
                        <span className="text-xs font-normal">{getDayLabel(date)}</span>
                        <span className="font-bold text-sm">{format(date, 'd')}</span>
                        <span className={cn(
                            "absolute bottom-0 h-0.5 w-4 rounded-full bg-primary transition-transform scale-x-0",
                            isSelected && "scale-x-100"
                        )} />
                    </button>
                )
            })}
        </div>
    );
}

type TabName = 'all-matches' | 'my-results' | 'predictions';
type Cache<T> = { [date: string]: T };

// Main Screen Component
export function MatchesScreen({ navigate, goBack, canGoBack, isVisible }: ScreenProps & { isVisible: boolean }) {
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const { db } = useFirestore();
  const [favorites, setFavorites] = useState<Favorites>({userId: ''});
  const [activeTab, setActiveTab] = useState<TabName>('my-results');

  const [selectedDateKey, setSelectedDateKey] = useState(formatDateKey(new Date()));

  const [fixturesCache, setFixturesCache] = useState<Cache<FixtureType[]>>({});
  const [loadingFixtures, setLoadingFixtures] = useState(true);
  
  const [showLiveOnly, setShowLiveOnly] = useState(false);

  useEffect(() => {
    if (!user || !db) {
        setFavorites({userId: ''});
        return;
    }
    const docRef = doc(db, 'favorites', user.uid);
    const unsubscribe = onSnapshot(docRef, (doc) => {
        setFavorites(doc.data() as Favorites || {userId: user.uid});
    }, (error) => {
        const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'get',
        });
        errorEmitter.emit('permission-error', permissionError);
    });

    return () => unsubscribe();
  }, [user, db]);
  
  const fetchFixturesForDate = useCallback(async (dateKey: string) => {
    if (fixturesCache[dateKey]) {
      setLoadingFixtures(false);
      return;
    }
    setLoadingFixtures(true);
    const url = `/api/football/fixtures?date=${dateKey}`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch fixtures');
        const data = await response.json();
        const fixtures = data.response || [];
        setFixturesCache(prev => ({ ...prev, [dateKey]: fixtures }));
    } catch (error) {
        console.error(`Failed to fetch fixtures for ${dateKey}:`, error);
        setFixturesCache(prev => ({ ...prev, [dateKey]: [] }));
    } finally {
        setLoadingFixtures(false);
    }
  }, [fixturesCache]);

  
  useEffect(() => {
    fetchFixturesForDate(selectedDateKey);
  }, [selectedDateKey, fetchFixturesForDate]);


  const handleDateChange = (dateKey: string) => {
      setSelectedDateKey(dateKey);
  };
  
  const handleTabChange = (value: string) => {
    const tabValue = value as TabName;
    if (tabValue === 'all-matches') {
        setSelectedDateKey(formatDateKey(new Date()));
    }
    setActiveTab(tabValue);
  };


  const favoritedTeamIds = useMemo(() => favorites?.teams ? Object.keys(favorites.teams).map(Number) : [], [favorites.teams]);
  const favoritedLeagueIds = useMemo(() => favorites?.leagues ? Object.keys(favorites.leagues).map(Number) : [], [favorites.leagues]);
  const hasAnyFavorites = favoritedLeagueIds.length > 0 || favoritedTeamIds.length > 0;
    
  const currentFixtures = fixturesCache[selectedDateKey] || [];

  return (
    <div className="flex-1 flex flex-col min-h-0">
        <ScreenHeader 
            title="" 
            canGoBack={false}
            onBack={() => {}} 
            actions={
              <div className="flex items-center gap-2">
                  <SearchSheet navigate={navigate}>
                      <Button variant="ghost" size="icon">
                          <Search className="h-5 w-5" />
                      </Button>
                  </SearchSheet>
                  <ProfileButton />
              </div>
            }
        />
        <div className="flex flex-col border-b bg-background">
             <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
               <TabsList className="grid w-full grid-cols-3 h-auto p-0 rounded-none bg-transparent">
                   <TabsTrigger value="predictions" className='text-xs sm:text-sm'>التوقعات</TabsTrigger>
                   <TabsTrigger value="all-matches" className='text-xs sm:text-sm'>مباشر</TabsTrigger>
                   <TabsTrigger value="my-results" className='text-xs sm:text-sm'>نتائجي</TabsTrigger>
               </TabsList>
                <TabsContent value="my-results" className="mt-0">
                     <div className="py-2 px-4">
                        <DateScroller selectedDateKey={selectedDateKey} onDateSelect={handleDateChange} />
                    </div>
                </TabsContent>
                <TabsContent value="all-matches" className="mt-0">
                     {/* The "all-matches" tab is now for live matches and doesn't need a date scroller */}
                </TabsContent>
                <TabsContent value="predictions" className="mt-0">
                    {/* Date scroller for predictions is handled inside the component */}
                </TabsContent>
             </Tabs>

        </div>
        <div className="flex-1 overflow-y-auto p-1 space-y-4">
            {activeTab === 'predictions' ? (
                <GlobalPredictionsScreen navigate={navigate} goBack={goBack} canGoBack={canGoBack} />
            ) : (
                <FixturesList 
                    fixtures={currentFixtures}
                    loading={loadingFixtures}
                    activeTab={activeTab}
                    showLiveOnly={showLiveOnly} 
                    favoritedLeagueIds={favoritedLeagueIds}
                    favoritedTeamIds={favoritedTeamIds}
                    hasAnyFavorites={hasAnyFavorites}
                    navigate={navigate}
                />
            )}
        </div>
    </div>
  );
}
