"use client";

import { useEffect } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ChevronLeft, Star } from 'lucide-react';
import type { ScreenProps } from '@/app/page';
import { Button } from '@/components/ui/button';

const competitionsData = {
  "أوروبا": ["دوري أبطال أوروبا", "الدوري الإنجليزي الممتاز", "الدوري الإسباني"],
  "آسيا": ["دوري أبطال آسيا", "الدوري السعودي للمحترفين", "دوري نجوم العراق"],
  "أمريكا الجنوبية": ["كأس ليبرتادوريس", "الدوري البرازيلي"],
};

export function CompetitionsScreen({ navigate, goBack, canGoBack }: ScreenProps) {
  useEffect(() => {
    console.log("CompetitionsScreen init");
    return () => console.log("CompetitionsScreen unmount (should not happen with keep-alive)");
  }, []);

  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader title="البطولات" onBack={goBack} canGoBack={canGoBack} />
      <div className="flex-1 overflow-y-auto p-4">
        <Accordion type="multiple" className="w-full space-y-4">
          {Object.entries(competitionsData).map(([continent, leagues]) => (
            <AccordionItem value={continent} key={continent} className="rounded-lg border bg-card">
              <AccordionTrigger className="px-4 text-base font-bold">
                {continent}
              </AccordionTrigger>
              <AccordionContent className="px-1">
                <ul className="flex flex-col">
                  {leagues.map(league => (
                    <li key={league}>
                      <button 
                        onClick={() => navigate('CompetitionDetails', { title: league })}
                        className="flex w-full items-center justify-between p-3 text-right hover:bg-accent transition-colors rounded-md"
                      >
                        <div className="flex items-center gap-3">
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Star className="h-5 w-5 text-muted-foreground/50" />
                          </Button>
                          <span>{league}</span>
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
      </div>
    </div>
  );
}
