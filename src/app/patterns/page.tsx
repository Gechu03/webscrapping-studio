'use client';

import { useState, useEffect } from 'react';
import { Search, Star, Layers } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ComponentPattern } from '@/types/intelligence';

export default function PatternsPage() {
  const [patterns, setPatterns] = useState<ComponentPattern[]>([]);
  const [search, setSearch] = useState('');
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/intelligence/components')
      .then((r) => r.json())
      .then(setPatterns)
      .catch(() => {});
  }, []);

  const filtered = patterns
    .filter((p) => {
      if (ratingFilter && p.rating !== ratingFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.type.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.sectors.some((s) => s.toLowerCase().includes(q))
        );
      }
      return true;
    })
    .sort((a, b) => b.rating - a.rating);

  const counts = {
    total: patterns.length,
    critical: patterns.filter((p) => p.rating === 3).length,
    high: patterns.filter((p) => p.rating === 2).length,
    emerging: patterns.filter((p) => p.rating === 1).length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Pattern Library</h2>
        <p className="text-muted-foreground">
          Component patterns extracted from analyzed websites, ranked by frequency
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="cursor-pointer" onClick={() => setRatingFilter(null)}>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-muted-foreground" />
              <span className="text-2xl font-bold">{counts.total}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total Patterns</p>
          </CardContent>
        </Card>
        <Card
          className={cn('cursor-pointer', ratingFilter === 3 && 'border-primary')}
          onClick={() => setRatingFilter(ratingFilter === 3 ? null : 3)}
        >
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5">
                {[1, 2, 3].map((i) => (
                  <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <span className="text-2xl font-bold">{counts.critical}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Critical (3+ sites)</p>
          </CardContent>
        </Card>
        <Card
          className={cn('cursor-pointer', ratingFilter === 2 && 'border-primary')}
          onClick={() => setRatingFilter(ratingFilter === 2 ? null : 2)}
        >
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5">
                {[1, 2].map((i) => (
                  <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <span className="text-2xl font-bold">{counts.high}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">High (2+ sites)</p>
          </CardContent>
        </Card>
        <Card
          className={cn('cursor-pointer', ratingFilter === 1 && 'border-primary')}
          onClick={() => setRatingFilter(ratingFilter === 1 ? null : 1)}
        >
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              <span className="text-2xl font-bold">{counts.emerging}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Emerging (1 site)</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search patterns by name, sector, or description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Pattern list */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((pattern) => (
          <Card key={pattern.type} className="hover:border-primary/30 transition-colors">
            <CardContent className="pt-5">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-medium text-sm">{pattern.name}</h3>
                <div className="flex items-center gap-0.5 shrink-0 ml-2">
                  {Array.from({ length: pattern.rating }).map((_, i) => (
                    <Star
                      key={i}
                      className="w-3 h-3 fill-amber-400 text-amber-400"
                    />
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-3 mb-3">
                {pattern.description}
              </p>
              {pattern.sectors.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {pattern.sectors.slice(0, 4).map((s) => (
                    <Badge key={s} variant="secondary" className="text-[10px] px-1.5">
                      {s}
                    </Badge>
                  ))}
                </div>
              )}
              {pattern.variants.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {pattern.variants.map((v) => (
                    <Badge key={v} variant="outline" className="text-[10px] px-1.5">
                      {v}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No patterns found matching your search.
        </div>
      )}
    </div>
  );
}
