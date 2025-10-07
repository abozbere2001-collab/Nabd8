
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { ScreenProps } from '@/app/page';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, AlertTriangle } from 'lucide-react';
import { addDays, format, isToday, isYesterday, isTomorrow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useFirestore } from '@/firebase/provider';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { Fixture, DailyGlobalPredictions, GlobalPredictionMatch } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';

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
        for (let i = -7; i <= 7; i++) {
            days.push(addDays(today, i));
        }
        return days;
    }, []);
    
    return (
        <div className="flex space-x-2 overflow-x-auto pb-2 px-4" style={{ scrollbarWidth: 'none' }}>
            {dates.map(date => {
                const dateKey = formatDateKey(date);
                return (
                     <button
                        key={dateKey}
                        className={cn(
                            "relative flex flex-col items-center justify-center h-auto py-1 px-2.5 min-w-[48px] rounded-lg transition-colors",
                            dateKey === selectedDateKey ? "text-primary bg-primary/10" : "text-foreground/80 hover:text-primary"
                        )}
                        onClick={() => onDateSelect(dateKey)}
                    >
                        <span className="text-xs font-normal">{getDayLabel(date)}</span>
                        <span className="font-bold text-sm">{format(date, 'd')}</span>
                    </button>
                )
            })}
        </div>
    );
}

const FixtureSelectionItem = ({ fixture, isSelected, onSelectionChange }: { fixture: Fixture, isSelected: boolean, onSelectionChange: (checked: boolean) => void }) => {
    return (
        <Card>
            <CardContent className="p-3">
                <div className="flex items-center gap-4">
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
                        <div className="text-center text-xs text-muted-foreground mt-1">
                            {fixture.league.name}
                        </div>
                    </Label>
                </div>
            </CardContent>
        </Card>
    );
};

// --- Main Screen Component ---
export function AdminMatchSelectionScreen({ navigate, goBack, canGoBack, headerActions }: ScreenProps) {
    const [selectedDateKey, setSelectedDateKey] = useState(formatDateKey(new Date()));
    const [allFixtures, setAllFixtures] = useState<Fixture[]>([]);
    const [selectedFixtureIds, setSelectedFixtureIds] = useState<Set<number>>(new Set());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const { toast } = useToast();
    const { db } = useFirestore();

    const MAX_SELECTIONS = 15;

    // Fetch available fixtures for the selected date from the API
    useEffect(() => {
        const fetchFixtures = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/football/fixtures?date=${selectedDateKey}`);
                const data = await res.json();
                setAllFixtures(data.response || []);
            } catch (error) {
                console.error("Failed to fetch fixtures:", error);
                toast({ variant: "destructive", title: "خطأ", description: "فشل في جلب المباريات." });
            } finally {
                setLoading(false);
            }
        };
        fetchFixtures();
    }, [selectedDateKey, toast]);

    // Fetch existing selections for the selected date from Firestore
    useEffect(() => {
        const fetchSelections = async () => {
            const dailyDocRef = doc(db, 'dailyGlobalPredictions', selectedDateKey);
            try {
                const docSnap = await getDoc(dailyDocRef);
                if (docSnap.exists()) {
                    const dailyData = docSnap.data() as DailyGlobalPredictions;
                    if (dailyData.selectedByAdmin) {
                        const ids = new Set(dailyData.selectedMatches.map(m => m.fixtureId));
                        setSelectedFixtureIds(ids);
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

        try {
            await setDoc(dailyDocRef, dataToSave);
            toast({
                title: "تم الحفظ بنجاح",
                description: `تم حفظ ${selectedFixtureIds.size} مباريات للتوقعات العالمية.`,
            });
        } catch (error) {
            console.error("Error saving selections:", error);
            const permissionError = new FirestorePermissionError({ path: dailyDocRef.path, operation: 'create', requestResourceData: dataToSave });
            errorEmitter.emit('permission-error', permissionError);
            toast({ variant: "destructive", title: "خطأ", description: "فشل حفظ الاختيارات." });
        } finally {
            setSaving(false);
        }
    };


    return (
        <div className="flex h-full flex-col bg-background">
            <ScreenHeader title="اختيار مباريات التوقع" onBack={goBack} canGoBack={canGoBack} actions={headerActions} />
            <div className="border-b bg-card py-2">
                 <DateScroller selectedDateKey={selectedDateKey} onDateSelect={setSelectedDateKey} />
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loading ? (
                    Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
                ) : allFixtures.length > 0 ? (
                    allFixtures.map(fixture => (
                        <FixtureSelectionItem
                            key={fixture.fixture.id}
                            fixture={fixture}
                            isSelected={selectedFixtureIds.has(fixture.fixture.id)}
                            onSelectionChange={(checked) => handleSelectionChange(fixture.fixture.id, !!checked)}
                        />
                    ))
                ) : (
                    <Card>
                        <CardContent className="p-6 text-center text-muted-foreground">
                            <p>لا توجد مباريات متاحة في هذا اليوم.</p>
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
