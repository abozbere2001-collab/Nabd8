"use client";

import React, { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from './ui/button';
import { Search } from 'lucide-react';

export function SearchSheet({ children }: { children: React.ReactNode }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    setLoading(true);
    // Here you would typically call your API
    // For now, we'll just simulate a search
    console.log(`Searching for: ${searchTerm}`);
    setTimeout(() => {
      // Simulated results
      setResults([
        { id: 1, name: `Result for '${searchTerm}' 1` },
        { id: 2, name: `Result for '${searchTerm}' 2` },
      ]);
      setLoading(false);
    }, 1000);
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon">
            {children}
        </Button>
      </SheetTrigger>
      <SheetContent side="top" className="h-full" onOpenAutoFocus={(e) => e.preventDefault()}>
        <SheetHeader>
          <SheetTitle>ابحث عن فريق، لاعب، أو بطولة</SheetTitle>
        </SheetHeader>
        <div className="py-4 space-y-4">
          <div className="flex w-full items-center space-x-2 space-x-reverse">
            <Input
              type="text"
              placeholder="اكتب هنا للبحث..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
              dir="rtl"
            />
            <Button onClick={handleSearch} disabled={loading}>
              {loading ? 'جاري البحث...' : <Search className="h-4 w-4" />}
            </Button>
          </div>
          <div className="mt-4">
            {/* Results will be displayed here */}
            {loading && <p>جاري تحميل النتائج...</p>}
            {!loading && results.length > 0 && (
              <ul className="space-y-2">
                {results.map(result => (
                  <li key={result.id} className="p-2 border rounded-md">{result.name}</li>
                ))}
              </ul>
            )}
            {!loading && results.length === 0 && searchTerm && (
              <p className="text-muted-foreground text-center">لا توجد نتائج بحث.</p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
