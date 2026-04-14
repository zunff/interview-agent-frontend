'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createWebSocketClient } from '../lib/api';
import { useInterviewStore } from '../store/interviewStore';
import { parseFile, isValidFileType, isValidFileSize } from '../lib/fileParser';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { 
  Upload, 
  FileText, 
  X, 
  Loader2, 
  Plus, 
  ChevronUp,
  Settings,
  Play
} from 'lucide-react';

const InterviewForm = () => {
  const router = useRouter();
  const { setInterviewStatus, setWsClient } = useInterviewStore();

  const [resume, setResume] = useState('');
  const [jobInfo, setJobInfo] = useState('');
  const [maxTechnicalQuestions, setMaxTechnicalQuestions] = useState(6);
  const [maxBusinessQuestions, setMaxBusinessQuestions] = useState(4);
  const [maxFollowUps, setMaxFollowUps] = useState(2);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [parseError, setParseError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [showPreview, setShowPreview] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jobInfoRef = useRef<HTMLTextAreaElement>(null);

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
      const result = await parseFile(file);
      if (result.error) {
        setParseError(result.error);
      } else {
        setResume(result.text);
        setSelectedFile(file);
        setShowPreview(true);
        setParseError('');
      }
    } catch {
      setParseError('文件处理失败，请重试');
    } finally {
      setUploading(false);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setResume('');
    setShowPreview(false);
    setShowSettings(false);
    setParseError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleJobInfoChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setJobInfo(e.target.value);
  };

  // Auto-show settings after user stops typing
  useEffect(() => {
    if (!jobInfo.trim() || !resume) {
      setShowSettings(false);
      return;
    }

    const timer = setTimeout(() => {
      if (!showSettings) {
        setShowSettings(true);
        // Scroll to show the new controls
        setTimeout(() => {
          const settingsElement = document.querySelector('.settings-container');
          if (settingsElement) {
            settingsElement.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center' 
            });
          }
        }, 100);
      }
    }, 800); // 800ms debounce

    return () => clearTimeout(timer);
  }, [jobInfo, resume, showSettings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      // 通过 WebSocket 启动面试（不再使用 REST API）
      const wsClient = createWebSocketClient();
      setWsClient(wsClient);
      await wsClient.connect();
      setInterviewStatus('进行中');
      wsClient.sendStartInterview({
        resume,
        jobInfo,
        maxTechnicalQuestions,
        maxBusinessQuestions,
        maxFollowUps,
      });
      router.push('/interview/session');
    } catch {
      setError('开始面试失败，请重试');
      setLoading(false);
    }
  };

  const incrementMaxTechnicalQuestions = () => setMaxTechnicalQuestions(prev => Math.min(prev + 1, 15));
  const decrementMaxTechnicalQuestions = () => setMaxTechnicalQuestions(prev => Math.max(prev - 1, 1));
  const incrementMaxBusinessQuestions = () => setMaxBusinessQuestions(prev => Math.min(prev + 1, 10));
  const decrementMaxBusinessQuestions = () => setMaxBusinessQuestions(prev => Math.max(prev - 1, 1));
  const incrementMaxFollowUps = () => setMaxFollowUps(prev => Math.min(prev + 1, 5));
  const decrementMaxFollowUps = () => setMaxFollowUps(prev => Math.max(prev - 1, 0));

  return (
    <div className="w-full max-w-3xl mx-auto">
      {error && (
        <div className="bg-destructive/10 text-destructive border border-destructive/20 p-3 mb-6 rounded-lg text-sm text-center">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Upload Area / Resume Preview */}
        <div className="relative">
          {!showPreview ? (
            /* Upload Area */
            <div
              className={cn(
                'relative rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer overflow-hidden',
                'hover:border-primary/50 hover:bg-primary/[0.02]',
                dragActive ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-border',
                'flex items-center gap-4 py-4 px-6'
              )}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
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
                  'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300',
                  uploading ? 'bg-primary/10' : 'bg-primary/10 group-hover:bg-primary/20'
                )}>
                  {uploading ? (
                    <Loader2 className="size-5 text-primary animate-spin" />
                  ) : (
                    <Plus className="size-5 text-primary" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {dragActive ? '释放文件以上传' : '上传简历'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
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
            /* Resume Preview */
            <div className="relative rounded-2xl border border-border bg-card overflow-hidden transition-all duration-500 animate-in fade-in slide-in-from-top-4">
              {/* Header with restore button */}
              <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="size-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {selectedFile?.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      简历已解析
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={clearFile}
                  className="text-muted-foreground hover:text-foreground transition-colors shrink-0 cursor-pointer p-1.5 hover:bg-muted rounded-lg"
                  title="重新上传"
                >
                  <Upload className="size-4" />
                </button>
              </div>

              {/* Preview content */}
              <div className="p-4 max-h-48 overflow-y-auto custom-scrollbar">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <div className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {resume}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Job Info Input */}
        <div className="relative">
          <textarea
            ref={jobInfoRef}
            value={jobInfo}
            onChange={handleJobInfoChange}
            placeholder="请输入目标岗位信息（如：前端开发工程师，3 年经验，熟悉 React）"
            className={cn(
              'w-full px-4 py-6 rounded-xl border bg-background text-sm transition-all duration-500 resize-none custom-scrollbar',
              'placeholder:text-muted-foreground/70',
              'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
              'border-border hover:border-primary/30',
              showPreview 
                ? 'bg-muted/30 text-xs text-muted-foreground leading-relaxed' 
                : 'hover:border-primary/30'
            )}
            rows={10}
            style={showPreview ? { whiteSpace: 'pre-wrap' } : {}}
          />
          {jobInfo && (
            <button
              type="button"
              onClick={() => setJobInfo('')}
              className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Settings & Start Button - Conditional Display */}
        {showSettings && (
          <div className="settings-container space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Settings Controls */}
            <div className="grid grid-cols-3 gap-3">
              {/* Technical Questions */}
              <div className="group relative p-4 rounded-2xl border border-border bg-background hover:border-primary/30 hover:bg-muted/20 transition-all duration-300 cursor-default">
                <label className="text-xs font-medium text-muted-foreground mb-2.5 block">
                  技术题数
                </label>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-foreground tabular-nums leading-none">
                    {maxTechnicalQuestions}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={decrementMaxTechnicalQuestions}
                      className="w-7 h-7 rounded-lg border border-border flex items-center justify-center hover:border-primary hover:bg-primary hover:text-primary-foreground transition-all cursor-pointer"
                      aria-label="减少技术题数"
                    >
                      <span className="text-base font-semibold leading-none">−</span>
                    </button>
                    <button
                      type="button"
                      onClick={incrementMaxTechnicalQuestions}
                      className="w-7 h-7 rounded-lg border border-border flex items-center justify-center hover:border-primary hover:bg-primary hover:text-primary-foreground transition-all cursor-pointer"
                      aria-label="增加技术题数"
                    >
                      <span className="text-base font-semibold leading-none">+</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Business Questions */}
              <div className="group relative p-4 rounded-2xl border border-border bg-background hover:border-primary/30 hover:bg-muted/20 transition-all duration-300 cursor-default">
                <label className="text-xs font-medium text-muted-foreground mb-2.5 block">
                  业务题数
                </label>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-foreground tabular-nums leading-none">
                    {maxBusinessQuestions}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={decrementMaxBusinessQuestions}
                      className="w-7 h-7 rounded-lg border border-border flex items-center justify-center hover:border-primary hover:bg-primary hover:text-primary-foreground transition-all cursor-pointer"
                      aria-label="减少业务题数"
                    >
                      <span className="text-base font-semibold leading-none">−</span>
                    </button>
                    <button
                      type="button"
                      onClick={incrementMaxBusinessQuestions}
                      className="w-7 h-7 rounded-lg border border-border flex items-center justify-center hover:border-primary hover:bg-primary hover:text-primary-foreground transition-all cursor-pointer"
                      aria-label="增加业务题数"
                    >
                      <span className="text-base font-semibold leading-none">+</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Max Follow-ups */}
              <div className="group relative p-4 rounded-2xl border border-border bg-background hover:border-primary/30 hover:bg-muted/20 transition-all duration-300 cursor-default">
                <label className="text-xs font-medium text-muted-foreground mb-2.5 block">
                  最大追问数
                </label>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-foreground tabular-nums leading-none">
                    {maxFollowUps}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={decrementMaxFollowUps}
                      className="w-7 h-7 rounded-lg border border-border flex items-center justify-center hover:border-primary hover:bg-primary hover:text-primary-foreground transition-all cursor-pointer"
                      aria-label="减少追问数"
                    >
                      <span className="text-base font-semibold leading-none">−</span>
                    </button>
                    <button
                      type="button"
                      onClick={incrementMaxFollowUps}
                      className="w-7 h-7 rounded-lg border border-border flex items-center justify-center hover:border-primary hover:bg-primary hover:text-primary-foreground transition-all cursor-pointer"
                      aria-label="增加追问数"
                    >
                      <span className="text-base font-semibold leading-none">+</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Start Button */}
            <Button
              type="submit"
              disabled={loading || !resume || !jobInfo}
              className={cn(
                'w-full py-6 text-base font-semibold rounded-xl',
                'transition-all duration-300 transform',
                'hover:scale-[1.02] active:scale-[0.98]',
                (!resume || !jobInfo) && 'opacity-50 cursor-not-allowed'
              )}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="size-5 animate-spin" />
                  准备面试中...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Play className="size-5 fill-current" />
                  开始面试
                </span>
              )}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
};

export default InterviewForm;
