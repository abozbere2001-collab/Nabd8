"use client";

import { useEffect } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ScreenProps } from '@/app/page';

export function CompetitionDetailScreen({ navigate, goBack, canGoBack, title }: ScreenProps & { title?: string }) {
  useEffect(() => {
    console.log(`CompetitionDetailScreen for ${title} init`);
    return () => console.log(`CompetitionDetailScreen for ${title} unmount (should not happen with keep-alive)`);
  }, [title]);

  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader title={title || "البطولة"} onBack={goBack} canGoBack={canGoBack} />
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
