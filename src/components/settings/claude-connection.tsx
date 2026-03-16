'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface ConnectionStatus {
  connected: boolean;
  subscriptionType?: string;
  connectedAt?: string;
  expiresAt?: number;
  expired?: boolean;
}

export function ClaudeConnection() {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [manualCredentials, setManualCredentials] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/claude/status');
      if (res.ok) {
        setStatus(await res.json());
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const res = await fetch('/api/auth/claude/disconnect', { method: 'POST' });
      if (res.ok) {
        setStatus({ connected: false });
        toast.success('Claude Code disconnected');
      }
    } catch {
      toast.error('Failed to disconnect');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSubmit = async () => {
    if (!manualCredentials.trim()) return;
    setSubmitting(true);
    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(manualCredentials);
      } catch {
        toast.error('Invalid JSON — check that you copied the full file contents');
        setSubmitting(false);
        return;
      }
      const res = await fetch('/api/auth/claude/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });
      if (res.ok) {
        toast.success('Claude Code credentials saved!');
        setManualCredentials('');
        fetchStatus();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to save credentials');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save credentials');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Claude Code Account</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Claude Code Account</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {status?.connected ? (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Status</p>
                <p className="text-xs text-muted-foreground">
                  Your Claude Code account is linked
                </p>
              </div>
              <Badge variant={status.expired ? 'destructive' : 'default'}>
                {status.expired ? 'Token Expired' : 'Connected'}
              </Badge>
            </div>
            {status.subscriptionType && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Subscription</p>
                    <p className="text-xs text-muted-foreground">Account type</p>
                  </div>
                  <Badge variant="secondary">{status.subscriptionType}</Badge>
                </div>
              </>
            )}
            {status.connectedAt && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Connected Since</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(status.connectedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </>
            )}
            <Separator />
            <div className="flex gap-2">
              {status.expired && (
                <Button size="sm" variant="default" onClick={() => setStatus({ connected: false })}>
                  Update Credentials
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={handleDisconnect}
                disabled={disconnecting}
              >
                {disconnecting ? 'Disconnecting...' : 'Disconnect'}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Not Connected</p>
                <p className="text-xs text-muted-foreground">
                  Connect your Claude Code account to enable builds
                </p>
              </div>
              <Badge variant="outline">Disconnected</Badge>
            </div>
            <Separator />
            <div className="space-y-3">
              <div className="rounded-md bg-muted/50 p-3 space-y-2">
                <p className="text-sm font-medium">How to connect</p>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Install Claude Code CLI locally: <code className="bg-muted px-1 rounded">npm i -g @anthropic-ai/claude-code</code></li>
                  <li>Run <code className="bg-muted px-1 rounded">claude login</code> and authenticate in your browser</li>
                  <li>Copy the contents of <code className="bg-muted px-1 rounded">~/.claude/.credentials.json</code></li>
                  <li>Paste below and save</li>
                </ol>
              </div>
              <Textarea
                placeholder='{"claudeAiOauth": { ... }}'
                value={manualCredentials}
                onChange={(e) => setManualCredentials(e.target.value)}
                rows={6}
                className="font-mono text-xs"
              />
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={submitting || !manualCredentials.trim()}
              >
                {submitting ? 'Saving...' : 'Save Credentials'}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
