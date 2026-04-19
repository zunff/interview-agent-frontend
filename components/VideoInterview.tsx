'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useInterviewStore } from '../store/interviewStore';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import { Video, VideoOff, Mic, MicOff, Phone, Clock, MessageSquare, X, ChevronLeft } from 'lucide-react';
import QuestionDisplay from './QuestionDisplay';
import ThemeToggle from './ThemeToggle';
import { AudioEncoderManager } from '../lib/audioEncoderManager';

const BLENDSHAPE_THRESHOLD = 0.1;
const FALLBACK_INTERVAL = 8000;
const CAPTURE_INTERVAL = 500;
const CANVAS_WIDTH = 160;
const CANVAS_HEIGHT = 120;
const JPEG_QUALITY = 0.5;

const VideoInterview = () => {
  const router = useRouter();
  const store = useInterviewStore();
  const {
    wsClient,
    currentQuestion,
    isCameraEnabled,
    isMicEnabled,
    answerPhase,
    answerStartTime,
    elapsedTime,
    isRecordingAudio,
    interviewPhase,
    isReady,
    toggleCamera,
    toggleMic,
    setAnswerPhase,
    setElapsedTime,
    setAudioEncoderGetter,
    setIsEncoderReady,
    setIsRecordingAudio,
    clearState,
  } = store;

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioEncoderRef = useRef<AudioEncoderManager | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const captureIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastBlendshapesRef = useRef<Float32Array | null>(null);
  const lastSentTimeRef = useRef<number>(Date.now());
  const faceLandmarkerRef = useRef<any>(null);
  const [isLoadingModel, setIsLoadingModel] = useState(true);
  const [mediaError, setMediaError] = useState('');
  const [isModelReady, setIsModelReady] = useState(false);
  const [isQuestionExpanded, setIsQuestionExpanded] = useState(true);

  // 将 Uint8Array 转换为 base64
  const uint8ToBase64 = useCallback((data: Uint8Array): string => {
    let binary = '';
    for (let i = 0; i < data.length; i++) {
      binary += String.fromCharCode(data[i]);
    }
    return btoa(binary);
  }, []);

  // Initialize FaceLandmarker
  useEffect(() => {
    let cancelled = false;

    const initFaceLandmarker = async () => {
      try {
        const vision = await (
          await import('@mediapipe/tasks-vision')
        ).FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );

        if (cancelled) return;

        const { FaceLandmarker } = await import('@mediapipe/tasks-vision');
        const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          outputFaceBlendshapes: true,
          numFaces: 1,
        });

        if (cancelled) {
          faceLandmarker.close();
          return;
        }

        faceLandmarkerRef.current = faceLandmarker;
        setIsModelReady(true);
        setIsLoadingModel(false);
      } catch (err) {
        console.error('FaceLandmarker初始化失败:', err);
        setIsLoadingModel(false);
      }
    };

    initFaceLandmarker();

    return () => {
      cancelled = true;
      if (faceLandmarkerRef.current) {
        faceLandmarkerRef.current.close();
        faceLandmarkerRef.current = null;
      }
    };
  }, []);

  // Initialize canvas
  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    canvasRef.current = canvas;
  }, []);

  // Initialize media stream
  useEffect(() => {
    let cancelled = false;

    const initMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        // 初始化音频编码器
        const audioEncoder = new AudioEncoderManager((data: Uint8Array) => {
          const audioBase64 = uint8ToBase64(data);
          const currentWsClient = useInterviewStore.getState().wsClient;
          currentWsClient?.sendAudioChunk(audioBase64);
        });

        await audioEncoder.initialize(stream);
        audioEncoderRef.current = audioEncoder;

        // 注册 encoder getter，让 useAudioPlayback 可以获取 encoder 引用
        setAudioEncoderGetter(() => audioEncoderRef.current);
        console.log('[VideoInterview] 已注册 AudioEncoder getter');

        // 标记 encoder 就绪，可以开始录音
        setIsEncoderReady(true);
        console.log('[VideoInterview] AudioEncoder 已就绪');
      } catch (err: any) {
        if (cancelled) return;
        if (err.name === 'NotAllowedError') {
          setMediaError('请允许访问摄像头和麦克风');
        } else if (err.name === 'NotFoundError') {
          setMediaError('未检测到摄像头或麦克风');
        } else {
          setMediaError('无法访问媒体设备');
        }
      }
    };

    initMedia();

    return () => {
      cancelled = true;
      setIsEncoderReady(false);
      if (audioEncoderRef.current) {
        audioEncoderRef.current.dispose();
        audioEncoderRef.current = null;
      }
      // 不清空 audioEncoderGetter，因为它返回的是 ref
      // ref 被清空后自然返回 null，无需额外清理
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [uint8ToBase64, setIsEncoderReady]);

  const captureKeyFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !wsClient) return;
    if (!isCameraEnabled) return;

    const video = videoRef.current;
    // 视频还没加载出画面时 videoWidth/videoHeight 为 0，传给 FaceLandmarker 会报错
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const now = Date.now();
    const timeSinceLastSend = now - lastSentTimeRef.current;

    let shouldSend = false;

    if (faceLandmarkerRef.current && isModelReady) {
      try {
        const result = faceLandmarkerRef.current.detectForVideo(video, now);

        if (result.faceBlendshapes && result.faceBlendshapes.length > 0) {
          const blendshapes = result.faceBlendshapes[0].categories;
          const currentValues = new Float32Array(blendshapes.length);
          for (let i = 0; i < blendshapes.length; i++) {
            currentValues[i] = blendshapes[i].score;
          }

          if (lastBlendshapesRef.current) {
            let maxDiff = 0;
            for (let i = 0; i < currentValues.length; i++) {
              const diff = Math.abs(currentValues[i] - lastBlendshapesRef.current[i]);
              if (diff > maxDiff) maxDiff = diff;
            }

            if (maxDiff > BLENDSHAPE_THRESHOLD) {
              shouldSend = true;
            }
          } else {
            shouldSend = true;
          }

          lastBlendshapesRef.current = currentValues;
        }
      } catch (err) {
        console.error('FaceLandmarker检测失败:', err);
      }
    }

    if (!shouldSend && timeSinceLastSend > FALLBACK_INTERVAL) {
      shouldSend = true;
    }

    if (shouldSend) {
      const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
      // 去掉 "data:image/jpeg;base64," 前缀，只发送纯 base64 数据，减小消息体积
      const base64Frame = dataUrl.split(',')[1] || '';
      wsClient.sendVideoFrame(base64Frame, Date.now());
      lastSentTimeRef.current = now;
    }
  }, [wsClient, isCameraEnabled, isModelReady]);

  useEffect(() => {
    // 只有在问答阶段且正在回答时才发送视频帧
    if (answerPhase === 'answering' && interviewPhase === 'questioning') {
      if (captureIntervalRef.current) clearInterval(captureIntervalRef.current);
      captureIntervalRef.current = setInterval(captureKeyFrame, CAPTURE_INTERVAL);
    } else {
      if (captureIntervalRef.current) {
        clearInterval(captureIntervalRef.current);
        captureIntervalRef.current = null;
      }
    }

    return () => {
      if (captureIntervalRef.current) {
        clearInterval(captureIntervalRef.current);
        captureIntervalRef.current = null;
      }
    };
  }, [answerPhase, interviewPhase, captureKeyFrame]);

  useEffect(() => {
    if (answerPhase !== 'answering' || !answerStartTime) return;

    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - answerStartTime) / 1000);
      setElapsedTime(elapsed);
    }, 1000);

    return () => clearInterval(timer);
  }, [answerPhase, answerStartTime, setElapsedTime]);

  const handleToggleCamera = useCallback(() => {
    const videoTrack = streamRef.current?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      toggleCamera();
    }
  }, [toggleCamera]);

  const handleToggleMic = useCallback(() => {
    const audioTrack = streamRef.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      toggleMic();
    }
  }, [toggleMic]);

  const handleAnswerComplete = useCallback(() => {
    // 自我介绍阶段：必须收到两个信号才能结束
    if (interviewPhase === 'self_intro' && !isReady) {
      console.warn('[VideoInterview] 等待岗位分析完成才能结束自我介绍');
      return;
    }

    if (!wsClient || answerPhase !== 'answering') return;

    // 停止发送音频数据
    audioEncoderRef.current?.stopSending();
    setIsRecordingAudio(false);

    if (interviewPhase === 'self_intro') {
      wsClient.sendSelfIntroComplete();
    } else {
      wsClient.sendAnswerComplete();
    }
    setAnswerPhase('evaluating');

    lastBlendshapesRef.current = null;
  }, [wsClient, answerPhase, interviewPhase, isReady, setAnswerPhase]);

  const handleExit = useCallback(() => {
    if (audioEncoderRef.current) {
      audioEncoderRef.current.dispose();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    clearState();
    router.push('/');
  }, [clearState, router]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (mediaError) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <div className="text-center bg-card/50 backdrop-blur-xl border border-border/50 rounded-3xl p-12 max-w-md mx-4 animate-fade-in-up shadow-2xl">
          <div className="w-20 h-20 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-6">
            <VideoOff className="size-10 text-destructive" />
          </div>
          <p className="text-lg text-foreground mb-8 font-medium">{mediaError}</p>
          <Button variant="outline" onClick={() => router.push('/')} className="px-8 rounded-xl">
            返回首页
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background flex flex-col">
      {/* Header */}
      <header className="h-16 bg-card/50 backdrop-blur-xl flex items-center justify-between px-6 border-b border-border/50 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Clock className="size-5 text-primary" />
            </div>
            <div>
              <h1 className="text-foreground font-semibold text-base tracking-wide">
                模拟面试
              </h1>
              <span className="text-muted-foreground text-xs font-mono">
                {interviewPhase === 'self_intro' ? '自我介绍' : `Q${currentQuestion?.index || 0}`}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-muted/50 border border-border/50">
            <Clock className="size-4 text-muted-foreground" />
            <span className="font-mono tabular-nums text-sm font-medium">{formatTime(elapsedTime)}</span>
          </div>

          {answerPhase === 'answering' && isRecordingAudio && (
            <span className="flex items-center gap-2 text-red-400 text-sm animate-fade-in">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="font-medium">录制中</span>
            </span>
          )}

          {answerPhase === 'evaluating' && (
            <span className="flex items-center gap-2 text-primary text-sm animate-fade-in">
              <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
              <span className="font-medium">评估中</span>
            </span>
          )}

          {isLoadingModel && (
            <span className="text-muted-foreground text-xs">加载检测...</span>
          )}

          <ThemeToggle />

          {/* Toggle Question Panel Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsQuestionExpanded(!isQuestionExpanded)}
            className="text-muted-foreground hover:text-foreground gap-2"
          >
            <MessageSquare className="size-4" />
            {isQuestionExpanded ? '隐藏问题' : '显示问题'}
          </Button>

        </div>
      </header>

      {/* Main Content - Horizontal Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video Area - Left Side */}
        <div className="flex-1 flex items-center justify-center p-6 min-w-0 transition-all duration-300">
          <div className="relative w-full h-full max-w-5xl rounded-3xl overflow-hidden shadow-2xl ring-1 ring-border/50">
            {isCameraEnabled ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover bg-black scale-x-[-1]"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted/50 to-muted/30">
                <div className="text-center">
                  <div className="w-24 h-24 rounded-2xl bg-background/80 backdrop-blur-sm flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <VideoOff className="size-12 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground text-sm font-medium">摄像头已关闭</p>
                </div>
              </div>
            )}

            {/* Recording indicator */}
            {answerPhase === 'answering' && isRecordingAudio && isCameraEnabled && (
              <div className="absolute top-6 right-6 animate-fade-in">
                <div className="flex items-center gap-2.5 px-4 py-2.5 bg-red-500/95 backdrop-blur-md rounded-full shadow-xl ring-1 ring-white/20">
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  <span className="text-white text-xs font-semibold font-mono tracking-wide">REC</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Question Panel - Right Drawer */}
        <div
          className={cn(
            "border-l border-border/50 bg-card/95 backdrop-blur-xl shadow-2xl flex-shrink-0 transition-all duration-300 ease-in-out overflow-hidden",
            isQuestionExpanded ? "w-[420px]" : "w-0"
          )}
        >
          <div className="w-[420px] h-full flex flex-col relative">
            {/* Drawer Toggle Button - Floating */}
            <button
              onClick={() => setIsQuestionExpanded(!isQuestionExpanded)}
              className={cn(
                "absolute top-1/2 -translate-y-1/2 w-10 h-20 bg-primary/10 backdrop-blur-xl border border-primary/20 rounded-l-xl flex flex-col items-center justify-center gap-1 hover:bg-primary/20 hover:border-primary/30 transition-all duration-200 shadow-xl z-30",
                "group",
                isQuestionExpanded ? "-left-10" : "-left-10"
              )}
              aria-label={isQuestionExpanded ? "收起问题面板" : "展开问题面板"}
            >
              <ChevronLeft
                className={cn(
                  "size-5 text-primary transition-transform duration-300",
                  !isQuestionExpanded && "rotate-180"
                )}
              />
              <span className="text-[10px] text-primary font-medium writing-mode-vertical">
                {isQuestionExpanded ? "收起" : "问题"}
              </span>
            </button>

            {/* Question Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
              <div className="flex items-center gap-2">
                <MessageSquare className="size-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">面试问题</h2>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsQuestionExpanded(false)}
                className="size-8 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </Button>
            </div>

            {/* Question Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              <QuestionDisplay />
            </div>
          </div>
        </div>
      </div>

      {/* Controls Bar */}
      <footer className="h-20 bg-card/50 backdrop-blur-xl flex items-center justify-center gap-4 px-6 border-t border-border/50 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleToggleCamera}
          className={cn(
            'size-14 rounded-2xl transition-all duration-200 border border-border/50',
            isCameraEnabled
              ? 'bg-background/50 text-muted-foreground hover:bg-muted hover:border-primary/30'
              : 'bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20'
          )}
        >
          {isCameraEnabled ? <Video className="size-6" /> : <VideoOff className="size-6" />}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleToggleMic}
          className={cn(
            'size-14 rounded-2xl transition-all duration-200 border border-border/50',
            isMicEnabled
              ? 'bg-background/50 text-muted-foreground hover:bg-muted hover:border-primary/30'
              : 'bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20'
          )}
        >
          {isMicEnabled ? <Mic className="size-6" /> : <MicOff className="size-6" />}
        </Button>

        <div className="w-px h-10 bg-border/50 mx-2" />

        <Button
          size="lg"
          onClick={handleAnswerComplete}
          disabled={interviewPhase === 'self_intro' ? !isReady : answerPhase !== 'answering'}
          className={cn(
            'px-12 py-4 rounded-2xl font-semibold transition-all duration-200 shadow-lg',
            (interviewPhase === 'self_intro' ? isReady : answerPhase === 'answering')
              ? 'bg-gradient-to-r from-primary to-primary/80 text-primary-foreground hover:shadow-xl hover:-translate-y-0.5 hover:from-primary hover:to-primary/90'
              : 'bg-muted text-muted-foreground cursor-not-allowed shadow-none'
          )}
        >
          {interviewPhase === 'self_intro' ? '自我介绍完成' : '回答完毕'}
        </Button>

        <div className="w-px h-10 bg-border/50 mx-2" />

        <Button
          variant="ghost"
          size="icon"
          onClick={handleExit}
          className="size-14 rounded-2xl text-destructive hover:bg-destructive/10 hover:text-destructive transition-all duration-200 border border-border/50"
        >
          <Phone className="size-6" />
        </Button>
      </footer>
    </div>
  );
};

export default VideoInterview;
