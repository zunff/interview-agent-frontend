// 面试状态类型
export type InterviewStatus = '准备中' | '进行中' | '已结束';

// 题目信息
export interface QuestionInfo {
  content: string;
  type: string;
  index: number;
  isFollowUp?: boolean;
}

// WebSocket消息类型
export type WebSocketMessageType =
  | 'start_interview'
  | 'resume_interview'
  | 'audio_start'
  | 'video_frame'
  | 'audio_chunk'
  | 'answer_complete'
  | 'self_intro_complete'
  | 'session_created'
  | 'self_intro'
  | 'job_analysis_complete'
  | 'new_question'
  | 'evaluation_result'
  | 'final_report'
  | 'answer_received'
  | 'error'
  | 'audio_question_start'
  | 'audio_question_chunk'
  | 'audio_question_end'
  | 'audio_question_error'
  | 'interview_resumed';

// 具体消息类型定义

// 服务端 → 客户端：自我介绍阶段信号
export interface SelfIntroMessage {
  type: 'self_intro';
  payload: Record<string, never>;
  timestamp?: number;
}

// 服务端 → 客户端：岗位分析完成信号
export interface JobAnalysisCompleteMessage {
  type: 'job_analysis_complete';
  payload: Record<string, never>;
  timestamp?: number;
}

// 岗位级别（与 WebSocket start_interview 约定一致）
export type PositionLevel = 'junior' | 'mid' | 'senior' | 'expert';

// 客户端 → 服务端

export interface ResumeInterviewMessage {
  type: 'resume_interview';
  sessionId: string;
}

export interface StartInterviewMessage {
  type: 'start_interview';
  resume: string;
  jobInfo: string;
  maxTechnicalQuestions?: number;
  maxBusinessQuestions?: number;
  maxFollowUps?: number;
  positionLevel?: PositionLevel;
}

export interface AudioStartMessage {
  type: 'audio_start';
  startTimestampMs: number;
}

export interface VideoFrameMessage {
  type: 'video_frame';
  frame: string;
  timestampMs: number;
}

export interface AudioChunkMessage {
  type: 'audio_chunk';
  audio: string;
}

export interface AnswerCompleteMessage {
  type: 'answer_complete';
}

export interface SelfIntroCompleteMessage {
  type: 'self_intro_complete';
}

// 服务端 → 客户端

export interface SessionCreatedMessage {
  type: 'session_created';
  payload: {
    sessionId: string;
  };
  timestamp?: number;
}

export interface NewQuestionMessage {
  type: 'new_question';
  payload: {
    content: string;
    questionType: string;
    questionIndex: number;
    isFollowUp: boolean;
  };
  timestamp?: number;
}

export interface EvaluationResultMessage {
  type: 'evaluation_result';
  payload: EvaluationResult;
  timestamp?: number;
}

export interface FinalReportMessage {
  type: 'final_report';
  payload: {
    report: string;
  };
  timestamp?: number;
}

export interface AnswerReceivedMessage {
  type: 'answer_received';
  payload: {
    questionIndex?: number;
    message?: string;
  };
  timestamp?: number;
}

export interface ErrorMessage {
  type: 'error';
  payload: {
    message: string;
    code?: number;
  };
  timestamp?: number;
}

// 语音问题开始（TTS 合成开始）
export interface AudioQuestionStartMessage {
  type: 'audio_question_start';
  payload: {
    format: 'opus';
  };
  timestamp?: number;
}

// 语音问题结束（所有二进制音频帧已发送完毕）
export interface AudioQuestionEndMessage {
  type: 'audio_question_end';
  payload: {
    sessionId: string;
  };
  timestamp?: number;
}

// 语音问题错误（降级为纯文字模式）
export interface AudioQuestionErrorMessage {
  type: 'audio_question_error';
  payload: {
    message: string;
  };
  timestamp?: number;
}

// 面试已恢复（服务端 → 客户端）
export interface InterviewResumedMessage {
  type: 'interview_resumed';
  payload: {
    sessionId: string;
    currentRound: string;
    interruptNode: string;
  };
  timestamp?: number;
}

// 基础WebSocket消息类型
export interface BaseWebSocketMessage {
  type: string;
  payload?: any;
  timestamp?: number;
}

// 联合类型
export type WebSocketMessage =
  | StartInterviewMessage
  | ResumeInterviewMessage
  | AudioStartMessage
  | VideoFrameMessage
  | AudioChunkMessage
  | AnswerCompleteMessage
  | SelfIntroCompleteMessage
  | SessionCreatedMessage
  | SelfIntroMessage
  | JobAnalysisCompleteMessage
  | NewQuestionMessage
  | EvaluationResultMessage
  | FinalReportMessage
  | AnswerReceivedMessage
  | ErrorMessage
  | AudioQuestionStartMessage
  | AudioQuestionEndMessage
  | AudioQuestionErrorMessage
  | InterviewResumedMessage;

// 评估结果
export interface EvaluationResult {
  questionIndex: number;
  question: string;
  answer: string;
  accuracy: number;
  logic: number;
  fluency: number;
  confidence: number;
  emotionScore: number;
  bodyLanguageScore: number;
  voiceToneScore: number;
  overallScore: number;
  strengths: string[];
  weaknesses: string[];
  detailedEvaluation: string;
  needFollowUp: boolean;
  followUpSuggestion: string;
  modalityFollowUpSuggestion?: string;
  modalityConcern?: string;
}

// 情感分析数据类型 (前端展示用，从EvaluationResult提取)
export interface EmotionData {
  emotion: string;
  confidence: number;
  timestamp: number;
}

// 面试历史记录
export interface InterviewHistoryItem {
  sessionId: string;
  jobInfo: string;
  status: 'WAITING' | 'IN_PROGRESS' | 'WAITING_ANSWER' | 'DISCONNECTED' | 'FINISHED';
  currentQuestionIndex: number;
  maxTechnicalQuestions: number;
  maxBusinessQuestions: number;
  createTime: string;
  endTime: string | null;
}

// 分页结果
export interface PageResult<T> {
  records: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}
