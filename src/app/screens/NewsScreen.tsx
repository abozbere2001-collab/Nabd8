"use client";

import { useEffect } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { ScreenProps } from '@/app/page';
import Image from 'next/image';

export function NewsScreen({ navigate, goBack, canGoBack }: ScreenProps) {
  useEffect(() => {
    console.log("NewsScreen: init");
  }, []);

  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader title="الأخبار" onBack={goBack} canGoBack={canGoBack} />
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="relative aspect-video w-full mb-4">
                <Image 
                  src={`https://picsum.photos/seed/${i+10}/600/400`}
                  alt="News article placeholder"
                  fill
                  className="rounded-md object-cover"
                  data-ai-hint="football match"
                />
              </div>
              <CardTitle>
                <Skeleton className="h-6 w-4/5" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </CardContent>
            <CardFooter>
              <Skeleton className="h-4 w-24" />
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
