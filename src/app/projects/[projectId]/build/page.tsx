'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  Pencil,
  Copy,
  Trash2,
  FileText,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useProject } from '@/hooks/use-project';
import { usePages } from '@/hooks/use-pages';
import { toast } from 'sonner';

export default function PageListPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const { project } = useProject(projectId);
  const { pages, loading, createPage, duplicatePage, deletePage } = usePages(projectId);
  const [newPageName, setNewPageName] = useState('');
  const [showNewInput, setShowNewInput] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleCreatePage = async () => {
    const name = newPageName.trim();
    if (!name) return;
    const page = await createPage(name);
    if (page) {
      toast.success(`Page "${name}" created`);
      setNewPageName('');
      setShowNewInput(false);
    } else {
      toast.error('Failed to create page');
    }
  };

  const handleDuplicate = async (pageId: string, pageName: string) => {
    const page = await duplicatePage(pageId);
    if (page) {
      toast.success(`Duplicated "${pageName}"`);
    } else {
      toast.error('Failed to duplicate page');
    }
  };

  const handleDelete = async (pageId: string, pageName: string) => {
    if (deletingId !== pageId) {
      setDeletingId(pageId);
      return;
    }
    const success = await deletePage(pageId);
    if (success) {
      toast.success(`Deleted "${pageName}"`);
    } else {
      toast.error('Cannot delete page (it may be the last one)');
    }
    setDeletingId(null);
  };

  if (!project) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-32 bg-muted animate-pulse rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/projects/${projectId}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-lg font-semibold">Pages</h2>
            <p className="text-xs text-muted-foreground">{project.name}</p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => setShowNewInput(true)}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          New Page
        </Button>
      </div>

      {/* New page input */}
      {showNewInput && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Page name (e.g. About, Contact, Pricing)"
                value={newPageName}
                onChange={(e) => setNewPageName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreatePage()}
                className="flex-1 px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
              />
              <Button size="sm" onClick={handleCreatePage} disabled={!newPageName.trim()}>
                Create
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowNewInput(false);
                  setNewPageName('');
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Page grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : pages.length === 0 ? (
        <div className="text-center py-16 space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
            <FileText className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium">No pages yet</h3>
          <p className="text-sm text-muted-foreground">
            Create your first page to start building.
          </p>
          <Button onClick={() => setShowNewInput(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Create First Page
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {pages.map((page) => (
            <Card
              key={page.id}
              className="group hover:border-primary/30 transition-colors"
            >
              <CardContent className="pt-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-muted-foreground" />
                    <h3 className="font-medium text-sm">{page.name}</h3>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">
                    /{page.slug}
                  </Badge>
                </div>

                <div className="text-xs text-muted-foreground space-y-1">
                  <p>{page.componentCount} component{page.componentCount !== 1 ? 's' : ''}</p>
                  <p>
                    Updated{' '}
                    {new Date(page.updatedAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-1.5 pt-1">
                  <Link href={`/projects/${projectId}/build/${page.id}`} className="flex-1">
                    <Button size="sm" className="w-full gap-1.5" variant="default">
                      <Pencil className="w-3 h-3" />
                      Edit
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDuplicate(page.id, page.name)}
                    title="Duplicate"
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant={deletingId === page.id ? 'destructive' : 'outline'}
                    onClick={() => handleDelete(page.id, page.name)}
                    onBlur={() => setDeletingId(null)}
                    title={deletingId === page.id ? 'Click again to confirm' : 'Delete'}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
