'use client';

import { useCallback } from 'react';

/**
 * Hook to fetch component HTML from disk via the API.
 * Components are shared across pages — all in flat components/ directory.
 */
export function useComponentFiles(projectId: string | null, ext: string = 'html') {
  const fetchFile = useCallback(
    async (componentType: string): Promise<string | null> => {
      if (!projectId) return null;
      try {
        const res = await fetch(
          `/api/projects/${projectId}/components/file?type=${componentType}&ext=${ext}`
        );
        if (!res.ok) return null;
        const data = await res.json();
        return data.exists ? data.content : null;
      } catch {
        return null;
      }
    },
    [projectId, ext]
  );

  return { fetchFile };
}
