

"use client";

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import type { ScreenProps } from '@/app/page';
import { format, addDays, isToday, isYesterday, isTomorrow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useAuth, useFirestore, useAdmin } from '@/firebase/provider';
import { doc, onSnapshot, collection, getDocs } from 'firebase/firestore';
import { Loader2, Search, Star } from 'lucide-react';
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
    hasAnyFavorites,
    favoritedLeagueIds,
    favoritedTeamIds,
    commentedMatches,
    navigate,
}: { 
    fixtures: FixtureType[], 
    loading: boolean,
    activeTab: string, 
    hasAnyFavorites: boolean,
    favoritedLeagueIds: number[],
    favoritedTeamIds: number[],
    commentedMatches: { [key: number]: MatchDetails },
    navigate: ScreenProps['navigate'],
}) => {
    
    const { favoriteTeamMatches, otherFixtures } = useMemo(() => {
        if (activeTab !== 'my-results') {
            return { favoriteTeamMatches: [], otherFixtures: fixtures };
        }
        
        const favoriteTeamMatches: FixtureType[] = [];
        const otherFixtures: FixtureType[] = [];

        fixtures.forEach(f => {
            if (favoritedTeamIds.includes(f.teams.home.id) || favoritedTeamIds.includes(f.teams.away.id)) {
                favoriteTeamMatches.push(f);
            } else if (favoritedLeagueIds.includes(f.league.id)) {
                 otherFixtures.push(f);
            }
        });

        return { favoriteTeamMatches, otherFixtures };

    }, [fixtures, activeTab, favoritedTeamIds, favoritedLeagueIds]);


    const groupedOtherFixtures = useMemo(() => {
        const fixturesToGroup = activeTab === 'my-results' ? otherFixtures : fixtures;
        return fixturesToGroup.reduce((acc, fixture) => {
            const leagueName = fixture.league.name;
            if (!acc[leagueName]) {
                acc[leagueName] = { league: fixture.league, fixtures: [] };
            }
            acc[leagueName].fixtures.push(fixture);
            return acc;
        }, {} as GroupedFixtures);
    }, [activeTab, otherFixtures, fixtures]);


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
    
    const noMatches = activeTab === 'my-results' 
        ? favoriteTeamMatches.length === 0 && Object.keys(groupedOtherFixtures).length === 0
        : fixtures.length === 0;

    if (noMatches) {
        const message = activeTab === 'live' 
            ? "لا توجد مباريات مباشرة حاليًا." 
            : activeTab === 'my-results'
            ? "لا توجد مباريات لمفضلاتك هذا اليوم"
            : "لا توجد مباريات لهذا اليوم.";
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
                    <div className="font-bold text-foreground py-2 px-3 rounded-md bg-card border flex items-center gap-2">
                        <Star className="h-5 w-5 text-yellow-400" />
                        <span className="truncate">مباريات فرقك المفضلة</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 pt-1">
                        {favoriteTeamMatches.map(f => (
                            <FixtureItem 
                                key={f.fixture.id} 
                                fixture={f} 
                                navigate={navigate}
                                commentsEnabled={commentedMatches[f.fixture.id]?.commentsEnabled} 
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
                            className="font-bold text-foreground py-2 px-3 rounded-md bg-card border flex items-center gap-2 cursor-pointer"
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
                                    commentsEnabled={commentedMatches[f.fixture.id]?.commentsEnabled} 
                                />
                            ))}
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
                        <span className={cn(
                            "absolute bottom-0 h-0.5 w-3 rounded-full bg-primary transition-transform scale-x-0",
                            isSelected && "scale-x-100"
                        )} />
                    </button>
                )
            })}
        </div>
    );
}

