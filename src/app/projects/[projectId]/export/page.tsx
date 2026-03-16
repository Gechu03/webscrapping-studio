'use client';

import { use, useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Download,
  FileCode,
  Palette,
  Code,
  FolderTree,
  CheckCircle2,
  Loader2,
  XCircle,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { useProject } from '@/hooks/use-project';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { OutputFormat } from '@/types/project';

const FORMAT_OPTIONS: {
  value: OutputFormat;
  label: string;
  icon: typeof Code;
  description: string;
  fileTree: string[];
}[] = [
  {
    value: 'react',
    label: 'React',
    icon: Code,
    description: 'TSX components with TypeScript, hooks, and CSS modules',
    fileTree: [
      'components/',
      '  Hero.tsx',
      '  CardGrid.tsx',
      '  Testimonials.tsx',
      '  Footer.tsx',
      'styles/',
      '  tokens.css',
      '  globals.css',
      'types/',
      '  index.ts',
      'package.json',
    ],
  },
  {
    value: 'vue',
    label: 'Vue',
    icon: Code,
    description: 'Vue 3 Single File Components with Composition API',
    fileTree: [
      'components/',
      '  Hero.vue',
      '  CardGrid.vue',
      '  Testimonials.vue',
      '  Footer.vue',
      'styles/',
      '  tokens.css',
      '  globals.css',
      'package.json',
    ],
  },
  {
    value: 'vanilla',
    label: 'Vanilla HTML',
    icon: FileCode,
    description: 'Standalone HTML/CSS/JS with no framework dependencies',
    fileTree: [
      'index.html',
      'styles.css',
      'script.js',
      'assets/',
      '  images/',
      '  fonts/',
    ],
  },
  {
    value: 'designer',
    label: 'Designer Mode',
    icon: Palette,
    description: 'Design specs + reference HTML for developer handoff',
    fileTree: [
      'DESIGN_SYSTEM.md',
      'COMPONENT_SPECS.md',
      'IMPLEMENTATION_GUIDE.md',
      'components/',
      '  hero.html',
      '  card-grid.html',
      '  testimonials.html',
      'assets/',
    ],
  },
];

const EXPORT_STEPS = [
  'Starting Claude CLI...',
  'Reading component files...',
  'Assembling output...',
  'Writing export files...',
];

function useElapsedTime(running: boolean) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(0);

  useEffect(() => {
    if (!running) {
      setElapsed(0);
      return;
    }
    startRef.current = Date.now();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [running]);

  return elapsed;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function ExportPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const { project } = useProject(projectId);
  const [selectedFormat, setSelectedFormat] = useState<OutputFormat>(
    project?.config.outputFormat || 'vanilla'
  );
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [streamLog, setStreamLog] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const logEndRef = useRef<HTMLDivElement>(null);
  const elapsed = useElapsedTime(exporting);

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [streamLog]);

  // Advance steps based on elapsed time (heuristic since we stream plain text)
  useEffect(() => {
    if (!exporting) return;
    if (elapsed >= 3 && currentStep < 1) setCurrentStep(1);
    if (elapsed >= 8 && currentStep < 2) setCurrentStep(2);
    if (streamLog.length > 0 && currentStep < 3) setCurrentStep(3);
  }, [elapsed, exporting, streamLog.length, currentStep]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    setExported(false);
    setExportError(null);
    setStreamLog([]);
    setCurrentStep(0);

    try {
      const res = await fetch(`/api/projects/${projectId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: selectedFormat }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(errBody.error || `Export failed (${res.status})`);
      }

      // Read SSE stream (same pattern as builder's streamClaude)
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let hadError = false;

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
            const chunk = JSON.parse(data);
            if (chunk.type === 'text' && chunk.content) {
              setStreamLog((prev) => [...prev, chunk.content]);
            } else if (chunk.type === 'error' && chunk.content) {
              setStreamLog((prev) => [...prev, `Error: ${chunk.content}`]);
              hadError = true;
            } else if (chunk.type === 'result' && chunk.content) {
              setStreamLog((prev) => [...prev, chunk.content]);
            }
          } catch {
            // Non-JSON SSE line
            if (data.trim()) {
              setStreamLog((prev) => [...prev, data]);
            }
          }
        }
      }

      if (hadError) {
        throw new Error('Export completed with errors');
      }
      setExported(true);
      toast.success(`Project exported as ${selectedFormat}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Export failed';
      setExportError(msg);
      toast.error(msg);
    } finally {
      setExporting(false);
    }
  }, [projectId, selectedFormat]);

  const selected = FORMAT_OPTIONS.find((f) => f.value === selectedFormat)!;
  const progressPercent = exporting
    ? Math.min(10 + (currentStep / EXPORT_STEPS.length) * 60 + Math.min(elapsed, 120) * 0.25, 95)
    : exported
      ? 100
      : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/projects/${projectId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <h2 className="text-lg font-semibold">Export Project</h2>
      </div>

      <div className="grid grid-cols-[1fr_350px] gap-6">
        {/* Format selection */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground">
            Select Output Format
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {FORMAT_OPTIONS.map((format) => {
              const Icon = format.icon;
              return (
                <button
                  key={format.value}
                  disabled={exporting}
                  onClick={() => {
                    setSelectedFormat(format.value);
                    setExported(false);
                    setExportError(null);
                  }}
                  className={cn(
                    'p-4 rounded-xl border text-left transition-all',
                    exporting && 'opacity-50 cursor-not-allowed',
                    selectedFormat === format.value
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border hover:border-primary/30'
                  )}
                >
                  <Icon className="w-5 h-5 mb-2" />
                  <div className="font-medium text-sm">{format.label}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format.description}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Export button */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleExport}
              disabled={exporting}
              className="flex-1"
            >
              {exported ? (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Exported Successfully
                </>
              ) : exporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : exportError ? (
                <>
                  <XCircle className="w-4 h-4 mr-2" />
                  Retry Export as {selected.label}
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Export as {selected.label}
                </>
              )}
            </Button>
          </div>

          {/* Progress area — visible during and after export */}
          {(exporting || exported || exportError) && (
            <div className="space-y-3 pt-2">
              {/* Progress bar + elapsed time */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    {exporting ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        {EXPORT_STEPS[currentStep] || 'Processing...'}
                      </>
                    ) : exported ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                        Export complete
                      </>
                    ) : exportError ? (
                      <>
                        <XCircle className="w-3 h-3 text-destructive" />
                        {exportError}
                      </>
                    ) : null}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {exporting ? formatTime(elapsed) : exported ? 'Done' : 'Failed'}
                  </span>
                </div>
                <Progress value={progressPercent} className="h-1.5" />
              </div>

              {/* Step indicators */}
              {exporting && (
                <div className="flex gap-4 text-xs">
                  {EXPORT_STEPS.map((step, i) => (
                    <span
                      key={step}
                      className={cn(
                        'flex items-center gap-1 transition-colors',
                        i < currentStep
                          ? 'text-green-600'
                          : i === currentStep
                            ? 'text-foreground font-medium'
                            : 'text-muted-foreground/50'
                      )}
                    >
                      {i < currentStep ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : i === currentStep ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <span className="w-3 h-3 rounded-full border border-current inline-block" />
                      )}
                      {step.replace('...', '')}
                    </span>
                  ))}
                </div>
              )}

              {/* Live output log */}
              {streamLog.length > 0 && (
                <Card className="bg-muted/30">
                  <CardContent className="p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-medium">
                      Output Log
                    </p>
                    <ScrollArea className="h-[120px]">
                      <div className="space-y-1 font-mono text-xs text-muted-foreground">
                        {streamLog.map((line, i) => (
                          <p key={i} className="break-all leading-relaxed">
                            {line}
                          </p>
                        ))}
                        <div ref={logEndRef} />
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}

              {/* Helpful message when running with no stream output yet */}
              {exporting && streamLog.length === 0 && elapsed > 2 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Claude is reading {project?.components.length || 0} components and assembling the export.
                  This typically takes 30-90 seconds.
                </p>
              )}
            </div>
          )}
        </div>

        {/* File tree preview */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <FolderTree className="w-4 h-4" />
              Export Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="outline" className="text-xs">
                {selected.label}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {project?.components.length || 0} components
              </span>
            </div>
            <ScrollArea className="h-[300px]">
              <pre className="text-sm font-mono text-muted-foreground">
                {selected.fileTree.join('\n')}
              </pre>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
