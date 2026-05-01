'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ReportExperienceLayout } from '@/components/ReportExperienceLayout';
import { resumeApi, type SessionListItem } from '@/lib/resumeApi';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { FileText, Clock, Loader2, ChevronRight } from 'lucide-react';

export default function ResumeHistoryPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    loadSessions(1);
  }, []);

  const loadSessions = async (page: number) => {
    setLoading(true);
    setError('');
    try {
      const result = await resumeApi.getSessionList({ page, size: pageSize });
      setSessions(result.records);
      setTotal(result.total);
      setCurrentPage(result.page);
      setTotalPages(result.pages);
    } catch {
      setError('加载会话列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleClickSession = (sessionId: string) => {
    router.push(`/resume/${sessionId}`);
  };

  return (
    <ReportExperienceLayout
      headerExtra={
        <Link
          href="/resume"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <FileText className="size-4" />
          <span>新建分析</span>
        </Link>
      }
      breadcrumbs={[
        { label: '首页', href: '/' },
        { label: '简历分析', href: '/resume' },
        { label: '历史会话' },
      ]}
      pageTitle="历史会话"
      pageDescription={`共 ${total} 条简历分析记录`}
    >
      <div className="w-full max-w-4xl mx-auto space-y-4">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-8 text-primary animate-spin" />
          </div>
        )}

        {error && (
          <div className="bg-destructive/10 text-destructive border border-destructive/20 p-4 rounded-lg text-center">
            {error}
            <Button onClick={() => loadSessions(1)} variant="outline" size="sm" className="ml-3">
              重试
            </Button>
          </div>
        )}

        {!loading && !error && sessions.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            <p>暂无历史会话</p>
            <Link href="/resume" className="mt-4 inline-block">
              <Button>开始新的简历分析</Button>
            </Link>
          </div>
        )}

        {!loading && !error && sessions.length > 0 && (
          <>
            <div className="space-y-3">
              {sessions.map((session) => (
                <Card
                  key={session.sessionId}
                  className="p-4 hover:border-primary/30 hover:shadow-md transition-all cursor-pointer group"
                  onClick={() => handleClickSession(session.sessionId)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <FileText className="size-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-foreground truncate">
                          简历分析 #{session.sessionId.slice(0, 8)}
                        </h3>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <Clock className="size-3" />
                          <span>{session.createTime || '未知时间'}</span>
                          {session.hasResume && (
                            <Badge variant="secondary" className="text-[10px]">
                              已上传简历
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={session.status === 'ACTIVE' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {session.status === 'ACTIVE' ? '活跃' : session.status}
                      </Badge>
                      <ChevronRight className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-6">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadSessions(currentPage - 1)}
                  disabled={currentPage <= 1}
                >
                  上一页
                </Button>
                <span className="text-sm text-muted-foreground">
                  第 {currentPage} / {totalPages} 页
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadSessions(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                >
                  下一页
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </ReportExperienceLayout>
  );
}