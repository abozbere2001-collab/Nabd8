
"use client";

import React, { useState, useEffect } from 'react';
import type { ScreenProps } from '@/app/page';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useAuth, useFirestore, useAdmin } from '@/firebase/provider';
import type { Fixture, UserScore } from '@/lib/types';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';


const AdminMatchSelector = () => {
    // This is a placeholder for the admin-specific UI to select matches.
    // In a full implementation, this would fetch matches from the API and allow the admin to pick them.
    return (
        <Card>
            <CardContent className="p-4">
                <h3 className="font-bold text-lg mb-2">لوحة تحكم المدير: اختيار المباريات</h3>
                <p className="text-sm text-muted-foreground">
                    هنا يمكن للمدير اختيار ما يصل إلى 15 مباراة لليوم. إذا لم يتم اختيار أي شيء، سيقوم النظام تلقائيًا باختيار ما يصل إلى 10 مباريات مهمة. هذه الميزة سيتم تفعيلها في مرحلة لاحقة.
                </p>
            </CardContent>
        </Card>
    )
}


export function GlobalPredictionsScreen({ navigate, goBack, canGoBack, headerActions }: ScreenProps) {
    const { isAdmin } = useAdmin();
    const { db } = useFirestore();
    const [loading, setLoading] = useState(true);
    const [selectedMatches, setSelectedMatches] = useState<Fixture[]>([]);
    const [leaderboard, setLeaderboard] = useState<UserScore[]>([]);

    useEffect(() => {
        setLoading(true);

        // Fetch leaderboard data
        const leaderboardRef = query(collection(db, 'leaderboard'), orderBy('totalPoints', 'desc'));
        const unsubscribeLeaderboard = onSnapshot(leaderboardRef, (snapshot) => {
            const scores: UserScore[] = [];
            snapshot.forEach(doc => scores.push(doc.data() as UserScore));
            setLeaderboard(scores);
            setLoading(false); // Consider loading finished once leaderboard is fetched
        }, (error) => {
            const permissionError = new FirestorePermissionError({ path: 'leaderboard', operation: 'list' });
            errorEmitter.emit('permission-error', permissionError);
            setLoading(false);
        });
        
        // In a future stage, we'll fetch the selected matches for the day here.
        // For now, we leave it empty.

        return () => {
            unsubscribeLeaderboard();
        };
    }, [db]);


    return (
        <div className="flex h-full flex-col bg-background">
            <ScreenHeader title="التوقعات العالمية" onBack={goBack} canGoBack={canGoBack} actions={headerActions} />
            <div className="flex-1 overflow-y-auto p-4 space-y-6">

                {isAdmin && <AdminMatchSelector />}

                <div>
                    <h3 className="text-xl font-bold mb-3">مباريات اليوم للتوقع</h3>
                    {loading ? (
                         <div className="space-y-4">
                            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
                        </div>
                    ) : selectedMatches.length > 0 ? (
                        <div className="space-y-4">
                            {/* Map through selectedMatches here in a future stage */}
                        </div>
                    ) : (
                        <Card>
                           <CardContent className="p-6 text-center text-muted-foreground">
                                <p>لم يتم اختيار أي مباريات للتوقع لهذا اليوم بعد.</p>
                                <p className="text-xs">سيقوم النظام باختيار مباريات مهمة قريبًا أو يمكن للمدير اختيارها يدويًا.</p>
                           </CardContent>
                        </Card>
                    )}
                </div>

                <div>
                    <h3 className="text-xl font-bold mb-3">لوحة الصدارة العالمية</h3>
                     <Card>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>الترتيب</TableHead>
                                    <TableHead>المستخدم</TableHead>
                                    <TableHead className="text-center">النقاط</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                            <TableCell className="text-center"><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : leaderboard.length > 0 ? (
                                     leaderboard.map((score, index) => (
                                        <TableRow key={score.userId}>
                                            <TableCell>{index + 1}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Avatar className="h-6 w-6">
                                                        <AvatarImage src={score.userPhoto}/>
                                                        <AvatarFallback>{score.userName.charAt(0)}</AvatarFallback>
                                                    </Avatar>
                                                    {score.userName}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center font-bold">{score.totalPoints}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center text-muted-foreground h-24">
                                            لا توجد بيانات لعرضها في لوحة الصدارة بعد.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </Card>
                </div>
            </div>
        </div>
    );
}
