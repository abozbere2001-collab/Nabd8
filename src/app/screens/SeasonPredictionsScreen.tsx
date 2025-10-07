
"use client";

import React, { useState, useEffect } from 'react';
import type { ScreenProps } from '@/app/page';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const PREMIER_LEAGUE_ID = 39;
const LALIGA_ID = 140;
const SERIE_A_ID = 135;
const BUNDESLIGA_ID = 78;

const leagues = [
    { id: PREMIER_LEAGUE_ID, name: "الدوري الإنجليزي الممتاز" },
    { id: LALIGA_ID, name: "الدوري الإسباني" },
    { id: SERIE_A_ID, name: "الدوري الإيطالي" },
    { id: BUNDESLIGA_ID, name: "الدوري الألماني" },
];

export function SeasonPredictionsScreen({ navigate, goBack, canGoBack, headerActions }: ScreenProps) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    
    // This is a placeholder. In a real scenario, you would fetch teams/players,
    // and save the user's predictions to Firestore.
    const handleSavePrediction = () => {
        setLoading(true);
        setTimeout(() => {
            toast({
                title: "قيد التطوير",
                description: "سيتم تفعيل حفظ توقعات الموسم قريبًا.",
            });
            setLoading(false);
        }, 1000);
    };

    return (
        <div className="flex h-full flex-col bg-background">
            <ScreenHeader title="توقعات الموسم" onBack={goBack} canGoBack={canGoBack} actions={headerActions} />
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>توقع بطل الموسم وهداف الدوري</CardTitle>
                        <CardDescription>
                            اختر توقعاتك للدوريات الكبرى. سيتم منح 50 نقطة لتوقع البطل الصحيح و 25 نقطة لتوقع الهداف الصحيح في نهاية الموسم.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {leagues.map(league => (
                            <div key={league.id} className="p-4 border rounded-lg bg-card">
                                <h3 className="font-bold mb-4">{league.name}</h3>
                                <div className="space-y-4">
                                   <p className="text-sm text-muted-foreground text-center py-4">
                                        سيتم تفعيل اختيار الفرق والهدافين هنا قريبًا.
                                    </p>
                                </div>
                            </div>
                        ))}
                         <Button onClick={handleSavePrediction} disabled={loading} className="w-full mt-4">
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'حفظ التوقعات'}
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
