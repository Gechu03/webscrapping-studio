'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ReportViewerProps {
  content: string;
  title?: string;
}

export function ReportViewer({ content, title }: ReportViewerProps) {
  if (!content) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No report content available yet
      </div>
    );
  }

  return (
    <div className="border rounded-lg">
      {title && (
        <div className="px-4 py-2 border-b bg-muted/30">
          <h3 className="text-sm font-medium">{title}</h3>
        </div>
      )}
      <ScrollArea className="h-[500px]">
        <div className="p-4 prose prose-sm max-w-none dark:prose-invert">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      </ScrollArea>
    </div>
  );
}
