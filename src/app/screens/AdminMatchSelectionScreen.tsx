

"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { ScreenProps } from '@/app/page';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';
import { addDays, format, isToday, isYesterday, isTomorrow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useFirestore } from '@/firebase/provider';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { Fixture, DailyGlobalPredictions, GlobalPredictionMatch } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { hardcodedTranslations } from '@/lib/hardcoded-translations';

// --- Helper Functions & Components ---
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
        <div ref={scrollerRef} className="flex flex-row-reverse overflow-x-auto pb-2 px-4" style={{ scrollbarWidth: 'none' }}>
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
                    >
                        <span className="text-xs font-normal">{getDayLabel(date)}</span>
                        <span className="font-bold text-sm">{format(date, 'd')}</span>
                        {isSelected && (
                            <span className="absolute bottom-0 h-0.5 w-4 rounded-full bg-primary transition-transform" />
                        )}
                    </button>
                )
            })}
        </div>
    );
}

const FixtureSelectionItem = ({ fixture, isSelected, onSelectionChange }: { fixture: Fixture, isSelected: boolean, onSelectionChange: (checked: boolean) => void }) => {
    return (
      <div className="flex items-center gap-3 p-3 bg-card rounded-lg border">
        <Checkbox
          id={`fixture-${fixture.fixture.id}`}
          checked={isSelected}
          onCheckedChange={onSelectionChange}
          className="h-5 w-5"
        />
        <Label htmlFor={`fixture-${fixture.fixture.id}`} className="flex-1 cursor-pointer">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 justify-end truncate">
              <span className="font-semibold truncate">{fixture.teams.home.name}</span>
              <Avatar className="h-8 w-8">
                <AvatarImage src={fixture.teams.home.logo} />
              </Avatar>
            </div>
            <div className="font-bold text-sm px-2 bg-muted rounded-md min-w-[70px] text-center">
              {format(new Date(fixture.fixture.date), "HH:mm")}
            </div>
            <div className="flex items-center gap-2 flex-1 truncate">
              <Avatar className="h-8 w-8">
                <AvatarImage src={fixture.teams.away.logo} />
              </Avatar>
              <span className="font-semibold truncate">{fixture.teams.away.name}</span>
            </div>
          </div>
        </Label>
      </div>
    );
};

interface GroupedFixtures {
    [leagueName: string]: {
        league: Fixture['league'];
        fixtures: Fixture[];
    }
}

const leagueOrder: { [key: string]: number } = {
  // Top 5
  "La Liga": 1, "Premier League": 2, "Ligue 1": 3, "Bundesliga": 4, "Serie A": 5, 
  "الدوري الإسباني": 1, "الدوري الإنجليزي الممتاز": 2, "الدوري الفرنسي": 3, "الدوري الألماني": 4, "الدوري الإيطالي": 5,

  // Other European
  "Eredivisie": 6, "دوري الهولندي": 6,

  // Arab Leagues
  "Iraq Stars League": 7, "دوري نجوم العراق": 7,
  "Saudi Professional League": 8, "دوري المحترفين السعودي": 8,

  // Continental Club
  "UEFA Champions League": 20, "دوري أبطال أوروبا": 20,
  "UEFA Europa League": 21, "الدوري الأوروبي": 21,
  "AFC Champions League": 22, "دوري أبطال آسيا": 22,
  "CAF Champions League": 23, "دوري أبطال أفريقيا": 23,
  "Copa Libertadores": 24, "كأس ليبرتادوريس": 24,

  // National Team Comps
  "World Cup": 30, "كأس العالم": 30,
  "Euro Championship": 31, "بطولة أمم أوروبا": 31,
  "Africa Cup of Nations": 32, "كأس الأمم الأفريقية": 32,
  "AFC Asian Cup": 33, "كأس آسيا": 33,
  "Copa America": 34, "كوبا أمريكا": 34,
};


