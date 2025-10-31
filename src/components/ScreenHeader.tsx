
"use client";
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { NabdAlMalaebLogo } from './icons/NabdAlMalaebLogo';

interface ScreenHeaderProps {
  title: string;
  canGoBack: boolean;
  onBack: () => void;
  actions?: React.ReactNode;
  secondaryActions?: React.ReactNode;
}

export function ScreenHeader({ title, canGoBack, onBack, actions, secondaryActions }: ScreenHeaderProps) {

  return (
    <header data-id={`screen-header-${title.replace(/\s+/g, '-').toLowerCase()}`} 
    className={cn(
        "relative flex h-14 flex-shrink-0 items-center justify-between p-2 z-30",
        "bg-card text-card-foreground rounded-b-lg mb-1 mx-1 shadow-md border-x border-b"
    )}>
      <div className="flex items-center gap-1">
         {canGoBack && (
            <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            aria-label="Go back"
            className="h-8 w-8"
            >
            <ArrowLeft className="h-5 w-5" />
            </Button>
        )}
      </div>

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none text-center">
        {title ? (
            <h1 className="text-md font-bold truncate">{title}</h1>
        ) : (
            <h1 className="text-md font-bold truncate">نبض الملاعب</h1>
        )}
      </div>

      <div data-id="screen-header-actions" className="flex items-center gap-1">
        {actions}
      </div>
    </header>
  );
}
