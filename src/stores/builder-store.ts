'use client';

import { create } from 'zustand';
import type {
  BuilderState,
  BuilderActions,
  CompositionEntry,
  ChatMessage,
  RecommendationChip,
} from '@/types/builder';
import type { ComponentPattern } from '@/types/intelligence';
import type { PageSection } from '@/types/page-section';
import type { ComponentEntry } from '@/types/project';
import { v4 as uuidv4 } from 'uuid';

const initialState: BuilderState = {
  projectId: null,
  pageId: null,
  composition: [],
  pageSections: [],
  isFullBuild: false,
  isDirty: false,
  messages: [],
  isStreaming: false,
  streamingMessageId: null,
  recommendations: [],
  activeEntryId: null,
};

export const useBuilderStore = create<BuilderState & BuilderActions>((set, get) => ({
  ...initialState,

  // ── Init ──────────────────────────────────────────────
  init: (projectId, existingComponents, patterns, pageSections, pageId) => {
    // Don't create composition entries here — they'll be added by the page
    // after verifying files exist on disk. This avoids race conditions with
    // stale DB entries that have no file.
    const composition: CompositionEntry[] = [];

    // Build recommendation chips from page sections (ordered by position) or patterns (by rating)
    const existingTypes = new Set(existingComponents.map((c) => c.type));
    let recommendations: RecommendationChip[];

    if (pageSections && pageSections.length > 0) {
      // Use page sections as recommendations — ordered by position
      recommendations = pageSections
        .sort((a, b) => a.position - b.position)
        .map((s) => {
          // Try to find a matching pattern for rating info
          const matchingPattern = patterns.find((p) => p.type === s.type);
          const chipPattern: ComponentPattern = matchingPattern || {
            name: s.name,
            type: s.type,
            rating: s.required ? 3 : 2,
            sectors: [],
            description: s.description,
            variants: [],
          };
          return {
            pattern: chipPattern,
            state: existingTypes.has(s.type) ? ('cached' as const) : ('idle' as const),
          };
        });
    } else {
      recommendations = patterns
        .sort((a, b) => b.rating - a.rating)
        .map((p) => ({
          pattern: p,
          state: existingTypes.has(p.type) ? ('cached' as const) : ('idle' as const),
        }));
    }

    set({
      projectId,
      pageId: pageId || null,
      composition,
      pageSections: pageSections || [],
      isFullBuild: false,
      isDirty: false,
      recommendations,
      messages: [],
      isStreaming: false,
      streamingMessageId: null,
      activeEntryId: null,
    });
  },

  reset: () => set(initialState),

  // ── Composition ───────────────────────────────────────
  addEntry: (entry) => {
    const { composition } = get();
    const order = composition.length;
    set({
      composition: [...composition, { ...entry, progress: entry.progress ?? 0, order }],
      isDirty: true,
    });
  },

  updateEntry: (id, updates) => {
    const isDirtyUpdate = 'html' in updates && updates.html !== undefined;
    set({
      composition: get().composition.map((e) =>
        e.id === id ? { ...e, ...updates } : e
      ),
      ...(isDirtyUpdate ? { isDirty: true } : {}),
    });
  },

  removeEntry: (id) => {
    const filtered = get().composition.filter((e) => e.id !== id);
    set({
      composition: filtered.map((e, i) => ({ ...e, order: i })),
      activeEntryId: get().activeEntryId === id ? null : get().activeEntryId,
      isDirty: true,
    });
  },

  reorderEntries: (fromIndex, toIndex) => {
    const items = [...get().composition];
    const [moved] = items.splice(fromIndex, 1);
    items.splice(toIndex, 0, moved);
    set({
      composition: items.map((e, i) => ({ ...e, order: i })),
      isDirty: true,
    });
  },

  setActiveEntry: (id) => set({ activeEntryId: id }),

  // ── Full Page Build ─────────────────────────────────
  startFullBuild: () => {
    const { pageSections } = get();
    // Create composition entries for all page sections
    const composition: CompositionEntry[] = pageSections
      .sort((a, b) => a.position - b.position)
      .map((s, i) => ({
        id: uuidv4(),
        patternType: s.type,
        name: s.name,
        html: '',
        status: 'generating' as const,
        order: i,
        progress: 0,
      }));

    // Mark all chips as generating
    const recommendations = get().recommendations.map((r) => {
      const isInBuild = pageSections.some((s) => s.type === r.pattern.type);
      return isInBuild ? { ...r, state: 'generating' as const } : r;
    });

    set({ composition, recommendations, isFullBuild: true });
  },

  finishFullBuild: (files) => {
    const { composition } = get();
    const fileTypes = new Set(files.map((f) => f.type));

    // Update entries: found files → ready, unfound → error
    const updated = composition.map((entry) => {
      if (fileTypes.has(entry.patternType)) {
        return { ...entry, status: 'ready' as const };
      }
      return { ...entry, status: 'error' as const };
    });

    // Update chip states
    const recommendations = get().recommendations.map((r) => ({
      ...r,
      state: fileTypes.has(r.pattern.type) ? ('cached' as const) : r.state === 'generating' ? ('idle' as const) : r.state,
    }));

    set({ composition: updated, recommendations, isFullBuild: false });
  },

  // ── Chat ──────────────────────────────────────────────
  addMessage: (msg) => {
    const message: ChatMessage = {
      ...msg,
      id: uuidv4(),
      timestamp: Date.now(),
    };
    set({ messages: [...get().messages, message] });
    return message;
  },

  appendToMessage: (id, content) => {
    set({
      messages: get().messages.map((m) =>
        m.id === id ? { ...m, content: m.content + content } : m
      ),
    });
  },

  finalizeStreamingMessage: (id) => {
    set({
      messages: get().messages.map((m) =>
        m.id === id ? { ...m, isStreaming: false } : m
      ),
      isStreaming: false,
      streamingMessageId: null,
    });
  },

  setStreaming: (streaming, messageId = null) => {
    set({ isStreaming: streaming, streamingMessageId: messageId ?? null });
  },

  // ── Recommendations ───────────────────────────────────
  setRecommendations: (patterns) => {
    const existing = get().composition.map((e) => e.patternType);
    const existingSet = new Set(existing);
    set({
      recommendations: patterns
        .sort((a, b) => b.rating - a.rating)
        .map((p) => ({
          pattern: p,
          state: existingSet.has(p.type) ? ('cached' as const) : ('idle' as const),
        })),
    });
  },

  setChipState: (patternType, state) => {
    set({
      recommendations: get().recommendations.map((r) =>
        r.pattern.type === patternType ? { ...r, state } : r
      ),
    });
  },

  // ── Dirty tracking ──────────────────────────────────────
  markDirty: () => set({ isDirty: true }),
  markSaved: () => set({ isDirty: false }),

  // ── Update page sections without resetting composition ──
  updatePageSections: (pageSections, patterns, existingTypes) => {
    const recommendations: RecommendationChip[] = pageSections
      .sort((a, b) => a.position - b.position)
      .map((s) => {
        const matchingPattern = patterns.find((p) => p.type === s.type);
        const chipPattern: ComponentPattern = matchingPattern || {
          name: s.name,
          type: s.type,
          rating: s.required ? 3 : 2,
          sectors: [],
          description: s.description,
          variants: [],
        };
        // Check both DB types and current composition for cached state
        const compositionTypes = new Set(get().composition.map((e) => e.patternType));
        return {
          pattern: chipPattern,
          state: (existingTypes.has(s.type) || compositionTypes.has(s.type)) ? ('cached' as const) : ('idle' as const),
        };
      });

    set({ pageSections, recommendations });
  },
}));
