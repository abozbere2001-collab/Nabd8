"use client";
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ScreenHeaderProps {
  title: string;
  canGoBack: boolean;
  onBack: () => void;
  actions?: React.ReactNode;
}

export function ScreenHeader({ title, canGoBack, onBack, actions }: ScreenHeaderProps) {
  return (
    <header className="relative flex h-14 flex-shrink-0 items-center justify-center border-b bg-background px-4">
      {canGoBack && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="absolute left-2 top-1/2 -translate-y-1/2"
          aria-label="Go back"
        >
          <ArrowRight className="h-5 w-5" />
        </Button>
      )}
      <h1 className="truncate text-lg font-bold">{title}</h1>
      {actions && <div className="absolute right-2 top-1/2 -translate-y-1/2">{actions}</div>}
    </header>
  );
}
