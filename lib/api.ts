import type {
  WebSocketMessage,
  VideoFrameMessage,
  AudioChunkMessage,
  AnswerCompleteMessage,
  SelfIntroCompleteMessage,
  StartInterviewMessage,
  AudioStartMessage,
} from '../types/index.js';

// Re-export 工厂函数，供组件使用
export { createWebSocketClient, isMockMode } from './createWebSocketClient';
export type { WebSocketClientLike } from './createWebSocketClient';

// API基础URL
const API_BASE_URL = process.env.API_BASE_URL || ''; // 使用相对路径，通过Next.js代理
const WS_BASE_URL = process.env.WS_BASE_URL || 'ws://localhost:8080';

// REST API调用函数
export const api = {
  // 获取面试报告
  async getReport(sessionId: string) {
    const response = await fetch(`${API_BASE_URL}/api/interview/report/${sessionId}`);

    if (!response.ok) {
      throw new Error('获取面试报告失败');
    }

    const result = await response.json();
    return result.data;
  },
};

// WebSocket客户端类
export class WebSocketClient {
  private socket: WebSocket | null = null;
  private messageHandlers: Map<string, ((data: unknown) => void)[]> = new Map();
  private binaryMessageHandlers: Map<string, ((data: ArrayBuffer) => void)[]> = new Map();
  private errorHandlers: ((error: Error) => void)[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private baseReconnectDelay = 1000; // 基础重连延迟
  private maxReconnectDelay = 30000; // 最大重连延迟 30s
  private intentionalClose = false;

  // 待发送消息队列（连接断开时暂存）
  private pendingMessages: WebSocketMessage[] = [];

  // 消息批处理
  private messageQueue: WebSocketMessage[] = [];
  private batchInterval: NodeJS.Timeout | null = null;
  private batchSize = 10;
  private batchDelay = 100; // 毫秒

  // 日志节流
  private binaryLogCount = 0;
  private lastBinaryLogTime = 0;
  private lastAudioChunkLogTime = 0;

  constructor() {}

  // 连接WebSocket
  connect(): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = new WebSocket(`${WS_BASE_URL}/ws/interview`);
        // 设置 binaryType 为 arraybuffer，避免 Blob 转换开销
        this.socket.binaryType = 'arraybuffer';

        this.socket.onopen = () => {
          console.log('[WS] 连接成功');
          this.reconnectAttempts = 0;
          // 发送暂存的消息
          this.flushPendingMessages();
          resolve(this.socket!);
        };

        this.socket.onmessage = (event) => {
          try {
            // 二进制帧处理（Opus 音频）
            if (event.data instanceof ArrayBuffer) {
              // 每 1 秒打印一次日志
              this.binaryLogCount++;
              const now = Date.now();
              if (now - this.lastBinaryLogTime >= 1000) {
                console.log(`[WS 收到] 二进制音频帧, 累计 ${this.binaryLogCount} 帧, 大小: ${event.data.byteLength} bytes`);
                this.binaryLogCount = 0;
                this.lastBinaryLogTime = now;
              }
              this.handleBinaryMessage(event.data);
              return;
            }

            // JSON 文本消息处理
            const parsedMessage = JSON.parse(event.data);
            console.log('[WS 收到]', parsedMessage.type, parsedMessage.payload ?? '');

            // 验证消息格式
            if (!this.validateMessage(parsedMessage)) {
              const error = new Error('消息格式无效');
              console.error('WebSocket消息格式无效:', parsedMessage);
              this.emitError(error);
              return;
            }

            const message: WebSocketMessage = parsedMessage;
            this.handleMessage(message);
          } catch (error) {
            const err = error instanceof Error ? error : new Error('消息解析失败');
            console.error('WebSocket消息解析失败:', err);
            this.emitError(err);
          }
        };

        this.socket.onclose = () => {
          console.log('[WS] 连接关闭');
          if (!this.intentionalClose) {
            this.handleReconnect();
          }
        };

        this.socket.onerror = (event) => {
          const message = event instanceof ErrorEvent ? event.message : 'WebSocket连接错误';
          const err = new Error(message);
          console.error('[WS] 错误:', err);
          this.emitError(err);
          reject(err);
        };
      } catch (error) {
        const err = error instanceof Error ? error : new Error('WebSocket连接失败');
        console.error('[WS] 连接失败:', err);
        this.emitError(err);
        reject(err);
      }
    });
  }

  // 发送消息
  send(message: WebSocketMessage, useBatch: boolean = false): void {
    if (useBatch) {
      this.messageQueue.push(message);
      this.startBatchProcessing();
    } else {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        try {
          this.socket.send(JSON.stringify(message));
        } catch (error) {
          const err = error instanceof Error ? error : new Error('消息发送失败');
          console.error('[WS] 消息发送失败:', err);
          this.emitError(err);
        }
      } else if (this.socket && this.socket.readyState === WebSocket.CONNECTING) {
        // 连接中，暂存消息
        this.pendingMessages.push(message);
      } else {
        // 未连接，尝试重连并暂存消息
        this.pendingMessages.push(message);
        if (!this.intentionalClose) {
          this.handleReconnect();
        }
      }
    }
  }

  // 发送暂存的消息
  private flushPendingMessages(): void {
    while (this.pendingMessages.length > 0) {
      const message = this.pendingMessages.shift()!;
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        try {
          this.socket.send(JSON.stringify(message));
        } catch (error) {
          console.error('[WS] 发送暂存消息失败:', error);
        }
      }
    }
  }

  // 启动面试
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

  // 发送音频开始信号（必须在 audio_chunk 之前发送）
  sendAudioStart(startTimestampMs: number): void {
    const message: AudioStartMessage = {
      type: 'audio_start',
      startTimestampMs,
    };
    this.send(message);
  }

  // 发送视频帧
  sendVideoFrame(frame: string, timestampMs: number): void {
    const message: VideoFrameMessage = {
      type: 'video_frame',
      frame,
      timestampMs,
    };
    this.send(message);
  }

  // 发送音频块
  sendAudioChunk(audio: string): void {
    const message: AudioChunkMessage = {
      type: 'audio_chunk',
      audio,
    };
    this.send(message);

    // 每 10 秒打印一次发送日志，避免高频刷屏
    const now = Date.now();
    if (now - this.lastAudioChunkLogTime >= 10000) {
      console.log(`[WS] 发送 audio_chunk, 音频数据大小: ${audio.length} bytes (base64)`);
      this.lastAudioChunkLogTime = now;
    }
  }

  // 标记回答完成
  sendAnswerComplete(): void {
    const message: AnswerCompleteMessage = {
      type: 'answer_complete',
    };
    this.send(message);
  }

  // 标记自我介绍完成
  sendSelfIntroComplete(): void {
    const message: SelfIntroCompleteMessage = {
      type: 'self_intro_complete',
    };
    this.send(message);
  }

  // 注册消息处理器
  on<T extends WebSocketMessage>(type: T['type'], handler: (data: any) => void): void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, []);
    }
    this.messageHandlers.get(type)!.push(handler);
  }

  // 移除消息处理器
  off<T extends WebSocketMessage>(type: T['type'], handler: (data: any) => void): void {
    if (this.messageHandlers.has(type)) {
      const handlers = this.messageHandlers.get(type)!;
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  // 注册二进制消息处理器
  onBinary(type: string, handler: (data: ArrayBuffer) => void): void {
    if (!this.binaryMessageHandlers.has(type)) {
      this.binaryMessageHandlers.set(type, []);
    }
    this.binaryMessageHandlers.get(type)!.push(handler);
  }

  // 移除二进制消息处理器
  offBinary(type: string, handler: (data: ArrayBuffer) => void): void {
    if (this.binaryMessageHandlers.has(type)) {
      const handlers = this.binaryMessageHandlers.get(type)!;
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  // 处理二进制消息（Opus 音频帧）
  private handleBinaryMessage(data: ArrayBuffer): void {
    const handlers = this.binaryMessageHandlers.get('audio_question_chunk');
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          const err = error instanceof Error ? error : new Error('处理二进制消息失败');
          console.error('处理二进制消息失败:', err);
          this.emitError(err);
        }
      });
    }
  }

  // 注册错误处理器
  onError(handler: (error: Error) => void): void {
    this.errorHandlers.push(handler);
  }

  // 移除错误处理器
  offError(handler: (error: Error) => void): void {
    const index = this.errorHandlers.indexOf(handler);
    if (index > -1) {
      this.errorHandlers.splice(index, 1);
    }
  }

  // 触发错误
  private emitError(error: Error): void {
    this.errorHandlers.forEach(handler => {
      try {
        handler(error);
      } catch (err) {
        console.error('错误处理器执行失败:', err);
      }
    });
  }

  // 启动批处理
  private startBatchProcessing(): void {
    if (!this.batchInterval) {
      this.batchInterval = setInterval(() => {
        this.processBatch();
      }, this.batchDelay);
    }
  }

  // 处理批处理消息
  private processBatch(): void {
    if (this.messageQueue.length === 0) {
      this.stopBatchProcessing();
      return;
    }

    const batch = this.messageQueue.splice(0, this.batchSize);

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      try {
        this.socket.send(JSON.stringify({
          type: 'batch',
          payload: batch
        }));
      } catch (error) {
        const err = error instanceof Error ? error : new Error('批处理消息发送失败');
        console.error('WebSocket批处理消息发送失败:', err);
        this.emitError(err);
      }
    }
  }

  // 停止批处理
  private stopBatchProcessing(): void {
    if (this.batchInterval) {
      clearInterval(this.batchInterval);
      this.batchInterval = null;
    }
  }

  // 关闭连接
  close(): void {
    this.intentionalClose = true;
    this.stopBatchProcessing();
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  // 验证消息格式
  private validateMessage(message: any): message is WebSocketMessage {
    if (!message || typeof message !== 'object') {
      return false;
    }

    if (!message.type || typeof message.type !== 'string') {
      return false;
    }

    // 客户端发送的消息类型（不需要 payload）
    switch (message.type) {
      case 'start_interview':
        return typeof message.resume === 'string' && typeof message.jobInfo === 'string';
      case 'audio_start':
        return typeof message.startTimestampMs === 'number';
      case 'video_frame':
        return typeof message.frame === 'string' && typeof message.timestampMs === 'number';
      case 'audio_chunk':
        return typeof message.audio === 'string';
      case 'answer_complete':
      case 'self_intro_complete':
        return true;
      // 服务端推送的消息类型（需要 payload）
      case 'session_created':
        return typeof message.payload === 'object' &&
               typeof message.payload.sessionId === 'string';
      case 'self_intro':
      case 'job_analysis_complete':
        return typeof message.payload === 'object';
      case 'new_question':
        return typeof message.payload === 'object' &&
               typeof message.payload.content === 'string' &&
               typeof message.payload.questionType === 'string' &&
               typeof message.payload.questionIndex === 'number';
      case 'evaluation_result':
        return typeof message.payload === 'object';
      case 'final_report':
        return typeof message.payload === 'object' &&
               typeof message.payload.report === 'string';
      case 'answer_received':
        return typeof message.payload === 'object';
      case 'error':
        return typeof message.payload === 'object' &&
               typeof message.payload.message === 'string';
      case 'audio_question_start':
        return typeof message.payload === 'object' &&
               typeof message.payload.format === 'string';
      case 'audio_question_end':
        return typeof message.payload === 'object';
      case 'audio_question_error':
        return typeof message.payload === 'object' &&
               typeof message.payload.message === 'string';
      default:
        return true; // 允许未知类型的消息
    }
  }

  // 处理消息
  private handleMessage(message: any): void {
    const { type, payload } = message;
    if (this.messageHandlers.has(type)) {
      this.messageHandlers.get(type)!.forEach(handler => {
        try {
          handler(payload);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(`处理${type}消息失败`);
          console.error(`处理${type}消息失败:`, err);
          this.emitError(err);
        }
      });
    }
  }

  // 处理重连（指数退避）
  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WS] 达到最大重连次数，停止重连');
      return;
    }

    this.reconnectAttempts++;
    // 指数退避: delay = baseDelay * 2^(attempts-1), 最大 maxReconnectDelay
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );
    console.log(`[WS] 尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts}), 延迟 ${delay}ms...`);

    // 清理旧连接
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.onerror = null;
      this.socket.onmessage = null;
      this.socket.onopen = null;
      this.socket = null;
    }

    setTimeout(() => {
      this.connect().catch(error => {
        console.error('[WS] 重连失败:', error);
      });
    }, delay);
  }
}
