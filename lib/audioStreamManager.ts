interface AudioStreamConfig {
  channels: number;
}

// 动态导入类型 - decode 可能返回同步或异步结果
type OggOpusDecoderType = {
  decode: (data: Uint8Array) => Promise<{
    channelData: Float32Array[];
    samplesDecoded: number;
    errors: unknown[];
  }> | {
    channelData: Float32Array[];
    samplesDecoded: number;
    errors: unknown[];
  };
  ready: Promise<void>;
  reset: () => Promise<void>;
  free: () => void;
};

/**
 * 管理来自 WebSocket 二进制帧的 Ogg Opus 音频流的解码和播放。
 *
 * 流程：二进制帧(Ogg容器) → addChunk() → Ogg Opus 解码 → Web Audio API 调度播放
 *
 * 注意：Ogg Opus 采样率固定为 48000Hz
 */
export class AudioStreamManager {
  private decoder: OggOpusDecoderType | null = null;
  private audioContext: AudioContext | null = null;
  private chunkQueue: ArrayBuffer[] = [];
  private isPlaying = false;
  private nextStartTime = 0;
  private disposed = false;
  private config: AudioStreamConfig;
  private isInitialized = false;
  // Ogg Opus 固定采样率
  private readonly sampleRate = 48000;
  // 正在播放的 AudioBufferSourceNode 列表（用于 stopImmediately 打断）
  private activeSources: AudioBufferSourceNode[] = [];

  constructor(config: AudioStreamConfig = { channels: 1 }) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    this.audioContext = new AudioContext({ sampleRate: this.sampleRate });

    try {
      // 动态导入 ogg-opus-decoder，避免 SSR 问题
      const { OggOpusDecoder } = await import('ogg-opus-decoder');
      this.decoder = new OggOpusDecoder({ forceStereo: false }) as unknown as OggOpusDecoderType;

      await this.decoder.ready;
      if (!this.decoder) return;
      await this.decoder.reset();
      this.isInitialized = true;
      console.log('[AudioStreamManager] 初始化完成, 采样率:', this.sampleRate);
    } catch (err) {
      console.error('[AudioStreamManager] 初始化失败:', err);
      this.dispose();
    }
  }

  /**
   * 添加一个 Ogg Opus 二进制帧到播放队列。
   * 收到前几帧后自动开始播放。
   */
  addChunk(chunk: ArrayBuffer): void {
    if (!this.isInitialized || this.disposed) return;

    this.chunkQueue.push(chunk);

    // 缓冲 2 帧后开始播放，平衡延迟和流畅度
    if (!this.isPlaying && this.chunkQueue.length >= 2) {
      this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    this.isPlaying = true;

    while (this.chunkQueue.length > 0 && !this.disposed) {
      const chunk = this.chunkQueue.shift()!;
      await this.playChunk(chunk);
    }

    this.isPlaying = false;
  }

  private async playChunk(oggData: ArrayBuffer): Promise<void> {
    if (!this.decoder || !this.audioContext) return;

    // 检查数据有效性
    if (!oggData || oggData.byteLength === 0) {
      console.warn('[AudioStreamManager] 收到空音频帧，跳过');
      return;
    }

    try {
      const uint8Data = new Uint8Array(oggData);

      // decode 返回 Promise，需要 await
      const result = await this.decoder.decode(uint8Data);

      if (!result) {
        console.warn('[AudioStreamManager] decode 返回 null/undefined');
        return;
      }

      // 尝试不同的属性名
      const channelData = result.channelData || (result as any).channelData;
      const samplesDecoded = result.samplesDecoded || (result as any).samplesDecoded;

      if (!channelData || channelData.length === 0 || samplesDecoded === 0) {
        console.warn('[AudioStreamManager] 解码结果为空, samplesDecoded:', samplesDecoded);
        return;
      }

      console.log('[AudioStreamManager] 解码成功, samples:', samplesDecoded);

      const pcmData = channelData[0];

      // 检查 PCM 数据有效性
      if (!pcmData || pcmData.length === 0) {
        console.warn('[AudioStreamManager] PCM 数据为空，跳过');
        return;
      }

      const audioBuffer = this.audioContext.createBuffer(
        this.config.channels,
        pcmData.length,
        this.sampleRate,
      );
      audioBuffer.getChannelData(0).set(pcmData);

      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);

      // 无缝拼接：按时间调度播放
      const now = this.audioContext.currentTime;
      if (this.nextStartTime < now) {
        this.nextStartTime = now;
      }
      source.start(this.nextStartTime);
      this.nextStartTime += audioBuffer.duration;

      // 追踪活跃的 source，用于 stopImmediately 打断
      this.activeSources.push(source);
      source.onended = () => {
        const idx = this.activeSources.indexOf(source);
        if (idx > -1) this.activeSources.splice(idx, 1);
      };
      console.log('[AudioStreamManager] 播放调度完成, duration:', audioBuffer.duration.toFixed(3), 's');
    } catch (error) {
      console.error('[AudioStreamManager] 解码/播放失败:', error);
    }
  }

  /**
   * 停止播放并清空队列
   */
  stop(): void {
    this.chunkQueue = [];
    this.isPlaying = false;
    this.nextStartTime = 0;
  }

  /**
   * 立即停止播放，包括已经调度但尚未播完的音频源。
   * 用于 VAD 打断场景。
   */
  stopImmediately(): void {
    this.chunkQueue = [];
    this.isPlaying = false;
    this.nextStartTime = 0;
    for (const source of this.activeSources) {
      try {
        source.onended = null;
        source.stop();
      } catch {
        // source 可能已播放完毕
      }
    }
    this.activeSources = [];
  }

  /**
   * 释放所有资源
   */
  dispose(): void {
    this.disposed = true;
    this.stop();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    if (this.decoder) {
      try {
        this.decoder.free();
      } catch {
        // 忽略释放时的错误
      }
      this.decoder = null;
    }
    this.isInitialized = false;
  }

  /**
   * 是否还有音频在播放（包括已调度但尚未播完的）。
   * isPlaying 表示队列处理中；activeSources.length > 0 表示有声源在播。
   */
  get playing(): boolean {
    return this.isPlaying || this.activeSources.length > 0;
  }
}