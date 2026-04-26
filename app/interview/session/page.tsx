'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useInterviewStore } from '../../../store/interviewStore';
import { useAudioPlayback } from '../../../hooks/useAudioPlayback';
import VideoInterview from '../../../components/VideoInterview';
import ReportDisplay from '../../../components/ReportDisplay';
import { ReportExperienceLayout } from '../../../components/ReportExperienceLayout';
import { Button } from '../../../components/ui/button';
import { Loader2 } from 'lucide-react';

export default function InterviewSessionPage() {
  const router = useRouter();
  const {
    interviewStatus,
    wsClient,
    hasSelfIntro,
    isReady,
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
  } = useInterviewStore();

  // 初始化音频播放
  useAudioPlayback();

  useEffect(() => {
    // 没有 wsClient 说明没有从表单页正确进入
    if (!wsClient) {
      router.back();
      return;
    }

    console.log('[Interview] useEffect 执行，开始注册事件监听器');
    console.log('[Interview] wsClient 类型:', wsClient.constructor.name);

    // 在 effect 内部创建 handler，确保注册和清理使用同一个引用
    const handlers = {
      sessionCreated: (data: { sessionId: string }) => {
        console.log('[Interview] 会话创建:', data.sessionId);
        setSessionId(data.sessionId);
      },
      selfIntro: (_data: unknown) => {
        console.log('[Interview] 收到 self_intro 信号');
        // 确保自我介绍阶段状态正确设置
        setInterviewPhase('self_intro');
        // 清理旧题目，避免重新进入面试时短暂显示上一轮问题
        setCurrentQuestion(null);
        // 标记已收到 self_intro 信号
        setHasSelfIntro(true);
        // self_intro 信号表示服务端已准备好，前端可以开始引导用户自我介绍
        // 录音启动逻辑在 useAudioPlayback 中处理
      },
      jobAnalysisComplete: (_data: unknown) => {
        console.log('[Interview] 收到 job_analysis_complete 信号');
        // 标记已收到 job_analysis_complete 信号
        setHasJobAnalysisComplete(true);
      },
      newQuestion: (data: { content: string; questionType: string; questionIndex: number; isFollowUp: boolean }) => {
        console.log('[Interview] 收到新问题:', data.content.substring(0, 50));
        setCurrentQuestion({
          content: data.content,
          type: data.questionType,
          index: data.questionIndex,
          isFollowUp: data.isFollowUp,
        });
        // 收到第一道技术题时切换到问答阶段
        setInterviewPhase('questioning');
        // 新题到达后先进入 waiting；用户开口触发 VAD 后由 startRecording() 切到 answering
        setAnswerPhase('waiting');
        setAnswerStartTime(null);
        // 评估间隙用户可能已触发开录：必须清掉，否则 isRecordingAudio 仍为 true，VAD 无法再 startRecording，按钮也会一直 disable
        setIsRecordingAudio(false);
        useInterviewStore.getState()._audioEncoderGetter?.()?.stopSending();
        console.log('[Interview] 已设置 currentQuestion 和 interviewPhase');
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
    wsClient.on('job_analysis_complete', handlers.jobAnalysisComplete);
    wsClient.on('new_question', handlers.newQuestion);
    wsClient.on('evaluation_result', handlers.evaluationResult);
    wsClient.on('final_report', handlers.finalReport);
    wsClient.on('answer_received', handlers.answerReceived);
    wsClient.on('error', handlers.error);

    console.log('[Interview] 事件监听器注册完成');

    return () => {
      wsClient.off('session_created', handlers.sessionCreated);
      wsClient.off('self_intro', handlers.selfIntro);
      wsClient.off('job_analysis_complete', handlers.jobAnalysisComplete);
      wsClient.off('new_question', handlers.newQuestion);
      wsClient.off('evaluation_result', handlers.evaluationResult);
      wsClient.off('final_report', handlers.finalReport);
      wsClient.off('answer_received', handlers.answerReceived);
      wsClient.off('error', handlers.error);
    };
  }, [wsClient, router, setSessionId, setCurrentQuestion, addEvaluationResult, setReport, setInterviewStatus, setAnswerPhase, setAnswerStartTime, setInterviewPhase, setHasSelfIntro, setHasJobAnalysisComplete, setIsRecordingAudio]);

  // 准备中加载界面：等待 self_intro 信号
  if (!hasSelfIntro) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="size-12 text-primary animate-spin mx-auto" />
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">准备中</h2>
            <p className="text-sm text-muted-foreground">正在初始化面试环境...</p>
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
