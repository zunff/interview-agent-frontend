import { create } from 'zustand';
import type {
  InterviewStatus,
  EvaluationResult,
  QuestionInfo,
} from '../types';
import { WebSocketClient } from '../lib/api';
import type { WebSocketClientLike } from '../lib/api';
import type { AudioEncoderManager } from '../lib/audioEncoderManager';

interface InterviewState {
  // 基本状态
  sessionId: string | null;
  currentQuestion: QuestionInfo | null;
  interviewStatus: InterviewStatus;
  interviewPhase: 'self_intro' | 'questioning';

  // 评估结果
  evaluationResults: EvaluationResult[];
  currentEvaluation: EvaluationResult | null;

  // 面试报告 (Markdown字符串)
  report: string | null;

  // WebSocket客户端
  wsClient: WebSocketClientLike | null;

  // 媒体控制
  isCameraEnabled: boolean;
  isMicEnabled: boolean;

  // 回答阶段
  answerPhase: 'waiting' | 'answering' | 'evaluating';
  answerStartTime: number | null;
  elapsedTime: number;

  // 面板可见性
  isQuestionPanelOpen: boolean;
  isEvaluationPanelOpen: boolean;

  // 音频播放状态
  audioPlaybackState: {
    isPlaying: boolean;
    hasError: boolean;
    errorMessage: string | null;
  };

  // 是否正在发送音频数据
  isRecordingAudio: boolean;

  // AudioEncoderManager getter（用于 useAudioPlayback 获取 encoder 引用）
  _audioEncoderGetter: (() => AudioEncoderManager | null) | null;

  // 动作
  setSessionId: (sessionId: string) => void;
  setCurrentQuestion: (question: QuestionInfo | null) => void;
  setInterviewStatus: (status: InterviewStatus) => void;
  addEvaluationResult: (result: EvaluationResult) => void;
  setCurrentEvaluation: (evaluation: EvaluationResult | null) => void;
  setReport: (report: string) => void;
  setWsClient: (client: WebSocketClientLike) => void;
  toggleCamera: () => void;
  toggleMic: () => void;
  setAnswerPhase: (phase: 'waiting' | 'answering' | 'evaluating') => void;
  setInterviewPhase: (phase: 'self_intro' | 'questioning') => void;
  setAnswerStartTime: (time: number | null) => void;
  setElapsedTime: (time: number) => void;
  toggleQuestionPanel: () => void;
  toggleEvaluationPanel: () => void;
  setAudioPlaying: (isPlaying: boolean) => void;
  setAudioError: (hasError: boolean, errorMessage: string | null) => void;
  resetAudioState: () => void;
  setIsRecordingAudio: (recording: boolean) => void;
  setAudioEncoderGetter: (getter: (() => AudioEncoderManager | null) | null) => void;
  clearState: () => void;
}

export const useInterviewStore = create<InterviewState>((set) => ({
  // 初始状态
  sessionId: null,
  currentQuestion: null,
  interviewStatus: '准备中',
  interviewPhase: 'self_intro',
  evaluationResults: [],
  currentEvaluation: null,
  report: null,
  wsClient: null,

  // 媒体控制
  isCameraEnabled: true,
  isMicEnabled: true,

  // 回答阶段
  answerPhase: 'waiting',
  answerStartTime: null,
  elapsedTime: 0,

  // 面板可见性
  isQuestionPanelOpen: true,
  isEvaluationPanelOpen: false,

  // 音频播放状态
  audioPlaybackState: {
    isPlaying: false,
    hasError: false,
    errorMessage: null,
  },

  // 是否正在发送音频数据
  isRecordingAudio: false,

  // AudioEncoderManager getter
  _audioEncoderGetter: null,

  // 动作
  setSessionId: (sessionId) => set({ sessionId }),
  setCurrentQuestion: (currentQuestion) => set({ currentQuestion }),
  setInterviewStatus: (interviewStatus) => set({ interviewStatus }),

  addEvaluationResult: (result) => set((state) => ({
    evaluationResults: [...state.evaluationResults, result],
    currentEvaluation: result
  })),

  setCurrentEvaluation: (currentEvaluation) => set({ currentEvaluation }),

  setReport: (report) => set({ report }),

  setWsClient: (wsClient) => set({ wsClient }),

  toggleCamera: () => set((state) => ({ isCameraEnabled: !state.isCameraEnabled })),
  toggleMic: () => set((state) => ({ isMicEnabled: !state.isMicEnabled })),

  setAnswerPhase: (answerPhase) => set({ answerPhase }),
  setInterviewPhase: (interviewPhase) => set({ interviewPhase }),
  setAnswerStartTime: (answerStartTime) => set({ answerStartTime }),
  setElapsedTime: (elapsedTime) => set({ elapsedTime }),

  toggleQuestionPanel: () => set((state) => ({
    isQuestionPanelOpen: !state.isQuestionPanelOpen
  })),
  toggleEvaluationPanel: () => set((state) => ({
    isEvaluationPanelOpen: !state.isEvaluationPanelOpen
  })),

  setAudioPlaying: (isPlaying) => set((state) => ({
    audioPlaybackState: { ...state.audioPlaybackState, isPlaying }
  })),

  setAudioError: (hasError, errorMessage) => set((state) => ({
    audioPlaybackState: { ...state.audioPlaybackState, hasError, errorMessage }
  })),

  resetAudioState: () => set({
    audioPlaybackState: { isPlaying: false, hasError: false, errorMessage: null }
  }),

  setIsRecordingAudio: (isRecordingAudio) => set({ isRecordingAudio }),

  setAudioEncoderGetter: (_audioEncoderGetter) => set({ _audioEncoderGetter }),

  clearState: () => set((state) => {
    state.wsClient?.close();
    return {
      sessionId: null,
      currentQuestion: null,
      interviewStatus: '准备中',
      interviewPhase: 'self_intro',
      evaluationResults: [],
      currentEvaluation: null,
      report: null,
      wsClient: null,
      isCameraEnabled: true,
      isMicEnabled: true,
      answerPhase: 'waiting',
      answerStartTime: null,
      elapsedTime: 0,
      isQuestionPanelOpen: true,
      isEvaluationPanelOpen: false,
      audioPlaybackState: { isPlaying: false, hasError: false, errorMessage: null },
      isRecordingAudio: false,
      _audioEncoderGetter: null,
    };
  })
}));

// Dev helper for testing
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).__INTERVIEW_STORE__ = useInterviewStore;
}
