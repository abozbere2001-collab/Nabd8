"use client";

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import type { ScreenProps } from '@/app/page';
import { format, addDays, isToday, isYesterday, isTomorrow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useFirebase } from '@/firebase/provider';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

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

interface Favorites {
    leagues?: { [key: string]: any };
    teams?: { [key:string]: any };
}

interface GroupedFixtures {
    [leagueName: string]: {
        league: Fixture['league'];
        fixtures: Fixture[];
    }
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
const FixtureItem = React.memo(({ fixture, onSelect }: { fixture: Fixture, onSelect: (fixtureId: number, fixture: Fixture) => void }) => {
    return (
      <div 
        key={fixture.fixture.id} 
        className="rounded-lg bg-muted p-3 text-sm transition-colors hover:bg-accent cursor-pointer"
        onClick={() => onSelect(fixture.fixture.id, fixture)}
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
                 ['NS', 'TBD', 'PST', 'CANC'].includes(fixture.fixture.status.short) ? "bg-card" : "bg-card"
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
    );
});
FixtureItem.displayName = 'FixtureItem';


// Fixtures List Component
const FixturesList = ({ 
    fixtures, 
    loading,
    activeTab, 
    hasAnyFavorites,
    favoritedLeagueIds,
    favoritedTeamIds,
    onSelectFixture,
}: { 
    fixtures: Fixture[], 
    loading: boolean,
    activeTab: string, 
    hasAnyFavorites: boolean,
    favoritedLeagueIds: number[],
    favoritedTeamIds: number[],
    onSelectFixture: (fixtureId: number, fixture: Fixture) => void
}) => {
    
    const filteredFixtures = useMemo(() => {
        if (activeTab === 'all-matches') {
            return fixtures;
        }
        return fixtures.filter(f => 
            favoritedTeamIds.includes(f.teams.home.id) ||
            favoritedTeamIds.includes(f.teams.away.id) ||
            favoritedLeagueIds.includes(f.league.id)
        );
    }, [fixtures, activeTab, favoritedTeamIds, favoritedLeagueIds]);

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
                            {fixtures.map(f => <FixtureItem key={f.fixture.id} fixture={f} onSelect={onSelectFixture} />)}
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
        <div ref={scrollerRef} className="flex flex-row-reverse space-x-2 space-x-reverse overflow-x-auto pb-2 px-4" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
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
                        {isSelected && <div className="absolute bottom-0 h-0.5 w-4 bg-primary rounded-full" />}
                    </button>
                )
            })}
        </div>
    );
}

// Main Screen Component
export function MatchesScreen({ navigate, goBack, canGoBack, headerActions }: ScreenProps & { headerActions?: React.ReactNode }) {
  const { user } = useFirebase();
  const [favorites, setFavorites] = useState<Favorites>({});
  const [activeTab, setActiveTab] = useState<'my-results' | 'all-matches'>('all-matches');

  const [selectedDateKey, setSelectedDateKey] = useState(formatDateKey(new Date()));
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);

  const handleSelectFixture = (fixtureId: number, fixture: Fixture) => {
    navigate('MatchDetails', { fixtureId, fixture });
  };

  useEffect(() => {
    async function fetchFixturesForDate(dateKey: string) {
        setLoading(true);
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
  }, [selectedDateKey]);
  
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'favorites', user.uid), (doc) => {
      setFavorites(doc.data() as Favorites || {});
    });
    return () => unsub();
  }, [user]);

  const favoritedTeamIds = useMemo(() => favorites?.teams ? Object.keys(favorites.teams).map(Number) : [], [favorites.teams]);
  const favoritedLeagueIds = useMemo(() => favorites?.leagues ? Object.keys(favorites.leagues).map(Number) : [], [favorites.leagues]);
  const hasAnyFavorites = favoritedLeagueIds.length > 0 || favoritedTeamIds.length > 0;
    
  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader title="المباريات" onBack={goBack} canGoBack={canGoBack} actions={headerActions} />
      <div className="flex flex-1 flex-col min-h-0">
        <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)} className="w-full flex-1 flex flex-col min-h-0">
          
          <div className="border-b bg-card flex flex-col">
             <TabsList className="grid w-full grid-cols-2 h-auto p-0 rounded-none">
                <TabsTrigger value="my-results">نتائجي</TabsTrigger>
                <TabsTrigger value="all-matches">كل المباريات</TabsTrigger>
            </TabsList>
            <div className="py-2">
               <DateScroller selectedDateKey={selectedDateKey} onDateSelect={setSelectedDateKey} />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <FixturesList 
                fixtures={fixtures}
                loading={loading}
                activeTab={activeTab} 
                favoritedLeagueIds={favoritedLeagueIds}
                favoritedTeamIds={favoritedTeamIds}
                hasAnyFavorites={hasAnyFavorites}
                onSelectFixture={handleSelectFixture}
            />
          </div>
        </Tabs>
      </div>
    </div>
  );
}
