
"use client";
import { ArrowLeft, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ScreenHeaderProps {
  title: string;
  canGoBack: boolean;
  onBack: () => void;
  actions?: React.ReactNode;
  secondaryActions?: React.ReactNode;
}

export function ScreenHeader({ title, canGoBack, onBack, actions, secondaryActions }: ScreenHeaderProps) {
  return (
    <header data-id={`screen-header-${title.replace(/\s+/g, '-').toLowerCase()}`} className="relative flex h-14 flex-shrink-0 items-center justify-between border-b bg-background px-2">
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

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1">
        {secondaryActions}
      </div>
      <div data-id="screen-header-actions" className="flex items-center gap-1">
        {actions}
      </div>
    </header>
  );
}
