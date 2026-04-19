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
  const ttsChunkCountRef = useRef(0);
  const ttsChunkBytesRef = useRef(0);
  const ttsChunkLogTimeRef = useRef(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const { wsClient, hasSelfIntro, isEncoderReady, setAudioError, resetAudioState, setAnswerPhase, setAnswerStartTime, setIsRecordingAudio } = useInterviewStore();

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
   * 开始录音：发送 audio_start 信号 + 启动 encoder 发送 + 更新 store 状态。
   * 注意：此函数应在 isEncoderReady 为 true 时调用，确保 encoder 已初始化完成。
   */
  const startRecording = useCallback(() => {
    const wsClient = useInterviewStore.getState().wsClient;
    const encoder = useInterviewStore.getState()._audioEncoderGetter?.();

    console.log('[useAudioPlayback] 开始录音 - encoder 存在:', !!encoder);

    // 先发送 audio_start 消息，携带录音开始时间戳
    if (wsClient) {
      const startTimestampMs = Date.now();
      wsClient.sendAudioStart(startTimestampMs);
      console.log('[useAudioPlayback] 发送 audio_start:', startTimestampMs);
    }

    // 启动 encoder 发送音频数据
    if (encoder) {
      console.log('[useAudioPlayback] 调用 encoder.startSending()');
      encoder.startSending();

      setAnswerPhase('answering');
      setAnswerStartTime(Date.now());
      setIsRecordingAudio(true);
      setIsRecording(true);
      console.log('[useAudioPlayback] 开始录音');
    } else {
      // 理论上不应该发生，因为 isEncoderReady 保证 encoder 已就绪
      console.error('[useAudioPlayback] encoder 为空！isEncoderReady 应该为 false');
    }
  }, [setAnswerPhase, setAnswerStartTime, setIsRecordingAudio, setIsRecording]);

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
   * 等待 AudioStreamManager 播放队列清空，并额外缓冲确保尾音自然结束。
   */
  const waitForPlaybackComplete = useCallback(async (manager: AudioStreamManager): Promise<void> => {
    return new Promise<void>((resolve) => {
      const check = () => {
        if (!manager.playing) {
          // 额外缓冲 300ms，确保最后一个字的尾音完全结束
          setTimeout(resolve, 300);
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
        ttsChunkCountRef.current = 0;
        ttsChunkBytesRef.current = 0;
        ttsChunkLogTimeRef.current = 0;
        console.log('[useAudioPlayback] 收到 audio_question_start，准备接收并播放 TTS 二进制音频');
        resetAudioState();
        setIsRecordingAudio(false); // 重置录音状态，为下一题做准备
        manager?.stop();
        interruptedRef.current = false;
        setIsPlaying(true);

        // 重置 VAD 状态（VAD 对象和 callback 在 encoder 就绪时已统一设置）
        if (vadRef.current) {
          vadRef.current.reset();
        }
      },
      onChunk: (data: ArrayBuffer) => {
        ttsChunkCountRef.current += 1;
        ttsChunkBytesRef.current += data.byteLength;
        const now = Date.now();
        if (now - ttsChunkLogTimeRef.current >= 1000) {
          console.log(
            `[useAudioPlayback] 收到 TTS 二进制 chunk: +${ttsChunkCountRef.current} 帧, 累计 ${ttsChunkBytesRef.current} bytes, 当前帧 ${data.byteLength} bytes`,
          );
          ttsChunkLogTimeRef.current = now;
          ttsChunkCountRef.current = 0;
        }
        manager?.addChunk(data);
      },
      onEnd: async () => {
        console.log(`[useAudioPlayback] 收到 audio_question_end，TTS 累计接收 ${ttsChunkBytesRef.current} bytes`);
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

        // Mock 模式下直接启动录音（没有真实音频输入，VAD 不会触发）
        if (process.env.NEXT_PUBLIC_MOCK_MODE === 'true') {
          playBeep().then(() => {
            console.log('[useAudioPlayback] Mock 模式下直接启动录音');
            startRecording();
          });
        } else {
          // 真实模式下等用户说话开始录音
          playBeep();
          console.log('[useAudioPlayback] TTS 错误，等待用户说话开始录音...');
        }
      },
    };

    handlersRef.current = handlers;

    wsClient.on('audio_question_start', handlers.onStart);
    wsClient.onBinary('audio_question_chunk', handlers.onChunk);
    wsClient.on('audio_question_end', handlers.onEnd);
    wsClient.on('audio_question_error', handlers.onError);

    return () => {
      manager?.dispose();
      managerRef.current = null;
      handlersRef.current = null;

      wsClient.off('audio_question_start', handlers.onStart);
      wsClient.offBinary('audio_question_chunk', handlers.onChunk);
      wsClient.off('audio_question_end', handlers.onEnd);
      wsClient.off('audio_question_error', handlers.onError);

      if (beepAudioContextRef.current) {
        beepAudioContextRef.current.close().catch(() => {});
        beepAudioContextRef.current = null;
      }
    };
  }, [wsClient, setAudioError, resetAudioState, setIsRecordingAudio, playBeep, startRecording, waitForPlaybackComplete]);

  // 统一初始化 VAD（在 encoder 就绪时设置一次）
  useEffect(() => {
    if (!isEncoderReady) return;

    const encoder = useInterviewStore.getState()._audioEncoderGetter?.();
    if (!encoder) return;

    // 创建或重置 VAD
    if (!vadRef.current) {
      const vad = new VoiceActivityDetector({
        threshold: 0.01,
        speechDurationMs: 300,
        onSpeechStart: () => {
          const state = useInterviewStore.getState();

          console.log('[VAD] onSpeechStart 触发', {
            managerPlaying: managerRef.current?.playing,
            interrupted: interruptedRef.current,
            isRecordingAudio: state.isRecordingAudio,
            interviewPhase: state.interviewPhase,
            answerPhase: state.answerPhase,
          });

          // 播放中被用户打断
          if (managerRef.current?.playing && !interruptedRef.current) {
            console.log('[useAudioPlayback] VAD 检测到说话，打断播放');
            interruptedRef.current = true;
            managerRef.current.stopImmediately();
            setIsPlaying(false);
            playBeep().then(() => startRecording());
          }
          // 播放结束后或自我介绍阶段，用户开始说话
          else if (!interruptedRef.current && !state.isRecordingAudio) {
            console.log('[useAudioPlayback] 检测到用户说话，开始录音');
            interruptedRef.current = true; // 防止重复触发
            startRecording();
          } else {
            console.log('[VAD] onSpeechStart 被忽略，conditions not met');
          }
        },
      });
      vadRef.current = vad;
    } else {
      vadRef.current.reset();
    }

    // 设置 VAD callback
    encoder.setVadCallback((vol) => {
      const vad = vadRef.current;
      if (vad) {
        const beforeProcess = vad.isSpeaking;
        vad.processVolume(vol);
        const afterProcess = vad.isSpeaking;
        // 状态变化时打日志
        if (!beforeProcess && afterProcess) {
          console.log(`[VAD] 检测到说话开始, RMS=${vol.toFixed(4)}, threshold=0.01`);
        } else if (beforeProcess && !afterProcess) {
          console.log(`[VAD] 检测到说话停止, RMS=${vol.toFixed(4)}`);
        }
      }
    });
    console.log('[useAudioPlayback] VAD callback 已设置');

    return () => {
      encoder.setVadCallback(null);
      if (vadRef.current) {
        vadRef.current.reset();
      }
    };
  }, [isEncoderReady, playBeep, startRecording]);

  // 自我介绍阶段：等待 encoder 就绪且收到 self_intro 后，播放 beep 提示用户
  useEffect(() => {
    if (isEncoderReady && hasSelfIntro && !isRecording) {
      const interviewPhase = useInterviewStore.getState().interviewPhase;
      if (interviewPhase === 'self_intro') {
        console.log('[useAudioPlayback] encoder 已就绪且收到 self_intro，播放 beep 提示用户');
        resetAudioState();
        interruptedRef.current = false;

        // 播放 beep 提示用户可以开始说话（VAD 会在检测到说话时启动录音）
        playBeep().then(() => {
          console.log('[useAudioPlayback] 自我介绍 beep 播放完毕，等待用户说话...');
        });
      }
    }
  }, [isEncoderReady, hasSelfIntro, isRecording, resetAudioState, playBeep]);

  return { isPlaying, isRecording, stopRecording };
}
