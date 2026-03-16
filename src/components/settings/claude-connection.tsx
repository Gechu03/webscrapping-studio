'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
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
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualCredentials, setManualCredentials] = useState('');
  const [submittingManual, setSubmittingManual] = useState(false);

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

  // Handle URL params from OAuth callback
  useEffect(() => {
    if (searchParams.get('claude_connected') === 'true') {
      toast.success('Claude Code connected successfully!');
      fetchStatus();
    }
    const error = searchParams.get('claude_error');
    if (error) {
      toast.error(`Claude connection failed: ${error}`);
    }
  }, [searchParams, fetchStatus]);

  const handleConnect = () => {
    window.location.href = '/api/auth/claude';
  };

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

  const handleManualSubmit = async () => {
    if (!manualCredentials.trim()) return;
    setSubmittingManual(true);
    try {
      const parsed = JSON.parse(manualCredentials);
      const res = await fetch('/api/auth/claude/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });
      if (res.ok) {
        toast.success('Claude Code credentials saved!');
        setManualCredentials('');
        setShowManual(false);
        fetchStatus();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to save credentials');
      }
    } catch {
      toast.error('Invalid JSON format');
    } finally {
      setSubmittingManual(false);
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
                <Button size="sm" onClick={handleConnect}>
                  Reconnect
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
              <Button size="sm" onClick={handleConnect}>
                Connect with Claude
              </Button>

              <div>
                <button
                  className="text-xs text-muted-foreground underline hover:text-foreground"
                  onClick={() => setShowManual(!showManual)}
                >
                  {showManual ? 'Hide manual connection' : 'Manual connection (paste credentials)'}
                </button>

                {showManual && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Run <code className="bg-muted px-1 rounded">claude login</code> locally, then
                      paste the contents of <code className="bg-muted px-1 rounded">~/.claude/.credentials.json</code>
                    </p>
                    <Textarea
                      placeholder='{"claudeAiOauth": { ... }}'
                      value={manualCredentials}
                      onChange={(e) => setManualCredentials(e.target.value)}
                      rows={6}
                      className="font-mono text-xs"
                    />
                    <Button
                      size="sm"
                      onClick={handleManualSubmit}
                      disabled={submittingManual || !manualCredentials.trim()}
                    >
                      {submittingManual ? 'Saving...' : 'Save Credentials'}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
