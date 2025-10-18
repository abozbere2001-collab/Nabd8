
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
        "relative flex h-8 flex-shrink-0 items-center justify-between p-1 z-30",
        "bg-card text-card-foreground rounded-b-lg mb-1 mx-1 shadow-md border-x border-b"
    )}>
      <div className="flex items-center gap-1">
         <NabdAlMalaebLogo className="h-6" />
         {canGoBack && (
            <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            aria-label="Go back"
            className="h-7 w-7"
            >
            <ArrowLeft className="h-4 w-4" />
            </Button>
        )}
         {(title && title !== "المزيد" && title !== "أخبار" && title !== "اختياراتي" && title !== "العراق") && <div className='font-bold text-md px-2'>{title}</div>}
      </div>

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
        <span className="font-bold text-sm font-headline">نبض الملاعب</span>
      </div>
      <div data-id="screen-header-actions" className="flex items-center gap-1">
        {actions}
      </div>
    </header>
  );
}
