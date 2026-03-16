'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ClaudeConnection } from '@/components/settings/claude-connection';

export default function SettingsPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold">Settings</h2>

      <ClaudeConnection />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Framework</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Intelligence Files</p>
              <p className="text-xs text-muted-foreground">
                Pattern library, style catalog, component patterns
              </p>
            </div>
            <Badge variant="secondary">Loaded</Badge>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Agent System</p>
              <p className="text-xs text-muted-foreground">
                13 specialized agents with 54 skills
              </p>
            </div>
            <Badge variant="secondary">v3</Badge>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Sectors Covered</p>
              <p className="text-xs text-muted-foreground">
                Sector taxonomy with sub-categories
              </p>
            </div>
            <Badge variant="secondary">18 sectors</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Claude Code</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">CLI Status</p>
              <p className="text-xs text-muted-foreground">
                Claude Code CLI used as subprocess
              </p>
            </div>
            <Badge>Active</Badge>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Max Concurrent Processes</p>
              <p className="text-xs text-muted-foreground">
                Maximum parallel Claude processes
              </p>
            </div>
            <Badge variant="outline">2</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
