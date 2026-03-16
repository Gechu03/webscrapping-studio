'use client';

import { useState, useEffect } from 'react';
import type { ComponentPattern } from '@/types/intelligence';
import type { PageSection } from '@/types/page-section';

export function usePatterns() {
  const [patterns, setPatterns] = useState<ComponentPattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchPatterns() {
      try {
        const res = await fetch('/api/intelligence/components');
        if (!res.ok) throw new Error('Failed to fetch patterns');
        const data = await res.json();
        if (!cancelled) setPatterns(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchPatterns();
    return () => { cancelled = true; };
  }, []);

  return { patterns, loading, error };
}

export function usePageSections(sector?: string, subCategory?: string) {
  const [sections, setSections] = useState<PageSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchSections() {
      try {
        const params = new URLSearchParams({ mode: 'page' });
        if (sector) params.set('sector', sector);
        if (subCategory) params.set('subCategory', subCategory);
        const res = await fetch(`/api/intelligence/components?${params}`);
        if (!res.ok) throw new Error('Failed to fetch page sections');
        const data = await res.json();
        if (!cancelled) setSections(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchSections();
    return () => { cancelled = true; };
  }, [sector, subCategory]);

  return { sections, loading, error };
}
