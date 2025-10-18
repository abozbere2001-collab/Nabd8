

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
import { Button } from '@/components/ui/button';
import { SearchSheet } from '@/components/SearchSheet';
import { ProfileButton } from '../AppContentWrapper';
import type { Fixture as FixtureType, Favorites, MatchDetails, MatchCustomization } from '@/lib/types';
import { GlobalPredictionsScreen } from './GlobalPredictionsScreen';
import { FixtureItem } from '@/components/FixtureItem';
import { isMatchLive } from '@/lib/matchStatus';
import { hardcodedTranslations } from '@/lib/hardcoded-translations';

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
    customStatuses,
    navigate,
}: { 
    fixtures: FixtureType[], 
    loading: boolean,
    activeTab: string, 
    hasAnyFavorites: boolean,
    favoritedLeagueIds: number[],
    favoritedTeamIds: number[],
    commentedMatches: { [key: number]: MatchDetails },
    customStatuses: { [key: number]: MatchCustomization },
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
                <p className="text-sm">أضف فرقًا أو بطولات لترى مبارياتها هنا.</p>
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
            ? "لا توجد مباريات لمفضلاتك هذا اليوم."
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
                    <div className="font-semibold text-foreground py-1 px-3 rounded-md bg-card border flex items-center gap-2 text-xs h-8">
                        <Star className="h-4 w-4 text-yellow-400" />
                        <span className="truncate">مباريات فرقك المفضلة</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 pt-1">
                        {favoriteTeamMatches.map(f => (
                            <FixtureItem 
                                key={f.fixture.id} 
                                fixture={f} 
                                navigate={navigate}
                                commentsEnabled={commentedMatches[f.fixture.id]?.commentsEnabled}
                                customStatus={customStatuses[f.fixture.id]?.customStatus}
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
                                    commentsEnabled={commentedMatches[f.fixture.id]?.commentsEnabled} 
                                    customStatus={customStatuses[f.fixture.id]?.customStatus}
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
                        {isSelected && (
                          <span className="absolute bottom-0 h-0.5 w-3 rounded-full bg-primary transition-transform" />
                        )}
                    </button>
                )
            })}
        </div>
    );
}

type TabName = 'my-results' | 'live' | 'predictions';

