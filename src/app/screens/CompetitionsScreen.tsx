
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

interface LeaguesByCountry {
    [country: string]: {
        flag: string | null;
        leagues: Competition[];
    };
}

interface GroupedCompetitions {
  [continent: string]: LeaguesByCountry | { leagues: Competition[] };
}

const countryToContinent: { [key: string]: string } = {
    "World": "World",
    // Europe
    "England": "Europe", "Spain": "Europe", "Germany": "Europe", "Italy": "Europe", "France": "Europe",
    "Netherlands": "Europe", "Portugal": "Europe", "Belgium": "Europe", "Russia": "Europe", "Turkey": "Europe",
    "Greece": "Europe", "Switzerland": "Europe", "Austria": "Europe", "Denmark": "Europe", "Scotland": "Europe",
    "Sweden": "Europe", "Norway": "Europe", "Poland": "Europe", "Ukraine": "Europe", "Czech-Republic": "Europe",
    "Croatia": "Europe", "Romania": "Europe", "Serbia": "Europe", "Hungary": "Europe", "Finland": "Europe",
    "Ireland": "Europe", "Northern-Ireland": "Europe", "Wales": "Europe", "Iceland": "Europe", "Albania": "Europe",
    "Georgia": "Europe", "Latvia": "Europe", "Estonia": "Europe", "Lithuania": "Europe", "Luxembourg": "Europe",
    "Faroe-Islands": "Europe", "Malta": "Europe", "Andorra": "Europe", "San-Marino": "Europe", "Gibraltar": "Europe", "Kosovo": "Europe",
    "Bosnia-and-Herzegovina": "Europe", "Slovakia": "Europe", "Slovenia": "Europe", "Bulgaria": "Europe", "Cyprus": "Europe", "Azerbaijan": "Europe",
    "Armenia": "Europe", "Belarus": "Europe", "Moldova": "Europe", "North-Macedonia": "Europe", "Montenegro": "Europe",
    // Asia
    "Saudi-Arabia": "Asia", "Japan": "Asia", "South-Korea": "Asia", "China": "Asia", "Qatar": "Asia",
    "UAE": "Asia", "Iran": "Asia", "Iraq": "Asia", "Uzbekistan": "Asia", "Australia": "Asia", // Australia is in AFC
    "Jordan": "Asia", "Syria": "Asia", "Lebanon": "Asia", "Oman": "Asia", "Kuwait": "Asia", "Bahrain": "Asia",
    "India": "Asia", "Thailand": "Asia", "Vietnam": "Asia", "Malaysia": "Asia", "Indonesia": "Asia", "Singapore": "Asia",
    "Philippines": "Asia", "Hong-Kong": "Asia", "Palestine": "Asia", "Tajikistan": "Asia", "Turkmenistan": "Asia",
    "Kyrgyzstan": "Asia", "Bangladesh": "Asia", "Maldives": "Asia", "Cambodia": "Asia", "Myanmar": "Asia",
    // Africa
    "Egypt": "Africa", "Morocco": "Africa", "Tunisia": "Africa", "Algeria": "Africa", "Nigeria": "Africa",
    "Senegal": "Africa", "Ghana": "Africa", "Ivory-Coast": "Africa", "Cameroon": "Africa", "South-Africa": "Africa",
    "DR-Congo": "Africa", "Mali": "Africa", "Burkina-Faso": "Africa", "Guinea": "Africa", "Zambia": "Africa",
    "Cape-Verde": "Africa", "Uganda": "Africa", "Kenya": "Africa", "Tanzania": "Africa", "Sudan": "Africa",
    "Libya": "Africa", "Angola": "Africa", "Zimbabwe": "Africa", "Ethiopia": "Africa",
    // North America
    "USA": "North America", "Mexico": "North America", "Canada": "North America", "Costa-Rica": "North America",
    "Honduras": "North America", "Panama": "North America", "Jamaica": "North America", "El-Salvador": "North America",
    "Trinidad-and-Tobago": "North America", "Guatemala": "North America", "Nicaragua": "North America", "Cuba": "North America",
    // South America
    "Brazil": "South America", "Argentina": "South America", "Colombia": "South America", "Chile": "South America",
    "Uruguay": "South America", "Peru": "South America", "Ecuador": "South America", "Paraguay": "South America",
    "Venezuela": "South America", "Bolivia": "South America",
    // Oceania
    "New-Zealand": "Oceania", "Fiji": "Oceania"
};

const continentOrder = ["World", "Europe", "Asia", "Africa", "South America", "North America", "Oceania"];

