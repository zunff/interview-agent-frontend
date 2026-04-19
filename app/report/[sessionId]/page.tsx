'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useInterviewStore } from '../../../store/interviewStore';
import { api, isMockMode } from '../../../lib/api';
import { generateMockReport } from '../../../mock/data/report';
import { generateEvaluation } from '../../../mock/data/evaluations';
import ReportDisplay from '../../../components/ReportDisplay';
import { ReportExperienceLayout } from '../../../components/ReportExperienceLayout';
import { Button } from '../../../components/ui/button';

export default function ReportPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const { report, setReport } = useInterviewStore();

  useEffect(() => {
    if (!sessionId) {
      router.push('/');
      return;
    }

    if (!report) {
      const fetchReport = async () => {
        try {
          if (isMockMode()) {
            // Mock 模式：生成模拟报告
            const mockEvaluations = Array.from({ length: 3 }, (_, i) =>
              generateEvaluation(i + 1, '模拟面试问题'),
            );
            const mockReport = await generateMockReport(sessionId, mockEvaluations);
            setReport(mockReport);
            return;
          }
          const reportData = await api.getReport(sessionId);
          setReport(reportData.report);
        } catch (error) {
          console.error('获取报告失败:', error);
          router.push('/');
        }
      };

      fetchReport();
    }
  }, [sessionId, report, router, setReport]);

  return (
    <ReportExperienceLayout
      showPageHeading={false}
      contentClassName="max-w-7xl"
      headerExtra={
        <Button variant="outline" size="sm" onClick={() => router.push('/')}>
          首页
        </Button>
      }
    >
      <ReportDisplay />
    </ReportExperienceLayout>
  );
}
