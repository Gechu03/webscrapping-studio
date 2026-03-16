'use client';

import { use, useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, Play, Square, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PhaseProgress } from '@/components/analysis/phase-progress';
import { ReportViewer } from '@/components/analysis/report-viewer';
import { useProject } from '@/hooks/use-project';
import { useClaudeStream } from '@/hooks/use-claude-stream';
import { toast } from 'sonner';
import { PHASES } from '@/types/project';
import { cn } from '@/lib/utils';

interface ReportData {
  analysis: string;
  design: string;
  ux: string;
  seo: string;
}

export default function AnalysisPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const { project, refetch } = useProject(projectId);
  const { isStreaming, output, error, startStream, stopStream } = useClaudeStream();

  const [selectedPhases, setSelectedPhases] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [competitors, setCompetitors] = useState('');
  const [competitorsLoaded, setCompetitorsLoaded] = useState(false);
  const [reports, setReports] = useState<ReportData>({ analysis: '', design: '', ux: '', seo: '' });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pre-fill competitors from project config
  useEffect(() => {
    if (project && !competitorsLoaded) {
      const projectCompetitors = project.config.competitors || [];
      if (projectCompetitors.length > 0) {
        setCompetitors(projectCompetitors.join(', '));
      }
      setCompetitorsLoaded(true);
    }
  }, [project, competitorsLoaded]);

  // Fetch report files from project directory
  const fetchReports = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/reports`);
      if (!res.ok) return;
      const data = await res.json();
      setReports({
        analysis: data.analysis?.content || '',
        design: data.design?.content || '',
        ux: data.ux?.content || '',
        seo: data.seo?.content || '',
      });
    } catch {
      // ignore
    }
  }, [projectId]);

  // Load reports on mount
  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Poll for phase updates and reports during streaming
  useEffect(() => {
    if (isStreaming) {
      pollRef.current = setInterval(() => {
        refetch();
        fetchReports();
      }, 10_000); // Poll every 10 seconds
    } else {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [isStreaming, refetch, fetchReports]);

  const handleStartAnalysis = async () => {
    if (!project) return;

    const url = project.config.url;
    if (!url) {
      toast.error('Project has no reference URL. Set one in project settings.');
      return;
    }

    const competitorUrls = competitors
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const { buildAnalysisPrompt } = await import('@/lib/prompt-builder');
    const prompt = buildAnalysisPrompt(url, competitorUrls, selectedPhases, project.config.sector);

    toast.info('Starting analysis pipeline...');
    try {
      await startStream(projectId, prompt, { timeout: 3_600_000 });
      toast.success('Analysis pipeline completed.');
    } catch {
      toast.error('Analysis pipeline failed. Check the output for details.');
    }
    refetch();
    fetchReports();
  };

  const togglePhase = (id: number) => {
    setSelectedPhases((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id].sort()
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/projects/${projectId}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <h2 className="text-lg font-semibold">Analysis Pipeline</h2>
        </div>
        <div className="flex gap-2">
          {isStreaming ? (
            <Button variant="destructive" onClick={stopStream}>
              <Square className="w-4 h-4 mr-2" />
              Stop
            </Button>
          ) : (
            <Button onClick={handleStartAnalysis}>
              <Play className="w-4 h-4 mr-2" />
              Start Analysis
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_350px] gap-6">
        {/* Main area */}
        <div className="space-y-6">
          {/* Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Target URL</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {project?.config.url || 'No URL set'}
                </p>
              </div>
              <div>
                <Label htmlFor="competitors">Competitor URLs</Label>
                <Input
                  id="competitors"
                  placeholder="https://competitor1.com, https://competitor2.com"
                  value={competitors}
                  onChange={(e) => setCompetitors(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Phases</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {PHASES.map((phase) => (
                    <button
                      key={phase.id}
                      onClick={() => togglePhase(phase.id)}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                        selectedPhases.includes(phase.id)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border text-muted-foreground hover:border-primary/30'
                      )}
                    >
                      P{phase.id}: {phase.name}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Output / Reports */}
          <Tabs defaultValue="output">
            <TabsList>
              <TabsTrigger value="output">Live Output</TabsTrigger>
              <TabsTrigger value="analysis">Analysis Report</TabsTrigger>
              <TabsTrigger value="design">Design Spec</TabsTrigger>
              <TabsTrigger value="ux">UX Spec</TabsTrigger>
              <TabsTrigger value="seo">SEO Spec</TabsTrigger>
            </TabsList>
            <TabsContent value="output">
              <Card>
                <CardContent className="pt-4 space-y-3">
                  {error && (
                    <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium">Error</p>
                        <p className="mt-1">{error}</p>
                      </div>
                    </div>
                  )}
                  {isStreaming && !output && (
                    <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg text-sm">
                      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <div>
                        <p className="font-medium text-primary">Claude is processing...</p>
                        <p className="text-muted-foreground text-xs mt-0.5">
                          The analysis may take 1-5 minutes. Output will appear when Claude completes its response.
                        </p>
                      </div>
                    </div>
                  )}
                  <pre className="text-sm font-mono whitespace-pre-wrap max-h-[400px] overflow-auto p-4 bg-muted rounded-lg">
                    {output || (isStreaming ? 'Waiting for Claude response...' : 'No output yet. Start the analysis to see live progress.')}
                  </pre>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="analysis">
              <ReportViewer content={reports.analysis} title="Analysis Report" />
            </TabsContent>
            <TabsContent value="design">
              <ReportViewer content={reports.design} title="Design Specification" />
            </TabsContent>
            <TabsContent value="ux">
              <ReportViewer content={reports.ux} title="UX Specification" />
            </TabsContent>
            <TabsContent value="seo">
              <ReportViewer content={reports.seo} title="SEO Specification" />
            </TabsContent>
          </Tabs>
        </div>

        {/* Right sidebar: Phase progress */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Progress</CardTitle>
              <CardAction>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => { refetch(); fetchReports(); }}
                  title="Refresh progress & reports"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              <PhaseProgress phases={project?.phases || []} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
