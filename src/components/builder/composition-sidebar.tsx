'use client';

import { useState, useRef, useCallback } from 'react';
import { Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBuilderStore } from '@/stores/builder-store';
import { CompositionItem } from './composition-item';

interface CompositionSidebarProps {
  onDelete: (entryId: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}

export function CompositionSidebar({ onDelete, onReorder }: CompositionSidebarProps) {
  const composition = useBuilderStore((s) => s.composition);
  const activeEntryId = useBuilderStore((s) => s.activeEntryId);
  const setActiveEntry = useBuilderStore((s) => s.setActiveEntry);

  const [expanded, setExpanded] = useState(false);
  const dragItemRef = useRef<number | null>(null);

  const handleDragStart = useCallback((index: number) => (e: React.DragEvent) => {
    dragItemRef.current = index;
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((toIndex: number) => (e: React.DragEvent) => {
    e.preventDefault();
    const fromIndex = dragItemRef.current;
    if (fromIndex !== null && fromIndex !== toIndex) {
      onReorder(fromIndex, toIndex);
    }
    dragItemRef.current = null;
  }, [onReorder]);

  if (composition.length === 0) return null;

  return (
    <div
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      className={cn(
        'absolute left-0 top-0 bottom-0 z-10 transition-all duration-200 ease-out',
        'bg-background/95 backdrop-blur-sm border-r shadow-sm',
        expanded ? 'w-[200px]' : 'w-[48px]'
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b">
        <Layers className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        {expanded && (
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Sections ({composition.length})
          </span>
        )}
      </div>

      {/* Section list */}
      <div className="p-1.5 space-y-0.5 overflow-y-auto" style={{ maxHeight: 'calc(100% - 40px)' }}>
        {composition.map((entry, i) => (
          <CompositionItem
            key={entry.id}
            entry={entry}
            index={i}
            total={composition.length}
            isActive={activeEntryId === entry.id}
            expanded={expanded}
            onSelect={() => setActiveEntry(entry.id)}
            onMoveUp={() => onReorder(i, i - 1)}
            onMoveDown={() => onReorder(i, i + 1)}
            onDelete={() => onDelete(entry.id)}
            onDragStart={handleDragStart(i)}
            onDragOver={handleDragOver}
            onDrop={handleDrop(i)}
          />
        ))}
      </div>
    </div>
  );
}
