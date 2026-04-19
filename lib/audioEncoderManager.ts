/**
 * 使用 WebCodecs API 将麦克风音频编码为 PCM 格式（16kHz, 16-bit signed integer）。
 * 如果浏览器不支持 WebCodecs，则降级为 MediaRecorder。
 *
 * 输出采样率 16kHz（AudioContext 48kHz → 降采样到 16kHz）。
 * 支持录音控制（startSending/stopSending）和 VAD 音量回调。
 */

// 录音输出采样率（后端 ASR 需要）
const OUTPUT_SAMPLE_RATE = 16000;
// AudioContext 采样率（浏览器原生）
const CONTEXT_SAMPLE_RATE = 48000;
// 降采样比例
const DOWNSAMPLE_RATIO = CONTEXT_SAMPLE_RATE / OUTPUT_SAMPLE_RATE; // 3
// 与 initPcmEncoder 中 ScriptProcessor(4096) 降采样后样本数一致，便于后端按同格式解析
const SILENT_PCM_SAMPLES = Math.floor(4096 / DOWNSAMPLE_RATIO);
/** 关麦但仍在答题时，定时发送全零 PCM 保活，避免服务端长时间无 audio_chunk 断开 */
const DEFAULT_SILENT_KEEPALIVE_MS = 10_000;
/** VAD 判定前仍保留的 16kHz PCM 时长（方案 B：补录开口前几字） */
const PRE_ROLL_MS = 600;

type OnEncodedChunk = (chunk: Uint8Array) => void;

const PRE_ROLL_MAX_BYTES = Math.floor((OUTPUT_SAMPLE_RATE * 2 * PRE_ROLL_MS) / 1000);

export class AudioEncoderManager {
  private audioContext: AudioContext | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private onEncodedChunk: OnEncodedChunk;
  private disposed = false;
  private useWebCodecs = false;

  // 录音控制：默认不发送数据
  private sending = false;

  // VAD 回调：无论是否 sending 都会调用
  private vadCallback: ((volume: number) => void) | null = null;

  // 调试日志计数器（减少日志频率）
  private chunkCount = 0;
  private lastLogTime = 0;
  private audioSendCount = 0;
  private lastAudioLogTime = 0;

  private silentKeepaliveTimer: ReturnType<typeof setInterval> | null = null;
  private lastSilentKeepaliveLogTime = 0;

  /** 未 sending 时持续写入的 16kHz PCM 片段（与正式发送格式一致） */
  private preRollChunks: Uint8Array[] = [];
  private preRollTotalBytes = 0;

  constructor(onEncodedChunk: OnEncodedChunk) {
    this.onEncodedChunk = onEncodedChunk;
  }

  async initialize(stream: MediaStream): Promise<void> {
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) {
      throw new Error('没有音频轨道');
    }

