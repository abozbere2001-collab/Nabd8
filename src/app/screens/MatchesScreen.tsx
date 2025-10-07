
"use client";

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import type { ScreenProps } from '@/app/page';
import { format, addDays, isToday, isYesterday, isTomorrow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useAuth, useFirestore } from '@/firebase/provider';
import { doc, onSnapshot, collection, getDocs } from 'firebase/firestore';
import { Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { SearchSheet } from '@/components/SearchSheet';
import { CommentsButton } from '@/components/CommentsButton';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';


// Interfaces
interface Fixture {
  fixture: {
    id: number;
    date: string;
    timestamp: number;
    status: {
      long: string;
      short: string;
      elapsed: number | null;
    };
  };
  league: {
    id: number;
    name: string;
    logo: string;
    round: string;
  };
  teams: {
    home: { id: number; name: string; logo: string; winner: boolean | null };
    away: { id: number; name: string; logo: string; winner: boolean | null };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
}

interface Odds {
    fixture: { id: number };
    bookmakers: {
        id: number;
        name: string;
        bets: {
            id: number;
            name: string;
            values: { value: string; odd: string }[];
        }[];
    }[];
}

interface Favorites {
    userId: string;
    leagues?: { [key: string]: any };
    teams?: { [key:string]: any };
}

interface GroupedFixtures {
    [leagueName: string]: {
        league: Fixture['league'];
        fixtures: Fixture[];
    }
}

interface MatchDetails {
    commentsEnabled: boolean;
}


// Helper functions
const formatDateKey = (date: Date): string => format(date, 'yyyy-MM-dd');

const getDayLabel = (date: Date) => {
    if (isToday(date)) return "اليوم";
    if (isYesterday(date)) return "الأمس";
    if (isTomorrow(date)) return "غداً";
    return format(date, "EEE", { locale: ar });
};

// Live Timer Component
const LiveTimer = ({ startTime, status, elapsed }: { startTime: number, status: string, elapsed: number | null }) => {
    const [elapsedTime, setElapsedTime] = useState<string>('');

    useEffect(() => {
        if (!['1H', '2H', 'HT', 'ET', 'P', 'BT'].includes(status)) {
            setElapsedTime(status);
            return;
        }

        if (status === 'HT') {
            setElapsedTime('نصف الوقت');
            return;
        }
        
        if (elapsed) {
            setElapsedTime(`${elapsed}'`);
        }

        const interval = setInterval(() => {
            if (elapsed) {
              setElapsedTime(`${elapsed}'`);
            }
        }, 1000 * 60); // Update every minute

        return () => clearInterval(interval);
    }, [startTime, status, elapsed]);

    if (!elapsedTime) return null;

    return (
        <span className="text-red-600 font-bold text-xs animate-pulse">
            {elapsedTime}
        </span>
    );
};

// Fixture Item Component
const FixtureItem = React.memo(({ fixture, navigate, odds, commentsEnabled }: { fixture: Fixture, navigate: ScreenProps['navigate'], odds?: Odds['bookmakers'][0]['bets'][0]['values'], commentsEnabled?: boolean }) => {
    
    const homeOdd = odds?.find(o => o.value === 'Home')?.odd;
    const drawOdd = odds?.find(o => o.value === 'Draw')?.odd;
    const awayOdd = odds?.find(o => o.value === 'Away')?.odd;

    return (
      <div 
        key={fixture.fixture.id} 
        className="rounded-lg bg-card border p-3 text-sm transition-all duration-300"
      >
        <div 
          className="hover:bg-accent/50 cursor-pointer -m-3 p-3"
          onClick={() => navigate('MatchDetails', { fixtureId: fixture.fixture.id, fixture })}
        >
         <div className="flex justify-between items-center text-xs text-muted-foreground mb-2">
              <div className="flex items-center gap-2">
                  <Avatar className="h-4 w-4">
                      <AvatarImage src={fixture.league.logo} alt={fixture.league.name} />
                      <AvatarFallback>{fixture.league.name.substring(0,1)}</AvatarFallback>
                  </Avatar>
                  <span className="truncate">{fixture.league.name}</span>
              </div>
              <LiveTimer 
                startTime={fixture.fixture.timestamp} 
                status={fixture.fixture.status.short}
                elapsed={fixture.fixture.status.elapsed}
              />
         </div>
         <div className="flex items-center justify-between gap-2">
             <div className="flex items-center gap-2 flex-1 justify-end truncate">
                 <span className="font-semibold truncate">{fixture.teams.home.name}</span>
                 <Avatar className="h-8 w-8">
                     <AvatarImage src={fixture.teams.home.logo} alt={fixture.teams.home.name} />
                     <AvatarFallback>{fixture.teams.home.name.substring(0, 2)}</AvatarFallback>
                 </Avatar>
             </div>
             <div className={cn(
                "font-bold text-lg px-2 rounded-md min-w-[80px] text-center",
                 ['NS', 'TBD', 'PST', 'CANC'].includes(fixture.fixture.status.short) ? "bg-muted" : "bg-card"
                )}>
                 {['FT', 'AET', 'PEN', 'LIVE', 'HT', '1H', '2H'].includes(fixture.fixture.status.short) || (fixture.goals.home !== null)
                   ? `${fixture.goals.home ?? 0} - ${fixture.goals.away ?? 0}`
                   : format(new Date(fixture.fixture.date), "HH:mm")}
             </div>
             <div className="flex items-center gap-2 flex-1 truncate">
                  <Avatar className="h-8 w-8">
                     <AvatarImage src={fixture.teams.away.logo} alt={fixture.teams.away.name} />
                     <AvatarFallback>{fixture.teams.away.name.substring(0, 2)}</AvatarFallback>
                  </Avatar>
                 <span className="font-semibold truncate">{fixture.teams.away.name}</span>
             </div>
         </div>
         </div>
         {odds && (
            <div className="mt-2 pt-2 border-t border-border/50 text-xs text-muted-foreground text-center grid grid-cols-3 gap-2">
                <div>
                    <p className="font-semibold text-foreground">{homeOdd}</p>
                    <p>فوز المضيف</p>
                </div>
                <div>
                    <p className="font-semibold text-foreground">{drawOdd}</p>
                    <p>تعادل</p>
                </div>
                <div>
                    <p className="font-semibold text-foreground">{awayOdd}</p>
                    <p>فوز الضيف</p>
                </div>
            </div>
         )}
         <div className="mt-2 pt-2 border-t border-border/50">
            <CommentsButton matchId={fixture.fixture.id} navigate={navigate} commentsEnabled={commentsEnabled} />
         </div>
      </div>
    );
});
FixtureItem.displayName = 'FixtureItem';


// Fixtures List Component
const FixturesList = ({ 
    fixtures, 
    loading,
    activeTab, 
    showLiveOnly,
    hasAnyFavorites,
    favoritedLeagueIds,
    favoritedTeamIds,
    odds,
    matchDetails,
    navigate,
}: { 
    fixtures: Fixture[], 
    loading: boolean,
    activeTab: string, 
    showLiveOnly: boolean,
    hasAnyFavorites: boolean,
    favoritedLeagueIds: number[],
    favoritedTeamIds: number[],
    odds: { [fixtureId: number]: Odds['bookmakers'][0]['bets'][0]['values'] },
    matchDetails: { [matchId: string]: MatchDetails },
    navigate: ScreenProps['navigate'],
}) => {
    
    const filteredFixtures = useMemo(() => {
        let fixturesToFilter = fixtures;

        if (showLiveOnly) {
            fixturesToFilter = fixturesToFilter.filter(f => ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE'].includes(f.fixture.status.short));
        }

        if (activeTab === 'all-matches' || activeTab === 'global-predictions') {
            return fixturesToFilter;
        }
        return fixturesToFilter.filter(f => 
            favoritedTeamIds.includes(f.teams.home.id) ||
            favoritedTeamIds.includes(f.teams.away.id) ||
            favoritedLeagueIds.includes(f.league.id)
        );
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
    
    const liveMatchesCount = fixtures.filter(f => ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE'].includes(f.fixture.status.short)).length;

    if (showLiveOnly && liveMatchesCount === 0) {
        return (
             <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-64 p-4">
                <p>لا توجد مباريات مباشرة حاليًا.</p>
            </div>
        )
    }

    if (fixtures.length > 0 && filteredFixtures.length === 0) {
       return (
            <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-64 p-4">
                <p className="font-bold text-lg">لا توجد مباريات مفضلة لهذا اليوم</p>
            </div>
        );
    }

    if (Object.keys(groupedFixtures).length === 0) {
        return (
            <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-64 p-4">
                <p>لا توجد مباريات لهذا اليوم.</p>
            </div>
        );
    }

    const sortedLeagues = Object.keys(groupedFixtures).sort((a,b) => a.localeCompare(b));


    return (
        <div className="space-y-4">
            {sortedLeagues.map(leagueName => {
                const { league, fixtures } = groupedFixtures[leagueName];
                return (
                    <div key={leagueName} className="space-y-2">
                        <h3 className="font-bold text-foreground px-1 py-2">{leagueName}</h3>
                        <div className="space-y-2">
                            {fixtures.map(f => <FixtureItem key={f.fixture.id} fixture={f} navigate={navigate} odds={odds[f.fixture.id]} commentsEnabled={matchDetails[f.fixture.id]?.commentsEnabled} />)}
                        </div>
                    </div>
                )
            })}
        </div>
    );
};

// Date Scroller
const DateScroller = ({ selectedDateKey, onDateSelect }: {selectedDateKey: string, onDateSelect: (dateKey: string) => void}) => {
    const dates = useMemo(() => {
        const today = new Date();
        const days = [];
        for (let i = -30; i <= 30; i++) {
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
        <div ref={scrollerRef} className="flex space-x-2 overflow-x-auto pb-2 px-4" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {dates.map(date => {
                const dateKey = formatDateKey(date);
                const isSelected = dateKey === selectedDateKey;
                return (
                     <button
                        key={dateKey}
                        ref={isSelected ? selectedButtonRef : null}
                        className={cn(
                            "relative flex flex-col items-center justify-center h-auto py-1 px-2.5 min-w-[48px] rounded-lg transition-colors",
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

const ODDS_STORAGE_KEY = 'goalstack-showOdds';

// Main Screen Component
export function MatchesScreen({ navigate, goBack, canGoBack, headerActions: baseHeaderActions }: ScreenProps & { headerActions?: React.ReactNode }) {
  const { user } = useAuth();
  const { db } = useFirestore();
  const [favorites, setFavorites] = useState<Favorites>({userId: ''});
  const [activeTab, setActiveTab] = useState<'all-matches' | 'my-results' | 'global-predictions'>('my-results');

  const [selectedDateKey, setSelectedDateKey] = useState(formatDateKey(new Date()));
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [odds, setOdds] = useState<{ [fixtureId: number]: any }>({});
  const [showOdds, setShowOdds] = useState(false);
  const [loadingOdds, setLoadingOdds] = useState(false);
  const [showLiveOnly, setShowLiveOnly] = useState(false);

  const [matchDetails, setMatchDetails] = useState<{ [matchId: string]: MatchDetails }>({});


  useEffect(() => {
      const fetchMatchDetails = async () => {
          if (!db) return;
          const matchesColRef = collection(db, 'matches');
          try {
              const snapshot = await getDocs(matchesColRef);
              const details: { [matchId: string]: MatchDetails } = {};
              snapshot.forEach(doc => {
                  details[doc.id] = doc.data() as MatchDetails;
              });
              setMatchDetails(details);
          } catch (error) {
                const permissionError = new FirestorePermissionError({
                    path: matchesColRef.path,
                    operation: 'list',
                });
                errorEmitter.emit('permission-error', permissionError);
          }
      };
      fetchMatchDetails();

      // Also set up a listener for real-time updates
      const unsubscribe = onSnapshot(collection(db, 'matches'), (snapshot) => {
        const details: { [matchId: string]: MatchDetails } = {};
        snapshot.forEach(doc => {
            details[doc.id] = doc.data() as MatchDetails;
        });
        setMatchDetails(prevDetails => ({...prevDetails, ...details}));
      });

      return () => unsubscribe();
  }, [db]);


  useEffect(() => {
    try {
      const savedState = localStorage.getItem(ODDS_STORAGE_KEY);
      setShowOdds(savedState === 'true');
    } catch (error) {
      console.warn('Could not access localStorage:', error);
    }
  }, []);
  
  const fetchOddsForDate = async (dateKey: string) => {
      setLoadingOdds(true);
      try {
          const response = await fetch(`/api/football/odds?date=${dateKey}&bookmaker=8&bet=1`); // Bet365, Match Winner
          if (!response.ok) throw new Error('Failed to fetch odds');
          const data = await response.json();
          const oddsByFixture: { [fixtureId: number]: any } = {};
          (data.response as Odds[]).forEach(item => {
              // Find the "Match Winner" bet
              const matchWinnerBet = item.bookmakers[0]?.bets.find(b => b.id === 1);
              if (matchWinnerBet) {
                  oddsByFixture[item.fixture.id] = matchWinnerBet.values;
              }
          });
          setOdds(oddsByFixture);
      } catch (error) {
          const permissionError = new FirestorePermissionError({
            path: `/api/football/odds?date=${dateKey}`,
            operation: 'get',
          });
          errorEmitter.emit('permission-error', permissionError);
          setOdds({});
      } finally {
          setLoadingOdds(false);
      }
  };


  useEffect(() => {
    if (activeTab === 'global-predictions') {
      navigate('GlobalPredictions');
      return;
    }
    async function fetchFixturesForDate(dateKey: string) {
        setLoading(true);
        if(showOdds) {
            fetchOddsForDate(dateKey);
        } else {
            setOdds({});
        }
        try {
            const response = await fetch(`/api/football/fixtures?date=${dateKey}`);
            if (!response.ok) throw new Error('Failed to fetch');
            const data = await response.json();
            setFixtures(data.response || []);
        } catch (error) {
            console.error(`Failed to fetch fixtures for ${dateKey}:`, error);
            setFixtures([]);
        } finally {
            setLoading(false);
        }
    }
    fetchFixturesForDate(selectedDateKey);
  }, [selectedDateKey, showOdds, activeTab, navigate]);
  
  useEffect(() => {
    if (!user) {
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

  const favoritedTeamIds = useMemo(() => favorites?.teams ? Object.keys(favorites.teams).map(Number) : [], [favorites.teams]);
  const favoritedLeagueIds = useMemo(() => favorites?.leagues ? Object.keys(favorites.leagues).map(Number) : [], [favorites.leagues]);
  const hasAnyFavorites = favoritedLeagueIds.length > 0 || favoritedTeamIds.length > 0;
    
  const toggleShowOdds = () => {
    const newShowOdds = !showOdds;
    setShowOdds(newShowOdds);
    try {
      localStorage.setItem(ODDS_STORAGE_KEY, String(newShowOdds));
    } catch (error) {
      console.warn('Could not access localStorage:', error);
    }
  }

  const screenHeaderActions = (
    <div className='flex items-center gap-2'>
        <SearchSheet navigate={navigate}>
            <Button variant="ghost" size="icon">
                <Search className="h-5 w-5" />
            </Button>
        </SearchSheet>
        <Switch
            id="live-mode"
            checked={showLiveOnly}
            onCheckedChange={setShowLiveOnly}
        />
        <Button
            variant={showOdds ? "default" : "secondary"}
            className="h-7 px-2 text-xs"
            onClick={toggleShowOdds}
            disabled={loadingOdds}
        >
            {loadingOdds ? <Loader2 className="h-4 w-4 animate-spin" /> : '1X2'}
        </Button>
        {baseHeaderActions}
    </div>
  )

  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader title="" onBack={goBack} canGoBack={canGoBack} actions={screenHeaderActions} />
      <div className="flex flex-1 flex-col min-h-0">
        <div className="flex flex-col border-b bg-card">
            <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)} className="w-full">
              <TabsList className="grid w-full grid-cols-3 h-auto p-0 rounded-none">
                  <TabsTrigger value="all-matches">كل المباريات</TabsTrigger>
                  <TabsTrigger value="global-predictions">التوقعات العالمية</TabsTrigger>
                  <TabsTrigger value="my-results">نتائجي</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="py-2">
                <DateScroller selectedDateKey={selectedDateKey} onDateSelect={setSelectedDateKey} />
            </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <FixturesList 
            fixtures={fixtures}
            loading={loading}
            activeTab={activeTab}
            showLiveOnly={showLiveOnly} 
            favoritedLeagueIds={favoritedLeagueIds}
            favoritedTeamIds={favoritedTeamIds}
            hasAnyFavorites={hasAnyFavorites}
            odds={odds}
            matchDetails={matchDetails}
            navigate={navigate}
        />
        </div>
      </div>
    </div>
  );
}
