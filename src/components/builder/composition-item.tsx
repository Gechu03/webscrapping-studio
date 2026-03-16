'use client';

import { GripVertical, Trash2, ChevronUp, ChevronDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CompositionEntry } from '@/types/builder';

interface CompositionItemProps {
  entry: CompositionEntry;
  index: number;
  total: number;
  isActive: boolean;
  expanded: boolean;
  onSelect: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

export function CompositionItem({
  entry,
  index,
  total,
  isActive,
  expanded,
  onSelect,
  onMoveUp,
  onMoveDown,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
}: CompositionItemProps) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={onSelect}
      className={cn(
        'group rounded cursor-pointer transition-colors overflow-hidden',
        isActive ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted/50',
        entry.status === 'error' && 'border-red-300 bg-red-50 dark:bg-red-950',
      )}
    >
      <div className="flex items-center gap-1 px-1.5 py-1.5">
        {/* Drag handle */}
        <GripVertical className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 cursor-grab active:cursor-grabbing" />

        {/* Status dot */}
        <div
          className={cn(
            'w-2 h-2 rounded-full flex-shrink-0',
            entry.status === 'ready' && 'bg-green-500',
            entry.status === 'generating' && 'bg-blue-500 animate-pulse',
            entry.status === 'error' && 'bg-red-500'
          )}
        />

        {/* Name */}
        <span className="text-xs font-medium truncate flex-1 min-w-0">
          {expanded ? entry.name : ''}
        </span>

        {entry.status === 'generating' && (
          <Loader2 className="w-3 h-3 animate-spin text-blue-500 flex-shrink-0" />
        )}

        {/* Actions — visible on hover or when expanded */}
        {expanded && entry.status !== 'generating' && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
              disabled={index === 0}
              className="p-0.5 rounded hover:bg-muted disabled:opacity-30"
            >
              <ChevronUp className="w-3 h-3" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
              disabled={index === total - 1}
              className="p-0.5 rounded hover:bg-muted disabled:opacity-30"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900 text-red-500"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Progress bar when generating */}
      {entry.status === 'generating' && (
        <div className="h-1 w-full bg-blue-100 dark:bg-blue-950 overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-r transition-[width] duration-300 ease-out"
            style={{ width: `${entry.progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
