'use client';

import { use, useEffect, useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Layers, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PreviewFrame } from '@/components/preview/preview-frame';
import { ResponsiveToolbar } from '@/components/preview/responsive-toolbar';
import { ChatPanel } from '@/components/builder/chat-panel';
import { CompositionSidebar } from '@/components/builder/composition-sidebar';
import { composePageHtml } from '@/components/builder/page-composer';
import { usePreview } from '@/hooks/use-preview';
import { useProject } from '@/hooks/use-project';
import { usePatterns, usePageSections } from '@/hooks/use-patterns';
import { useComponentFiles } from '@/hooks/use-component-files';
import { useBuilderStore } from '@/stores/builder-store';
import { buildSectionPrompt } from '@/lib/prompt-builder';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import type { ClaudeStreamChunk } from '@/types/claude';
import type { Page } from '@/types/project';

export default function BuilderEditorPage({
  params,
}: {
  params: Promise<{ projectId: string; pageId: string }>;
}) {
  const { projectId, pageId } = use(params);
  const { project, refetch: refetchProject } = useProject(projectId);
  const { patterns } = usePatterns();
  const { sections: pageSections } = usePageSections(
    project?.config.sector,
    project?.config.subCategory
  );
  const { iframeRef, breakpoint, setBreakpoint, customWidth, setCustomWidth, effectiveWidth, refreshPreview } = usePreview();

  // Fetch page data
  const [pageData, setPageData] = useState<Page | null>(null);
  useEffect(() => {
    fetch(`/api/projects/${projectId}/pages/${pageId}`)
      .then((res) => res.ok ? res.json() : null)
      .then(setPageData)
      .catch(() => setPageData(null));
  }, [projectId, pageId]);

  const fileExt = project?.config.outputFormat === 'react'
    ? 'tsx'
    : project?.config.outputFormat === 'vue'
      ? 'vue'
      : 'html';

  const { fetchFile } = useComponentFiles(projectId, fileExt);

  // Store
  const {
    composition,
    isStreaming,
    isFullBuild,
    isDirty,
    messages,
    activeEntryId,
    pageSections: storeSections,
    init,
    addEntry,
    updateEntry,
    removeEntry,
    reorderEntries,
    setActiveEntry,
    startFullBuild,
    finishFullBuild,
    addMessage,
    appendToMessage,
    finalizeStreamingMessage,
    setStreaming,
    setChipState,
    markSaved,
    recommendations,
  } = useBuilderStore();

  const abortRef = useRef<AbortController | null>(null);
  const initializedRef = useRef(false);

  // Initialize store when project + patterns + page data are ready
  useEffect(() => {
    if (project && patterns.length > 0 && pageData && !initializedRef.current) {
      initializedRef.current = true;
      init(
        projectId,
        pageData.components,
        patterns,
        pageSections.length > 0 ? pageSections : undefined,
        pageId
      );

      // Load HTML for existing components from disk
      const loadComponents = async () => {
        const sorted = [...pageData.components].sort((a, b) => a.order - b.order);
        for (const comp of sorted) {
          const html = await fetchFile(comp.type);
          if (html) {
            const store = useBuilderStore.getState();
            const alreadyExists = store.composition.some((e) => e.patternType === comp.type);
            if (!alreadyExists) {
              store.addEntry({
                id: uuidv4(),
                componentId: comp.id,
                patternType: comp.type,
                name: comp.name,
                html,
                status: 'ready',
              });
              store.setChipState(comp.type, 'cached');
            }
          } else {
            useBuilderStore.getState().setChipState(comp.type, 'idle');
          }
        }
        // Loading from DB is not a dirty change
        useBuilderStore.getState().markSaved();
      };
      loadComponents();
    }
  }, [project, patterns, pageSections, projectId, pageId, pageData, init, fetchFile]);

  // Update page sections when they load after initial init
  useEffect(() => {
    if (initializedRef.current && pageSections.length > 0 && storeSections.length === 0 && pageData) {
      const existingTypes = new Set(pageData.components.map((c) => c.type));
      useBuilderStore.getState().updatePageSections(pageSections, patterns, existingTypes);
    }
  }, [pageSections, storeSections.length, pageData, patterns]);

  // Compose full page HTML from composition entries
  const composedHtml = composePageHtml(
    composition,
    project?.config
      ? {
          typography: project.config.typography,
          colors: project.config.colors,
        }
      : undefined
  );

  // ── Save composition to DB (manual) ─────────────────────
  const handleSave = useCallback(
    async () => {
      const state = useBuilderStore.getState();
      const entries = state.composition;
      let saved = 0;

      // 1. Create DB records for entries without componentId
      for (const entry of entries) {
        if (!entry.componentId) {
          try {
            const res = await fetch(`/api/projects/${projectId}/components`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: entry.name, type: entry.patternType, code: '', pageId }),
            });
            if (res.ok) {
              const data = await res.json();
              useBuilderStore.getState().updateEntry(entry.id, { componentId: data.id });
              saved++;
            }
          } catch { /* non-critical */ }
        }
      }

      // 2. Reorder all entries that have componentIds
      const reordered = useBuilderStore.getState().composition;
      const ordersPayload = reordered
        .filter((e) => e.componentId)
        .map((e) => ({ id: e.componentId, order: e.order }));
      if (ordersPayload.length > 0) {
        try {
          await fetch(`/api/projects/${projectId}/components/reorder`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orders: ordersPayload }),
          });
        } catch { /* non-critical */ }
      }

      markSaved();
      toast.success(saved > 0 ? `Saved ${saved} new component(s)` : 'Composition saved');
      await refetchProject();
    },
    [projectId, pageId, markSaved, refetchProject]
  );

  // ── Stream Claude SSE ─────────────────────────────────
  const streamClaude = useCallback(
    async (prompt: string, entryId: string, opts?: { skipFileLoad?: boolean }) => {
      abortRef.current = new AbortController();
      setStreaming(true);

      addMessage({ role: 'assistant', content: '', isStreaming: true, targetEntryId: entryId });
      const msgs = useBuilderStore.getState().messages;
      const lastMsg = msgs[msgs.length - 1];
      const assistantMsgId = lastMsg.id;
      setStreaming(true, assistantMsgId);

      try {
        const res = await fetch(`/api/projects/${projectId}/build`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, timeout: 600_000 }),
          signal: abortRef.current.signal,
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const reader = res.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';
        let charsReceived = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim() || !line.startsWith('data: ')) continue;
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const chunk = JSON.parse(data) as ClaudeStreamChunk;
              if ((chunk.type === 'text' || chunk.type === 'result') && chunk.content) {
                appendToMessage(assistantMsgId, chunk.content);
                charsReceived += chunk.content.length;
                const progress = Math.min(95, Math.round(100 * (1 - Math.exp(-charsReceived / 3000))));
                updateEntry(entryId, { progress });
              }
              if (chunk.type === 'error') {
                appendToMessage(assistantMsgId, `\n\nError: ${chunk.content}`);
              }
            } catch { /* non-JSON SSE */ }
          }
        }

        if (!opts?.skipFileLoad) {
          const state = useBuilderStore.getState();
          const entry = state.composition.find((e) => e.id === entryId);
          if (entry) {
            const html = await fetchFile(entry.patternType);
            if (html) {
              updateEntry(entryId, { html, status: 'ready', progress: 100 });
              setChipState(entry.patternType, 'cached');
            } else {
              updateEntry(entryId, { status: 'error' });
            }
          }
        }

        finalizeStreamingMessage(assistantMsgId);
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          appendToMessage(assistantMsgId, `\n\nError: ${err.message}`);
          if (!opts?.skipFileLoad) {
            updateEntry(entryId, { status: 'error' });
          }
        }
        finalizeStreamingMessage(assistantMsgId);
      }
    },
    [projectId, fetchFile, setStreaming, addMessage, appendToMessage, finalizeStreamingMessage, updateEntry, setChipState]
  );

  // ── Build Full Page handler (per-section sessions) ──────
  const handleBuildPage = useCallback(
    async () => {
      if (!project?.config) return;

      const sections = useBuilderStore.getState().pageSections;
      if (sections.length === 0) {
        toast.error('No page sections available');
        return;
      }

      startFullBuild();

      addMessage({
        role: 'user',
        content: `Build the full page with ${sections.length} sections: ${sections.map((s) => s.name).join(', ')}`,
      });

      const state = useBuilderStore.getState();
      const builtFiles: { name: string; type: string }[] = [];

      // Build each section sequentially with its own Claude session
      for (const entry of state.composition) {
        const section = sections.find((s) => s.type === entry.patternType);
        if (!section) continue;

        useBuilderStore.getState().updateEntry(entry.id, { status: 'generating', progress: 0 });

        const prompt = buildSectionPrompt(
          section,
          sections.length,
          project.config,
          useBuilderStore.getState().composition,
          sections
        );

        await streamClaude(prompt, entry.id);

        // Check if this section succeeded
        const updated = useBuilderStore.getState().composition.find((e) => e.id === entry.id);
        if (updated?.status === 'ready') {
          builtFiles.push({ name: entry.name, type: entry.patternType });
        }
      }

      finishFullBuild(builtFiles);

      const totalCount = sections.length;
      toast.success(`Built ${builtFiles.length}/${totalCount} sections`);

      await refetchProject();
    },
    [project, startFullBuild, finishFullBuild, addMessage, streamClaude, refetchProject]
  );

  // ── Build prompt for a single component (context-aware) ──
  const buildComponentPrompt = useCallback(
    (patternType: string, patternName: string, customInstructions?: string) => {
      const config = project?.config;
      const fileName = `components/${patternType}.${fileExt}`;
      const sections = useBuilderStore.getState().pageSections;
      const currentComposition = useBuilderStore.getState().composition;

      if (sections.length > 0 && config) {
        const section = sections.find((s) => s.type === patternType);
        if (section) {
          let prompt = buildSectionPrompt(
            section,
            sections.length,
            config,
            currentComposition,
            sections
          );
          if (customInstructions) {
            prompt += `\n## Additional Instructions\n${customInstructions}\n`;
          }
          return prompt;
        }
      }

      const rec = recommendations.find((r) => r.pattern.type === patternType);
      const pattern = rec?.pattern;

      const parts: string[] = [];
      parts.push(`Create a production-quality "${patternName}" component.`);
      parts.push(`Write the complete component to the file: ${fileName}`);
      parts.push('');

      if (pattern) {
        parts.push(`## Component Details`);
        parts.push(`- **Name**: ${pattern.name}`);
        parts.push(`- **Type**: ${patternType}`);
        if (pattern.description) parts.push(`- **Description**: ${pattern.description}`);
        if (pattern.variants.length > 0) parts.push(`- **Known variants**: ${pattern.variants.join(', ')}`);
        parts.push('');
      }

      if (config) {
        parts.push(`## Design Tokens`);
        parts.push(`- Primary color: ${config.colors.primary}`);
        if (config.colors.secondary) parts.push(`- Secondary color: ${config.colors.secondary}`);
        if (config.colors.accent) parts.push(`- Accent color: ${config.colors.accent}`);
        if (config.colors.background) parts.push(`- Background: ${config.colors.background}`);
        parts.push(`- Heading font: '${config.typography.heading}', serif`);
        parts.push(`- Body font: '${config.typography.body}', sans-serif`);
        parts.push(`- Style: ${config.style}`);
        parts.push(`- Sector: ${config.sector}`);
        parts.push('');
      }

      if (customInstructions) {
        parts.push(`## Custom Instructions`);
        parts.push(customInstructions);
        parts.push('');
      }

      parts.push(`## Output Requirements`);
      parts.push(`- Write a section-only ${fileExt === 'html' ? 'HTML' : fileExt.toUpperCase()} file to ${fileName}`);
      parts.push(`- Output ONLY the section content — a single <section> or <div> root element`);
      parts.push(`- Include a <style> block with section-specific CSS`);
      parts.push(`- Include Google Fonts <link> tags for ${config?.typography.heading} and ${config?.typography.body}`);
      parts.push(`- Do NOT include <!DOCTYPE>, <html>, <head>, or <body> wrappers`);
      parts.push(`- Must be fully responsive (mobile-first, works at 375px to 1440px+)`);
      parts.push(`- Use realistic placeholder content if no specific content was provided`);
      parts.push(`- Include subtle hover effects and smooth transitions`);
      parts.push(`- Use semantic HTML elements`);
      parts.push(`- The component should look polished and production-ready`);

      return parts.join('\n');
    },
    [project, fileExt, recommendations]
  );

  // ── Chip click handler ────────────────────────────────
  const handleChipClick = useCallback(
    async (patternType: string, patternName: string) => {
      const existing = composition.find((e) => e.patternType === patternType);
      if (existing && existing.status === 'ready' && existing.html) {
        setActiveEntry(existing.id);
        addMessage({
          role: 'system',
          content: `"${patternName}" is already in the composition. Selected it.`,
        });
        return;
      }

      if (existing && !existing.html) {
        removeEntry(existing.id);
      }

      const chip = recommendations.find((r) => r.pattern.type === patternType);
      if (chip?.state === 'cached') {
        const html = await fetchFile(patternType);
        if (html) {
          const entryId = uuidv4();
          addEntry({
            id: entryId,
            patternType,
            name: patternName,
            html,
            status: 'ready',
          });
          addMessage({
            role: 'system',
            content: `Loaded "${patternName}" from cache.`,
          });
          return;
        }
      }

      const entryId = uuidv4();
      addEntry({
        id: entryId,
        patternType,
        name: patternName,
        html: '',
        status: 'generating',
      });
      setChipState(patternType, 'generating');
      setActiveEntry(entryId);

      addMessage({
        role: 'user',
        content: `Build a ${patternName} component`,
        targetEntryId: entryId,
      });

      const prompt = buildComponentPrompt(patternType, patternName);
      await streamClaude(prompt, entryId);
    },
    [composition, recommendations, fetchFile, addEntry, removeEntry, setChipState, setActiveEntry, addMessage, buildComponentPrompt, streamClaude]
  );

  // ── Chat message handler ──────────────────────────────
  const handleSendMessage = useCallback(
    async (message: string) => {
      let targetEntry = activeEntryId
        ? composition.find((e) => e.id === activeEntryId)
        : null;

      if (!targetEntry || targetEntry.status !== 'ready') {
        const msgLower = message.toLowerCase();
        const matched = composition.find((e) => {
          if (e.status !== 'ready') return false;
          const nameLower = e.name.toLowerCase();
          const typeLower = e.patternType.toLowerCase().replace(/[-_]/g, ' ');
          return msgLower.includes(nameLower) || msgLower.includes(typeLower);
        });
        if (matched) {
          targetEntry = matched;
          setActiveEntry(matched.id);
        }
      }

      addMessage({ role: 'user', content: message });

      if (targetEntry && targetEntry.status === 'ready') {
        const sections = useBuilderStore.getState().pageSections;
        const section = sections.find((s) => s.type === targetEntry.patternType);
        const fileName = `components/${targetEntry.patternType}.${fileExt}`;

        const promptParts = [
          `Read the file ${fileName} and update it based on this feedback:`,
          '',
          `"${message}"`,
          '',
        ];

        if (section && sections.length > 0) {
          promptParts.push(`## Page Context`);
          promptParts.push(`This is section ${section.position} of ${sections.length} in the page.`);
          if (section.sectorHints) {
            promptParts.push(`Sector guidance: ${section.sectorHints}`);
          }
          promptParts.push('');
        }

        promptParts.push(`Write the updated component back to ${fileName}.`);
        promptParts.push(`Output ONLY the section content — a single <section> or <div> root element with embedded <style>.`);
        promptParts.push(`Do NOT include <!DOCTYPE>, <html>, <head>, or <body> wrappers.`);

        const prompt = promptParts.join('\n');
        updateEntry(targetEntry.id, { status: 'generating', progress: 0 });
        await streamClaude(prompt, targetEntry.id);
      } else {
        const entryId = uuidv4();
        const patternType = 'custom-' + Date.now();
        const name = message.slice(0, 40) + (message.length > 40 ? '...' : '');
        addEntry({
          id: entryId,
          patternType,
          name,
          html: '',
          status: 'generating',
        });
        setActiveEntry(entryId);

        const prompt = buildComponentPrompt(patternType, 'Custom Component', message);
        await streamClaude(prompt, entryId);
      }
    },
    [activeEntryId, composition, fileExt, addMessage, addEntry, updateEntry, setActiveEntry, buildComponentPrompt, streamClaude]
  );

  // ── Delete handler ────────────────────────────────────
  const handleDelete = useCallback(
    async (entryId: string) => {
      const entry = composition.find((e) => e.id === entryId);
      if (!entry) return;

      if (entry.componentId) {
        try {
          await fetch(`/api/projects/${projectId}/components?componentId=${entry.componentId}`, {
            method: 'DELETE',
          });
        } catch { /* non-critical */ }
      }

      removeEntry(entryId);
      addMessage({
        role: 'system',
        content: `Removed "${entry.name}" from composition.`,
      });
    },
    [composition, projectId, removeEntry, addMessage]
  );

  // ── Reorder handler (deferred to Save) ──────────────────
  const handleReorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (toIndex < 0 || toIndex >= composition.length) return;
      reorderEntries(fromIndex, toIndex);
    },
    [composition.length, reorderEntries]
  );

  // Loading state
  if (!project || !pageData) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="space-y-3 text-center">
          <div className="h-6 w-48 bg-muted animate-pulse rounded mx-auto" />
          <div className="h-96 w-full max-w-2xl bg-muted animate-pulse rounded-xl" />
        </div>
      </div>
    );
  }

  const showBuildPageButton = composition.length === 0 && storeSections.length > 0 && !isStreaming;

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-2">
      {/* Top bar */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link href={`/projects/${projectId}/build`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-lg font-semibold">Builder</h2>
            <p className="text-xs text-muted-foreground">
              {project.name} &rsaquo; {pageData.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Save button */}
          <Button
            variant={isDirty ? 'default' : 'outline'}
            size="sm"
            onClick={handleSave}
            disabled={!isDirty || isStreaming || isFullBuild}
            className="gap-2 relative"
          >
            <Save className="w-4 h-4" />
            Save
            {isDirty && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-orange-500 rounded-full" />
            )}
          </Button>

          {storeSections.length > 0 && !isStreaming && !isFullBuild && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleBuildPage}
              className="gap-2"
            >
              <Layers className="w-4 h-4" />
              Build Full Page ({storeSections.length} sections)
            </Button>
          )}
        </div>
      </div>

      {/* Main layout: Preview (70%) + Chat (30%) */}
      <div className="flex-1 grid grid-cols-[1fr_380px] min-h-0">
        {/* Left: Preview + Composition sidebar */}
        <div className="relative min-h-0 flex flex-col">
          <CompositionSidebar
            onDelete={handleDelete}
            onReorder={handleReorder}
          />

          {showBuildPageButton && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm">
              <div className="text-center space-y-4 p-8 rounded-xl border bg-card shadow-lg max-w-md">
                <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                  <Layers className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Build Your Page</h3>
                <p className="text-sm text-muted-foreground">
                  Generate all {storeSections.length} sections for your {project.config.sector} page
                  using the framework&apos;s agent system. Or click individual sections in the chat panel.
                </p>
                <Button
                  onClick={handleBuildPage}
                  size="lg"
                  className="gap-2"
                >
                  <Layers className="w-5 h-5" />
                  Build Full Page
                </Button>
                <p className="text-[11px] text-muted-foreground">
                  Sections: {storeSections.map((s) => s.name).join(' → ')}
                </p>
              </div>
            </div>
          )}

          <PreviewFrame
            iframeRef={iframeRef}
            breakpoint={breakpoint}
            customWidth={customWidth}
            srcDoc={composedHtml}
            className="flex-1 min-h-0"
          />

          <div className="flex justify-center py-2 flex-shrink-0">
            <ResponsiveToolbar
              breakpoint={breakpoint}
              onBreakpointChange={setBreakpoint}
              onRefresh={refreshPreview}
              customWidth={customWidth}
              onCustomWidthChange={setCustomWidth}
              effectiveWidth={effectiveWidth}
            />
          </div>
        </div>

        {/* Right: Chat panel */}
        <ChatPanel
          onChipClick={handleChipClick}
          onSendMessage={handleSendMessage}
          isStreaming={isStreaming}
        />
      </div>
    </div>
  );
}
