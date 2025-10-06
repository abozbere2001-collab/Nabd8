
"use client";

import React, { useEffect, useState } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ChevronLeft, Star } from 'lucide-react';
import type { ScreenProps } from '@/app/page';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface Competition {
  league: {
    id: number;
    name: string;
    logo: string;
  };
  country: {
    name: string;
    flag: string | null;
  };
}

interface GroupedCompetitions {
  [country: string]: {
    flag: string | null;
    leagues: Competition[];
  };
}

export function CompetitionsScreen({ navigate, goBack, canGoBack }: ScreenProps) {
  const [competitions, setCompetitions] = useState<GroupedCompetitions | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCompetitions() {
      try {
        setLoading(true);
        const response = await fetch('/api/football/leagues');
        if (!response.ok) {
            const errorBody = await response.text();
            console.error('Failed to fetch competitions:', errorBody);
            throw new Error(`Failed to fetch competitions. Status: ${response.status}`);
        }
        const data = await response.json();
        
        if (data.errors && Object.keys(data.errors).length > 0) {
            console.error("API Errors:", data.errors);
            throw new Error("API returned errors. Check your API key or request parameters.");
        }
        
        const grouped = (data.response as Competition[]).reduce((acc: GroupedCompetitions, competition) => {
            const countryName = competition.country.name || "World";
            if (!acc[countryName]) {
                acc[countryName] = { flag: competition.country.flag, leagues: [] };
            }
            acc[countryName].leagues.push(competition);
            return acc;
        }, {});

        // Sort countries
        const sortedCountries = Object.keys(grouped).sort((a, b) => a.localeCompare(b));
        
        const sortedGrouped: GroupedCompetitions = {};
        for (const country of sortedCountries) {
            // Sort leagues within each country
            const sortedLeagues = grouped[country].leagues.sort((a, b) => a.league.name.localeCompare(b.league.name));
            sortedGrouped[country] = { ...grouped[country], leagues: sortedLeagues };
        }

        setCompetitions(sortedGrouped);

      } catch (error) {
        console.error("Error fetching competitions:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchCompetitions();
  }, []);

  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader title="البطولات" onBack={goBack} canGoBack={canGoBack} />
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="rounded-lg border bg-card p-4">
                <Skeleton className="h-6 w-1/3" />
              </div>
            ))}
          </div>
        ) : competitions ? (
          <Accordion type="multiple" className="w-full space-y-4">
            {Object.entries(competitions).map(([country, { flag, leagues }]) => (
              <AccordionItem value={country} key={country} className="rounded-lg border bg-card">
                <AccordionTrigger className="px-4 text-base font-bold">
                  <div className="flex items-center gap-3">
                    {flag && <img src={flag} alt={country} className="h-5 w-7 object-contain" />}
                    <span>{country}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-1">
                  <ul className="flex flex-col">
                    {leagues.map(comp => (
                      <li key={comp.league.id}>
                        <button 
                          onClick={() => navigate('CompetitionDetails', { title: comp.league.name, leagueId: comp.league.id })}
                          className="flex w-full items-center justify-between p-3 text-right hover:bg-accent transition-colors rounded-md"
                        >
                          <div className="flex items-center gap-3">
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Star className="h-5 w-5 text-muted-foreground/50" />
                            </Button>
                            <img src={comp.league.logo} alt={comp.league.name} className="h-6 w-6 object-contain" />
                            <span className="text-sm">{comp.league.name}</span>
                          </div>
                          <ChevronLeft className="h-5 w-5 text-muted-foreground" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        ) : (
          <div className="text-center text-muted-foreground py-10">فشل في تحميل البطولات. يرجى التحقق من مفتاح API أو المحاولة مرة أخرى لاحقًا.</div>
        )}
      </div>
    </div>
  );
}
