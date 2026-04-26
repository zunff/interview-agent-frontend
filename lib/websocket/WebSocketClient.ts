import type {
  WebSocketMessage,
  VideoFrameMessage,
  AudioChunkMessage,
  AnswerCompleteMessage,
  SelfIntroCompleteMessage,
  StartInterviewMessage,
  AudioStartMessage,
} from '../../types/index.js';

const WS_BASE_URL = process.env.WS_BASE_URL || 'ws://localhost:8080';

export class WebSocketClient {
  private socket: WebSocket | null = null;
  private messageHandlers: Map<string, ((data: unknown) => void)[]> = new Map();
  private binaryMessageHandlers: Map<string, ((data: ArrayBuffer) => void)[]> = new Map();
  private errorHandlers: ((error: Error) => void)[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private baseReconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private intentionalClose = false;

  private pendingMessages: WebSocketMessage[] = [];

  private messageQueue: WebSocketMessage[] = [];
  private batchInterval: NodeJS.Timeout | null = null;
  private batchSize = 10;
  private batchDelay = 100;

  private binaryLogCount = 0;
  private lastBinaryLogTime = 0;
  private lastAudioChunkLogTime = 0;
  private lastVideoFrameLogTime = 0;

  connect(): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = new WebSocket(`${WS_BASE_URL}/ws/interview`);
        this.socket.binaryType = 'arraybuffer';

        this.socket.onopen = () => {
          console.log('[WS] 连接成功');
          this.reconnectAttempts = 0;
          this.flushPendingMessages();
          resolve(this.socket!);
        };

        this.socket.onmessage = (event) => {
          try {
            if (event.data instanceof ArrayBuffer) {
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

            const parsedMessage = JSON.parse(event.data);
            console.log('[WS 收到]', parsedMessage.type, parsedMessage.payload ?? '');

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
        this.pendingMessages.push(message);
      } else {
        this.pendingMessages.push(message);
        if (!this.intentionalClose) {
          this.handleReconnect();
        }
      }
    }
  }

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

  sendAudioStart(startTimestampMs: number): void {
    const message: AudioStartMessage = {
      type: 'audio_start',
      startTimestampMs,
    };
    this.send(message);
  }

  sendVideoFrame(frame: string, timestampMs: number): void {
    const message: VideoFrameMessage = {
      type: 'video_frame',
      frame,
      timestampMs,
    };
    this.send(message);

    const now = Date.now();
    if (now - this.lastVideoFrameLogTime >= 5000) {
      console.log(
        `[WS] 发送 video_frame, timestampMs: ${timestampMs}, 帧数据大小: ${frame.length} chars (base64)`
      );
      this.lastVideoFrameLogTime = now;
    }
  }

  sendAudioChunk(audio: string): void {
    const message: AudioChunkMessage = {
      type: 'audio_chunk',
      audio,
    };
    this.send(message);

    const now = Date.now();
    if (now - this.lastAudioChunkLogTime >= 10000) {
      console.log(`[WS] 发送 audio_chunk, 音频数据大小: ${audio.length} bytes (base64)`);
      this.lastAudioChunkLogTime = now;
    }
  }

  sendAnswerComplete(): void {
    const message: AnswerCompleteMessage = {
      type: 'answer_complete',
    };
    this.send(message);
  }

  sendSelfIntroComplete(): void {
    const message: SelfIntroCompleteMessage = {
      type: 'self_intro_complete',
    };
    this.send(message);
  }

  on<T extends WebSocketMessage>(type: T['type'], handler: (data: any) => void): void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, []);
    }
    this.messageHandlers.get(type)!.push(handler);
  }

  off<T extends WebSocketMessage>(type: T['type'], handler: (data: any) => void): void {
    if (this.messageHandlers.has(type)) {
      const handlers = this.messageHandlers.get(type)!;
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  onBinary(type: string, handler: (data: ArrayBuffer) => void): void {
    if (!this.binaryMessageHandlers.has(type)) {
      this.binaryMessageHandlers.set(type, []);
    }
    this.binaryMessageHandlers.get(type)!.push(handler);
  }

  offBinary(type: string, handler: (data: ArrayBuffer) => void): void {
    if (this.binaryMessageHandlers.has(type)) {
      const handlers = this.binaryMessageHandlers.get(type)!;
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

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

  onError(handler: (error: Error) => void): void {
    this.errorHandlers.push(handler);
  }

  offError(handler: (error: Error) => void): void {
    const index = this.errorHandlers.indexOf(handler);
    if (index > -1) {
      this.errorHandlers.splice(index, 1);
    }
  }

  private emitError(error: Error): void {
    this.errorHandlers.forEach(handler => {
      try {
        handler(error);
      } catch (err) {
        console.error('错误处理器执行失败:', err);
      }
    });
  }

  private startBatchProcessing(): void {
    if (!this.batchInterval) {
      this.batchInterval = setInterval(() => {
        this.processBatch();
      }, this.batchDelay);
    }
  }

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

  private stopBatchProcessing(): void {
    if (this.batchInterval) {
      clearInterval(this.batchInterval);
      this.batchInterval = null;
    }
  }

  close(): void {
    this.intentionalClose = true;
    this.stopBatchProcessing();
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  private validateMessage(message: any): message is WebSocketMessage {
    if (!message || typeof message !== 'object') {
      return false;
    }

    if (!message.type || typeof message.type !== 'string') {
      return false;
    }

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
        return true;
    }
  }

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

  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WS] 达到最大重连次数，停止重连');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );
    console.log(`[WS] 尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts}), 延迟 ${delay}ms...`);

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
