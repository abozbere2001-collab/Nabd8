
"use client";

import React, { useState, useEffect, useRef } from 'react';
import type { ScreenProps } from '@/app/page';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useFirestore } from '@/firebase/provider';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, Trash2, Power, PowerOff } from 'lucide-react';
import type { PinnedMatch } from '@/lib/types';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import Image from 'next/image';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export function ManagePinnedMatchScreen({ goBack, canGoBack, headerActions }: ScreenProps) {
    const [match, setMatch] = useState<Partial<PinnedMatch>>({ isEnabled: true });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [isDeleteAlertOpen, setDeleteAlertOpen] = useState(false);
    const { db } = useFirestore();
    const { toast } = useToast();
    const homeLogoInputRef = useRef<HTMLInputElement>(null);
    const awayLogoInputRef = useRef<HTMLInputElement>(null);
    
    useEffect(() => {
        if (!db) {
          // Keep loading if db is not available yet
          setLoading(true);
          return;
        }
    
        setLoading(true);
        const docRef = doc(db, 'pinnedIraqiMatch', 'special');
    
        getDoc(docRef).then(docSnap => {
            if (docSnap.exists()) {
                setMatch(docSnap.data() as PinnedMatch);
            }
        }).catch(error => {
            const permissionError = new FirestorePermissionError({ path: docRef.path, operation: 'get' });
            errorEmitter.emit('permission-error', permissionError);
        }).finally(() => {
            setLoading(false);
        });
    }, [db]);


    const handleInputChange = (field: keyof PinnedMatch, value: string | boolean) => {
        setMatch(prev => ({ ...prev, [field]: value }));
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, team: 'home' | 'away') => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const logoField = team === 'home' ? 'homeTeamLogo' : 'awayTeamLogo';
                handleInputChange(logoField, reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };
    
    const handleSave = async () => {
        if (!db) return;
        setSaving(true);
        const docRef = doc(db, 'pinnedIraqiMatch', 'special');
        
        const dataToSave: PinnedMatch = {
            isEnabled: match.isEnabled ?? true,
            homeTeamName: match.homeTeamName || '',
            homeTeamLogo: match.homeTeamLogo || '',
            awayTeamName: match.awayTeamName || '',
            awayTeamLogo: match.awayTeamLogo || '',
            competitionName: match.competitionName || '',
            matchDate: match.matchDate || '',
            matchTime: match.matchTime || '',
        };

        setDoc(docRef, dataToSave)
            .then(() => {
                toast({ title: 'نجاح', description: 'تم حفظ بيانات المباراة المثبتة.' });
                goBack();
            })
            .catch(serverError => {
                const permissionError = new FirestorePermissionError({ path: docRef.path, operation: 'create', requestResourceData: dataToSave });
                errorEmitter.emit('permission-error', permissionError);
            })
            .finally(() => setSaving(false));
    };

    const handleDelete = async () => {
        if (!db) return;
        setDeleting(true);
        const docRef = doc(db, 'pinnedIraqiMatch', 'special');
        deleteDoc(docRef)
         .then(() => {
                toast({ title: 'نجاح', description: 'تم حذف المباراة المثبتة.' });
                goBack();
            })
            .catch(serverError => {
                const permissionError = new FirestorePermissionError({ path: docRef.path, operation: 'delete' });
                errorEmitter.emit('permission-error', permissionError);
            })
            .finally(() => {
                setDeleting(false);
                setDeleteAlertOpen(false);
            });
    }

    if (loading) {
        return (
             <div className="flex h-full flex-col bg-background">
                <ScreenHeader title="إدارة المباراة المثبتة" onBack={goBack} canGoBack={canGoBack} />
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            </div>
        )
    }

    return (
        <div className="flex h-full flex-col bg-background">
        <ScreenHeader title="إدارة المباراة المثبتة" onBack={goBack} canGoBack={canGoBack} actions={
             <AlertDialog open={isDeleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="icon">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>هل أنت متأكد من الحذف؟</AlertDialogTitle>
                        <AlertDialogDescription>
                            سيؤدي هذا إلى حذف البطاقة بالكامل. يمكنك دائمًا إنشاء واحدة جديدة لاحقًا.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} disabled={deleting}>
                            {deleting ? <Loader2 className="h-4 w-4 animate-spin"/> : 'حذف'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        } />
        <div className="flex-1 overflow-y-auto p-4">
            <Card>
            <CardContent className="space-y-6 pt-6">
                <div className="flex items-center justify-between rounded-lg border p-4">
                    <Label htmlFor="isEnabled" className="flex flex-col gap-1">
                        <span>تفعيل البطاقة</span>
                        <span className="font-normal leading-snug text-muted-foreground">
                            قم بإلغاء التفعيل لإخفاء البطاقة مؤقتًا من شاشة العراق.
                        </span>
                    </Label>
                    <Switch
                        id="isEnabled"
                        checked={match.isEnabled}
                        onCheckedChange={(checked) => handleInputChange('isEnabled', checked)}
                    />
                </div>

                <div className="space-y-2">
                    <Label>الفريق المضيف</Label>
                    <div className="flex items-center gap-2">
                        <Input value={match.homeTeamName || ''} onChange={(e) => handleInputChange('homeTeamName', e.target.value)} placeholder="اسم الفريق المضيف" />
                         <Button variant="outline" size="icon" className="flex-shrink-0" onClick={() => homeLogoInputRef.current?.click()}>
                            {match.homeTeamLogo ? <Image src={match.homeTeamLogo} alt="" width={24} height={24} /> : <Upload className="h-4 w-4"/>}
                         </Button>
                         <Input type="file" ref={homeLogoInputRef} onChange={(e) => handleFileChange(e, 'home')} className="hidden" accept="image/*"/>
                    </div>
                </div>

                 <div className="space-y-2">
                    <Label>الفريق الضيف</Label>
                    <div className="flex items-center gap-2">
                        <Input value={match.awayTeamName || ''} onChange={(e) => handleInputChange('awayTeamName', e.target.value)} placeholder="اسم الفريق الضيف" />
                         <Button variant="outline" size="icon" className="flex-shrink-0" onClick={() => awayLogoInputRef.current?.click()}>
                             {match.awayTeamLogo ? <Image src={match.awayTeamLogo} alt="" width={24} height={24} /> : <Upload className="h-4 w-4"/>}
                         </Button>
                         <Input type="file" ref={awayLogoInputRef} onChange={(e) => handleFileChange(e, 'away')} className="hidden" accept="image/*"/>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="competitionName">اسم البطولة</Label>
                    <Input id="competitionName" value={match.competitionName || ''} onChange={(e) => handleInputChange('competitionName', e.target.value)} placeholder="مثال: دوري نجوم العراق" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <Label htmlFor="matchDate">التاريخ</Label>
                        <Input id="matchDate" value={match.matchDate || ''} onChange={(e) => handleInputChange('matchDate', e.target.value)} placeholder="مثال: السبت، 25 مايو" />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="matchTime">الوقت</Label>
                        <Input id="matchTime" value={match.matchTime || ''} onChange={(e) => handleInputChange('matchTime', e.target.value)} placeholder="مثال: 09:00 مساءً" />
                    </div>
                </div>

                <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'حفظ التغييرات'}
                </Button>
            </CardContent>
            </Card>
        </div>
        </div>
    );
}
