'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

export type PreviewBreakpoint = 375 | 768 | 1024 | 1440;

interface UsePreviewReturn {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  breakpoint: PreviewBreakpoint;
  setBreakpoint: (bp: PreviewBreakpoint) => void;
  customWidth: number | null;
  setCustomWidth: (w: number | null) => void;
  effectiveWidth: number;
  refreshPreview: () => void;
  previewUrl: string | null;
  setPreviewUrl: (url: string | null) => void;
}

export function usePreview(): UsePreviewReturn {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [breakpoint, setBreakpoint] = useState<PreviewBreakpoint>(1440);
  const [customWidth, setCustomWidth] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const effectiveWidth = customWidth ?? breakpoint;

  const handleSetBreakpoint = useCallback((bp: PreviewBreakpoint) => {
    setBreakpoint(bp);
    setCustomWidth(null); // clear custom when picking a preset
  }, []);

  const refreshPreview = useCallback(() => {
    if (iframeRef.current && previewUrl) {
      iframeRef.current.src = previewUrl + '?t=' + Date.now();
    }
  }, [previewUrl]);

  // Auto-refresh when URL changes
  useEffect(() => {
    if (iframeRef.current && previewUrl) {
      iframeRef.current.src = previewUrl;
    }
  }, [previewUrl]);

  return {
    iframeRef,
    breakpoint,
    setBreakpoint: handleSetBreakpoint,
    customWidth,
    setCustomWidth,
    effectiveWidth,
    refreshPreview,
    previewUrl,
    setPreviewUrl,
  };
}
