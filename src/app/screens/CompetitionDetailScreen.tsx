"use client";

import { useEffect } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ScreenProps } from '@/app/page';
import { useAdmin } from '@/hooks/useAdmin.tsx';
import { Button } from '@/components/ui/button';
import { Star, Pencil } from 'lucide-react';

export function CompetitionDetailScreen({ navigate, goBack, canGoBack, title, leagueId }: ScreenProps & { title?: string, leagueId?: number }) {
  const { isAdmin } = useAdmin();
  
  useEffect(() => {
    console.log(`CompetitionDetailScreen for ${title} (ID: ${leagueId}): init`);
  }, [title, leagueId]);

  const headerActions = (
    <div className="flex items-center gap-1">
      {isAdmin && (
         <Button
          variant="ghost"
          size="icon"
          onClick={() => console.log('Rename clicked for', title)}
        >
          <Pencil className="h-5 w-5" />
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => console.log('Favorite clicked for', title)}
      >
        <Star className="h-5 w-5 text-muted-foreground/80" />
      </Button>
    </div>
  );

  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader title={title || "البطولة"} onBack={goBack} canGoBack={canGoBack} actions={headerActions} />
       <div className="flex-1 overflow-y-auto">
        <Tabs defaultValue="matches" className="w-full">
          <div className="p-4 sticky top-0 bg-background z-10">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="matches">المباريات</TabsTrigger>
              <TabsTrigger value="standings">الترتيب</TabsTrigger>
              <TabsTrigger value="scorers">الهدافين</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="matches" className="p-4 pt-0 text-center text-muted-foreground">
            قائمة مباريات {title}.
          </TabsContent>
          <TabsContent value="standings" className="p-4 pt-0 text-center text-muted-foreground">
            جدول ترتيب {title}.
          </TabsContent>
          <TabsContent value="scorers" className="p-4 pt-0 text-center text-muted-foreground">
            ترتيب هدافي {title}.
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
