/**
 * 简易语音活动检测（VAD）。
 * 基于 RMS 音量阈值判断用户是否在说话。
 */

export interface VadOptions {
  /** RMS 音量阈值，超过此值视为有声音。默认 0.01 */
  threshold?: number;
  /** 持续超过阈值多久判定为"开始说话"（ms）。默认 300 */
  speechDurationMs?: number;
  /** 持续低于阈值多久判定为"停止说话"（ms）。默认 500 */
  silenceDurationMs?: number;
  /** 检测到开始说话的回调 */
  onSpeechStart?: () => void;
  /** 检测到停止说话的回调 */
  onSpeechEnd?: () => void;
}

export class VoiceActivityDetector {
  private threshold: number;
  private speechDurationMs: number;
  private silenceDurationMs: number;
  private onSpeechStartCb: (() => void) | null;
  private onSpeechEndCb: (() => void) | null;

  private _isSpeaking = false;
  private speechStartTime: number | null = null;
  private silenceStartTime: number | null = null;
  private aboveThreshold = false;

  constructor(options: VadOptions = {}) {
    this.threshold = options.threshold ?? 0.01;
    this.speechDurationMs = options.speechDurationMs ?? 300;
    this.silenceDurationMs = options.silenceDurationMs ?? 500;
    this.onSpeechStartCb = options.onSpeechStart ?? null;
    this.onSpeechEndCb = options.onSpeechEnd ?? null;
  }

  /**
   * 处理一帧音频的 RMS 音量。
   * 由 AudioEncoderManager 的 vadCallback 调用。
   */
  processVolume(rms: number): void {
    const now = Date.now();
    this.aboveThreshold = rms >= this.threshold;

    if (!this._isSpeaking) {
      // 当前未在说话状态，检测是否开始说话
      if (this.aboveThreshold) {
        if (this.speechStartTime === null) {
          this.speechStartTime = now;
        } else if (now - this.speechStartTime >= this.speechDurationMs) {
          // 持续超过阈值足够长时间，判定为开始说话
          this._isSpeaking = true;
          this.speechStartTime = null;
          this.silenceStartTime = null;
          this.onSpeechStartCb?.();
        }
      } else {
        // 低于阈值，重置计时
        this.speechStartTime = null;
      }
    } else {
      // 当前正在说话状态，检测是否停止说话
      if (!this.aboveThreshold) {
        if (this.silenceStartTime === null) {
          this.silenceStartTime = now;
        } else if (now - this.silenceStartTime >= this.silenceDurationMs) {
          // 持续低于阈值足够长时间，判定为停止说话
          this._isSpeaking = false;
          this.silenceStartTime = null;
          this.speechStartTime = null;
          this.onSpeechEndCb?.();
        }
      } else {
        // 再次超过阈值，重置静音计时
        this.silenceStartTime = null;
      }
    }
  }

  /** 当前是否在说话 */
  get isSpeaking(): boolean {
    return this._isSpeaking;
  }

  /** 重置检测状态 */
  reset(): void {
    this._isSpeaking = false;
    this.speechStartTime = null;
    this.silenceStartTime = null;
    this.aboveThreshold = false;
  }
}
