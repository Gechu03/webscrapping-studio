'use client';

import { useState, useMemo } from 'react';
import { Check, Loader2, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBuilderStore } from '@/stores/builder-store';

const VISIBLE_COUNT = 5;

interface RecommendationChipsProps {
  onChipClick: (patternType: string, patternName: string) => void;
  disabled?: boolean;
}

export function RecommendationChips({ onChipClick, disabled }: RecommendationChipsProps) {
  const recommendations = useBuilderStore((s) => s.recommendations);
  const pageSections = useBuilderStore((s) => s.pageSections);
  const composition = useBuilderStore((s) => s.composition);
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState('');

  const hasPageSections = pageSections.length > 0;

  const filtered = useMemo(() => {
    if (!search.trim()) return recommendations;
    const q = search.toLowerCase();
    return recommendations.filter(
      (chip) =>
        chip.pattern.name.toLowerCase().includes(q) ||
        chip.pattern.type.toLowerCase().includes(q) ||
        chip.pattern.description?.toLowerCase().includes(q)
    );
  }, [recommendations, search]);

  // Find the next unbuilt required section
  const nextRequiredType = useMemo(() => {
    if (!hasPageSections) return null;
    const builtTypes = new Set(
      composition.filter((e) => e.status === 'ready').map((e) => e.patternType)
    );
    const sorted = [...pageSections].sort((a, b) => a.position - b.position);
    const next = sorted.find(
      (s) => s.required && !builtTypes.has(s.type)
    );
    return next?.type || null;
  }, [hasPageSections, pageSections, composition]);

  if (recommendations.length === 0) return null;

  const isSearching = search.trim().length > 0;
  const visible = isSearching || expanded ? filtered : filtered.slice(0, VISIBLE_COUNT);
  const hasMore = !isSearching && filtered.length > VISIBLE_COUNT;

  // Find position for a chip (page sections mode)
  const getPosition = (type: string): number | null => {
    if (!hasPageSections) return null;
    const section = pageSections.find((s) => s.type === type);
    return section?.position || null;
  };

  const isRequired = (type: string): boolean => {
    if (!hasPageSections) return true;
    const section = pageSections.find((s) => s.type === type);
    return section?.required ?? true;
  };

  return (
    <div className="px-3 py-2 border-b">
      {/* Header + search */}
      <div className="flex items-center gap-2 mb-1.5">
        <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider flex-shrink-0">
          {hasPageSections ? 'Page Sections' : 'Components'}
        </p>
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full h-6 pl-6 pr-2 rounded-md border bg-muted/50 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      {/* Chips */}
      <div className="flex flex-wrap gap-1.5">
        {visible.map((chip) => {
          const stars = chip.pattern.rating;
          const position = getPosition(chip.pattern.type);
          const required = isRequired(chip.pattern.type);
          const isNext = chip.pattern.type === nextRequiredType;

          return (
            <button
              key={chip.pattern.type}
              onClick={() => onChipClick(chip.pattern.type, chip.pattern.name)}
              disabled={disabled || chip.state === 'generating'}
              className={cn(
                'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                'border hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                chip.state === 'cached' && 'bg-green-50 border-green-200 text-green-700 dark:bg-green-950 dark:border-green-800 dark:text-green-300',
                chip.state === 'generating' && 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-950 dark:border-blue-800',
                chip.state === 'idle' && !required && 'bg-background border-dashed border-border text-muted-foreground',
                chip.state === 'idle' && required && 'bg-background border-border text-foreground',
                isNext && chip.state === 'idle' && 'ring-2 ring-primary/40 ring-offset-1',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              {chip.state === 'generating' && <Loader2 className="w-3 h-3 animate-spin" />}
              {chip.state === 'cached' && <Check className="w-3 h-3" />}
              {position !== null && (
                <span className="text-muted-foreground text-[10px] font-mono mr-0.5">
                  {position}.
                </span>
              )}
              <span>{chip.pattern.name}</span>
              {stars > 0 && (
                <span className="text-amber-500 ml-0.5">
                  {'★'.repeat(stars)}
                </span>
              )}
            </button>
          );
        })}
        {visible.length === 0 && isSearching && (
          <p className="text-xs text-muted-foreground py-1">No components match &quot;{search}&quot;</p>
        )}
        {hasMore && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="inline-flex items-center gap-0.5 px-2.5 py-1 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? (
              <>Show less <ChevronUp className="w-3 h-3" /></>
            ) : (
              <>{filtered.length - VISIBLE_COUNT} more <ChevronDown className="w-3 h-3" /></>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
