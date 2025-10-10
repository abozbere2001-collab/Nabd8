

"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ScreenProps } from '@/app/page';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { collection, getDocs, doc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { useFirestore, useAdmin } from '@/firebase/provider';
import type { Fixture, Standing, AdminFavorite, ManualTopScorer } from '@/lib/types';
import { CommentsButton } from '@/components/CommentsButton';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { Button } from '@/components/ui/button';
import { Users, Search } from 'lucide-react';
import { SearchSheet } from '@/components/SearchSheet';
import { ProfileButton } from '../AppContentWrapper';


const IRAQI_LEAGUE_ID = 542;
const CURRENT_SEASON = 2025;


const LiveMatchStatus = ({ fixture }: { fixture: Fixture }) => {
    const { status, date } = fixture.fixture;

    const isLive = ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE'].includes(status.short);
    const isFinished = ['FT', 'AET', 'PEN'].includes(status.short);

    if (isLive) {
        return (
            <>
                <div className="text-red-500 font-bold text-xs animate-pulse mb-1">
                    {status.elapsed ? `${status.elapsed}'` : status.long}
                </div>
                <div className="font-bold text-lg">{`${fixture.goals.home ?? 0} - ${fixture.goals.away ?? 0}`}</div>
                <div className="text-xs text-muted-foreground mt-1">{status.short === 'HT' ? 'استراحة' : 'مباشر'}</div>
            </>
        );
    }
    
    if (isFinished) {
         return (
            <>
                <div className="font-bold text-lg">{`${fixture.goals.home ?? 0} - ${fixture.goals.away ?? 0}`}</div>
                <div className="text-xs text-muted-foreground mt-1">انتهت</div>
            </>
        );
    }

    return (
        <>
            <div className="font-bold text-lg">{format(new Date(date), "HH:mm")}</div>
            <div className="text-xs text-muted-foreground mt-1">{status.long}</div>
        </>
    );
};


const FixtureItem = React.memo(({ fixture, navigate }: { fixture: Fixture, navigate: ScreenProps['navigate'] }) => {
    return (
      <div 
        key={fixture.fixture.id} 
        className="rounded-lg bg-card border p-3 text-sm transition-all duration-300"
      >
        <div 
          className="hover:bg-accent/50 cursor-pointer -m-3 p-3"
          onClick={() => navigate('MatchDetails', { fixtureId: fixture.fixture.id, fixture })}
        >
         <div className="flex justify-between items-center text-xs text-muted-foreground mb-2">
              <div className="flex items-center gap-2">
                  <Avatar className="h-4 w-4">
                      <AvatarImage src={fixture.league.logo} alt={fixture.league.name} />
                      <AvatarFallback>{fixture.league.name.substring(0,1)}</AvatarFallback>
                  </Avatar>
                  <span className="truncate">{fixture.league.name}</span>
              </div>
         </div>
         <div className="flex items-center justify-between gap-2">
             <div className="flex items-center gap-2 flex-1 justify-end truncate">
                 <span className="font-semibold truncate">{fixture.teams.home.name}</span>
                 <Avatar className="h-8 w-8">
                     <AvatarImage src={fixture.teams.home.logo} alt={fixture.teams.home.name} />
                     <AvatarFallback>{fixture.teams.home.name.substring(0, 2)}</AvatarFallback>
                 </Avatar>
             </div>
              <div className="flex flex-col items-center justify-center min-w-[80px] text-center">
                 <LiveMatchStatus fixture={fixture} />
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
         <div className="mt-2 pt-2 border-t border-border/50">
            <CommentsButton matchId={fixture.fixture.id} navigate={navigate} />
         </div>
      </div>
    );
});
FixtureItem.displayName = 'FixtureItem';


