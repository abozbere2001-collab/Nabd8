"use client";

import { useEffect } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from '@/components/ui/skeleton';
import type { ScreenProps } from '@/app/page';

export function MatchesScreen({ navigate, goBack, canGoBack }: ScreenProps) {
  useEffect(() => {
    console.log("MatchesScreen init");
    return () => console.log("MatchesScreen unmount (should not happen with keep-alive)");
  }, []);

  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader title="المباريات" onBack={goBack} canGoBack={canGoBack} />
      <div className="flex-1 overflow-y-auto">
        <Tabs defaultValue="my-results" className="w-full">
          <div className="p-4 sticky top-0 bg-background z-10">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="my-results">نتائجي</TabsTrigger>
              <TabsTrigger value="all-matches">كل المباريات</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="my-results" className="p-4 pt-0">
             <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-64">
                <p className="font-bold text-lg">لا توجد مباريات مفضلة</p>
                <p className="text-sm">أضف فرقا أو بطولات للمفضلة لترى مبارياتها هنا.</p>
            </div>
          </TabsContent>
          <TabsContent value="all-matches" className="space-y-4 p-4 pt-0">
            <p className="text-sm text-muted-foreground text-center py-2">اليوم - 24 أكتوبر 2024</p>
            {Array.from({ length: 3 }).map((_, i) => (
                 <div key={i} className="rounded-lg border bg-card p-4">
                    <div className="flex items-center justify-between mb-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-10" />
                    </div>
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2 flex-1 justify-end">
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-8 w-8 rounded-full" />
                        </div>
                        <Skeleton className="h-6 w-12" />
                        <div className="flex items-center gap-2 flex-1">
                            <Skeleton className="h-8 w-8 rounded-full" />
                            <Skeleton className="h-4 w-20" />
                        </div>
                    </div>
                 </div>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
