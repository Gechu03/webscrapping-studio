'use client';

import { useState } from 'react';
import { Monitor, Tablet, Smartphone, Laptop, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { PreviewBreakpoint } from '@/hooks/use-preview';

interface ResponsiveToolbarProps {
  breakpoint: PreviewBreakpoint;
  onBreakpointChange: (bp: PreviewBreakpoint) => void;
  onRefresh: () => void;
  customWidth?: number | null;
  onCustomWidthChange?: (w: number | null) => void;
  effectiveWidth?: number;
}

const breakpoints: { value: PreviewBreakpoint; icon: typeof Monitor; label: string }[] = [
  { value: 375, icon: Smartphone, label: 'Mobile' },
  { value: 768, icon: Tablet, label: 'Tablet' },
  { value: 1024, icon: Laptop, label: 'Laptop' },
  { value: 1440, icon: Monitor, label: 'Desktop' },
];

export function ResponsiveToolbar({
  breakpoint,
  onBreakpointChange,
  onRefresh,
  customWidth,
  onCustomWidthChange,
  effectiveWidth,
}: ResponsiveToolbarProps) {
  const [inputValue, setInputValue] = useState('');
  const [editing, setEditing] = useState(false);
  const isCustom = customWidth != null;
  const displayWidth = effectiveWidth ?? breakpoint;

  const handleInputSubmit = () => {
    const num = parseInt(inputValue, 10);
    if (num >= 280 && num <= 3840 && onCustomWidthChange) {
      onCustomWidthChange(num);
    }
    setEditing(false);
    setInputValue('');
  };

  return (
    <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
      {breakpoints.map((bp) => {
        const Icon = bp.icon;
        const isActive = !isCustom && breakpoint === bp.value;
        return (
          <Button
            key={bp.value}
            variant="ghost"
            size="sm"
            onClick={() => onBreakpointChange(bp.value)}
            className={cn(
              'h-8 px-2.5',
              isActive && 'bg-background shadow-sm'
            )}
            title={`${bp.label} (${bp.value}px)`}
          >
            <Icon className="w-4 h-4" />
          </Button>
        );
      })}
      <div className="w-px h-4 bg-border mx-1" />
      <Button variant="ghost" size="sm" className="h-8 px-2.5" onClick={onRefresh}>
        <RefreshCw className="w-3.5 h-3.5" />
      </Button>
      <div className="w-px h-4 bg-border mx-1" />

      {/* Width display / custom input */}
      {editing ? (
        <input
          autoFocus
          type="number"
          min={280}
          max={3840}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={handleInputSubmit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleInputSubmit();
            if (e.key === 'Escape') { setEditing(false); setInputValue(''); }
          }}
          placeholder={String(displayWidth)}
          className="w-16 h-6 px-1.5 text-xs text-center rounded border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
        />
      ) : (
        <button
          onClick={() => { setEditing(true); setInputValue(String(displayWidth)); }}
          className={cn(
            'text-xs px-1.5 h-6 rounded hover:bg-background/80 transition-colors',
            isCustom ? 'text-primary font-medium' : 'text-muted-foreground'
          )}
          title="Click to set custom width"
        >
          {displayWidth}px
        </button>
      )}
    </div>
  );
}
