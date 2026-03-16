'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProjectCard } from '@/components/dashboard/project-card';
import { StatsOverview } from '@/components/dashboard/stats-overview';
import { useProjects } from '@/hooks/use-project';

export default function DashboardPage() {
  const { projects, loading } = useProjects();

  const totalComponents = projects.reduce((sum, p) => sum + p.componentCount, 0);
  const activeBuilds = projects.filter((p) => p.status === 'building' || p.status === 'analyzing').length;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Projects</h2>
          <p className="text-muted-foreground">
            Manage your website analysis and component building projects
          </p>
        </div>
        <Link href="/projects/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Project
          </Button>
        </Link>
      </div>

      <StatsOverview
        totalProjects={projects.length}
        totalComponents={totalComponents}
        activeBuilds={activeBuilds}
        patternsUsed={12}
      />

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-40 rounded-xl bg-muted animate-pulse"
            />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground mb-4">
            No projects yet. Create your first project to get started.
          </p>
          <Link href="/projects/new">
            <Button variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Create Project
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
