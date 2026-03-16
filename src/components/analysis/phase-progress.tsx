'use client';

import { CheckCircle2, Clock, Play, AlertCircle, SkipForward } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { Phase, PhaseStatus } from '@/types/project';

const statusConfig: Record<PhaseStatus, { icon: typeof Clock; color: string; bgColor: string }> = {
  pending: { icon: Clock, color: 'text-muted-foreground', bgColor: 'bg-muted' },
  running: { icon: Play, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  completed: { icon: CheckCircle2, color: 'text-green-600', bgColor: 'bg-green-100' },
  failed: { icon: AlertCircle, color: 'text-red-600', bgColor: 'bg-red-100' },
  skipped: { icon: SkipForward, color: 'text-muted-foreground', bgColor: 'bg-muted' },
};

interface PhaseProgressProps {
  phases: Phase[];
}

export function PhaseProgress({ phases }: PhaseProgressProps) {
  const completed = phases.filter((p) => p.status === 'completed').length;
  const progress = (completed / phases.length) * 100;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {completed} of {phases.length} phases completed
        </span>
        <span className="font-medium">{Math.round(progress)}%</span>
      </div>
      <Progress value={progress} className="h-2" />

      <div className="space-y-2">
        {phases.map((phase) => {
          const config = statusConfig[phase.status];
          const Icon = config.icon;

          return (
            <div
              key={phase.id}
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg transition-colors',
                phase.status === 'running' && 'bg-blue-50'
              )}
            >
              <div className={cn('p-1.5 rounded-full', config.bgColor)}>
                <Icon className={cn('w-4 h-4', config.color)} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-mono">
                    P{phase.id}
                  </span>
                  <span className="font-medium text-sm">{phase.label}</span>
                </div>
                <span className="text-xs text-muted-foreground capitalize">
                  {phase.status}
                </span>
              </div>
              {phase.status === 'running' && (
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
