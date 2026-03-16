'use client';

import { use } from 'react';
import Link from 'next/link';
import {
  Search,
  Hammer,
  Download,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Play,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useProject } from '@/hooks/use-project';
import type { PhaseStatus } from '@/types/project';

const phaseStatusIcon: Record<PhaseStatus, React.ReactNode> = {
  pending: <Clock className="w-4 h-4 text-muted-foreground" />,
  running: <Play className="w-4 h-4 text-blue-500 animate-pulse" />,
  completed: <CheckCircle2 className="w-4 h-4 text-green-500" />,
  failed: <AlertCircle className="w-4 h-4 text-red-500" />,
  skipped: <Clock className="w-4 h-4 text-muted-foreground opacity-50" />,
};

const actions = [
  {
    label: 'Analysis Pipeline',
    description: 'Run the full analysis pipeline (Phases 0-6)',
    icon: Search,
    href: 'analysis',
    color: 'text-blue-600',
  },
  {
    label: 'Builder',
    description: 'Manage pages and build with chat, preview & recommendations',
    icon: Hammer,
    href: 'build',
    color: 'text-purple-600',
  },
  {
    label: 'Export',
    description: 'Export to React, Vue, vanilla HTML, or designer specs',
    icon: Download,
    href: 'export',
    color: 'text-green-600',
  },
];

export default function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const { project, loading } = useProject(projectId);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-32 bg-muted animate-pulse rounded-xl" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Project not found</p>
        <Link href="/">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold">{project.name}</h2>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{project.config.sector}</span>
            <span>·</span>
            <span className="capitalize">{project.config.outputFormat}</span>
            <span>·</span>
            <span>{project.config.style}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={`/projects/${projectId}/${action.href}`}
            >
              <Card className="hover:border-primary/30 transition-colors cursor-pointer h-full">
                <CardContent className="pt-6">
                  <Icon className={`w-6 h-6 ${action.color} mb-3`} />
                  <p className="font-medium">{action.label}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {action.description}
                  </p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <Separator />

      {/* Phase Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pipeline Phases</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {project.phases.map((phase) => (
              <div
                key={phase.id}
                className="flex items-center gap-3 text-sm"
              >
                {phaseStatusIcon[phase.status]}
                <span className="w-8 text-muted-foreground">P{phase.id}</span>
                <span className="font-medium flex-1">{phase.label}</span>
                <Badge variant="secondary" className="capitalize text-xs">
                  {phase.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Pages */}
      {project.pages && project.pages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Pages ({project.pages.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {project.pages.map((page) => (
                <div
                  key={page.id}
                  className="flex items-center justify-between py-2"
                >
                  <div>
                    <p className="font-medium text-sm">{page.name}</p>
                    <p className="text-xs text-muted-foreground">
                      /{page.slug} · {page.componentCount} component{page.componentCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Components */}
      {project.components.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Components ({project.components.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {project.components.map((component) => (
                <div
                  key={component.id}
                  className="flex items-center justify-between py-2"
                >
                  <div>
                    <p className="font-medium text-sm">{component.name}</p>
                    <p className="text-xs text-muted-foreground">
                      v{component.currentVersion} · {component.type}
                    </p>
                  </div>
                  <Badge
                    variant={
                      component.status === 'approved'
                        ? 'default'
                        : 'secondary'
                    }
                    className="text-xs"
                  >
                    {component.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
