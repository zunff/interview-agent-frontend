'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useInterviewStore } from '../../../../store/interviewStore';
import { useAudioPlayback } from '../../../../hooks/useAudioPlayback';
import { createWebSocketClient } from '../../../../lib/createWebSocketClient';
import VideoInterview from '../../../../components/VideoInterview';
import ReportDisplay from '../../../../components/ReportDisplay';
import { ReportExperienceLayout } from '../../../../components/ReportExperienceLayout';
import { Button } from '../../../../components/ui/button';
import { Loader2 } from 'lucide-react';

export default function ResumeInterviewPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [connecting, setConnecting] = useState(true);
  const [resumeError, setResumeError] = useState('');
  const initializedRef = useRef(false);

  const {
    interviewStatus,
    wsClient,
    hasSelfIntro,
    setSessionId,
    setCurrentQuestion,
    addEvaluationResult,
    setReport,
    setInterviewStatus,
    setAnswerPhase,
    setAnswerStartTime,
    setInterviewPhase,
    setHasSelfIntro,
    setHasJobAnalysisComplete,
    setIsRecordingAudio,
    setWsClient,
  } = useInterviewStore();

  useAudioPlayback();

  // 建立连接并发送 resume_interview
  useEffect(() => {
    if (!sessionId) {
      router.push('/history');
      return;
    }

    // 防止严格模式下重复执行
    if (initializedRef.current) {
      return;
    }
    initializedRef.current = true;

    let client: ReturnType<typeof createWebSocketClient> | null = null;

    const init = async () => {
      try {
        client = createWebSocketClient();
        await client.connect();

        // 保存 wsClient 到 store
        setWsClient(client);
        setInterviewStatus('进行中');

        // 发送 resume_interview
        client.sendResumeInterview(sessionId);

        setConnecting(false);
      } catch (err) {
        console.error('[ResumeInterview] 连接失败:', err);
        setResumeError('连接服务器失败，请重试');
        setConnecting(false);
        initializedRef.current = false;
      }
    };

    init();

    return () => {
      // 组件卸载时，如果是错误导致的卸载，重置标志
      // 否则保持连接活跃
    };
  }, [sessionId, router, setWsClient, setInterviewStatus]);

  // 注册事件监听器
  useEffect(() => {
    if (!wsClient) return;

    const handlers = {
      interviewResumed: (data: { sessionId: string; currentRound: string; interruptNode: string }) => {
        console.log('[ResumeInterview] 面试已恢复:', data);
        setSessionId(data.sessionId);
      },
      selfIntro: (_data: unknown) => {
        console.log('[ResumeInterview] 收到 self_intro 信号');
        setInterviewPhase('self_intro');
        setCurrentQuestion(null);
        setHasSelfIntro(true);
      },
      jobAnalysisComplete: (_data: unknown) => {
        console.log('[ResumeInterview] 收到 job_analysis_complete 信号');
        setHasJobAnalysisComplete(true);
      },
      newQuestion: (data: { content: string; questionType: string; questionIndex: number; isFollowUp: boolean }) => {
        console.log('[ResumeInterview] 收到新问题:', data.content.substring(0, 50));
        setCurrentQuestion({
          content: data.content,
          type: data.questionType,
          index: data.questionIndex,
          isFollowUp: data.isFollowUp,
        });
        setInterviewPhase('questioning');
        setAnswerPhase('waiting');
        setAnswerStartTime(null);
        setIsRecordingAudio(false);
        useInterviewStore.getState()._audioEncoderGetter?.()?.stopSending();
        // 恢复面试时，收到 new_question 即视为准备好
        setHasSelfIntro(true);
        setHasJobAnalysisComplete(true);
      },
      evaluationResult: (data: unknown) => {
        addEvaluationResult(data as never);
        setAnswerPhase('evaluating');
      },
      finalReport: (data: { report: string }) => {
        setReport(data.report);
        setInterviewStatus('已结束');
      },
      answerReceived: (data: { message?: string }) => {
        console.log('[ResumeInterview] 回答已接收:', data);
      },
      error: (data: { message: string }) => {
        console.error('[ResumeInterview] WebSocket错误:', data.message);
        // 如果面试已结束，跳转到报告页
        if (data.message.includes('已结束') || data.message.includes('FINISHED')) {
          router.push(`/report/${sessionId}`);
        }
      },
    };

    wsClient.on('interview_resumed', handlers.interviewResumed);
    wsClient.on('self_intro', handlers.selfIntro);
    wsClient.on('job_analysis_complete', handlers.jobAnalysisComplete);
    wsClient.on('new_question', handlers.newQuestion);
    wsClient.on('evaluation_result', handlers.evaluationResult);
    wsClient.on('final_report', handlers.finalReport);
    wsClient.on('answer_received', handlers.answerReceived);
    wsClient.on('error', handlers.error);

    return () => {
      wsClient.off('interview_resumed', handlers.interviewResumed);
      wsClient.off('self_intro', handlers.selfIntro);
      wsClient.off('job_analysis_complete', handlers.jobAnalysisComplete);
      wsClient.off('new_question', handlers.newQuestion);
      wsClient.off('evaluation_result', handlers.evaluationResult);
      wsClient.off('final_report', handlers.finalReport);
      wsClient.off('answer_received', handlers.answerReceived);
      wsClient.off('error', handlers.error);
    };
  }, [wsClient, router, sessionId, setSessionId, setCurrentQuestion, addEvaluationResult, setReport, setInterviewStatus, setAnswerPhase, setAnswerStartTime, setInterviewPhase, setHasSelfIntro, setHasJobAnalysisComplete, setIsRecordingAudio]);

  // 连接中
  if (connecting) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="size-12 text-primary animate-spin mx-auto" />
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">正在重新连接</h2>
            <p className="text-sm text-muted-foreground">正在恢复面试会话...</p>
          </div>
        </div>
      </div>
    );
  }

  // 连接失败
  if (resumeError) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">恢复失败</h2>
            <p className="text-sm text-muted-foreground">{resumeError}</p>
          </div>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => router.push('/history')}>
              返回历史
            </Button>
            <Button onClick={() => window.location.reload()}>
              重试
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 等待恢复信号
  if (!hasSelfIntro) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="size-12 text-primary animate-spin mx-auto" />
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">正在恢复面试</h2>
            <p className="text-sm text-muted-foreground">加载面试状态中...</p>
          </div>
        </div>
      </div>
    );
  }

  if (interviewStatus === '已结束') {
    return (
      <ReportExperienceLayout
        showPageHeading={false}
        contentClassName="max-w-7xl"
        headerExtra={
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            返回
          </Button>
        }
      >
        <ReportDisplay />
        <div className="mt-10 flex justify-center animate-fade-in-up">
          <Button size="lg" className="min-w-[160px] px-8" onClick={() => router.push('/')}>
            重新开始
          </Button>
        </div>
      </ReportExperienceLayout>
    );
  }

  return <VideoInterview />;
}
