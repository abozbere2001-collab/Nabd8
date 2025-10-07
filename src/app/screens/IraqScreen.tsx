"use client";

import { useEffect } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ScreenProps } from '@/app/page';

export function IraqScreen({ navigate, goBack, canGoBack, headerActions }: ScreenProps & { headerActions?: React.ReactNode }) {
  useEffect(() => {
    console.log("IraqScreen: init");
  }, []);

  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader title="العراق" onBack={goBack} canGoBack={canGoBack} actions={headerActions} />
      <div className="flex-1 overflow-y-auto">
        <Tabs defaultValue="our-league" className="w-full">
          <div className="p-4 sticky top-0 bg-background z-10">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="our-league">دورينا</TabsTrigger>
              <TabsTrigger value="predictions">التوقعات</TabsTrigger>
              <TabsTrigger value="our-card">كرتنا</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="our-league" className="p-4 pt-0 text-center text-muted-foreground">
            محتوى دورينا هنا (مباريات، ترتيب، هدافين).
          </TabsContent>
          <TabsContent value="predictions" className="p-4 pt-0 text-center text-muted-foreground">
            واجهة التوقعات ستضاف لاحقاً.
          </TabsContent>
          <TabsContent value="our-card" className="p-4 pt-0 text-center text-muted-foreground">
            الفرق المحلية المفضلة تظهر هنا.
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
