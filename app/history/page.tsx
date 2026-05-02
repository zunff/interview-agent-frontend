'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ReportExperienceLayout } from '../../components/ReportExperienceLayout';
import { api, isMockMode } from '../../lib/api';
import { formatDate, formatTime } from '../../lib/format';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction } from '../../components/ui/card';
import {
  Loader2,
  Search,
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  FileText,
  AlertCircle,
  ChevronRightIcon,
  RotateCcw,
} from 'lucide-react';
import type { InterviewHistoryItem, PageResult } from '../../types/index';

const STATUS_MAP: Record<InterviewHistoryItem['status'], { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  WAITING: { label: '等待中', variant: 'secondary' },
  IN_PROGRESS: { label: '进行中', variant: 'default' },
  WAITING_ANSWER: { label: '等待回答', variant: 'default' },
  DISCONNECTED: { label: '已断开', variant: 'destructive' },
  FINISHED: { label: '已完成', variant: 'outline' },
};

const STATUS_DOT: Record<InterviewHistoryItem['status'], string> = {
  WAITING: 'bg-muted-foreground',
  IN_PROGRESS: 'bg-blue-500 animate-pulse',
  WAITING_ANSWER: 'bg-amber-500 animate-pulse',
  DISCONNECTED: 'bg-destructive',
  FINISHED: 'bg-emerald-500',
};

function generateMockHistory(): PageResult<InterviewHistoryItem> {
  const statuses: InterviewHistoryItem['status'][] = ['FINISHED', 'IN_PROGRESS', 'WAITING', 'DISCONNECTED'];
  const jobs = [
    '高级前端工程师',
    'Java 后端开发',
    '全栈工程师',
    'Python 开发工程师',
    '产品经理',
  ];

  const records: InterviewHistoryItem[] = Array.from({ length: 10 }, (_, i) => {
    const createDate = new Date(Date.now() - i * 86400000 * Math.random() * 3);
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const isFinished = status === 'FINISHED';

    return {
      sessionId: `mock-session-${i + 1}`,
      jobInfo: jobs[Math.floor(Math.random() * jobs.length)],
      status,
      currentQuestionIndex: isFinished ? 10 : Math.floor(Math.random() * 10),
      maxTechnicalQuestions: 6,
      maxBusinessQuestions: 4,
      createTime: createDate.toISOString(),
      endTime: isFinished ? new Date(createDate.getTime() + 3600000).toISOString() : null,
    };
  });

  return {
    records,
    total: 35,
    page: 1,
    size: 10,
    pages: 4,
  };
}

export default function HistoryPage() {
  const router = useRouter();
  const [historyData, setHistoryData] = useState<PageResult<InterviewHistoryItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [resumingSession, setResumingSession] = useState<string | null>(null);
  const pageSize = 10;

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      if (isMockMode()) {
        await new Promise(resolve => setTimeout(resolve, 500));
        setHistoryData(generateMockHistory());
      } else {
        const data = await api.getHistory({ page, size: pageSize, keyword: keyword || undefined });
        setHistoryData(data);
      }
    } catch (err) {
      console.error('获取面试历史失败:', err);
      setError('加载失败，请重试');
    } finally {
      setLoading(false);
    }
  }, [page, keyword]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleSearch = () => {
    setKeyword(searchInput);
    setPage(1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleResume = useCallback((sessionId: string) => {
    if (resumingSession) return;
    setResumingSession(sessionId);
    router.push(`/interview/resume/${sessionId}`);
  }, [resumingSession, router]);

  return (
    <ReportExperienceLayout
      pageTitle="面试历史"
      pageDescription="查看您的历史面试记录和评估报告"
      headerExtra={
        <Button variant="outline" size="sm" asChild>
          <Link href="/">返回首页</Link>
        </Button>
      }
    >
      {/* Search Bar */}
      <div className="w-full max-w-4xl mx-auto mb-6">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="搜索岗位信息..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border bg-background text-sm transition-all
                placeholder:text-muted-foreground/70
                focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary
                border-border hover:border-primary/30"
            />
          </div>
          <Button onClick={handleSearch} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : '搜索'}
          </Button>
        </div>
      </div>

      {/* History List */}
      <div className="w-full max-w-4xl mx-auto space-y-4">
        {loading && !historyData ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-8 text-primary animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <AlertCircle className="size-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={fetchHistory}>
              重试
            </Button>
          </div>
        ) : !historyData || historyData.records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <FileText className="size-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">暂无面试记录</p>
            <Button asChild>
              <Link href="/">开始面试</Link>
            </Button>
          </div>
        ) : (
          <>
            {historyData.records.map((item, index) => {
              const statusInfo = STATUS_MAP[item.status];
              const canResume = item.status !== 'FINISHED';

              return (
                <Card
                  key={item.sessionId}
                  className="hover:border-primary/30 hover:shadow-md transition-all animate-in fade-in slide-in-from-bottom-4"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="truncate">{item.jobInfo}</CardTitle>
                    <CardDescription className="flex items-center gap-4 text-xs">
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3" />
                        {formatDate(item.createTime)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {formatTime(item.createTime)}
                      </span>
                    </CardDescription>
                    <CardAction>
                      <div className="flex items-center gap-2">
                        <span className={`size-2 rounded-full shrink-0 ${STATUS_DOT[item.status]}`} />
                        <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                      </div>
                    </CardAction>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>技术题 {item.maxTechnicalQuestions} 道</span>
                        <span>业务题 {item.maxBusinessQuestions} 道</span>
                        {item.status === 'FINISHED' && item.endTime && (
                          <span>用时 {Math.round((new Date(item.endTime).getTime() - new Date(item.createTime).getTime()) / 60000)} 分钟</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {canResume ? (
                          <Button
                            variant="default"
                            size="sm"
                            className="gap-2"
                            disabled={resumingSession === item.sessionId}
                            onClick={() => handleResume(item.sessionId)}
                          >
                            <Loader2 className={`size-4 ${resumingSession === item.sessionId ? 'animate-spin' : 'hidden'}`} />
                            <RotateCcw className={`size-4 ${resumingSession === item.sessionId ? 'hidden' : 'block'}`} />
                            {resumingSession === item.sessionId ? '加载中...' : '恢复面试'}
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            asChild
                          >
                            <Link href={`/report/${item.sessionId}`}>
                              查看报告
                              <ChevronRightIcon className="size-4" />
                            </Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {/* Pagination */}
            {historyData.pages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={page === 1 || loading}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="text-sm text-muted-foreground px-4">
                  {page} / {historyData.pages}
                </span>
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={page >= historyData.pages || loading}
                  onClick={() => setPage(p => Math.min(historyData.pages, p + 1))}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </ReportExperienceLayout>
  );
}
