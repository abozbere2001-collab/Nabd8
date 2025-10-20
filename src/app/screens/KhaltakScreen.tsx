
"use client";

import React, { useEffect, useState, useMemo } from 'react';
import type { ScreenProps } from '@/app/page';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProfileButton } from '../AppContentWrapper';
import { Button } from '@/components/ui/button';
import { Crown, Search, X } from 'lucide-react';
import { SearchSheet } from '@/components/SearchSheet';
import { useAuth, useFirestore } from '@/firebase/provider';
import type { CrownedTeam, Favorites } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { collection, onSnapshot, doc, updateDoc, deleteField } from 'firebase/firestore';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';

const CrownedTeamScroller = ({
  crownedTeams,
  navigate,
  onRemove,
}: {
  crownedTeams: CrownedTeam[];
  navigate: ScreenProps['navigate'];
  onRemove: (teamId: number) => void;
}) => {
  if (crownedTeams.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-4">
        <p>لم تتوج أي فريق بعد. اضغط على التاج 👑 بجانب أي فريق لتبدأ!</p>
      </div>
    );
  }

  return (
    <ScrollArea className="w-full whitespace-nowrap">
      <div className="flex w-max space-x-4 px-4 flex-row-reverse">
        {crownedTeams.map(team => (
          <div
            key={team.teamId}
            className="relative flex flex-col items-center gap-2 w-24 text-center cursor-pointer group"
            onClick={() => navigate('TeamDetails', { teamId: team.teamId })}
          >
            <Avatar className="h-16 w-16 border-2 border-yellow-400">
              <AvatarImage src={team.logo} />
              <AvatarFallback>{team.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <span className="text-xs font-medium truncate w-full">{team.name}</span>
            <p className="text-[10px] text-muted-foreground truncate w-full h-8">{team.note}</p>
            <button 
              onClick={(e) => { e.stopPropagation(); onRemove(team.teamId); }}
              className="absolute top-0 left-0 h-6 w-6 bg-background/80 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="h-4 w-4 text-destructive"/>
            </button>
          </div>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
};


export function KhaltakScreen({ navigate, goBack, canGoBack }: ScreenProps) {
  const { user } = useAuth();
  const { db } = useFirestore();
  const [favorites, setFavorites] = useState<Partial<Favorites>>({});

  useEffect(() => {
    if (!user || !db) return;
    const favRef = doc(db, 'users', user.uid, 'favorites', 'data');
    const unsubscribe = onSnapshot(favRef, 
      (doc) => {
        setFavorites(doc.exists() ? doc.data() as Favorites : {});
      },
      (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: favRef.path, operation: 'get' }));
      }
    );
    return () => unsubscribe();
  }, [user, db]);

  const crownedTeams = useMemo(() => {
    if (!favorites.crownedTeams) return [];
    return Object.values(favorites.crownedTeams);
  }, [favorites.crownedTeams]);

  const handleRemoveCrownedTeam = (teamId: number) => {
    if (!user || !db) return;
    const favRef = doc(db, 'users', user.uid, 'favorites', 'data');
    const fieldPath = `crownedTeams.${teamId}`;
    updateDoc(favRef, { [fieldPath]: deleteField() })
      .catch(err => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: favRef.path, operation: 'update', requestResourceData: { [fieldPath]: 'DELETED' } }));
      });
  };
  
  if (!user) {
    return (
       <div className="flex h-full flex-col bg-background">
          <ScreenHeader title="خالتك" onBack={goBack} canGoBack={canGoBack} />
           <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <Crown className="h-16 w-16 text-muted-foreground mb-4"/>
              <h2 className="text-xl font-bold">ميزة حصرية للمستخدمين المسجلين</h2>
              <p className="text-muted-foreground mb-6">
                قم بتسجيل الدخول لتتويج فرقك المفضلة وحفظ ملاحظاتك الخاصة.
              </p>
              <Button onClick={() => navigate('Login')}>تسجيل الدخول</Button>
           </div>
       </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader
        title="خالتك"
        onBack={goBack}
        canGoBack={canGoBack}
        actions={
          <div className="flex items-center gap-1">
              <SearchSheet navigate={navigate}>
                  <Button variant="ghost" size="icon">
                      <Search className="h-5 w-5" />
                  </Button>
              </SearchSheet>
              <ProfileButton />
          </div>
        }
      />
      <div className="py-4">
        <CrownedTeamScroller crownedTeams={crownedTeams} navigate={navigate} onRemove={handleRemoveCrownedTeam} />
      </div>
      <div className="flex-1 overflow-y-auto p-4 flex items-center justify-center">
        <Card>
          <CardContent className="p-10">
            <p className="text-center text-muted-foreground">محتوى شاشة "خالتك" الرئيسي سيظهر هنا.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
