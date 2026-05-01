'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ReportExperienceLayout } from '@/components/ReportExperienceLayout';
import { RadarChart } from '@/components/RadarChart';
import { ResumeChat } from '@/components/ResumeChat';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { History, Loader2, FileText } from 'lucide-react';
import { resumeApi } from '@/lib/resumeApi';
import { useResumeAnalysisStore, type RadarChartData } from '@/store/resumeAnalysisStore';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function ResumeSessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const {
    setSessionId,
    setRadarChartData,
    setReport,
    setPhase,
    setMessages,
    sessionId: currentSessionId,
    radarChartData,
    report,
    reset,
  } = useResumeAnalysisStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const hasLoadedRef = useRef(false);

  const loadAnalysis = useCallback(async (id: string) => {
    setLoading(true);
    setError('');
    try {
      setSessionId(id);
      const result = await resumeApi.getAnalysis(id);
      console.log('[Analysis result]', result);
      if (result.hasAnalysis) {
        if (result.radarChartData) {
          const parsed: RadarChartData = JSON.parse(result.radarChartData);
          setRadarChartData(parsed);
        }
        if (result.reportMarkdown) {
          console.log('[Report loaded]', result.reportMarkdown.substring(0, 100) + '...');
          setReport(result.reportMarkdown);
        } else {
          console.warn('[No reportMarkdown in response]');
        }
      } else {
        console.warn('[No analysis found]');
      }
      setPhase('report_ready');
      hasLoadedRef.current = true;

      // 恢复历史对话消息（只保留 user/assistant）
      try {
        const sessionInfo = await resumeApi.getSessionInfo(id);
        if (sessionInfo.messages?.length) {
          setMessages(
            sessionInfo.messages
              .filter(m => m.role === 'user' || m.role === 'assistant')
              .map((m, i) => ({
                id: `${m.role}-${i}`,
                role: m.role as 'user' | 'assistant',
                content: m.content,
              }))
          );
        }
      } catch {
        console.warn('加载历史消息失败，可能后端接口暂不可用');
      }
    } catch {
      setError('加载分析结果失败');
    } finally {
      setLoading(false);
    }
  }, [setSessionId, setRadarChartData, setReport, setPhase, setMessages]);

  useEffect(() => {
    if (!sessionId) return;

    // 避免重复加载同一个会话
    if (hasLoadedRef.current && sessionId === currentSessionId) {
      setLoading(false);
      return;
    }

    if (sessionId !== currentSessionId) {
      reset();
      hasLoadedRef.current = false;
    }

    loadAnalysis(sessionId);
  }, [sessionId, currentSessionId, reset, loadAnalysis]);

  return (
    <ReportExperienceLayout
      headerExtra={
        <>
          <Link
            href="/resume/history"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <History className="size-4" />
            <span>历史会话</span>
          </Link>
          <Link
            href="/resume"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <FileText className="size-4" />
            <span>新建分析</span>
          </Link>
        </>
      }
      breadcrumbs={[
        { label: '首页', href: '/' },
        { label: '简历分析', href: '/resume' },
        { label: '会话详情' },
      ]}
      showPageHeading={false}
      contentClassName="max-w-7xl"
    >
      <div className="space-y-6">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-8 text-primary animate-spin" />
          </div>
        )}

        {error && (
          <div className="bg-destructive/10 text-destructive border border-destructive/20 p-4 rounded-lg text-center">
            {error}
            <Button onClick={() => loadAnalysis(sessionId)} variant="outline" size="sm" className="ml-3">
              重试
            </Button>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* 总览区域 */}
            <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-card/70 p-5 shadow-[0_24px_70px_-38px_rgba(8,145,178,0.55)] backdrop-blur-sm sm:p-6">
              <div className="pointer-events-none absolute -right-14 -top-16 h-48 w-48 rounded-full bg-primary/15 blur-3xl" />
              <div className="pointer-events-none absolute -left-16 -bottom-20 h-52 w-52 rounded-full bg-cyan-400/10 blur-3xl dark:bg-cyan-300/10" />
              <div className="relative flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary/90">Resume Intelligence</p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">简历分析总览</h2>
                </div>
                <Badge variant="secondary" className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-primary">
                  历史分析结果
                </Badge>
              </div>
            </section>

            {/* 左右分栏布局 */}
            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(380px,1fr)]">
              {/* 左侧：雷达图 + 报告 */}
              <div className="space-y-6 min-w-0">
                {/* 雷达图 */}
                {radarChartData && (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <RadarChart data={radarChartData} dimensionScores={radarChartData.dimensions} />
                  </div>
                )}

                {/* 报告 */}
                {report && (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="overflow-hidden rounded-3xl border border-border/70 bg-card/90 shadow-[0_20px_60px_-40px_rgba(0,0,0,0.6)]">
                      <div className="relative flex items-center justify-between border-b border-border/70 bg-gradient-to-r from-primary/[0.12] via-primary/[0.04] to-transparent px-5 py-4">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.12em] text-primary/80">Analysis Report</p>
                          <h3 className="text-lg font-semibold text-foreground">
                            分析报告
                          </h3>
                        </div>
                        <Badge variant="secondary" className="hidden rounded-full bg-background/80 text-xs text-muted-foreground sm:inline-flex">
                          Markdown 实时渲染
                        </Badge>
                      </div>
                      <div className="p-6 sm:p-7">
                        <div className="prose prose-sm prose-headings:scroll-mt-24 prose-table:my-6 prose-table:w-full prose-th:border prose-th:border-border prose-th:bg-muted/60 prose-th:px-3 prose-th:py-2 prose-th:text-left prose-td:border prose-td:border-border prose-td:px-3 prose-td:py-2 dark:prose-invert max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{report}</ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 右侧：对话面板 */}
              <div className="min-w-0 xl:sticky xl:top-24">
                {sessionId && (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <ResumeChat />
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </ReportExperienceLayout>
  );
}
