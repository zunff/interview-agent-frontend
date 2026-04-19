/**
 * Mock WebSocket 客户端
 *
 * 在 mock 模式下模拟真实 WebSocket 服务器行为，
 * 提供与 WebSocketClient 完全一致的 API。
 */

import type {
  WebSocketMessage,
  EvaluationResult,
  StartInterviewMessage,
  VideoFrameMessage,
  AudioChunkMessage,
  AnswerCompleteMessage,
  SelfIntroCompleteMessage,
} from '../types/index';
import { generateQuestionSequence, type MockQuestion } from '../mock/data/questions';
import { generateEvaluation } from '../mock/data/evaluations';
import { generateMockReport } from '../mock/data/report';

type MessageHandler = (data: unknown) => void;
type BinaryHandler = (data: ArrayBuffer) => void;
type ErrorHandler = (error: Error) => void;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 自我介绍结束后，模拟后端生成首题再推送 `new_question` 的等待时间 */
const MOCK_DELAY_BEFORE_FIRST_QUESTION_MS = 10_000;
/** 每题点击「回答完毕」后，模拟后端 LLM 思考再推送下一题 */
const MOCK_DELAY_LLM_BEFORE_NEXT_QUESTION_MS = 3_000;

/**
 * 模拟的 WebSocket 状态
 */
type MockReadyState = 'CONNECTING' | 'OPEN' | 'CLOSING' | 'CLOSED';

export class MockWebSocketClient {
  private messageHandlers: Map<string, MessageHandler[]> = new Map();
  private binaryHandlers: Map<string, BinaryHandler[]> = new Map();
  private errorHandlers: ErrorHandler[] = [];

  private readyState: MockReadyState = 'CLOSED';
  private intentionalClose = false;

  // 面试状态
  private sessionId: string = '';
  private currentQuestionIndex = 0;
  private questions: MockQuestion[] = [];
  private evaluations: EvaluationResult[] = [];
  private interviewConfig: {
    maxTechnicalQuestions: number;
    maxBusinessQuestions: number;
    maxFollowUps: number;
  } | null = null;

  // 音频接收统计
  private audioChunkCount = 0;
  private lastAudioLogTime = 0;
  private lastVideoFrameLogTime = 0;

  // 模拟 WebSocket 对象（用于兼容现有代码）
  private mockSocket = {
    readyState: 0, // WebSocket.OPEN
    binaryType: 'arraybuffer' as BinaryType,
  };

  constructor() {
    console.log('[MockWS] MockWebSocketClient 初始化');
  }

  /**
   * 模拟 WebSocket 连接
   */
  async connect(): Promise<typeof this.mockSocket> {
    console.log('[MockWS] 连接中...');
    this.readyState = 'CONNECTING';

    await sleep(300); // 模拟连接延迟

    this.readyState = 'OPEN';
    this.mockSocket.readyState = 1; // WebSocket.OPEN

    console.log('[MockWS] 连接成功');

    return this.mockSocket;
  }

  /**
   * 发送消息（模拟）
   */
  send(message: WebSocketMessage, _useBatch?: boolean): void {
    if (this.readyState !== 'OPEN') {
      console.warn('[MockWS] 连接未打开，消息被丢弃');
      return;
    }

    // 根据消息类型处理
    this.handleClientMessage(message);
  }

  /**
   * 启动面试
   */
  sendStartInterview(data: {
    resume: string;
    jobInfo: string;
    maxTechnicalQuestions?: number;
    maxBusinessQuestions?: number;
    maxFollowUps?: number;
    positionLevel?: StartInterviewMessage['positionLevel'];
  }): void {
    const message: StartInterviewMessage = {
      type: 'start_interview',
      resume: data.resume,
      jobInfo: data.jobInfo,
      maxTechnicalQuestions: data.maxTechnicalQuestions,
      maxBusinessQuestions: data.maxBusinessQuestions,
      maxFollowUps: data.maxFollowUps,
      ...(data.positionLevel ? { positionLevel: data.positionLevel } : {}),
    };
    this.send(message);
  }

