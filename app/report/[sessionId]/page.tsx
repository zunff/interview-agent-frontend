'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useInterviewStore } from '../../../store/interviewStore';
import { api } from '../../../lib/api';
import ReportDisplay from '../../../components/ReportDisplay';
import { Button } from '../../../components/ui/button';
import ParticleBackground from '../../../components/ParticleBackground';
import ThemeToggle from '../../../components/ThemeToggle';
import { useTheme } from '../../../components/ThemeProvider';

export default function ReportPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const { report, setReport } = useInterviewStore();
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!sessionId) {
      router.push('/');
      return;
    }

    if (!report) {
      const fetchReport = async () => {
        try {
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
    <div className="min-h-screen relative">
      {/* Particle background for dark mode */}
      {resolvedTheme === 'dark' && <ParticleBackground />}

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="flex justify-between items-center mb-8 animate-fade-in-up">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
            面试报告
          </h1>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button
              variant="outline"
              onClick={() => router.push('/')}
              size="sm"
            >
              首页
            </Button>
          </div>
        </div>

        <div className="animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <ReportDisplay />
        </div>
      </div>
    </div>
  );
}