    // 使用 ScriptProcessor 方式处理 PCM（更兼容）
    await this.initPcmEncoder(stream);
    this.useWebCodecs = true;
    console.log('[AudioEncoder] 使用 PCM 16kHz 16-bit 编码');
  }

  private async initPcmEncoder(stream: MediaStream): Promise<void> {
    this.audioContext = new AudioContext({ sampleRate: CONTEXT_SAMPLE_RATE });
    this.sourceNode = this.audioContext.createMediaStreamSource(stream);

    // 使用 ScriptProcessorNode 获取 48kHz PCM 数据
    this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);

    this.scriptProcessor.onaudioprocess = (event) => {
      if (this.disposed) return;

      const inputData = event.inputBuffer.getChannelData(0);

      // VAD 音量计算（无论是否 sending 都执行，基于原始 48kHz 数据）
      if (this.vadCallback) {
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);
        this.vadCallback(rms);
      }

      const pcmChunk = this.encodeInputToPcm16k(inputData);

      if (!this.sending) {
        this.pushPreRoll(pcmChunk);
        return;
      }

      this.onEncodedChunk(pcmChunk);

      // 每 1 秒打印一次日志
      this.chunkCount++;
      const now = Date.now();
      if (now - this.lastLogTime >= 1000) {
        console.log(`[AudioEncoder] 已发送 ${this.chunkCount} 个音频块, 速率: ~${Math.round(this.chunkCount * 1000 / (now - this.lastLogTime))} chunks/s`);
        this.chunkCount = 0;
        this.lastLogTime = now;
      }

      // 每 5 秒打印一次详细日志
      this.audioSendCount++;
      if (now - this.lastAudioLogTime >= 5000) {
        console.log(`[AudioEncoder] 音频发送状态: sending=${this.sending}, 累计发送 ${this.audioSendCount} 个音频块`);
        this.lastAudioLogTime = now;
      }
    };

    this.sourceNode.connect(this.scriptProcessor);
    this.scriptProcessor.connect(this.audioContext.destination);
  }

  /** 48kHz 输入 → 与线上一致的 16kHz Int16 PCM 字节块 */
  private encodeInputToPcm16k(inputData: Float32Array): Uint8Array {
    const downsampledLength = Math.floor(inputData.length / DOWNSAMPLE_RATIO);
    const int16Data = new Int16Array(downsampledLength);
    for (let i = 0; i < downsampledLength; i++) {
      const s = inputData[i * DOWNSAMPLE_RATIO];
      const sample = Math.max(-1, Math.min(1, s));
      int16Data[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }
    return new Uint8Array(int16Data.buffer);
  }

  private pushPreRoll(chunk: Uint8Array): void {
    const copy = new Uint8Array(chunk);
    this.preRollChunks.push(copy);
    this.preRollTotalBytes += copy.length;
    while (this.preRollTotalBytes > PRE_ROLL_MAX_BYTES && this.preRollChunks.length > 0) {
      const first = this.preRollChunks.shift()!;
      this.preRollTotalBytes -= first.length;
    }
  }

  private clearPreRoll(): void {
    this.preRollChunks = [];
    this.preRollTotalBytes = 0;
  }

  /**
   * 当前 pre-roll 缓冲对应的时长（ms），用于 `audio_start` 回溯；须在 `startSending()` 前读取。
   */
  getPreRollDurationMs(): number {
    return (this.preRollTotalBytes / (OUTPUT_SAMPLE_RATE * 2)) * 1000;
  }

  /**
   * 设置 VAD 音量回调。
   * 回调在每帧音频处理时触发，无论是否在 sending 状态。
   */
  setVadCallback(cb: ((volume: number) => void) | null): void {
    this.vadCallback = cb;
  }

  /**
   * 开始发送 PCM：先按顺序发出 pre-roll 缓冲，再进入实时发送。
   * 调用方应先 `sendAudioStart(Date.now() - getPreRollDurationMs())` 再调用本方法，保证信令顺序。
   */
  startSending(): void {
    this.clearSilentKeepalive();
    if (this.sending) return;

    let flushed = 0;
    for (const c of this.preRollChunks) {
      this.onEncodedChunk(c);
      flushed += c.length;
    }
    this.clearPreRoll();
    if (flushed > 0) {
      const approxMs = (flushed / (OUTPUT_SAMPLE_RATE * 2)) * 1000;
      console.log(
        `[AudioEncoder] 已 flush pre-roll ~${approxMs.toFixed(0)}ms (${flushed} bytes)，随后实时发送`
      );
    }

    this.sending = true;
    console.log('[AudioEncoder] 开始发送音频数据 (16kHz PCM 16-bit)');
    console.log('[AudioEncoder] 当前时间:', new Date().toISOString());
  }

  /**
   * 停止发送 PCM；同时清除关麦保活定时器（即使当前 sending 已为 false，例如仅保活中）。
   */
  stopSending(): void {
    this.clearSilentKeepalive();
    this.clearPreRoll();
    if (!this.sending) return;
    this.sending = false;
    console.log('[AudioEncoder] 停止发送音频数据');
  }

  /**
   * 关麦期间仍定期发送与正常块同长度的全零 16kHz PCM，避免服务端因无流量断开。
   * 调用前应先 stopSending()，且仅在仍在录音会话中时使用。
   */
  startSilentKeepalive(intervalMs: number = DEFAULT_SILENT_KEEPALIVE_MS): void {
    this.clearSilentKeepalive();
    if (this.disposed) return;

    const sendSilentFrame = () => {
      if (this.disposed || this.sending) return;
      const zeros = new Int16Array(SILENT_PCM_SAMPLES);
      this.onEncodedChunk(new Uint8Array(zeros.buffer));
      const now = Date.now();
      if (now - this.lastSilentKeepaliveLogTime >= 30_000) {
        console.log(
          `[AudioEncoder] 静默保活: 已发送全零 PCM (${SILENT_PCM_SAMPLES} 样本), 间隔 ${intervalMs}ms`
        );
        this.lastSilentKeepaliveLogTime = now;
      }
    };

    sendSilentFrame();
    this.silentKeepaliveTimer = setInterval(sendSilentFrame, intervalMs);
  }

  private clearSilentKeepalive(): void {
    if (this.silentKeepaliveTimer !== null) {
      clearInterval(this.silentKeepaliveTimer);
      this.silentKeepaliveTimer = null;
    }
  }

  /** 当前是否在发送数据 */
  get isSending(): boolean {
    return this.sending;
  }

  dispose(): void {
    this.disposed = true;
    this.clearSilentKeepalive();
    this.clearPreRoll();
    this.vadCallback = null;

    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    if (this.mediaRecorder) {
      this.mediaRecorder.stop();
      this.mediaRecorder = null;
    }
  }

  isUsingWebCodecs(): boolean {
    return this.useWebCodecs;
  }
}