  /**
   * 发送视频帧（静默消费，仅节流日志便于本地调试）
   */
  sendVideoFrame(frame: string, timestampMs: number): void {
    const now = Date.now();
    if (now - this.lastVideoFrameLogTime >= 5000) {
      console.log(
        `[MockWS] 发送 video_frame, timestampMs: ${timestampMs}, 帧数据大小: ${frame.length} chars (base64)`
      );
      this.lastVideoFrameLogTime = now;
    }
  }

  /**
   * 发送音频开始信号（静默消费）
   */
  sendAudioStart(_startTimestampMs: number): void {
    // 静默消费，不模拟服务器响应
  }

  /**
   * 发送音频块（静默消费）
   */
  sendAudioChunk(_audio: string): void {
    // 静默消费，不模拟服务器响应
  }

  /**
   * 标记回答完成
   */
  sendAnswerComplete(): void {
    const message: AnswerCompleteMessage = {
      type: 'answer_complete',
    };
    this.send(message);
  }

  /**
   * 标记自我介绍完成
   */
  sendSelfIntroComplete(): void {
    const message: SelfIntroCompleteMessage = {
      type: 'self_intro_complete',
    };
    this.send(message);
  }

  /**
   * 注册消息处理器
   */
  on<T extends WebSocketMessage>(
    type: T['type'],
    handler: (data: any) => void,
  ): void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, []);
    }
    this.messageHandlers.get(type)!.push(handler);
  }

  /**
   * 移除消息处理器
   */
  off<T extends WebSocketMessage>(
    type: T['type'],
    handler: (data: any) => void,
  ): void {
    const handlers = this.messageHandlers.get(type);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * 注册二进制消息处理器
   */
  onBinary(type: string, handler: (data: ArrayBuffer) => void): void {
    if (!this.binaryHandlers.has(type)) {
      this.binaryHandlers.set(type, []);
    }
    this.binaryHandlers.get(type)!.push(handler);
  }

  /**
   * 移除二进制消息处理器
   */
  offBinary(type: string, handler: (data: ArrayBuffer) => void): void {
    const handlers = this.binaryHandlers.get(type);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * 注册错误处理器
   */
  onError(handler: ErrorHandler): void {
    this.errorHandlers.push(handler);
  }

  /**
   * 移除错误处理器
   */
  offError(handler: ErrorHandler): void {
    const index = this.errorHandlers.indexOf(handler);
    if (index > -1) {
      this.errorHandlers.splice(index, 1);
    }
  }

  /**
   * 关闭连接
   */
  close(): void {
    this.intentionalClose = true;
    this.readyState = 'CLOSED';
    this.mockSocket.readyState = 3; // WebSocket.CLOSED
    console.log('[MockWS] 连接已关闭');
  }

  // ==================== 内部方法 ====================

  /**
   * 处理客户端消息，触发服务器响应
   */
  private async handleClientMessage(message: WebSocketMessage): Promise<void> {
    switch (message.type) {
      case 'start_interview':
        await this.handleStartInterview(message);
        break;
      case 'self_intro_complete':
        await this.handleSelfIntroComplete();
        break;
      case 'answer_complete':
        await this.handleAnswerComplete();
        break;
      case 'audio_start':
        console.log('[MockWS] 收到 audio_start，时间戳:', message.startTimestampMs);
        break;
      case 'video_frame':
      case 'audio_chunk':
        // 每 5 秒打印一次音频接收日志
        this.audioChunkCount++;
        const now = Date.now();
        if (now - this.lastAudioLogTime >= 5000) {
          console.log(`[MockWS] 累计收到 ${this.audioChunkCount} 个 audio_chunk`);
          this.lastAudioLogTime = now;
        }
        break;
      default:
        console.log('[MockWS] 收到消息:', message.type);
    }
  }

  /**
   * 处理 start_interview：生成 sessionId 和题目序列
   */
  private async handleStartInterview(message: StartInterviewMessage): Promise<void> {
    console.log('[MockWS] 收到 start_interview');

    // 生成 sessionId
    this.sessionId = `mock-session-${Date.now()}`;

    // 保存配置
    this.interviewConfig = {
      maxTechnicalQuestions: message.maxTechnicalQuestions ?? 6,
      maxBusinessQuestions: message.maxBusinessQuestions ?? 4,
      maxFollowUps: message.maxFollowUps ?? 2,
    };

    // 生成题目序列
    this.questions = generateQuestionSequence(
      this.interviewConfig.maxTechnicalQuestions,
      this.interviewConfig.maxBusinessQuestions,
      this.interviewConfig.maxFollowUps,
    );

    console.log(`[MockWS] 生成 ${this.questions.length} 道题目`);

    // 模拟服务器响应延迟
    await sleep(200);

    // 发送 session_created
    this.emit('session_created', { sessionId: this.sessionId });

    // 等待前端跳转到面试页面并注册事件监听器
    // 跳转 + useEffect 执行 + 事件注册需要一定时间
    await sleep(800);

    // 发送 self_intro
    this.emit('self_intro', {});

    await sleep(100);

    // 发送 job_analysis_complete
    this.emit('job_analysis_complete', {});
  }

  /**
   * 处理 self_intro_complete：开始第一道题
   */
  private async handleSelfIntroComplete(): Promise<void> {
    console.log('[MockWS] 自我介绍完成，模拟生成面试题中…');

    await sleep(MOCK_DELAY_BEFORE_FIRST_QUESTION_MS);

    console.log('[MockWS] 首题就绪，推送 new_question');
    await this.sendNextQuestion();
  }

  /**
   * 处理 answer_complete：生成评估结果，发送下一道题
   */
  private async handleAnswerComplete(): Promise<void> {
    console.log(`[MockWS] 回答完成，当前题目索引: ${this.currentQuestionIndex}`);

    // 发送 answer_received 确认
    this.emit('answer_received', {
      questionIndex: this.currentQuestionIndex,
      message: '回答已收到',
    });

    await sleep(500);

    // 生成评估结果
    const currentQuestion = this.questions[this.currentQuestionIndex - 1];
    const evaluation = generateEvaluation(
      this.currentQuestionIndex,
      currentQuestion.content,
    );
    this.evaluations.push(evaluation);

    // 发送评估结果
    this.emit('evaluation_result', evaluation);

    await sleep(300);

    // 检查是否还有下一道题
    if (this.currentQuestionIndex < this.questions.length) {
      console.log('[MockWS] 模拟 LLM 思考中…');
      await sleep(MOCK_DELAY_LLM_BEFORE_NEXT_QUESTION_MS);
      await this.sendNextQuestion();
    } else {
      // 面试结束，生成最终报告
      await this.sendFinalReport();
    }
  }

  /**
   * 发送下一道题
   */
  private async sendNextQuestion(): Promise<void> {
    const question = this.questions[this.currentQuestionIndex];
    this.currentQuestionIndex++;

    console.log(`[MockWS] 发送题目 ${this.currentQuestionIndex}/${this.questions.length}`);

    // 先发送 audio_question_error（模拟 TTS 降级为纯文字）
    this.emit('audio_question_error', {
      message: 'Mock 模式下不支持语音合成，使用纯文字模式',
    });

    await sleep(300);

    // 发送题目
    this.emit('new_question', {
      content: question.content,
      questionType: question.questionType,
      questionIndex: this.currentQuestionIndex,
      isFollowUp: question.questionType === '追问',
    });
  }

  /**
   * 发送最终报告
   */
  private async sendFinalReport(): Promise<void> {
    console.log('[MockWS] 面试结束，生成最终报告');

    await sleep(500);

    const report = await generateMockReport(this.sessionId, this.evaluations);
    this.emit('final_report', { report });
  }

  /**
   * 触发消息事件
   */
  private emit(type: string, payload: unknown): void {
    console.log(`[MockWS] 发送信号: ${type}`);
    const handlers = this.messageHandlers.get(type);
    if (handlers) {
      console.log(`[MockWS] 找到 ${handlers.length} 个处理器 for ${type}`);
      handlers.forEach((handler) => {
        try {
          handler(payload);
        } catch (error) {
          console.error(`[MockWS] 处理 ${type} 消息时出错:`, error);
        }
      });
    } else {
      console.warn(`[MockWS] 没有注册处理器 for ${type}`);
    }
  }
}
