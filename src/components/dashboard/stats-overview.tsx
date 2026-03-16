'use client';

import { FolderOpen, Layers, Zap, BarChart3 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface StatsProps {
  totalProjects: number;
  totalComponents: number;
  activeBuilds: number;
  patternsUsed: number;
}

export function StatsOverview({ totalProjects, totalComponents, activeBuilds, patternsUsed }: StatsProps) {
  const stats = [
    { label: 'Projects', value: totalProjects, icon: FolderOpen, color: 'text-blue-600' },
    { label: 'Components', value: totalComponents, icon: Layers, color: 'text-purple-600' },
    { label: 'Active Builds', value: activeBuilds, icon: Zap, color: 'text-amber-600' },
    { label: 'Patterns Used', value: patternsUsed, icon: BarChart3, color: 'text-green-600' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.label}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className={`${stat.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-semibold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
