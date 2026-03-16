'use client';

import { useRef, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { PreviewBreakpoint } from '@/hooks/use-preview';

interface PreviewFrameProps {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  breakpoint: PreviewBreakpoint;
  srcDoc?: string;
  src?: string;
  className?: string;
  onLoad?: () => void;
  customWidth?: number | null;
}

const breakpointWidths: Record<PreviewBreakpoint, string> = {
  375: 'max-w-[375px]',
  768: 'max-w-[768px]',
  1024: 'max-w-[1024px]',
  1440: 'max-w-full',
};

export function PreviewFrame({
  iframeRef,
  breakpoint,
  srcDoc,
  src,
  className,
  onLoad,
  customWidth,
}: PreviewFrameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerSize({
        w: entry.contentRect.width,
        h: entry.contentRect.height,
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const useCustom = customWidth != null;
  // For presets: 1440 means "full width" (no constraint), others are fixed px
  const targetWidth = useCustom ? customWidth : (breakpoint === 1440 ? 0 : breakpoint);
  // Need zoom-out only when we have a specific target wider than container
  const needsZoom = targetWidth > 0 && containerSize.w > 0 && targetWidth > containerSize.w;
  const scale = needsZoom ? containerSize.w / targetWidth : 1;

  // When NOT zooming: use simple max-width (original behavior)
  // When zooming: render iframe at full targetWidth, scale it down
  if (needsZoom) {
    return (
      <div
        ref={containerRef}
        className={cn(
          'relative bg-muted/30 rounded-lg overflow-hidden border',
          className
        )}
      >
        <iframe
          ref={iframeRef}
          srcDoc={srcDoc}
          src={src}
          className="bg-white"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: `${targetWidth}px`,
            height: `${containerSize.h / scale}px`,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            border: 'none',
          }}
          sandbox="allow-scripts allow-same-origin"
          title="Component Preview"
          onLoad={onLoad}
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex justify-center bg-muted/30 rounded-lg overflow-hidden border',
        className
      )}
    >
      <iframe
        ref={iframeRef}
        srcDoc={srcDoc}
        src={src}
        className={cn(
          'w-full h-full bg-white transition-all duration-300',
          !useCustom && breakpointWidths[breakpoint]
        )}
        style={useCustom && !needsZoom ? { maxWidth: `${customWidth}px` } : undefined}
        sandbox="allow-scripts allow-same-origin"
        title="Component Preview"
        onLoad={onLoad}
      />
    </div>
  );
}
