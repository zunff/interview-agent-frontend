'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ReportExperienceLayout } from '@/components/ReportExperienceLayout';
import { AnalysisProgress } from '@/components/AnalysisProgress';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Upload,
  FileText,
  X,
  Loader2,
  History,
} from 'lucide-react';
import { isValidFileType, isValidFileSize } from '@/lib/fileParser';
import { useResumeAnalysisStore } from '@/store/resumeAnalysisStore';
import { resumeApi } from '@/lib/resumeApi';
import type { SSEEvent } from '@/lib/sseParser';
import type { RadarChartData, DimensionScore } from '@/store/resumeAnalysisStore';

const FILE_PICKER_DEBOUNCE_MS = 800;

export default function ResumeAnalysisPage() {
  const router = useRouter();
  const {
    sessionId,
    phase,
    progressNodes,
    dimensionScores,
    radarChartData,
    setSessionId,
    setPhase,
    updateProgress,
    addDimensionScore,
    setRadarChartData,
    setError,
    reset,
  } = useResumeAnalysisStore();

  // 进入页面时清空上次残留状态
  useEffect(() => {
    reset();
  }, [reset]);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [parseError, setParseError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastFilePickerOpenAtRef = useRef(0);

  const handleSSEEvent = useCallback((event: SSEEvent) => {
    console.log('[SSE Event]', event);

    switch (event.event) {
      case 'progress':
        const progressData = event.data as { node: string; status: string };
        console.log('[Progress]', progressData.node, progressData.status);
        updateProgress(progressData.node, progressData.status as any);
        break;

      case 'dimension_score':
        const scoreData = event.data as DimensionScore;
        addDimensionScore(scoreData);
        break;

      case 'radar_chart':
        const radarData = event.data as { data: string };
        try {
          const parsed: RadarChartData = JSON.parse(radarData.data);
          setRadarChartData(parsed);
        } catch (e) {
          console.error('Failed to parse radar_chart data', e);
        }
        break;

      case 'done':
        console.log('[DONE] SSE stream completed');
        break;

      case 'error':
        const errorData = event.data as { error: string };
        setError(errorData.error);
        break;
    }
  }, [updateProgress, addDimensionScore, setRadarChartData, setPhase, setError]);

  const openFilePicker = () => {
    const now = Date.now();
    if (now - lastFilePickerOpenAtRef.current < FILE_PICKER_DEBOUNCE_MS) return;
    lastFilePickerOpenAtRef.current = now;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await processFile(file);
  };

  const processFile = async (file: File) => {
    setUploading(true);
    setParseError('');
    try {
      if (!isValidFileType(file)) {
        setParseError('不支持的文件格式，请上传 PDF 或 DOCX');
        return;
      }
      if (!isValidFileSize(file)) {
        setParseError('文件大小不能超过 10MB');
        return;
      }
      setSelectedFile(file);
    } catch {
      setParseError('文件处理失败，请重试');
    } finally {
      setUploading(false);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setParseError('');
    reset();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleStartAnalysis = async () => {
    if (!selectedFile) return;

    try {
      setUploading(true);
      setParseError('');
      setPhase('uploading');

      // 1. 创建会话
      const session = await resumeApi.createSession();
      setSessionId(session.sessionId);

      // 2. 上传简历并处理 SSE 事件
      setPhase('analyzing');
      await resumeApi.uploadResume(session.sessionId, selectedFile, handleSSEEvent);

      // 3. SSE 流结束，跳转到详情页
      router.push(`/resume/${session.sessionId}`);

    } catch (error) {
      console.error('Analysis failed', error);
      setParseError(error instanceof Error ? error.message : '分析失败，请重试');
      setError('分析失败');
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    clearFile();
  };

  const showProgress = phase === 'uploading' || phase === 'analyzing';

  return (
    <ReportExperienceLayout
      headerExtra={
        <Link
          href="/resume/history"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <History className="size-4" />
          <span>历史会话</span>
        </Link>
      }
      breadcrumbs={[
        { label: '首页', href: '/' },
        { label: '简历分析' },
      ]}
      pageTitle="简历分析"
      pageDescription="上传简历获取 AI 深度分析和雷达图评分"
    >
      <div className="w-full max-w-3xl mx-auto space-y-6">
          {/* 文件上传区 */}
          <div className="relative">
            {!selectedFile ? (
              <div
                className={cn(
                  'relative rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer overflow-hidden',
                  'hover:border-primary/50 hover:bg-primary/[0.02]',
                  dragActive ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-border',
                  'flex items-center gap-4 py-8 px-6'
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={openFilePicker}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="sr-only"
                  accept=".pdf,.docx"
                  onChange={handleFileChange}
                />

                <div className="flex items-center gap-4 flex-1">
                  <div className={cn(
                    'w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300',
                    uploading ? 'bg-primary/10' : 'bg-primary/10'
                  )}>
                    {uploading ? (
                      <Loader2 className="size-6 text-primary animate-spin" />
                    ) : (
                      <Upload className="size-6 text-primary" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-base font-medium text-foreground">
                      {dragActive ? '释放文件以上传' : '上传简历'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      支持 PDF、DOCX 格式，最大 10MB
                    </p>
                  </div>

                  <Badge variant="secondary" className="text-xs font-mono shrink-0">
                    PDF / DOCX
                  </Badge>
                </div>

                {parseError && (
                  <div className="absolute bottom-3 left-0 right-0 text-center">
                    <p className="text-xs text-destructive">{parseError}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="relative rounded-2xl border border-border bg-card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="size-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        简历已选择
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={clearFile}
                    className="text-muted-foreground hover:text-foreground transition-colors shrink-0 cursor-pointer p-1.5 hover:bg-muted rounded-lg"
                    title="重新选择"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>
            )}
          </div>


          {/* 开始分析按钮 */}
          <Button
            onClick={handleStartAnalysis}
            disabled={!selectedFile || uploading}
            className={cn(
              'h-14 w-full rounded-2xl text-base font-semibold shadow-[0_8px_24px_-8px_rgba(8,145,178,0.45)] transition-all duration-300',
              'hover:scale-[1.01] active:scale-[0.99]',
              !selectedFile && 'opacity-50 cursor-not-allowed shadow-none'
            )}
          >
            {uploading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="size-5 animate-spin" />
                分析中...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                开始分析
              </span>
            )}
          </Button>

          {/* 进度区域 */}
          {showProgress && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <AnalysisProgress progressNodes={progressNodes} />
            </div>
          )}
        </div>
    </ReportExperienceLayout>
  );
}