type TabName = 'my-results' | 'live' | 'predictions';
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
  
  const [liveFixtures, setLiveFixtures] = useState<FixtureType[]>([]);
  const [loadingLive, setLoadingLive] = useState(false);
  
  const [commentedMatches, setCommentedMatches] = useState<{ [key: number]: MatchDetails }>({});


  useEffect(() => {
    if (!user || !db) {
        setFavorites({userId: ''});
        return;
    }
    const docRef = doc(db, 'users', user.uid, 'favorites', 'data');
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

  useEffect(() => {
    if (!db) return;
    const matchesCollectionRef = collection(db, 'matches');
    const unsubscribe = onSnapshot(matchesCollectionRef, (snapshot) => {
        const matches: { [key: number]: MatchDetails } = {};
        snapshot.forEach(doc => {
            matches[Number(doc.id)] = doc.data() as MatchDetails;
        });
        setCommentedMatches(matches);
    }, (error) => {
        const permissionError = new FirestorePermissionError({ path: 'matches', operation: 'list' });
        errorEmitter.emit('permission-error', permissionError);
    });
    return () => unsubscribe();
  }, [db]);
  
  const fetchFixturesForDate = useCallback(async (dateKey: string) => {
    if (fixturesCache[dateKey]) {
      setLoadingFixtures(false);
      return;
    }
    setLoadingFixtures(true);
    const url = `/api/football/fixtures?date=${dateKey}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
          const errorBody = await response.text();
          console.error("API Error Body:", errorBody);
          throw new Error('Failed to fetch fixtures');
        }
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

  const fetchLiveFixtures = useCallback(async () => {
    setLoadingLive(true);
    const url = `/api/football/fixtures?live=all`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Failed to fetch live fixtures');
        }
        const data = await response.json();
        setLiveFixtures(data.response || []);
    } catch (error) {
        console.error(`Failed to fetch live fixtures:`, error);
        setLiveFixtures([]);
    } finally {
        setLoadingLive(false);
    }
  }, []);

  
  useEffect(() => {
    if(activeTab === 'my-results') {
        fetchFixturesForDate(selectedDateKey);
    }
  }, [selectedDateKey, fetchFixturesForDate, activeTab]);

  useEffect(() => {
    if (activeTab === 'live') {
        fetchLiveFixtures(); // Fetch immediately
        const interval = setInterval(fetchLiveFixtures, 60000); // And every minute
        return () => clearInterval(interval);
    }
  }, [activeTab, fetchLiveFixtures]);


  const handleDateChange = (dateKey: string) => {
      setSelectedDateKey(dateKey);
  };
  
  const handleTabChange = (value: string) => {
    const tabValue = value as TabName;
    setActiveTab(tabValue);
  };


  const favoritedTeamIds = useMemo(() => favorites?.teams ? Object.keys(favorites.teams).map(Number) : [], [favorites.teams]);
  const favoritedLeagueIds = useMemo(() => favorites?.leagues ? Object.keys(favorites.leagues).map(Number) : [], [favorites.leagues]);
  const hasAnyFavorites = favoritedLeagueIds.length > 0 || favoritedTeamIds.length > 0;
    
  const currentFixtures = activeTab === 'live' ? liveFixtures : (fixturesCache[selectedDateKey] || []);
  const isLoading = activeTab === 'live' ? loadingLive : loadingFixtures;

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
        <div className="flex flex-col border-b bg-card">
             <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
               <TabsList className="grid w-full grid-cols-3 h-auto p-0 rounded-none bg-transparent">
                   <TabsTrigger value="predictions" className='text-xs sm:text-sm'>التوقعات</TabsTrigger>
                   <TabsTrigger value="live" className='text-xs sm:text-sm'>مباشر</TabsTrigger>
                   <TabsTrigger value="my-results" className='text-xs sm:text-sm'>نتائجي</TabsTrigger>
               </TabsList>
                <TabsContent value="my-results" className="mt-0">
                     <div className="py-2 px-2">
                        <DateScroller selectedDateKey={selectedDateKey} onDateSelect={handleDateChange} />
                    </div>
                </TabsContent>
                 <TabsContent value="live" className="mt-0 h-[53px] flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">يتم التحديث كل دقيقة</p>
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
                    loading={isLoading}
                    activeTab={activeTab}
                    favoritedLeagueIds={favoritedLeagueIds}
                    favoritedTeamIds={favoritedTeamIds}
                    hasAnyFavorites={hasAnyFavorites}
                    commentedMatches={commentedMatches}
                    navigate={navigate}
                />
            )}
        </div>
    </div>
  );
}

    
