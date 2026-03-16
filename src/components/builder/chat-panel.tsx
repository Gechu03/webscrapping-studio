'use client';

import { RecommendationChips } from './recommendation-chips';
import { ChatMessages } from './chat-messages';
import { ChatInput } from './chat-input';

interface ChatPanelProps {
  onChipClick: (patternType: string, patternName: string) => void;
  onSendMessage: (message: string) => void;
  isStreaming: boolean;
}

export function ChatPanel({ onChipClick, onSendMessage, isStreaming }: ChatPanelProps) {
  return (
    <div className="flex flex-col h-full border-l bg-background">
      {/* Recommendation chips at top */}
      <RecommendationChips onChipClick={onChipClick} disabled={isStreaming} />

      {/* Chat messages — scrollable middle */}
      <ChatMessages />

      {/* Input at bottom */}
      <ChatInput
        onSend={onSendMessage}
        disabled={isStreaming}
      />
    </div>
  );
}
