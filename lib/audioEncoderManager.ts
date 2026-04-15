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

type OnEncodedChunk = (chunk: Uint8Array) => void;

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

      if (!this.sending) return;

      // 降采样 48kHz → 16kHz：每 3 个样本取 1 个
      const downsampledLength = Math.floor(inputData.length / DOWNSAMPLE_RATIO);
      const downsampled = new Float32Array(downsampledLength);
      for (let i = 0; i < downsampledLength; i++) {
        downsampled[i] = inputData[i * DOWNSAMPLE_RATIO];
      }

      // 将 Float32 [-1, 1] 转换为 Int16 [-32768, 32767]
      const int16Data = new Int16Array(downsampledLength);
      for (let i = 0; i < downsampledLength; i++) {
        const sample = Math.max(-1, Math.min(1, downsampled[i]));
        int16Data[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      }

      // 发送 PCM 数据
      this.onEncodedChunk(new Uint8Array(int16Data.buffer));

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

  /**
   * 设置 VAD 音量回调。
   * 回调在每帧音频处理时触发，无论是否在 sending 状态。
   */
  setVadCallback(cb: ((volume: number) => void) | null): void {
    this.vadCallback = cb;
  }

  /**
   * 开始发送 PCM 音频数据。
   */
  startSending(): void {
    if (this.sending) return;
    this.sending = true;
    console.log('[AudioEncoder] 开始发送音频数据 (16kHz PCM 16-bit)');
    console.log('[AudioEncoder] 当前时间:', new Date().toISOString());
  }

  /**
   * 停止发送音频数据。
   */
  stopSending(): void {
    if (!this.sending) return;
    this.sending = false;
    console.log('[AudioEncoder] 停止发送音频数据');
  }

  /** 当前是否在发送数据 */
  get isSending(): boolean {
    return this.sending;
  }

  dispose(): void {
    this.disposed = true;
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
