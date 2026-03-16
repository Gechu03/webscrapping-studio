'use client';

import Link from 'next/link';
import { Layers, Code, Palette, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ProjectSummary } from '@/types/project';

const formatIcons: Record<string, React.ReactNode> = {
  react: <Code className="w-3.5 h-3.5" />,
  vue: <Code className="w-3.5 h-3.5" />,
  vanilla: <FileText className="w-3.5 h-3.5" />,
  designer: <Palette className="w-3.5 h-3.5" />,
};

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  analyzing: 'bg-blue-100 text-blue-700',
  building: 'bg-amber-100 text-amber-700',
  completed: 'bg-green-100 text-green-700',
};

export function ProjectCard({ project }: { project: ProjectSummary }) {
  return (
    <Link href={`/projects/${project.id}`}>
      <Card className="hover:border-primary/30 transition-colors cursor-pointer">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <CardTitle className="text-base">{project.name}</CardTitle>
            <Badge
              variant="secondary"
              className={statusColors[project.status] || ''}
            >
              {project.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{project.sector}</p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              {formatIcons[project.outputFormat]}
              <span className="capitalize">{project.outputFormat}</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Layers className="w-3.5 h-3.5" />
              <span>{project.componentCount} components</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Updated {new Date(project.updatedAt).toLocaleDateString()}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
