
"use client";

import React from 'react';
import type { ScreenProps } from '@/app/page';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Card, CardContent } from '@/components/ui/card';
import { ProfileButton } from '../AppContentWrapper';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import { SearchSheet } from '@/components/SearchSheet';

export function KhaltakScreen({ navigate, goBack, canGoBack }: ScreenProps) {
  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader 
        title="خالتك" 
        onBack={goBack} 
        canGoBack={canGoBack} 
        actions={
          <div className="flex items-center gap-1">
              <SearchSheet navigate={navigate}>
                  <Button variant="ghost" size="icon">
                      <Search className="h-5 w-5" />
                  </Button>
              </SearchSheet>
              <ProfileButton />
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto p-4 flex items-center justify-center">
        <Card>
          <CardContent className="p-10">
            <p className="text-center text-muted-foreground">هذه هي شاشة "خالتك" الجديدة.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
