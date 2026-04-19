/**
 * 轻量自适应语音活动检测（VAD）。
 *
 * - 滚动窗口内 RMS，用分位数估计噪声底 noiseFloor，动态生成「开始 / 结束」双阈值（滞回）。
 * - 开始说话：窗口内高于 startThreshold 的比例 ≥ ratioStart，且持续 ≥ speechDurationMs。
 * - 结束说话：当前 RMS 低于 endThreshold 持续 ≥ silenceDurationMs（end < start，减少抖动）。
 *
 * ScriptProcessor 4096@48kHz 约每 85ms 一帧；窗口长度按「帧数」计，覆盖约 0.5~0.7s 量级。
 */

export interface VadOptions {
  /**
   * 兼容旧版：作为 startThreshold 的下限（floor），避免安静环境阈值过低。
   * 默认 0.012
   */
  threshold?: number;
  /** 噪声底系数：start = max(minStart, noiseFloor * noiseMultStart + biasStart) */
  noiseMultStart?: number;
  noiseMultEnd?: number;
  biasStart?: number;
  biasEnd?: number;
  /** startThreshold 绝对上限，避免极吵环境阈值过高导致永远开不了口 */
  maxStartThreshold?: number;
  /** end 阈值相对 start 的比例上限，保证 end < start */
  endRelativeToStart?: number;
  /** 滚动 RMS 窗口最大帧数（约 85ms/帧） */
  windowFrames?: number;
  /** 用于估计噪声底的分位数 0~1（越低越保守，更抗突发噪声） */
  noisePercentile?: number;
  /** 噪声底平滑：0~1，越大越跟当前环境 */
  noiseFloorSmoothing?: number;
  /** 判定「开始说话」时，窗口内高于 startThreshold 的帧比例下限 */
  ratioStart?: number;
  /** 持续满足 ratioStart 的判定时间（ms） */
  speechDurationMs?: number;
  /** 判定「停止说话」：低于 endThreshold 的持续时间 */
  silenceDurationMs?: number;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.floor((sorted.length - 1) * p);
  return sorted[idx]!;
}

export class VoiceActivityDetector {
  private readonly minStart: number;
  private readonly noiseMultStart: number;
  private readonly noiseMultEnd: number;
  private readonly biasStart: number;
  private readonly biasEnd: number;
  private readonly maxStart: number;
  private readonly endRelativeToStart: number;
  private readonly windowFrames: number;
  private readonly noisePercentile: number;
  private readonly noiseFloorSmoothing: number;
  private readonly ratioStart: number;
  private readonly speechDurationMs: number;
  private readonly silenceDurationMs: number;
  private readonly onSpeechStartCb: (() => void) | null;
  private readonly onSpeechEndCb: (() => void) | null;

  private _isSpeaking = false;
  private noiseFloor = 0.012;
  private rmsWindow: number[] = [];

  private ratioOkStartTime: number | null = null;
  private silenceStartTime: number | null = null;

  /** 最近一次计算的门限，便于调试日志 */
  private _lastStartTh = 0.024;
  private _lastEndTh = 0.014;

  constructor(options: VadOptions = {}) {
    this.minStart = options.threshold ?? 0.012;
    this.noiseMultStart = options.noiseMultStart ?? 2.6;
    this.noiseMultEnd = options.noiseMultEnd ?? 1.45;
    this.biasStart = options.biasStart ?? 0.005;
    this.biasEnd = options.biasEnd ?? 0.002;
    this.maxStart = options.maxStartThreshold ?? 0.09;
    this.endRelativeToStart = options.endRelativeToStart ?? 0.62;
    this.windowFrames = Math.max(4, options.windowFrames ?? 8);
    this.noisePercentile = options.noisePercentile ?? 0.18;
    this.noiseFloorSmoothing = options.noiseFloorSmoothing ?? 0.12;
    this.ratioStart = options.ratioStart ?? 0.42;
    this.speechDurationMs = options.speechDurationMs ?? 360;
    this.silenceDurationMs = options.silenceDurationMs ?? 520;
    this.onSpeechStartCb = options.onSpeechStart ?? null;
    this.onSpeechEndCb = options.onSpeechEnd ?? null;
  }

  /**
   * 处理一帧音频的 RMS 音量（约 85ms 一次）。
   */
  processVolume(rms: number): void {
    const now = Date.now();

    this.rmsWindow.push(rms);
    if (this.rmsWindow.length > this.windowFrames) {
      this.rmsWindow.shift();
    }

    const w = this.rmsWindow;
    const est =
      w.length >= 3
        ? percentile([...w].sort((a, b) => a - b), this.noisePercentile)
        : rms;
    // 未开口时噪声底跟随环境；开口后噪声底减慢更新以免被人声拉高
    const alpha = this._isSpeaking ? 0.03 : this.noiseFloorSmoothing;
    this.noiseFloor = (1 - alpha) * this.noiseFloor + alpha * est;

    let startTh = Math.max(
      this.minStart,
      Math.min(this.maxStart, this.noiseFloor * this.noiseMultStart + this.biasStart),
    );
    let endTh = Math.max(
      this.minStart * 0.35,
      this.noiseFloor * this.noiseMultEnd + this.biasEnd,
    );
    endTh = Math.min(endTh, startTh * this.endRelativeToStart);
    this._lastStartTh = startTh;
    this._lastEndTh = endTh;

    if (!this._isSpeaking) {
      const above = w.filter((x) => x >= startTh).length;
      const ratio = w.length > 0 ? above / w.length : 0;
      const ratioOk = w.length >= 4 && ratio >= this.ratioStart;

      if (ratioOk) {
        if (this.ratioOkStartTime === null) {
          this.ratioOkStartTime = now;
        } else if (now - this.ratioOkStartTime >= this.speechDurationMs) {
          this._isSpeaking = true;
          this.ratioOkStartTime = null;
          this.silenceStartTime = null;
          this.onSpeechStartCb?.();
        }
      } else {
        this.ratioOkStartTime = null;
      }
    } else {
      if (rms < endTh) {
        if (this.silenceStartTime === null) {
          this.silenceStartTime = now;
        } else if (now - this.silenceStartTime >= this.silenceDurationMs) {
          this._isSpeaking = false;
          this.silenceStartTime = null;
          this.ratioOkStartTime = null;
          this.onSpeechEndCb?.();
        }
      } else {
        this.silenceStartTime = null;
      }
    }
  }

  get isSpeaking(): boolean {
    return this._isSpeaking;
  }

  /** 最近一次动态门限，供调试 */
  getThresholds(): { start: number; end: number; noiseFloor: number } {
    return {
      start: this._lastStartTh,
      end: this._lastEndTh,
      noiseFloor: this.noiseFloor,
    };
  }

  reset(): void {
    this._isSpeaking = false;
    this.rmsWindow = [];
    this.noiseFloor = 0.012;
    this.ratioOkStartTime = null;
    this.silenceStartTime = null;
  }
}