// --- Main Screen Component ---
export function AdminMatchSelectionScreen({ navigate, goBack, canGoBack }: ScreenProps) {
    const [selectedDateKey, setSelectedDateKey] = useState(formatDateKey(new Date()));
    const [allFixtures, setAllFixtures] = useState<Fixture[]>([]);
    const [selectedFixtureIds, setSelectedFixtureIds] = useState<Set<number>>(new Set());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const { toast } = useToast();
    const { db } = useFirestore();

    const MAX_SELECTIONS = 15;

    // Fetch fixtures for the selected date
    useEffect(() => {
        const fetchFixtures = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/football/fixtures?date=${selectedDateKey}`);
                if (!res.ok) {
                    throw new Error('Failed to fetch fixtures');
                }
                const data = await res.json();
                
                // Apply hardcoded translations here
                const rawFixtures = data.response || [];
                const translatedFixtures = rawFixtures.map((fixture: Fixture) => ({
                    ...fixture,
                    league: {
                        ...fixture.league,
                        name: hardcodedTranslations.leagues[fixture.league.id] || fixture.league.name,
                    },
                    teams: {
                        home: { ...fixture.teams.home, name: hardcodedTranslations.teams[fixture.teams.home.id] || fixture.teams.home.name },
                        away: { ...fixture.teams.away, name: hardcodedTranslations.teams[fixture.teams.away.id] || fixture.teams.away.name },
                    }
                }));

                setAllFixtures(translatedFixtures);
            } catch (error) {
                console.error("Error fetching fixtures:", error);
                toast({
                    variant: "destructive",
                    title: "خطأ في الشبكة",
                    description: "فشل في جلب مباريات اليوم.",
                });
                setAllFixtures([]);
            } finally {
                setLoading(false);
            }
        };
        fetchFixtures();
    }, [selectedDateKey, toast]);


    // Fetch existing selections for the selected date from Firestore
    useEffect(() => {
        if (!db) return;
        const fetchSelections = async () => {
            const dailyDocRef = doc(db, 'dailyGlobalPredictions', selectedDateKey);
            try {
                const docSnap = await getDoc(dailyDocRef);
                if (docSnap.exists()) {
                    const dailyData = docSnap.data() as DailyGlobalPredictions;
                    if (dailyData.selectedByAdmin) {
                        const ids = new Set(dailyData.selectedMatches.map(m => m.fixtureId));
                        setSelectedFixtureIds(ids);
                    } else {
                        setSelectedFixtureIds(new Set());
                    }
                } else {
                    setSelectedFixtureIds(new Set());
                }
            } catch (error) {
                const permissionError = new FirestorePermissionError({ path: dailyDocRef.path, operation: 'get' });
                errorEmitter.emit('permission-error', permissionError);
            }
        };
        fetchSelections();
    }, [selectedDateKey, db]);

    const handleSelectionChange = (fixtureId: number, checked: boolean) => {
        setSelectedFixtureIds(prev => {
            const newSet = new Set(prev);
            if (checked) {
                if (newSet.size < MAX_SELECTIONS) {
                    newSet.add(fixtureId);
                } else {
                    toast({
                        variant: "destructive",
                        title: "تم الوصول للحد الأقصى",
                        description: `لا يمكن اختيار أكثر من ${MAX_SELECTIONS} مباراة في اليوم.`,
                    });
                }
            } else {
                newSet.delete(fixtureId);
            }
            return newSet;
        });
    };
    
    const handleSaveSelections = async () => {
        if (!db) return;
        setSaving(true);
        const dailyDocRef = doc(db, 'dailyGlobalPredictions', selectedDateKey);

        const selectedMatchesData: GlobalPredictionMatch[] = allFixtures
            .filter(f => selectedFixtureIds.has(f.fixture.id))
            .map(f => ({
                fixtureId: f.fixture.id,
                leagueId: f.league.id,
                date: selectedDateKey
            }));
        
        const dataToSave: DailyGlobalPredictions = {
            selectedByAdmin: true,
            selectedMatches: selectedMatchesData,
        };

        setDoc(dailyDocRef, dataToSave)
            .then(() => {
                toast({
                    title: "تم الحفظ بنجاح",
                    description: `تم حفظ ${selectedFixtureIds.size} مباريات للتوقعات العالمية.`,
                });
            })
            .catch((serverError) => {
                const permissionError = new FirestorePermissionError({ path: dailyDocRef.path, operation: 'create', requestResourceData: dataToSave });
                errorEmitter.emit('permission-error', permissionError);
            })
            .finally(() => {
                setSaving(false);
            });
    };

    const groupedFixtures = useMemo(() => {
        return allFixtures.reduce((acc, fixture) => {
            const leagueName = fixture.league.name;
            if (!acc[leagueName]) {
                acc[leagueName] = { league: fixture.league, fixtures: [] };
            }
            acc[leagueName].fixtures.push(fixture);
            return acc;
        }, {} as GroupedFixtures);
    }, [allFixtures]);

    const sortedLeagues = useMemo(() => {
        return Object.keys(groupedFixtures).sort((a, b) => {
            const orderA = leagueOrder[a] || 999;
            const orderB = leagueOrder[b] || 999;
            if (orderA !== orderB) {
                return orderA - orderB;
            }
            return a.localeCompare(b);
        });
    }, [groupedFixtures]);

    return (
        <div className="flex h-full flex-col bg-background">
            <ScreenHeader title="اختيار مباريات التوقع" onBack={goBack} canGoBack={true} />
            <div className="border-b bg-card py-2">
                 <DateScroller selectedDateKey={selectedDateKey} onDateSelect={setSelectedDateKey} />
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loading ? (
                    Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)
                ) : sortedLeagues.length > 0 ? (
                    <Accordion type="multiple" className="w-full space-y-4" defaultValue={sortedLeagues}>
                        {sortedLeagues.map(leagueName => {
                            const { league, fixtures } = groupedFixtures[leagueName];
                            return (
                               <AccordionItem value={leagueName} key={leagueName} className="rounded-lg border bg-card/50">
                                   <AccordionTrigger className="px-4 py-3 hover:no-underline">
                                       <div className="flex items-center gap-3">
                                           <Avatar className="h-6 w-6">
                                               <AvatarImage src={league.logo} alt={league.name} />
                                               <AvatarFallback>{league.name.substring(0,1)}</AvatarFallback>
                                           </Avatar>
                                           <span className="font-bold text-foreground">{leagueName}</span>
                                       </div>
                                   </AccordionTrigger>
                                   <AccordionContent className="p-2 space-y-2">
                                        {fixtures.map(fixture => (
                                             <FixtureSelectionItem
                                                key={fixture.fixture.id}
                                                fixture={fixture}
                                                isSelected={selectedFixtureIds.has(fixture.fixture.id)}
                                                onSelectionChange={(checked) => handleSelectionChange(fixture.fixture.id, !!checked)}
                                            />
                                        ))}
                                   </AccordionContent>
                               </AccordionItem>
                            )
                        })}
                    </Accordion>
                ) : (
                    <Card>
                        <CardContent className="p-6 text-center text-muted-foreground">
                            <p>لا توجد مباريات في هذا اليوم.</p>
                        </CardContent>
                    </Card>
                )}
            </div>
            <div className="p-4 border-t bg-background/90 backdrop-blur-sm sticky bottom-0">
                <div className="flex justify-between items-center mb-2">
                    <p className="text-sm font-semibold">المجموع المختار:</p>
                    <p className="text-sm font-bold">{selectedFixtureIds.size} / {MAX_SELECTIONS}</p>
                </div>
                 <Button className="w-full" onClick={handleSaveSelections} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ الاختيارات"}
                </Button>
            </div>
        </div>
    );
}
