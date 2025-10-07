"use client";
import { ArrowLeft, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SearchSheet } from './SearchSheet';
import type { ScreenProps } from '@/app/page';

interface ScreenHeaderProps {
  title: string;
  canGoBack: boolean;
  onBack: () => void;
  actions?: React.ReactNode;
  secondaryActions?: React.ReactNode;
}

export function ScreenHeader({ title, canGoBack, onBack, actions, secondaryActions }: ScreenHeaderProps) {
  return (
    <header className="relative flex h-14 flex-shrink-0 items-center justify-between border-b bg-background px-2">
      <div className="flex items-center">
         {canGoBack && (
            <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            aria-label="Go back"
            >
            <ArrowLeft className="h-5 w-5" />
            </Button>
        )}
         <div className='font-bold text-lg px-2'>{title}</div>
      </div>

      <div className="flex items-center gap-1">
        {secondaryActions}
        {actions}
      </div>
    </header>
  );
}
