'use client';

import { useState, useEffect, useCallback } from 'react';
import type { PageSummary } from '@/types/project';

export function usePages(projectId: string | null) {
  const [pages, setPages] = useState<PageSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPages = useCallback(async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/projects/${projectId}/pages`);
      if (!res.ok) throw new Error('Failed to fetch pages');
      const data = await res.json();
      setPages(data);
    } catch {
      setPages([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  const createPage = useCallback(
    async (name: string): Promise<PageSummary | null> => {
      if (!projectId) return null;
      try {
        const res = await fetch(`/api/projects/${projectId}/pages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        });
        if (!res.ok) return null;
        const page = await res.json();
        await fetchPages();
        return page;
      } catch {
        return null;
      }
    },
    [projectId, fetchPages]
  );

  const duplicatePage = useCallback(
    async (pageId: string): Promise<PageSummary | null> => {
      if (!projectId) return null;
      try {
        const res = await fetch(
          `/api/projects/${projectId}/pages/${pageId}/duplicate`,
          { method: 'POST' }
        );
        if (!res.ok) return null;
        const page = await res.json();
        await fetchPages();
        return page;
      } catch {
        return null;
      }
    },
    [projectId, fetchPages]
  );

  const deletePageById = useCallback(
    async (pageId: string): Promise<boolean> => {
      if (!projectId) return false;
      try {
        const res = await fetch(
          `/api/projects/${projectId}/pages/${pageId}`,
          { method: 'DELETE' }
        );
        if (!res.ok) return false;
        await fetchPages();
        return true;
      } catch {
        return false;
      }
    },
    [projectId, fetchPages]
  );

  const reorderPages = useCallback(
    async (orderedIds: string[]): Promise<boolean> => {
      if (!projectId) return false;
      try {
        const res = await fetch(`/api/projects/${projectId}/pages/reorder`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderedIds }),
        });
        if (!res.ok) return false;
        await fetchPages();
        return true;
      } catch {
        return false;
      }
    },
    [projectId, fetchPages]
  );

  return {
    pages,
    loading,
    refetch: fetchPages,
    createPage,
    duplicatePage,
    deletePage: deletePageById,
    reorderPages,
  };
}