export function CompetitionsScreen({ navigate, goBack, canGoBack }: ScreenProps) {
  const [competitions, setCompetitions] = useState<GroupedCompetitions | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("CompetitionsScreen: init");
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
        
        const groupedByContinent: GroupedCompetitions = {};

        (data.response as Competition[]).forEach(comp => {
            const countryName = comp.country.name;
            const continent = countryToContinent[countryName] || "Other";

            if (continent === "World") {
                if (!groupedByContinent.World) {
                    groupedByContinent.World = { leagues: [] };
                }
                (groupedByContinent.World as { leagues: Competition[] }).leagues.push(comp);
            } else {
                if (!groupedByContinent[continent]) {
                    groupedByContinent[continent] = {};
                }
                const continentGroup = groupedByContinent[continent] as LeaguesByCountry;
                if (!continentGroup[countryName]) {
                    continentGroup[countryName] = { flag: comp.country.flag, leagues: [] };
                }
                continentGroup[countryName].leagues.push(comp);
            }
        });
        
        // Sort continents
        const sortedGrouped: GroupedCompetitions = {};
        continentOrder.forEach(continent => {
            if (groupedByContinent[continent]) {
                if (continent === "World") {
                    const worldLeagues = (groupedByContinent.World as { leagues: Competition[] }).leagues;
                    worldLeagues.sort((a,b) => a.league.name.localeCompare(b.league.name));
                    sortedGrouped.World = { leagues: worldLeagues };
                } else {
                    const countries = groupedByContinent[continent] as LeaguesByCountry;
                    const sortedCountries = Object.keys(countries).sort((a,b) => a.localeCompare(b));
                    
                    const sortedCountriesObj: LeaguesByCountry = {};
                    for (const country of sortedCountries) {
                        countries[country].leagues.sort((a,b) => a.league.name.localeCompare(b.league.name));
                        sortedCountriesObj[country] = countries[country];
                    }
                    sortedGrouped[continent] = sortedCountriesObj;
                }
            }
        });

        if (groupedByContinent.Other) {
             sortedGrouped.Other = groupedByContinent.Other;
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
            {Object.entries(competitions).map(([continent, content]) => (
              <AccordionItem value={continent} key={continent} className="rounded-lg border bg-card">
                <AccordionTrigger className="px-4 text-lg font-bold">
                  {continent}
                </AccordionTrigger>
                <AccordionContent className="px-1">
                  {"leagues" in content ? (
                     <ul className="flex flex-col">
                        {(content.leagues as Competition[]).map(comp => (
                          <li key={comp.league.id}>
                            <div
                              className="flex w-full items-center justify-between p-3 text-right hover:bg-accent transition-colors rounded-md cursor-pointer"
                              onClick={() => navigate('CompetitionDetails', { title: comp.league.name, leagueId: comp.league.id })}
                            >
                              <div className="flex items-center gap-3">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    console.log('Favorite clicked for', comp.league.name);
                                  }}
                                >
                                    <Star className="h-5 w-5 text-muted-foreground/50" />
                                </Button>
                                <img src={comp.league.logo} alt={comp.league.name} className="h-6 w-6 object-contain" />
                                <span className="text-sm">{comp.league.name}</span>
                              </div>
                              <ChevronLeft className="h-5 w-5 text-muted-foreground" />
                            </div>
                          </li>
                        ))}
                      </ul>
                  ) : (
                    <Accordion type="multiple" className="w-full space-y-2 px-2">
                         {Object.entries(content as LeaguesByCountry).map(([country, { flag, leagues }]) => (
                             <AccordionItem value={country} key={country} className="rounded-lg border bg-background">
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
                                            <div
                                            className="flex w-full items-center justify-between p-3 text-right hover:bg-accent transition-colors rounded-md cursor-pointer"
                                            onClick={() => navigate('CompetitionDetails', { title: comp.league.name, leagueId: comp.league.id })}
                                            >
                                            <div className="flex items-center gap-3">
                                                <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-8 w-8"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    console.log('Favorite clicked for', comp.league.name);
                                                }}
                                                >
                                                    <Star className="h-5 w-5 text-muted-foreground/50" />
                                                </Button>
                                                <img src={comp.league.logo} alt={comp.league.name} className="h-6 w-6 object-contain" />
                                                <span className="text-sm">{comp.league.name}</span>
                                            </div>
                                            <ChevronLeft className="h-5 w-5 text-muted-foreground" />
                                            </div>
                                        </li>
                                        ))}
                                    </ul>
                                </AccordionContent>
                             </AccordionItem>
                         ))}
                    </Accordion>
                  )}
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

    