function OurLeagueTab({ navigate }: { navigate: ScreenProps['navigate'] }) {
    const [loading, setLoading] = useState(true);
    const [fixtures, setFixtures] = useState<Fixture[]>([]);
    const [standings, setStandings] = useState<Standing[]>([]);
    const [topScorers, setTopScorers] = useState<ManualTopScorer[]>([]);
    const { isAdmin } = useAdmin();
    const { db } = useFirestore();

    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            try {
                const [fixturesRes, standingsRes] = await Promise.all([
                    fetch(`/api/football/fixtures?league=${IRAQI_LEAGUE_ID}&season=${CURRENT_SEASON}`),
                    fetch(`/api/football/standings?league=${IRAQI_LEAGUE_ID}&season=${CURRENT_SEASON}`),
                ]);

                const fixturesData = await fixturesRes.json();
                const standingsData = await standingsRes.json();
                
                if (fixturesData.response) setFixtures(fixturesData.response);
                if (standingsData.response[0]?.league?.standings[0]) setStandings(standingsData.response[0].league.standings[0]);

            } catch (error) {
                console.error("Failed to fetch Iraqi league details:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchData();

        if (db) {
            const scorersRef = collection(db, 'iraqiLeagueTopScorers');
            const q = query(scorersRef, orderBy('rank', 'asc'));
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const fetchedScorers = snapshot.docs.map(doc => doc.data() as ManualTopScorer);
                setTopScorers(fetchedScorers);
            }, (error) => {
                const permissionError = new FirestorePermissionError({ path: 'iraqiLeagueTopScorers', operation: 'list' });
                errorEmitter.emit('permission-error', permissionError);
            });
             return () => unsubscribe();
        }
    }, [db]);

    return (
        <Tabs defaultValue="matches" className="w-full">
            <div className="sticky top-0 bg-background z-10 border-b -mx-4 px-4">
                <TabsList className="grid w-full grid-cols-3 rounded-none h-auto p-0 border-t flex-row-reverse">
                    <TabsTrigger value="scorers" className='rounded-none data-[state=active]:rounded-md'>الهدافين</TabsTrigger>
                    <TabsTrigger value="standings" className='rounded-none data-[state=active]:rounded-md'>الترتيب</TabsTrigger>
                    <TabsTrigger value="matches" className='rounded-none data-[state=active]:rounded-md'>المباريات</TabsTrigger>
                </TabsList>
            </div>
            <TabsContent value="matches" className="p-4 mt-0 -mx-4">
             {loading ? (
                <div className="space-y-4">
                    {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
                </div>
            ) : fixtures.length > 0 ? (
                <div className="space-y-3">
                    {fixtures.map((fixture) => (
                        <FixtureItem key={fixture.fixture.id} fixture={fixture} navigate={navigate} />
                    ))}
                </div>
            ) : <p className="pt-4 text-center text-muted-foreground">لا توجد مباريات متاحة لهذا الموسم.</p>}
          </TabsContent>
          <TabsContent value="standings" className="p-0 mt-0 -mx-4">
            {loading ? (
                 <div className="space-y-px p-4">
                    {Array.from({ length: 18 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
            ) : standings.length > 0 ? (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-1/2 text-right">الفريق</TableHead>
                            <TableHead className="text-center">لعب</TableHead>
                            <TableHead className="text-center">ف</TableHead>
                            <TableHead className="text-center">ت</TableHead>
                            <TableHead className="text-center">خ</TableHead>
                            <TableHead className="text-center">نقاط</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {standings.map((s) => (
                            <TableRow key={`${s.rank}-${s.team.id}`} className="cursor-pointer" onClick={() => navigate('TeamDetails', { teamId: s.team.id })}>
                                <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                        <span>{s.rank}</span>
                                        <Avatar className="h-6 w-6">
                                            <AvatarImage src={s.team.logo} alt={s.team.name} />
                                            <AvatarFallback>{s.team.name.substring(0,1)}</AvatarFallback>
                                        </Avatar>
                                        <span className="truncate">{s.team.name}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-center">{s.all.played}</TableCell>
                                <TableCell className="text-center">{s.all.win}</TableCell>
                                <TableCell className="text-center">{s.all.draw}</TableCell>
                                <TableCell className="text-center">{s.all.lose}</TableCell>
                                <TableCell className="text-center font-bold">{s.points}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            ): <p className="pt-4 text-center text-muted-foreground">جدول الترتيب غير متاح حاليًا.</p>}
          </TabsContent>
           <TabsContent value="scorers" className="p-0 mt-0 -mx-4">
            {isAdmin && (
                <div className="p-4">
                    <Button className="w-full" onClick={() => navigate('ManageTopScorers')}>
                        <Users className="ml-2 h-4 w-4" />
                        إدارة الهدافين
                    </Button>
                </div>
            )}
            {loading ? (
                <div className="space-y-px p-4">
                    {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
            ) : topScorers.length > 0 ? (
                <Table>
                    <TableHeader>
                        <TableRow>
                             <TableHead className="text-right">اللاعب</TableHead>
                             <TableHead className="text-right">الفريق</TableHead>
                            <TableHead className="text-center">الأهداف</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {topScorers.map((scorer) => (
                            <TableRow key={scorer.rank}>
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={scorer.playerPhoto} />
                                            <AvatarFallback>{scorer.playerName.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <p className="font-semibold">{scorer.playerName}</p>
                                    </div>
                                </TableCell>
                                <TableCell>
                                     <p className="text-xs text-muted-foreground text-right">{scorer.teamName}</p>
                                </TableCell>
                                <TableCell className="text-center font-bold text-lg">{scorer.goals}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            ) : <p className="pt-4 text-center text-muted-foreground">قائمة الهدافين غير متاحة حاليًا.</p>}
          </TabsContent>
        </Tabs>
    );
}

function OurBallTab({ navigate }: { navigate: ScreenProps['navigate'] }) {
    const [teams, setTeams] = useState<AdminFavorite[]>([]);
    const [loading, setLoading] = useState(true);
    const { db } = useFirestore();

    useEffect(() => {
        if (!db) return;
        const fetchAdminFavorites = async () => {
            setLoading(true);
            const favsRef = collection(db, 'adminFavorites');
            try {
                const snapshot = await getDocs(favsRef);
                const fetchedTeams: AdminFavorite[] = [];
                snapshot.forEach((doc) => {
                    fetchedTeams.push(doc.data() as AdminFavorite);
                });
                setTeams(fetchedTeams);
            } catch (error) {
                const permissionError = new FirestorePermissionError({ path: favsRef.path, operation: 'list' });
                errorEmitter.emit('permission-error', permissionError);
            } finally {
                setLoading(false);
            }
        };
        fetchAdminFavorites();
    }, [db]);

    if (loading) {
        return (
             <div className="space-y-4 pt-4">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
        )
    }

    if (teams.length === 0) {
        return <p className="pt-4 text-center text-muted-foreground">لم يتم إضافة فرق خاصة من قبل المدير بعد.</p>
    }

    return (
        <div className="space-y-3 pt-4">
            {teams.map(team => (
                <div key={team.teamId} onClick={() => navigate('AdminFavoriteTeamDetails', { teamId: team.teamId, teamName: team.name })} className="p-3 rounded-lg border bg-card cursor-pointer">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                            <AvatarImage src={team.logo} alt={team.name} />
                            <AvatarFallback>{team.name.substring(0, 2)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="font-bold">{team.name}</p>
                            <p className="text-xs text-muted-foreground">{team.note}</p>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

export function IraqScreen({ navigate, goBack, canGoBack, ...props }: ScreenProps) {
  
  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader 
        title="العراق" 
        onBack={goBack} 
        canGoBack={canGoBack} 
        actions={
          <div className="flex items-center gap-1">
              <SearchSheet navigate={navigate}>
                  <Button variant="ghost" size="icon">
                      <Search className="h-5 w-5" />
                  </Button>
              </SearchSheet>
              <ProfileButton onProfileClick={() => navigate('Profile')} />
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto px-4">
        <Tabs defaultValue="our-league" className="w-full">
          <div className="sticky top-0 bg-background z-10">
            <TabsList className="grid w-full grid-cols-2 flex-row-reverse">
              <TabsTrigger value="our-ball">كرتنا</TabsTrigger>
              <TabsTrigger value="our-league">دورينا</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="our-league" className="pt-0">
            <OurLeagueTab navigate={navigate} />
          </TabsContent>
          <TabsContent value="our-ball" className="pt-0">
             <OurBallTab navigate={navigate} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

    