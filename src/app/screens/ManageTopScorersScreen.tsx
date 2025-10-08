
"use client";

import React, { useState, useEffect } from 'react';
import type { ScreenProps } from '@/app/page';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useFirestore } from '@/firebase/provider';
import { doc, setDoc, collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import type { ManualTopScorer } from '@/lib/types';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';

const NUM_SCORERS = 10;

export function ManageTopScorersScreen({ navigate, goBack, canGoBack, headerActions }: ScreenProps) {
  const [scorers, setScorers] = useState<ManualTopScorer[]>(() => 
    Array.from({ length: NUM_SCORERS }, (_, i) => ({
      rank: i + 1,
      playerName: '',
      teamName: '',
      goals: 0
    }))
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { db } = useFirestore();
  const { toast } = useToast();

  useEffect(() => {
    if (!db) return;
    setLoading(true);
    const scorersRef = collection(db, 'iraqiLeagueTopScorers');
    const q = query(scorersRef, orderBy('rank', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
         setLoading(false);
         return;
      }
      const fetchedScorers = snapshot.docs.map(doc => doc.data() as ManualTopScorer);
      
      const newScorers = Array.from({ length: NUM_SCORERS }, (_, i) => {
        const existing = fetchedScorers.find(s => s.rank === i + 1);
        return existing || { rank: i + 1, playerName: '', teamName: '', goals: 0 };
      });

      setScorers(newScorers);
      setLoading(false);
    }, (error) => {
        const permissionError = new FirestorePermissionError({ path: 'iraqiLeagueTopScorers', operation: 'list' });
        errorEmitter.emit('permission-error', permissionError);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [db]);

  const handleInputChange = (rank: number, field: keyof ManualTopScorer, value: string | number) => {
    setScorers(prevScorers =>
      prevScorers.map(scorer =>
        scorer.rank === rank ? { ...scorer, [field]: value } : scorer
      )
    );
  };
  
  const handleSave = async () => {
    if (!db) return;
    setSaving(true);
    try {
      const batch = db.batch();
      scorers.forEach(scorer => {
        if(scorer.playerName.trim() || scorer.teamName.trim() || scorer.goals > 0) {
            const docRef = doc(db, 'iraqiLeagueTopScorers', String(scorer.rank));
            batch.set(docRef, scorer);
        }
      });
      await batch.commit();
      toast({ title: 'نجاح', description: 'تم حفظ قائمة الهدافين.' });
      goBack();
    } catch (error) {
       const permissionError = new FirestorePermissionError({ path: 'iraqiLeagueTopScorers', operation: 'update' });
       errorEmitter.emit('permission-error', permissionError);
    } finally {
        setSaving(false);
    }
  };
  
  if(loading) {
    return (
        <div className="flex h-full flex-col bg-background">
            <ScreenHeader title="إدارة الهدافين" onBack={goBack} canGoBack={canGoBack} actions={headerActions} />
            <div className="flex justify-center items-center flex-1">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader title="إدارة الهدافين" onBack={goBack} canGoBack={canGoBack} actions={headerActions} />
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {scorers.map((scorer) => (
          <Card key={scorer.rank}>
            <CardContent className="flex items-center gap-2 p-3">
              <span className="font-bold text-lg w-8 text-center">{scorer.rank}</span>
              <div className="flex-1 space-y-2">
                <Input
                  placeholder="اسم اللاعب"
                  value={scorer.playerName}
                  onChange={(e) => handleInputChange(scorer.rank, 'playerName', e.target.value)}
                />
                 <Input
                  placeholder="اسم الفريق"
                  value={scorer.teamName}
                  onChange={(e) => handleInputChange(scorer.rank, 'teamName', e.target.value)}
                />
              </div>
              <Input
                type="number"
                placeholder="الأهداف"
                value={scorer.goals || ''}
                onChange={(e) => handleInputChange(scorer.rank, 'goals', Number(e.target.value))}
                className="w-24 text-center"
              />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="p-4 border-t bg-background">
        <Button className="w-full" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'حفظ القائمة'}
        </Button>
      </div>
    </div>
  );
}
