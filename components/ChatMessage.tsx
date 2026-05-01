'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Loader2, Search, Lightbulb } from 'lucide-react';
import type { ChatMessage as ChatMessageType } from '@/store/resumeAnalysisStore';

const markdownComponents = {
  p: ({ children }: React.ComponentProps<'p'>) => (
    <p className="my-2 leading-7 break-words whitespace-pre-wrap">{children}</p>
  ),
  ul: ({ children }: React.ComponentProps<'ul'>) => (
    <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>
  ),
  ol: ({ children }: React.ComponentProps<'ol'>) => (
    <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>
  ),
  li: ({ children }: React.ComponentProps<'li'>) => (
    <li className="leading-7 break-words">{children}</li>
  ),
  blockquote: ({ children }: React.ComponentProps<'blockquote'>) => (
    <blockquote className="my-3 border-l-2 border-primary/40 pl-3 text-muted-foreground">
      {children}
    </blockquote>
  ),
  pre: ({ children }: React.ComponentProps<'pre'>) => (
    <pre className="my-3 overflow-x-auto rounded-lg border border-border/60 bg-background/70 p-3 text-xs leading-6">
      {children}
    </pre>
  ),
  code: ({ children, className }: React.ComponentProps<'code'>) => {
    const isBlock = Boolean(className?.includes('language-'));
    if (isBlock) {
      return <code className={cn('font-mono', className)}>{children}</code>;
    }
    return (
      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] break-all">
        {children}
      </code>
    );
  },
  table: ({ children }: React.ComponentProps<'table'>) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full min-w-[540px] border-collapse text-xs sm:text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }: React.ComponentProps<'thead'>) => (
    <thead className="bg-muted/50">{children}</thead>
  ),
  th: ({ children }: React.ComponentProps<'th'>) => (
    <th className="border border-border px-2 py-2 text-left align-top font-semibold break-words">
      {children}
    </th>
  ),
  td: ({ children }: React.ComponentProps<'td'>) => (
    <td className="border border-border px-2 py-2 align-top leading-6 break-words whitespace-pre-wrap">
      {children}
    </td>
  ),
  hr: () => <hr className="my-4 border-border/60" />,
};

interface ChatMessageProps {
  message: ChatMessageType;
  isStreaming?: boolean;
}

export function ChatMessage({ message, isStreaming }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const [thinkingOpen, setThinkingOpen] = useState(false);

  return (
    <div
      className={cn(
        'flex w-full',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={cn(
          'max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3',
          isUser
            ? 'bg-primary text-primary-foreground rounded-br-md'
            : 'bg-muted/50 text-foreground rounded-bl-md border border-border/50'
        )}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          <>
            {/* Thinking block */}
            {message.thinking && message.thinking.steps.length > 0 && (
              <Collapsible
                open={thinkingOpen}
                onOpenChange={setThinkingOpen}
                className="mb-3"
              >
                <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer w-full">
                  {thinkingOpen ? (
                    <ChevronDown className="size-3.5" />
                  ) : (
                    <ChevronRight className="size-3.5" />
                  )}
                  <span className="font-medium">
                    思考过程 ({message.thinking.steps.length} 步)
                  </span>
                  {isStreaming && (
                    <Loader2 className="size-3 animate-spin ml-auto" />
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-1.5">
                  {message.thinking.steps.map((step, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 text-xs text-muted-foreground pl-5"
                    >
                      {step.tool === 'search' ? (
                        <Search className="size-3.5" />
                      ) : (
                        <Lightbulb className="size-3.5" />
                      )}
                      <span>
                        {step.state === 'running'
                          ? '搜索中...'
                          : `搜索完成`}
                      </span>
                    </div>
                  ))}
                  {message.thinking.summary && (
                    <div className="mt-2 pt-2 border-t border-border/30 text-xs text-muted-foreground pl-5">
                      <span className="font-medium">总结：</span>
                      <span className="ml-1">{message.thinking.summary}</span>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Thinking indicator (streaming but no steps yet) */}
            {isStreaming && !message.thinking?.steps.length && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                <Loader2 className="size-3 animate-spin" />
                <span>思考中...</span>
              </div>
            )}

            {/* Answer content */}
            <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-7 break-words overflow-hidden prose-headings:my-3 prose-headings:font-semibold prose-p:my-2 prose-ul:my-2 prose-ol:my-2">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {message.content}
              </ReactMarkdown>
            </div>

            {/* Streaming cursor */}
            {isStreaming && (
              <span className="inline-block w-1.5 h-4 ml-1 bg-primary/70 animate-pulse rounded-full" />
            )}
          </>
        )}
      </div>
    </div>
  );
}