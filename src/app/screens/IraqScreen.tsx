
"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import type { ScreenProps } from "@/app/page";
import { useFirestore, useAuth } from "@/firebase/provider";
import { collection, onSnapshot, doc, query, getDoc } from "firebase/firestore";
import type { PinnedMatch, Team, Favorites, Fixture, Standing, TopScorer, FavoriteTeam, FavoriteLeague } from "@/lib/types";
import { FirestorePermissionError } from "@/firebase/errors";
import { errorEmitter } from "@/firebase/error-emitter";
import { Button } from "@/components/ui/button";
import { Search, Pin, Loader2 } from "lucide-react";
import { SearchSheet } from "@/components/SearchSheet";
import { ProfileButton } from "../AppContentWrapper";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { FixtureItem } from "@/components/FixtureItem";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CURRENT_SEASON } from "@/lib/constants";
import { hardcodedTranslations } from "@/lib/hardcoded-translations";
import { ScreenHeader } from "@/components/ScreenHeader";
import { getLocalFavorites } from "@/lib/local-favorites";

// --- Pinned Match Component ---
function PinnedMatchCard({
  match,
}: {
  match: PinnedMatch;
}) {
  if (!match.isEnabled) return null;

  return (
    <div className="mb-4 border-primary/50 border-2 rounded-lg p-3 relative bg-card">
      <div className="flex items-center justify-center text-center mb-2">
        <Pin className="h-4 w-4 text-primary mr-2" />
        <p className="text-sm font-bold text-primary">مباراة مثبتة</p>
      </div>
      <div className="flex-1 flex items-center justify-between gap-1">
        <div className="flex items-center gap-2 flex-1 justify-end truncate">
          <span className="font-semibold text-sm truncate">
            {match.homeTeamName}
          </span>
          <img
            src={match.homeTeamLogo}
            alt={match.homeTeamName}
            className="h-8 w-8 object-contain"
          />
        </div>
        <div className="flex flex-col items-center justify-center min-w-[90px] text-center">
          <div className="font-bold text-lg">{match.matchTime}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {match.matchDate}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-1 truncate">
          <img
            src={match.awayTeamLogo}
            alt={match.awayTeamName}
            className="h-8 w-8 object-contain"
          />
          <span className="font-semibold text-sm truncate">
            {match.awayTeamName}
          </span>
        </div>
      </div>
      <p className="text-center text-xs text-muted-foreground mt-2">
        {match.competitionName}
      </p>
    </div>
  );
}


