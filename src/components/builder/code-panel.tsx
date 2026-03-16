'use client';

import { Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CodePanelProps {
  code: string;
  language?: string;
}

export function CodePanel({ code }: CodePanelProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative border rounded-lg bg-zinc-950 text-zinc-100">
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
        <span className="text-xs text-zinc-400">Generated Code</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-zinc-400 hover:text-zinc-100"
          onClick={handleCopy}
        >
          {copied ? (
            <Check className="w-3.5 h-3.5" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </Button>
      </div>
      <ScrollArea className="h-[300px]">
        <pre className="p-4 text-sm font-mono whitespace-pre-wrap break-words">
          {code || 'No code generated yet. Select a component and click Generate.'}
        </pre>
      </ScrollArea>
    </div>
  );
}
