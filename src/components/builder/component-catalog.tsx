'use client';

import { useState, useEffect } from 'react';
import { Search, Star } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { ComponentPattern } from '@/types/intelligence';

interface ComponentCatalogProps {
  onSelect: (pattern: ComponentPattern) => void;
  selected?: string;
}

export function ComponentCatalog({ onSelect, selected }: ComponentCatalogProps) {
  const [patterns, setPatterns] = useState<ComponentPattern[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/intelligence/components')
      .then((r) => r.json())
      .then(setPatterns)
      .catch(() => {});
  }, []);

  const filtered = patterns.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.type.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search components..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <ScrollArea className="h-[400px]">
        <div className="space-y-2 pr-3">
          {filtered.map((pattern) => (
            <button
              key={pattern.type}
              onClick={() => onSelect(pattern)}
              className={cn(
                'w-full p-3 rounded-lg border text-left transition-colors',
                selected === pattern.type
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/30'
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-sm">{pattern.name}</span>
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: pattern.rating }).map((_, i) => (
                    <Star
                      key={i}
                      className="w-3 h-3 fill-amber-400 text-amber-400"
                    />
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {pattern.description}
              </p>
              {pattern.variants.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {pattern.variants.slice(0, 3).map((v) => (
                    <Badge key={v} variant="secondary" className="text-[10px] px-1.5">
                      {v}
                    </Badge>
                  ))}
                </div>
              )}
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
