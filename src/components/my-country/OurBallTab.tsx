"use client";

import React, { useState } from 'react';
import type { ScreenProps } from '@/app/page';
import { useAuth, useFirestore } from '@/firebase/provider';
import { doc, updateDoc, deleteField } from 'firebase/firestore';
import type { Team } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Loader2, Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { getLocalFavorites, setLocalFavorites } from '@/lib/local-favorites';

interface OurBallTabProps {
    navigate: ScreenProps['navigate'];
    ourBallTeams: Team[];
}

export function OurBallTab({ navigate, ourBallTeams }: OurBallTabProps) {
    const { user, db } = useAuth();
    const { toast } = useToast();
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const handleDelete = (teamId: number) => {
        if (deletingId) return;
        setDeletingId(teamId);

        if (user && db) {
            const docRef = doc(db, 'users', user.uid, 'favorites', 'data');
            const updateData = { [`ourBallTeams.${teamId}`]: deleteField() };
            updateDoc(docRef, updateData)
                .catch(error => {
                    const permissionError = new FirestorePermissionError({ path: docRef.path, operation: 'update', requestResourceData: updateData });
                    errorEmitter.emit('permission-error', permissionError);
                    toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حذف الفريق.' });
                })
                .finally(() => {
                    setDeletingId(null);
                });
        } else {
            const currentFavorites = getLocalFavorites();
            if (currentFavorites.ourBallTeams) {
                delete currentFavorites.ourBallTeams[teamId];
                setLocalFavorites(currentFavorites);
            }
            setDeletingId(null);
        }
    };
    
    if (ourBallTeams.length === 0) {
        return (
            <div className="text-center text-muted-foreground py-10 px-4">
                <p className="text-lg font-semibold">قسم "كرتنا" فارغ</p>
                <p>أضف فرقك ومنتخباتك المفضلة هنا بالضغط على زر القلب ❤️ في صفحة "كل البطولات".</p>
                <Button className="mt-4" onClick={() => navigate('AllCompetitions')}>استكشف البطولات</Button>
            </div>
        );
    }

    return (
        <div className="space-y-3 pt-4 px-4">
            {ourBallTeams.map((team) => (
                <div key={team.id} className="p-3 rounded-lg border bg-card flex items-center gap-3 h-16">
                    <div onClick={() => navigate('TeamDetails', { teamId: team.id })} className="flex-1 flex items-center gap-3 cursor-pointer">
                        <Avatar className="h-10 w-10">
                            <AvatarImage src={team.logo} alt={team.name} />
                            <AvatarFallback>{team.name.substring(0, 2)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="font-bold">{team.name}</p>
                        </div>
                    </div>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={deletingId === team.id} onClick={(e) => e.stopPropagation()}>
                                {deletingId === team.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                            <AlertDialogHeader>
                                <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
                                <AlertDialogDescription>
                                    سيتم حذف فريق "{team.name}" من قائمة "كرتنا".
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(team.id)} className="bg-destructive hover:bg-destructive/90">
                                    حذف
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            ))}
        </div>
    );
}