// --- Favorite Teams Horizontal Scroll ---
const FavoriteTeamsScroller = ({ teams, navigate }: { teams: FavoriteTeam[], navigate: ScreenProps['navigate']}) => {
    if (!teams || teams.length === 0) {
        return null;
    }

    return (
        <div className="pl-4 pb-4">
            <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex w-max space-x-4 flex-row-reverse">
                    {teams.map((team) => (
                        <div
                            key={team.teamId}
                            onClick={() => navigate('TeamDetails', { teamId: team.teamId })}
                            className="flex flex-col items-center gap-2 w-20 text-center cursor-pointer"
                        >
                            <Avatar className="h-14 w-14 border-2 border-border">
                                <AvatarImage src={team.logo} />
                                <AvatarFallback>{team.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span className="text-xs font-medium truncate w-full">{team.name}</span>
                        </div>
                    ))}
                </div>
                <ScrollBar orientation="horizontal" className="h-1.5 mt-2" />
            </ScrollArea>
        </div>
    );
}

const TeamDetailsLoader = ({ leagueId, db, children }: { leagueId: number, db: any, children: (data: { fixtures: Fixture[], standings: Standing[], topScorers: TopScorer[], leagueDetails: any }) => React.ReactNode }) => {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<{ fixtures: Fixture[], standings: Standing[], topScorers: TopScorer[], leagueDetails: any } | null>(null);

    useEffect(() => {
        let isMounted = true;
        setLoading(true);

        const fetchAllLeagueData = async () => {
             if (!db) {
                setLoading(false);
                return;
            }
            try {
                let leagueDetails = null;
                const managedCompDoc = await getDoc(doc(db, 'managedCompetitions', String(leagueId)));
                if (managedCompDoc.exists()) {
                    const data = managedCompDoc.data();
                    const name = hardcodedTranslations.leagues[leagueId] || data.name;
                    leagueDetails = { id: leagueId, name: name, logo: data.logo };
                } else {
                    const leagueRes = await fetch(`/api/football/leagues?id=${leagueId}`);
                    const leagueApiData = await leagueRes.json();
                     if (leagueApiData.response?.[0]) {
                        const { league } = leagueApiData.response[0];
                         const name = hardcodedTranslations.leagues[leagueId] || league.name;
                        leagueDetails = { id: league.id, name: name, logo: league.logo };
                    }
                }
                
                if (!leagueDetails || !isMounted) {
                    setLoading(false);
                    return;
                }

                const [fixturesRes, standingsRes, scorersRes] = await Promise.all([
                    fetch(`/api/football/fixtures?league=${leagueId}&season=${CURRENT_SEASON}`),
                    fetch(`/api/football/standings?league=${leagueId}&season=${CURRENT_SEASON}`),
                    fetch(`/api/football/players/topscorers?league=${leagueId}&season=${CURRENT_SEASON}`),
                ]);

                if (!isMounted) return;

                const fixturesData = await fixturesRes.json();
                const standingsData = await standingsRes.json();
                const scorersData = await scorersRes.json();
                
                setData({
                    fixtures: fixturesData.response || [],
                    standings: standingsData.response?.[0]?.league?.standings?.[0] || [],
                    topScorers: scorersData.response || [],
                    leagueDetails: leagueDetails,
                });

            } catch (error) {
                console.error("Failed to fetch league data:", error);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchAllLeagueData();
        return () => { isMounted = false; };
    }, [leagueId, db]);

    if (loading) {
        return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary"/></div>;
    }

    if (!data) {
        return null;
    }

    return <>{children(data)}</>;
}

// --- Our League Details Component ---
const OurLeagueDetails = ({ league, db, navigate }: { league: FavoriteLeague | undefined, db: any, navigate: ScreenProps['navigate'] }) => {
    if (!league) {
         return null;
    }

    return (
        <TeamDetailsLoader leagueId={league.leagueId} db={db}>
            {({ fixtures, standings, topScorers, leagueDetails }) => {
                 const sortedFixtures = useMemo(() => {
                    return [...fixtures].sort((a, b) => a.fixture.timestamp - b.fixture.timestamp);
                }, [fixtures]);

                return (
                    <div className="flex flex-col px-4">
                         <div className="flex items-center gap-3 p-3 rounded-lg bg-card border mb-4 cursor-pointer" onClick={() => navigate('CompetitionDetails', { leagueId: leagueDetails.id, title: leagueDetails.name, logo: leagueDetails.logo })}>
                             <Avatar className="h-10 w-10 p-1 border">
                                <AvatarImage src={leagueDetails.logo} className="object-contain" />
                                <AvatarFallback>{leagueDetails.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="font-bold text-lg">{leagueDetails.name}</p>
                                <p className="text-sm text-muted-foreground">دورينا المفضل</p>
                            </div>
                        </div>
                         <Tabs defaultValue="matches" className="w-full">
                            <TabsList className="grid w-full grid-cols-3 rounded-md h-11 p-0 flex-row-reverse bg-card">
                                <TabsTrigger value="scorers">الهدافين</TabsTrigger>
                                <TabsTrigger value="standings">الترتيب</TabsTrigger>
                                <TabsTrigger value="matches">المباريات</TabsTrigger>
                            </TabsList>
                            <TabsContent value="matches" className="mt-4">
                                 <div className="h-full overflow-y-auto space-y-3">
                                    {fixtures.length > 0 ? (
                                        sortedFixtures.map((fixture) => (
                                            <div key={fixture.fixture.id}><FixtureItem fixture={fixture} navigate={navigate} /></div>
                                        ))
                                    ) : (
                                        <p className="pt-8 text-center text-muted-foreground">لا توجد مباريات متاحة لهذا الموسم.</p>
                                    )}
                                </div>
                            </TabsContent>
                            <TabsContent value="standings" className="p-0 mt-4">
                                 {standings.length > 0 ? (
                                    <Table>
                                        <TableHeader><TableRow><TableHead className="text-center">نقاط</TableHead><TableHead className="text-center">لعب</TableHead><TableHead className="w-1/2 text-right">الفريق</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {standings.map((s) => (
                                                <TableRow key={`${s.rank}-${s.team.id}`} className="cursor-pointer" onClick={() => navigate('TeamDetails', { teamId: s.team.id})}>
                                                    <TableCell className="text-center font-bold">{s.points}</TableCell>
                                                    <TableCell className="text-center">{s.all.played}</TableCell>
                                                    <TableCell className="font-medium">
                                                        <div className="flex items-center gap-2 justify-end">
                                                            <span className="truncate">{hardcodedTranslations.teams[s.team.id] || s.team.name}</span>
                                                            <Avatar className="h-6 w-6"><AvatarImage src={s.team.logo} alt={s.team.name} /><AvatarFallback>{s.team.name.substring(0,1)}</AvatarFallback></Avatar>
                                                            <span>{s.rank}</span>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                ): <p className="pt-4 text-center text-muted-foreground">جدول الترتيب غير متاح حاليًا.</p>}
                            </TabsContent>
                             <TabsContent value="scorers" className="p-0 mt-4">
                                 {topScorers.length > 0 ? (
                                    <Table>
                                        <TableHeader><TableRow><TableHead className="text-center">الأهداف</TableHead><TableHead className="flex-1 text-right">اللاعب</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {topScorers.map((scorer, index) => {
                                                const playerData = scorer.player;
                                                const teamName = scorer.statistics[0].team.name;
                                                const goals = scorer.statistics[0]?.goals.total || 0;
                                            return (
                                                <TableRow key={playerData.id}>
                                                    <TableCell className="text-center font-bold text-lg">{goals}</TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-3 justify-end">
                                                            <div>
                                                                <p className="font-semibold">{hardcodedTranslations.players[playerData.id] || playerData.name}</p>
                                                                <p className="text-xs text-muted-foreground text-right">{hardcodedTranslations.teams[scorer.statistics?.[0].team.id] || teamName}</p>
                                                            </div>
                                                            <Avatar className="h-8 w-8"><AvatarImage src={playerData.photo} /><AvatarFallback>{playerData.name?.charAt(0)}</AvatarFallback></Avatar>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )})}
                                        </TableBody>
                                    </Table>
                                ) : <p className="pt-4 text-center text-muted-foreground">قائمة الهدافين غير متاحة حاليًا.</p>}
                            </TabsContent>
                        </Tabs>
                    </div>
                );
            }}
        </TeamDetailsLoader>
    );
};


// --- Main Screen ---
export function IraqScreen({ navigate, goBack, canGoBack }: ScreenProps) {
  const { user, db } = useAuth();
  const [favorites, setFavorites] = useState<Partial<Favorites>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [pinnedMatches, setPinnedMatches] = useState<PinnedMatch[]>([]);

  useEffect(() => {
    if (!db) {
        setIsLoading(false);
        return;
    }

    const pinnedMatchesRef = collection(db, "pinnedIraqiMatches");
    const q = query(pinnedMatchesRef);
    const unsubPinned = onSnapshot(q, (snapshot) => {
        const matches = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as PinnedMatch));
        setPinnedMatches(matches);
    }, (serverError) => {
        errorEmitter.emit("permission-error", new FirestorePermissionError({ path: "pinnedIraqiMatches", operation: "list" }));
    });

    let unsubFavs = () => {};
    if (user) {
        setIsLoading(true);
        const favsRef = doc(db, "users", user.uid, "favorites", "data");
        unsubFavs = onSnapshot(favsRef, (docSnap) => {
            setFavorites(docSnap.exists() ? (docSnap.data() as Favorites) : {});
            setIsLoading(false);
        }, (error) => {
            errorEmitter.emit("permission-error", new FirestorePermissionError({ path: favsRef.path, operation: "get" }));
            setFavorites({});
            setIsLoading(false);
        });
    } else {
        setFavorites({});
        setIsLoading(false);
    }
    
    return () => {
        unsubPinned();
        unsubFavs();
    };

  }, [user, db]);

  const ourBallTeams = useMemo(() => {
    if (!favorites.teams) return [];
    return Object.values(favorites.teams).filter(t => t.isHearted);
  }, [favorites.teams]);

  const ourLeague = useMemo(() => {
    if (!favorites.leagues) return undefined;
    return Object.values(favorites.leagues).find(l => l.isHearted);
  }, [favorites.leagues]);

  const hasHeartFavorites = ourBallTeams.length > 0 || !!ourLeague;

  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader
        title={"بلدي"}
        onBack={goBack}
        canGoBack={canGoBack}
        actions={
          <div className="flex items-center gap-1">
            <SearchSheet navigate={navigate}><Button variant="ghost" size="icon" className="h-7 w-7"><Search className="h-5 w-5" /></Button></SearchSheet>
            <ProfileButton />
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 pt-4">
            {pinnedMatches.map((match) => (
                <PinnedMatchCard key={match.id} match={match} />
            ))}
        </div>
        
        {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : !user ? (
             <div className="px-4 pt-4">
                 <div className="flex flex-col items-center justify-center text-center text-muted-foreground border-2 border-dashed rounded-lg p-6">
                    <p className="font-bold">محتوى حصري للمستخدمين</p>
                    <p className="text-sm">قم بتسجيل الدخول لحفظ فرقك ودوريك المفضل وعرضها هنا.</p>
                    <Button className="mt-4" size="sm" onClick={() => navigate('Login')}>تسجيل الدخول</Button>
                </div>
            </div>
        ) : (
            <div className="space-y-6">
                <FavoriteTeamsScroller teams={ourBallTeams} navigate={navigate} />
                <OurLeagueDetails league={ourLeague} db={db} navigate={navigate} />
                 {!hasHeartFavorites && (
                     <div className="px-4">
                        <div className="flex flex-col items-center justify-center text-center text-muted-foreground border-2 border-dashed rounded-lg p-6">
                            <p className="font-bold">قسم "بلدي" فارغ</p>
                            <p className="text-sm">أضف فرقك ودوريك المفضل بالضغط على زر القلب ❤️.</p>
                            <Button className="mt-4" size="sm" onClick={() => navigate('AllCompetitions')}>استكشاف</Button>
                        </div>
                    </div>
                )}
            </div>
        )}
      </div>
    </div>
  );
}
