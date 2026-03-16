'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useBuilderStore } from '@/stores/builder-store';
import { Bot, User, Info } from 'lucide-react';

export function ChatMessages() {
  const messages = useBuilderStore((s) => s.messages);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center text-muted-foreground">
          <Bot className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm font-medium">Start building</p>
          <p className="text-xs mt-1">
            Click a component chip above or type a prompt below
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={cn(
            'flex gap-2 text-sm',
            msg.role === 'user' && 'flex-row-reverse'
          )}
        >
          {/* Avatar */}
          <div
            className={cn(
              'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
              msg.role === 'user' && 'bg-primary text-primary-foreground',
              msg.role === 'assistant' && 'bg-muted',
              msg.role === 'system' && 'bg-blue-100 dark:bg-blue-900'
            )}
          >
            {msg.role === 'user' && <User className="w-3.5 h-3.5" />}
            {msg.role === 'assistant' && <Bot className="w-3.5 h-3.5" />}
            {msg.role === 'system' && <Info className="w-3.5 h-3.5" />}
          </div>

          {/* Bubble */}
          <div
            className={cn(
              'max-w-[85%] rounded-lg px-3 py-2',
              msg.role === 'user' && 'bg-primary text-primary-foreground',
              msg.role === 'assistant' && 'bg-muted',
              msg.role === 'system' && 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-xs italic'
            )}
          >
            <p className="whitespace-pre-wrap break-words leading-relaxed">
              {msg.content}
              {msg.isStreaming && (
                <span className="inline-block w-1.5 h-4 bg-current ml-0.5 animate-pulse rounded-sm" />
              )}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
