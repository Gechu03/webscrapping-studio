import type { ComponentPattern } from './intelligence';
import type { ComponentEntry } from './project';
import type { PageSection } from './page-section';

/** A single entry in the composed page — one section/component */
export interface CompositionEntry {
  id: string;
  componentId?: string; // DB component id (set after save)
  patternType: string; // e.g. "hero", "card-grid", "navbar"
  name: string; // display name
  html: string; // rendered HTML for this section
  status: 'generating' | 'ready' | 'error';
  order: number;
  progress: number; // 0-100, real streaming progress
}

/** Chat message in the builder conversation */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  /** Which composition entry this message relates to */
  targetEntryId?: string;
  isStreaming?: boolean;
}

/** State for a recommendation chip */
export interface RecommendationChip {
  pattern: ComponentPattern;
  state: 'idle' | 'generating' | 'cached';
}

/** Zustand store shape */
export interface BuilderState {
  // Project context
  projectId: string | null;

  // Page context
  pageId: string | null;

  // Composition — ordered list of sections in the page
  composition: CompositionEntry[];

  // Page sections — ordered blueprint for the page
  pageSections: PageSection[];
  isFullBuild: boolean;

  // Dirty tracking — unsaved changes
  isDirty: boolean;

  // Chat
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingMessageId: string | null;

  // Recommendations
  recommendations: RecommendationChip[];

  // Active target — which component is being iterated
  activeEntryId: string | null;
}

export interface BuilderActions {
  // Init
  init: (projectId: string, existingComponents: ComponentEntry[], patterns: ComponentPattern[], pageSections?: PageSection[], pageId?: string) => void;
  reset: () => void;

  // Composition
  addEntry: (entry: Omit<CompositionEntry, 'order' | 'progress'> & { progress?: number }) => void;
  updateEntry: (id: string, updates: Partial<CompositionEntry>) => void;
  removeEntry: (id: string) => void;
  reorderEntries: (fromIndex: number, toIndex: number) => void;
  setActiveEntry: (id: string | null) => void;

  // Full page build
  startFullBuild: () => void;
  finishFullBuild: (files: { name: string; type: string }[]) => void;

  // Chat
  addMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  appendToMessage: (id: string, content: string) => void;
  finalizeStreamingMessage: (id: string) => void;
  setStreaming: (streaming: boolean, messageId?: string | null) => void;

  // Recommendations
  setRecommendations: (patterns: ComponentPattern[]) => void;
  setChipState: (patternType: string, state: RecommendationChip['state']) => void;

  // Dirty tracking
  markDirty: () => void;
  markSaved: () => void;

  // Update page sections without resetting composition
  updatePageSections: (pageSections: PageSection[], patterns: ComponentPattern[], existingTypes: Set<string>) => void;
}
