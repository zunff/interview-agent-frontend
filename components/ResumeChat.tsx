'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { ChatMessage } from './ChatMessage';
import { useResumeAnalysisStore } from '@/store/resumeAnalysisStore';
import { resumeApi } from '@/lib/resumeApi';
import type { SSEEvent } from '@/lib/sseParser';
import { Loader2, Send } from 'lucide-react';

export function ResumeChat() {
  const MAX_TEXTAREA_HEIGHT = 160;
  const {
    sessionId,
    messages,
    addUserMessage,
    startAssistantMessage,
    addThinkingStep,
    setThinkingSummary,
    appendStreamText,
    finalizeStreamText,
    setError,
  } = useResumeAnalysisStore();

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Track if assistant message was created for this request
  const assistantCreatedRef = useRef(false);

  const adjustTextareaHeight = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
    el.style.overflowY = el.scrollHeight > MAX_TEXTAREA_HEIGHT ? 'auto' : 'hidden';
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    const el = messagesContainerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  useEffect(() => {
    // 仅滚动聊天面板内部，避免进入页面时触发整页跳转
    scrollToBottom(sending ? 'smooth' : 'auto');
  }, [messages.length, sending, scrollToBottom]);

  useEffect(() => {
    adjustTextareaHeight();
  }, [input, adjustTextareaHeight]);

  const handleSSEEvent = useCallback((event: SSEEvent) => {
    console.log('[Chat SSE]', event);

    switch (event.event) {
      case 'thinking_start':
        assistantCreatedRef.current = true;
        startAssistantMessage(true);
        break;

      case 'tool_status':
        const toolData = event.data as { state: string; tool?: string };
        addThinkingStep({ state: toolData.state, tool: toolData.tool });
        break;

      case 'thinking_end':
        const thinkingData = event.data as { summary?: string };
        if (thinkingData.summary) {
          setThinkingSummary(thinkingData.summary);
        }
        break;

      case 'message':
        // Fallback: create assistant message if thinking_start wasn't received
        if (!assistantCreatedRef.current) {
          startAssistantMessage(false);
          assistantCreatedRef.current = true;
        }
        appendStreamText(event.data as string);
        break;

      case 'done':
        finalizeStreamText();
        break;

      case 'error':
        setError((event.data as { error: string }).error);
        finalizeStreamText();
        break;
    }
  }, [startAssistantMessage, addThinkingStep, setThinkingSummary, appendStreamText, finalizeStreamText, setError]);

  const handleSend = async () => {
    const message = input.trim();
    if (!message || !sessionId || sending) return;

    setInput('');
    addUserMessage(message);
    assistantCreatedRef.current = false;
    setSending(true);

    try {
      await resumeApi.sendMessage(sessionId, message, handleSSEEvent);
    } catch (error) {
      console.error('Send message failed', error);
      setError(error instanceof Error ? error.message : '发送失败');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const lastMessage = messages[messages.length - 1];
  const isStreaming = sending && lastMessage?.role === 'assistant';

  return (
    <div className="flex h-[calc(100vh-7.5rem)] min-h-[560px] max-h-[820px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-muted/20 px-4 py-3">
        <h3 className="text-base font-semibold text-foreground sm:text-lg">对话问答</h3>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="custom-scrollbar flex-1 space-y-4 overflow-y-auto p-4"
      >
        {messages.length === 0 && (
          <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 py-8 text-center text-sm text-muted-foreground">
            <p>分析完成！你可以向 AI 提问关于这份简历的任何问题。</p>
            <p className="mt-2 text-xs">
              例如：&ldquo;这个候选人的技术能力怎么样？&rdquo;
            </p>
          </div>
        )}

        {messages.map((msg, index) => (
          <ChatMessage
            key={msg.id}
            message={msg}
            isStreaming={isStreaming && index === messages.length - 1}
          />
        ))}

      </div>

      {/* Input */}
      <div className="border-t border-border bg-background p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              adjustTextareaHeight();
            }}
            onKeyDown={handleKeyDown}
            placeholder="输入消息，按 Enter 发送..."
            rows={1}
            className={cn(
              'flex-1 resize-none rounded-xl border bg-background px-4 py-2.5 text-sm',
              'placeholder:text-muted-foreground/70',
              'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
              'border-border/80 hover:border-primary/40'
            )}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            size="icon"
            className={cn(
              'shrink-0 rounded-xl h-10 w-10',
              (!input.trim() || sending) && 'opacity-50'
            )}
          >
            {sending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
