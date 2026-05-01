'use client';

import { cn } from '@/lib/utils';
import { Loader2, Check, AlertCircle } from 'lucide-react';
import type { ProgressNode } from '@/store/resumeAnalysisStore';

interface AnalysisProgressProps {
  progressNodes: ProgressNode[];
}

const SEQUENTIAL_NODES = ['upload', 'parse', 'company', 'report'] as const;
const PARALLEL_NODES = ['skill', 'exp', 'bg', 'potential'] as const;

const NODE_LABELS: Record<string, string> = {
  upload: '上传文件',
  parse: '解析简历',
  company: '公司匹配',
  skill: '技能评分',
  exp: '经验评分',
  bg: '背景评分',
  potential: '潜力评分',
  report: '生成报告',
};

export function AnalysisProgress({ progressNodes }: AnalysisProgressProps) {
  const getNodeStatus = (node: string) => {
    return progressNodes.find((n) => n.node === node)?.status;
  };

  const isRunning = progressNodes.some(n => n.status === 'running');
  const allCompleted = progressNodes.every(n => n.status === 'completed');

  return (
    <div className="relative">
      {/* Sequential nodes with timeline */}
      <div className="space-y-1">
        {SEQUENTIAL_NODES.map((node, index) => (
          <TimelineNode
            key={node}
            node={node}
            status={getNodeStatus(node)}
            isLast={index === SEQUENTIAL_NODES.length - 1}
            showParallel={!allCompleted && node === 'company' && isRunning}
          >
            {node === 'company' && !allCompleted && isRunning && (
              <ParallelGrid nodes={PARALLEL_NODES.map(n => ({
                key: n,
                status: getNodeStatus(n)
              }))} />
            )}
          </TimelineNode>
        ))}
      </div>
    </div>
  );
}

function TimelineNode({
  node,
  status,
  isLast,
  showParallel,
  children,
}: {
  node: string;
  status?: 'running' | 'completed' | 'failed';
  isLast: boolean;
  showParallel?: boolean;
  children?: React.ReactNode;
}) {
  const label = NODE_LABELS[node] || node;
  const isActive = status === 'running';
  const isDone = status === 'completed';

  return (
    <div className="relative">
      <div className="flex items-start gap-4">
        {/* Icon column */}
        <div className="relative flex flex-col items-center">
          <div
            className={cn(
              'relative z-10 flex h-9 w-9 items-center justify-center rounded-full transition-all duration-300',
              isDone && 'bg-primary/10',
              isActive && 'bg-primary/15',
              !status && 'bg-muted/40'
            )}
          >
            {isActive && (
              <Loader2 className="h-5 w-5 text-primary animate-spin" />
            )}
            {isDone && <Check className="h-5 w-5 text-primary" />}
            {status === 'failed' && (
              <AlertCircle className="h-5 w-5 text-destructive" />
            )}
            {!status && (
              <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
            )}
          </div>
          {/* Connector line */}
          {!isLast && (
            <div
              className={cn(
                'absolute top-9 h-[calc(100%+0.25rem)] w-0.5 transition-colors duration-300',
                showParallel ? 'h-9' : '',
                isDone ? 'bg-primary/20' : 'bg-border'
              )}
            />
          )}
        </div>

        {/* Content column */}
        <div className="flex-1 pb-5">
          <div
            className={cn(
              'flex items-center gap-2 transition-colors duration-200',
              isActive && 'text-foreground',
              isDone && 'text-muted-foreground',
              !status && 'text-muted-foreground/50'
            )}
          >
            <span className={cn('text-sm font-medium', isActive && 'text-primary')}>
              {label}
            </span>
            {isActive && (
              <span className="text-xs text-primary/60 animate-pulse">处理中...</span>
            )}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

function ParallelGrid({ nodes }: { nodes: { key: string; status?: string }[] }) {
  return (
    <div className="mt-3 space-y-2">
      <div className="text-xs text-muted-foreground mb-2">并行评分中</div>
      <div className="overflow-hidden rounded-xl border border-primary/10 bg-primary/[0.02]">
        <div className="grid grid-cols-2 gap-3 p-3">
          {nodes.map(({ key, status }) => (
            <ParallelNode key={key} nodeKey={key} status={status as any} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ParallelNode({
  nodeKey,
  status,
}: {
  nodeKey: string;
  status?: 'running' | 'completed' | 'failed';
}) {
  const label = NODE_LABELS[nodeKey] || nodeKey;
  const isActive = status === 'running';
  const isDone = status === 'completed';

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg px-3 py-2.5 transition-all duration-200',
        isActive && 'bg-primary/10',
        isDone && 'bg-primary/5',
        !status && 'bg-muted/30'
      )}
    >
      <div className="shrink-0">
        {isActive && (
          <Loader2 className="h-4 w-4 text-primary animate-spin" />
        )}
        {isDone && <Check className="h-4 w-4 text-primary" />}
        {!status && (
          <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
        )}
      </div>
      <span
        className={cn(
          'text-sm transition-colors',
          isActive && 'text-primary font-medium',
          isDone && 'text-muted-foreground',
          !status && 'text-muted-foreground/50'
        )}
      >
        {label}
      </span>
    </div>
  );
}
