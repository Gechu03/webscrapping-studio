'use client';

import { useState } from 'react';
import { Send, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface FeedbackInputProps {
  onSubmit: (feedback: string) => void;
  onApprove: () => void;
  isLoading: boolean;
  version: number;
}

export function FeedbackInput({
  onSubmit,
  onApprove,
  isLoading,
  version,
}: FeedbackInputProps) {
  const [feedback, setFeedback] = useState('');

  const handleSubmit = () => {
    if (!feedback.trim()) return;
    onSubmit(feedback.trim());
    setFeedback('');
  };

  return (
    <div className="space-y-3 p-4 border rounded-lg bg-card">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          Version {version}
        </p>
        <Button size="sm" onClick={onApprove} disabled={isLoading}>
          Approve Component
        </Button>
      </div>

      <div className="flex gap-2">
        <Textarea
          placeholder="Describe what you'd like to change..."
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          className="min-h-[60px]"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              handleSubmit();
            }
          }}
        />
        <div className="flex flex-col gap-2">
          <Button
            size="icon"
            onClick={handleSubmit}
            disabled={!feedback.trim() || isLoading}
            title="Send feedback (Ctrl+Enter)"
          >
            {isLoading ? (
              <RotateCcw className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Press Ctrl+Enter to send feedback. The component will be regenerated with your changes.
      </p>
    </div>
  );
}
