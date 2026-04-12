'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useInterviewStore } from '../store/interviewStore';
import { VoiceActivityDetector } from '../lib/vad';

interface AudioQuestionErrorPayload {
  message: string;
}

interface AudioHandlers {
  onStart: () => void;
  onChunk: (data: ArrayBuffer) => void;
  onEnd: () => void;
  onError: (data: AudioQuestionErrorPayload) => void;
}

interface AudioStreamManager {
  initialize(): Promise<void>;
  addChunk(chunk: ArrayBuffer): void;
  stop(): void;
  stopImmediately(): void;
  dispose(): void;
  playing: boolean;
}

/**
 * 管理来自服务端的 Opus 音频流播放 + beep + 录音启动 + VAD 打断。
 *
 * 流程：
 * 1. audio_question_start → 开始播放 TTS + 启动 VAD 监听
 * 2a. audio_question_end → 等待播放完毕 → beep → startRecording
 * 2b. VAD 检测到说话 → stopImmediately → beep → startRecording
 * 3. audio_question_error → 降级为文字模式 → beep → startRecording
 */
export function useAudioPlayback() {
  const managerRef = useRef<AudioStreamManager | null>(null);
  const handlersRef = useRef<AudioHandlers | null>(null);
  const vadRef = useRef<VoiceActivityDetector | null>(null);
  const interruptedRef = useRef(false);
  const beepAudioContextRef = useRef<AudioContext | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const { wsClient, setAudioError, resetAudioState, setAnswerPhase, setAnswerStartTime, setIsRecordingAudio } = useInterviewStore();

  /**
   * 播放提示音（880Hz 正弦波，200ms）。
   * 返回 Promise，beep 播放完毕后 resolve。
   */
  const playBeep = useCallback(async (): Promise<void> => {
    try {
      if (!beepAudioContextRef.current) {
        beepAudioContextRef.current = new AudioContext({ sampleRate: 48000 });
      }
      const ctx = beepAudioContextRef.current;

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.value = 880;
      oscillator.type = 'sine';

      const now = ctx.currentTime;
      // 淡入淡出防杂音
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.3, now + 0.01);
      gainNode.gain.setValueAtTime(0.3, now + 0.19);
      gainNode.gain.linearRampToValueAtTime(0, now + 0.2);

      oscillator.start(now);
      oscillator.stop(now + 0.2);

      // 等待 beep 播放完毕 + 小间隔
      await new Promise<void>(resolve => setTimeout(resolve, 250));
    } catch (e) {
      console.error('[useAudioPlayback] beep 播放失败:', e);
    }
  }, []);

  /**
   * 开始录音：启动 encoder 发送 + 更新 store 状态。
   */
  const startRecording = useCallback(() => {
    const encoder = useInterviewStore.getState()._audioEncoderGetter?.();
    if (encoder) {
      encoder.startSending();
    }
    setAnswerPhase('answering');
    setAnswerStartTime(Date.now());
    setIsRecordingAudio(true);
    setIsRecording(true);
    console.log('[useAudioPlayback] 开始录音');
  }, [setAnswerPhase, setAnswerStartTime, setIsRecordingAudio]);

  /**
   * 停止录音。
   */
  const stopRecording = useCallback(() => {
    const encoder = useInterviewStore.getState()._audioEncoderGetter?.();
    if (encoder) {
      encoder.stopSending();
    }
    setIsRecordingAudio(false);
    setIsRecording(false);
  }, [setIsRecordingAudio]);

  /**
   * 等待 AudioStreamManager 播放队列清空。
   */
  const waitForPlaybackComplete = useCallback(async (manager: AudioStreamManager): Promise<void> => {
    return new Promise<void>((resolve) => {
      const check = () => {
        if (!manager.playing) {
          resolve();
          return;
        }
        setTimeout(check, 50);
      };
      check();
    });
  }, []);

  useEffect(() => {
    if (!wsClient) return;

    let manager: AudioStreamManager | null = null;

    const initManager = async () => {
      try {
        const { AudioStreamManager } = await import('../lib/audioStreamManager');
        manager = new AudioStreamManager({ channels: 1 });
        managerRef.current = manager;
        await manager.initialize();
      } catch (err) {
        console.error('[useAudioPlayback] 初始化失败:', err);
      }
    };

    initManager();

    // 创建稳定引用的处理器
    const handlers: AudioHandlers = {
      onStart: () => {
        resetAudioState();
        manager?.stop();
        interruptedRef.current = false;
        setIsPlaying(true);

        // 重置或创建 VAD
        const encoder = useInterviewStore.getState()._audioEncoderGetter?.();
        if (encoder) {
          if (!vadRef.current) {
            const vad = new VoiceActivityDetector({
              threshold: 0.01,
              speechDurationMs: 300,
              onSpeechStart: () => {
                // 播放中被用户打断
                if (managerRef.current?.playing && !interruptedRef.current) {
                  console.log('[useAudioPlayback] VAD 检测到说话，打断播放');
                  interruptedRef.current = true;
                  managerRef.current.stopImmediately();
                  setIsPlaying(false);
                  playBeep().then(() => startRecording());
                } else if (!interruptedRef.current) {
                  // 播放结束后，用户开始说话，开始录音
                  console.log('[useAudioPlayback] 检测到用户说话，开始录音');
                  interruptedRef.current = true; // 防止重复触发
                  startRecording();
                }
              },
            });
            vadRef.current = vad;
          } else {
            vadRef.current.reset();
          }
          // 每次都重新设置 callback，确保引用正确
          encoder.setVadCallback((vol) => vadRef.current!.processVolume(vol));
        }
      },
      onChunk: (data: ArrayBuffer) => {
        manager?.addChunk(data);
      },
      onEnd: async () => {
        if (interruptedRef.current) return; // 已被 VAD 打断，忽略

        // 等待播放队列清空
        if (manager && manager.playing) {
          await waitForPlaybackComplete(manager);
        }
        setIsPlaying(false);

        // 播放 beep，但不开始录音，等 VAD 检测到说话才开始
        await playBeep();
        console.log('[useAudioPlayback] 播放结束，等待用户说话开始录音...');
      },
      onError: (data: AudioQuestionErrorPayload) => {
        console.error('[useAudioPlayback] TTS 错误:', data?.message);
        setAudioError(true, data?.message ?? '语音合成失败');
        setIsPlaying(false);

        // TTS 错误时 beep，等用户说话开始录音
        playBeep();
        console.log('[useAudioPlayback] TTS 错误，等待用户说话开始录音...');
      },
    };

    // 自我介绍阶段：直接启动录音（没有 TTS 播放）
    const handleSelfIntro = () => {
      console.log('[useAudioPlayback] 自我介绍阶段，启动录音');
      resetAudioState();
      interruptedRef.current = false;
      startRecording();
    };

    handlersRef.current = handlers;

    wsClient.on('audio_question_start', handlers.onStart);
    wsClient.onBinary('audio_question_chunk', handlers.onChunk);
    wsClient.on('audio_question_end', handlers.onEnd);
    wsClient.on('audio_question_error', handlers.onError);
    wsClient.on('self_intro', handleSelfIntro);

    return () => {
      // 清除 encoder 上的 VAD callback
      const encoder = useInterviewStore.getState()._audioEncoderGetter?.();
      if (encoder) {
        encoder.setVadCallback(null);
      }

      manager?.dispose();
      managerRef.current = null;
      handlersRef.current = null;
      if (vadRef.current) {
        vadRef.current.reset();
        vadRef.current = null;
      }

      wsClient.off('audio_question_start', handlers.onStart);
      wsClient.offBinary('audio_question_chunk', handlers.onChunk);
      wsClient.off('audio_question_end', handlers.onEnd);
      wsClient.off('audio_question_error', handlers.onError);
      wsClient.off('self_intro', handleSelfIntro);

      if (beepAudioContextRef.current) {
        beepAudioContextRef.current.close().catch(() => {});
        beepAudioContextRef.current = null;
      }
    };
  }, [wsClient, setAudioError, resetAudioState, playBeep, startRecording, waitForPlaybackComplete]);

  return { isPlaying, isRecording, stopRecording };
}
