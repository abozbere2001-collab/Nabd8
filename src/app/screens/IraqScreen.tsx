"use client";

import React, { useEffect, useState, useMemo } from "react";
import type { ScreenProps } from "@/app/page";
import { useFirestore, useAdmin, useAuth } from "@/firebase/provider";
import { collection, onSnapshot, doc, query, getDoc } from "firebase/firestore";
import type { PinnedMatch, Team, Favorites, Fixture, Standing, TopScorer } from "@/lib/types";
import { FirestorePermissionError } from "@/firebase/errors";
import { errorEmitter } from "@/firebase/error-emitter";
import { Button } from "@/components/ui/button";
import { Search, Pin, Edit, Loader2 } from "lucide-react";
import { SearchSheet } from "@/components/SearchSheet";
import { ProfileButton } from "../AppContentWrapper";
import { getLocalFavorites } from "@/lib/local-favorites";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { FixtureItem } from "@/components/FixtureItem";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CURRENT_SEASON } from "@/lib/constants";
import { hardcodedTranslations } from "@/lib/hardcoded-translations";
import { ScreenHeader } from "@/components/ScreenHeader";

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
const FavoriteTeamsScroller = ({ teams, navigate }: { teams: (Team & {note?: string})[], navigate: ScreenProps['navigate']}) => {
    if (teams.length === 0) {
        return (
             <div className="px-4 pb-4">
                 <div className="flex flex-col items-center justify-center text-center text-muted-foreground border-2 border-dashed rounded-lg p-6">
                    <p className="font-bold">قسم "بلدي" فارغ</p>
                    <p className="text-sm">أضف فرقك ومنتخباتك المفضلة هنا بالضغط على زر القلب ❤️.</p>
                    <Button className="mt-4" size="sm" onClick={() => navigate('AllCompetitions')}>استكشاف الفرق</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="pl-4 pb-4">
            <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex w-max space-x-4 flex-row-reverse">
                    {teams.map((team) => (
                        <div
                            key={team.id}
                            onClick={() => navigate('TeamDetails', { teamId: team.id })}
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

// --- Our League Details Component ---
const OurLeagueDetails = ({ leagueId, navigate }: { leagueId: number | undefined, navigate: ScreenProps['navigate'] }) => {
    const { db } = useFirestore();
    const [loadingData, setLoadingData] = useState(true);
    const [fixtures, setFixtures] = useState<Fixture[]>([]);
    const [standings, setStandings] = useState<Standing[]>([]);
    const [topScorers, setTopScorers] = useState<TopScorer[]>([]);
    const [leagueDetails, setLeagueDetails] = useState<{ id: number; name: string; logo: string; } | null>(null);

    const sortedFixtures = useMemo(() => {
        return [...fixtures].sort((a, b) => a.fixture.timestamp - b.fixture.timestamp);
    }, [fixtures]);

    useEffect(() => {
        if (!leagueId) {
            setLoadingData(false);
            return;
        }

        let isMounted = true;
        setLoadingData(true);

        const fetchAllLeagueData = async () => {
            if (!db) {
                setLoadingData(false);
                return;
            }
            try {
                // Get managed competition details first
                const managedCompDoc = await getDoc(doc(db, 'managedCompetitions', String(leagueId)));
                if (!isMounted) return;

                if (managedCompDoc.exists()) {
                    const data = managedCompDoc.data();
                    setLeagueDetails({ id: leagueId, name: data.name, logo: data.logo });
                } else {
                    // Fallback to API if not in managed list
                    const leagueRes = await fetch(`/api/football/leagues?id=${leagueId}`);
                    const leagueApiData = await leagueRes.json();
                     if (isMounted && leagueApiData.response?.[0]) {
                        const { league } = leagueApiData.response[0];
                        setLeagueDetails({ id: league.id, name: league.name, logo: league.logo });
                    } else {
                        setLeagueDetails(null);
                        setLoadingData(false);
                        return;
                    }
                }
                
                // Fetch fixtures, standings, scorers
                const [fixturesRes, standingsRes, scorersRes] = await Promise.all([
                    fetch(`/api/football/fixtures?league=${leagueId}&season=${CURRENT_SEASON}`),
                    fetch(`/api/football/standings?league=${leagueId}&season=${CURRENT_SEASON}`),
                    fetch(`/api/football/players/topscorers?league=${leagueId}&season=${CURRENT_SEASON}`),
                ]);

                if (!isMounted) return;

                const fixturesData = await fixturesRes.json();
                const standingsData = await standingsRes.json();
                const scorersData = await scorersRes.json();
                
                setFixtures(fixturesData.response || []);
                setStandings(standingsData.response?.[0]?.league?.standings?.[0] || []);
                setTopScorers(scorersData.response || []);
            } catch (error) {
                console.error("Failed to fetch league data:", error);
            } finally {
                if (isMounted) setLoadingData(false);
            }
        };

        fetchAllLeagueData();
        return () => { isMounted = false; };
    }, [leagueId, db]);


    if (loadingData) {
        return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary"/></div>;
    }

    if (!leagueDetails) {
        return (
             <div className="px-4">
                <div className="flex flex-col items-center justify-center text-center text-muted-foreground border-2 border-dashed rounded-lg p-6">
                    <p className="font-bold">اختر دوريك المفضل</p>
                    <p className="text-sm">اذهب إلى "كل البطولات" واضغط على زر القلب ❤️ بجانب دوريك المفضل ليظهر هنا.</p>
                    <Button className="mt-4" size="sm" onClick={() => navigate('AllCompetitions')}>استكشاف البطولات</Button>
                </div>
            </div>
        );
    }
    
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
};


// --- Main Screen ---
export function IraqScreen({ navigate, goBack, canGoBack }: ScreenProps) {
  const { user, db } = useAuth();
  const { isAdmin } = useAdmin();
  const [favorites, setFavorites] = useState<Partial<Favorites>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [pinnedMatches, setPinnedMatches] = useState<PinnedMatch[]>([]);

  useEffect(() => {
    setIsLoading(true);
    const unsubscribes: (() => void)[] = [];

    const setupListeners = async () => {
        if (db) {
            // Pinned Matches Listener
            const pinnedMatchesRef = collection(db, "pinnedIraqiMatches");
            const q = query(pinnedMatchesRef);
            const unsubPinned = onSnapshot(q, (snapshot) => {
                const matches = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as PinnedMatch));
                setPinnedMatches(matches);
            }, (serverError) => {
                errorEmitter.emit("permission-error", new FirestorePermissionError({ path: "pinnedIraqiMatches", operation: "list" }));
            });
            unsubscribes.push(unsubPinned);

            // Favorites Listener
            if (user) {
                const favsRef = doc(db, "users", user.uid, "favorites", "data");
                const unsubFavs = onSnapshot(favsRef, (docSnap) => {
                    setFavorites(docSnap.exists() ? (docSnap.data() as Favorites) : {});
                    setIsLoading(false);
                }, (error) => {
                    errorEmitter.emit("permission-error", new FirestorePermissionError({ path: favsRef.path, operation: "get" }));
                    setFavorites({});
                    setIsLoading(false);
                });
                unsubscribes.push(unsubFavs);
            } else {
                 setFavorites(getLocalFavorites());
                 setIsLoading(false);
            }
        } else {
            setFavorites(getLocalFavorites());
            setIsLoading(false);
        }
    };
    
    setupListeners();

    return () => unsubscribes.forEach(unsub => unsub());

  }, [user, db]);

  const ourBallTeams = useMemo(() => Object.values(favorites?.ourBallTeams ?? {}), [favorites]);
  const ourLeagueId = favorites?.ourLeagueId;

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
        ) : (
            <div className="space-y-6">
                <FavoriteTeamsScroller teams={ourBallTeams} navigate={navigate} />
                <OurLeagueDetails leagueId={ourLeagueId} navigate={navigate} />
            </div>
        )}
      </div>
    </div>
  );
}

    