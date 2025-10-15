
"use client";

import React, { useState, useEffect, useRef } from 'react';
import type { ScreenProps } from '@/app/page';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useFirestore } from '@/firebase/provider';
import { doc, setDoc, collection, query, orderBy, onSnapshot, writeBatch, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload } from 'lucide-react';
import type { ManualTopScorer } from '@/lib/types';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const NUM_SCORERS = 20;

export function ManageTopScorersScreen({ navigate, goBack, canGoBack, headerActions }: ScreenProps) {
  const [scorers, setScorers] = useState<Omit<ManualTopScorer, 'rank'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { db } = useFirestore();
  const { toast } = useToast();
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!db) return;
    setLoading(true);
    const scorersRef = collection(db, 'iraqiLeagueTopScorers');
    const q = query(scorersRef, orderBy('rank', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedScorers = new Map<number, Omit<ManualTopScorer, 'rank'>>();
      snapshot.docs.forEach(doc => {
        const data = doc.data() as ManualTopScorer;
        if (data.rank && data.rank > 0 && data.rank <= NUM_SCORERS) {
          const { rank, ...rest } = data;
          fetchedScorers.set(rank, rest);
        }
      });
      
      const newScorersList = Array.from({ length: NUM_SCORERS }, (_, i) => {
        const rank = i + 1;
        return fetchedScorers.get(rank) || { playerName: '', teamName: '', goals: 0, playerPhoto: '' };
      });

      setScorers(newScorersList);
      setLoading(false);
    }, (error) => {
      const permissionError = new FirestorePermissionError({ path: 'iraqiLeagueTopScorers', operation: 'list' });
      errorEmitter.emit('permission-error', permissionError);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db]);

  const handleInputChange = (index: number, field: keyof Omit<ManualTopScorer, 'rank'>, value: string | number) => {
    setScorers(prevScorers => {
      const newScorers = [...prevScorers];
      const updatedScorer = { ...newScorers[index], [field]: value };
      newScorers[index] = updatedScorer;
      return newScorers;
    });
  };
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        handleInputChange(index, 'playerPhoto', reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!db) return;
    setSaving(true);
    try {
      const batch = writeBatch(db);
      
      scorers.forEach((scorer, index) => {
        const rank = index + 1;
        const docRef = doc(db, 'iraqiLeagueTopScorers', String(rank));

        if (scorer.playerName && scorer.playerName.trim()) {
          const dataToSave: ManualTopScorer = {
            rank: rank,
            playerName: scorer.playerName.trim(),
            teamName: scorer.teamName.trim(),
            goals: Number(scorer.goals) || 0,
            playerPhoto: scorer.playerPhoto || undefined
          };
          batch.set(docRef, dataToSave);
        } else {
          // If the player name is empty, delete the document for that rank
          batch.delete(docRef);
        }
      });
      
      await batch.commit();
      toast({ title: 'نجاح', description: 'تم حفظ قائمة الهدافين.' });
      goBack();
    } catch (error) {
       // This will now correctly report an error on a specific document if one occurs
       const permissionError = new FirestorePermissionError({ path: 'iraqiLeagueTopScorers', operation: 'write' });
       errorEmitter.emit('permission-error', permissionError);
       toast({
        variant: "destructive",
        title: "فشل الحفظ",
        description: "حدث خطأ أثناء حفظ القائمة. تأكد من صلاحياتك.",
      });
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
        {scorers.map((scorer, index) => (
          <Card key={index}>
            <CardContent className="flex items-center gap-2 p-3">
              <span className="font-bold text-lg w-8 text-center">{index + 1}</span>
               <button onClick={() => fileInputRefs.current[index]?.click()} className="flex-shrink-0">
                  <Avatar className="h-12 w-12 cursor-pointer">
                    <AvatarImage src={scorer.playerPhoto} />
                    <AvatarFallback><Upload className="h-5 w-5" /></AvatarFallback>
                  </Avatar>
                </button>
                <input
                    type="file"
                    ref={el => fileInputRefs.current[index] = el}
                    onChange={(e) => handleFileChange(e, index)}
                    className="hidden"
                    accept="image/*"
                />
              <div className="flex-1 space-y-2">
                <Input
                  placeholder="اسم اللاعب"
                  value={scorer.playerName}
                  onChange={(e) => handleInputChange(index, 'playerName', e.target.value)}
                />
                 <Input
                  placeholder="اسم الفريق"
                  value={scorer.teamName}
                  onChange={(e) => handleInputChange(index, 'teamName', e.target.value)}
                />
              </div>
              <Input
                type="number"
                placeholder="الأهداف"
                value={scorer.goals || ''}
                onChange={(e) => handleInputChange(index, 'goals', Number(e.target.value))}
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
