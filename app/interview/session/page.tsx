'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useInterviewStore } from '../../../store/interviewStore';
import { useAudioPlayback } from '../../../hooks/useAudioPlayback';
import VideoInterview from '../../../components/VideoInterview';
import ReportDisplay from '../../../components/ReportDisplay';
import { Button } from '../../../components/ui/button';

export default function InterviewSessionPage() {
  const router = useRouter();
  const {
    interviewStatus,
    wsClient,
    setSessionId,
    setCurrentQuestion,
    addEvaluationResult,
    setReport,
    setInterviewStatus,
    setAnswerPhase,
    setAnswerStartTime,
    setInterviewPhase,
  } = useInterviewStore();

  // 初始化音频播放
  useAudioPlayback();

  useEffect(() => {
    // 没有 wsClient 说明没有从表单页正确进入
    if (!wsClient) {
      router.push('/');
      return;
    }

    // 在 effect 内部创建 handler，确保注册和清理使用同一个引用
    const handlers = {
      sessionCreated: (data: { sessionId: string }) => {
        console.log('[Interview] 会话创建:', data.sessionId);
        setSessionId(data.sessionId);
      },
      selfIntro: (_data: unknown) => {
        console.log('[Interview] 进入自我介绍阶段');
        // self_intro 信号表示服务端已准备好，前端可以开始引导用户自我介绍
        // 录音启动逻辑在 useAudioPlayback 中处理
      },
      newQuestion: (data: { content: string; questionType: string; questionIndex: number; isFollowUp: boolean }) => {
        setCurrentQuestion({
          content: data.content,
          type: data.questionType,
          index: data.questionIndex,
          isFollowUp: data.isFollowUp,
        });
        // 收到第一道技术题时切换到问答阶段
        setInterviewPhase('questioning');
        // answerPhase 和 answerStartTime 的设置延迟到 beep 播放完毕后，
        // 由 useAudioPlayback 中的 startRecording() 触发
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
        console.log('[Interview] 回答已接收:', data);
      },
      error: (data: { message: string }) => {
        console.error('[Interview] WebSocket错误:', data.message);
      },
    };

    wsClient.on('session_created', handlers.sessionCreated);
    wsClient.on('self_intro', handlers.selfIntro);
    wsClient.on('new_question', handlers.newQuestion);
    wsClient.on('evaluation_result', handlers.evaluationResult);
    wsClient.on('final_report', handlers.finalReport);
    wsClient.on('answer_received', handlers.answerReceived);
    wsClient.on('error', handlers.error);

    return () => {
      wsClient.off('session_created', handlers.sessionCreated);
      wsClient.off('self_intro', handlers.selfIntro);
      wsClient.off('new_question', handlers.newQuestion);
      wsClient.off('evaluation_result', handlers.evaluationResult);
      wsClient.off('final_report', handlers.finalReport);
      wsClient.off('answer_received', handlers.answerReceived);
      wsClient.off('error', handlers.error);
    };
  }, [wsClient, router, setSessionId, setCurrentQuestion, addEvaluationResult, setReport, setInterviewStatus, setAnswerPhase, setAnswerStartTime, setInterviewPhase]);

  if (interviewStatus === '已结束') {
    return (
      <div className="min-h-screen bg-background p-6 sm:p-10">
        <div className="max-w-4xl mx-auto animate-fade-in-up">
          <h1 className="text-4xl font-bold text-foreground mb-8">
            面试结束
          </h1>
          <ReportDisplay />
          <div className="mt-8">
            <Button
              onClick={() => router.push('/')}
              size="lg"
              className="px-8"
            >
              重新开始
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <VideoInterview />;
}