// Main Screen Component
export function MatchesScreen({ navigate, goBack, canGoBack, isVisible }: ScreenProps & { isVisible: boolean }) {
  const { user } = useAuth();
  const { db } = useFirestore();
  const [favorites, setFavorites] = useState<Favorites>({userId: ''});
  const [activeTab, setActiveTab] = useState<TabName>('my-results');

  const [selectedDateKey, setSelectedDateKey] = useState(formatDateKey(new Date()));
  
  const [fixtures, setFixtures] = useState<FixtureType[]>([]);
  const [loading, setLoading] = useState(true);
    
  const [commentedMatches, setCommentedMatches] = useState<{ [key: number]: MatchDetails }>({});
  const [customStatuses, setCustomStatuses] = useState<{ [key: number]: MatchCustomization }>({});

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

     const customStatusCollectionRef = collection(db, 'matchCustomizations');
     const unsubscribeCustomStatus = onSnapshot(customStatusCollectionRef, (snapshot) => {
        const statuses: { [key: number]: MatchCustomization } = {};
        snapshot.forEach(doc => {
            statuses[Number(doc.id)] = doc.data() as MatchCustomization;
        });
        setCustomStatuses(statuses);
     }, (error) => {
        const permissionError = new FirestorePermissionError({ path: 'matchCustomizations', operation: 'list' });
        errorEmitter.emit('permission-error', permissionError);
     });


    return () => {
        unsubscribe();
        unsubscribeCustomStatus();
    }
  }, [db]);
  
  const fetchAndProcessData = useCallback(async (dateKey: string, isLive: boolean) => {
      if (!db) {
          setLoading(false);
          return;
      };
      setLoading(true);

      try {
        const [leaguesSnapshot, teamsSnapshot] = await Promise.all([
            getDocs(collection(db, 'leagueCustomizations')),
            getDocs(collection(db, 'teamCustomizations'))
        ]);
        const leagueNames = new Map<number, string>();
        leaguesSnapshot.forEach(doc => leagueNames.set(Number(doc.id), doc.data().customName));
        const teamNames = new Map<number, string>();
        teamsSnapshot.forEach(doc => teamNames.set(Number(doc.id), doc.data().customName));

        const getDisplayName = (type: 'team' | 'league', id: number, defaultName: string) => {
            const firestoreMap = type === 'team' ? teamNames : leagueNames;
            const customName = firestoreMap.get(id);
            if (customName) return customName;

            const hardcodedMap = type === 'team' ? hardcodedTranslations.teams : hardcodedTranslations.leagues;
            const hardcodedName = hardcodedMap[id as any];
            if(hardcodedName) return hardcodedName;

            return defaultName;
        };

        const url = isLive ? `/api/football/fixtures?live=all` : `/api/football/fixtures?date=${dateKey}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch fixtures`);
        const data = await response.json();
        const rawFixtures: FixtureType[] = data.response || [];

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
        setFixtures(processedFixtures);

      } catch (error) {
          console.error("Failed to fetch and process data:", error);
          setFixtures([]);
      } finally {
          setLoading(false);
      }
  }, [db]);

  
  useEffect(() => {
    if (activeTab === 'my-results') {
        fetchAndProcessData(selectedDateKey, false);
    }
  }, [selectedDateKey, activeTab, fetchAndProcessData]);

  useEffect(() => {
    if (activeTab === 'live' && isVisible) {
        fetchAndProcessData(selectedDateKey, true); // force live
        const interval = setInterval(() => fetchAndProcessData(selectedDateKey, true), 60000);
        return () => clearInterval(interval);
    }
  }, [activeTab, isVisible, selectedDateKey, fetchAndProcessData]);


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
    
  return (
    <div className="flex h-full flex-col bg-background">
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
        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-1 flex-col min-h-0">
            <div className="flex flex-col border-b bg-card">
                 <TabsList>
                     <TabsTrigger value="predictions">التوقعات</TabsTrigger>
                     <TabsTrigger value="live">مباشر</TabsTrigger>
                     <TabsTrigger value="my-results">نتائجي</TabsTrigger>
                 </TabsList>
                 {activeTab === 'my-results' && (
                     <div className="py-2 px-2">
                        <DateScroller selectedDateKey={selectedDateKey} onDateSelect={handleDateChange} />
                    </div>
                 )}
                  {activeTab === 'live' && (
                    <div className="h-[53px] flex items-center justify-center">
                        <p className="text-sm text-muted-foreground">يتم التحديث كل دقيقة</p>
                    </div>
                 )}
            </div>

            <TabsContent value="my-results" className="flex-1 overflow-y-auto p-1 space-y-4 mt-0">
                <FixturesList 
                    fixtures={fixtures}
                    loading={loading}
                    activeTab={activeTab}
                    favoritedLeagueIds={favoritedLeagueIds}
                    favoritedTeamIds={favoritedTeamIds}
                    hasAnyFavorites={hasAnyFavorites}
                    commentedMatches={commentedMatches}
                    customStatuses={customStatuses}
                    navigate={navigate}
                />
            </TabsContent>
            <TabsContent value="live" className="flex-1 overflow-y-auto p-1 space-y-4 mt-0">
                 <FixturesList 
                    fixtures={fixtures}
                    loading={loading}
                    activeTab={activeTab}
                    favoritedLeagueIds={favoritedLeagueIds}
                    favoritedTeamIds={favoritedTeamIds}
                    hasAnyFavorites={hasAnyFavorites}
                    commentedMatches={commentedMatches}
                    customStatuses={customStatuses}
                    navigate={navigate}
                />
            </TabsContent>
            <TabsContent value="predictions" className="flex-1 overflow-y-auto p-0 mt-0">
                <GlobalPredictionsScreen navigate={navigate} goBack={goBack} canGoBack={canGoBack} />
            </TabsContent>
        </Tabs>
    </div>
  );
}

    

    

    

    
