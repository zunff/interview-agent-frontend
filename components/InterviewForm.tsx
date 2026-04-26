'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createWebSocketClient } from '../lib/api';
import { useInterviewStore } from '../store/interviewStore';
import { parseFile, isValidFileType, isValidFileSize } from '../lib/fileParser';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import NumberStepper from './NumberStepper';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  Upload,
  FileText,
  X,
  Loader2,
  Plus,
  Settings,
  Play,
  Link2,
  Sparkles,
  Code2,
  Briefcase,
  MessagesSquare,
} from 'lucide-react';
import { parseBossZhipin } from '../lib/bossParser';
import type { PositionLevel } from '../types/index';

const FILE_PICKER_DEBOUNCE_MS = 800;

const POSITION_LEVEL_OPTIONS: {
  value: '' | PositionLevel;
  title: string;
  code: string;
}[] = [
  { value: '', title: '自动推断', code: 'LLM·JD' },
  { value: 'junior', title: '初级', code: 'junior' },
  { value: 'mid', title: '中级', code: 'mid' },
  { value: 'senior', title: '高级', code: 'senior' },
  { value: 'expert', title: '专家', code: 'expert' },
];

const InterviewForm = () => {
  const router = useRouter();
  const {
    setInterviewStatus,
    setWsClient,
    clearState,
    setHasSelfIntro,
    setHasJobAnalysisComplete,
    setInterviewPhase,
    setCurrentQuestion,
  } = useInterviewStore();

  const [resume, setResume] = useState('');
  const [jobInfo, setJobInfo] = useState('');
  const [maxTechnicalQuestions, setMaxTechnicalQuestions] = useState(6);
  const [maxBusinessQuestions, setMaxBusinessQuestions] = useState(4);
  const [maxFollowUps, setMaxFollowUps] = useState(2);
  const [positionLevel, setPositionLevel] = useState<'' | PositionLevel>('');
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [parseError, setParseError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [showPreview, setShowPreview] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importHtml, setImportHtml] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jobInfoRef = useRef<HTMLTextAreaElement>(null);
  const lastFilePickerOpenAtRef = useRef(0);

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
      // 防止上一轮会话残留状态影响新面试
      clearState();

      // 通过 WebSocket 启动面试
      const wsClient = createWebSocketClient();
      setWsClient(wsClient);
      await wsClient.connect();

      // 监听 session_created 消息，收到后再跳转
      wsClient.on('session_created', (data: { sessionId: string }) => {
        console.log('[InterviewForm] 会话创建:', data.sessionId);
        setInterviewStatus('进行中');
        router.push('/interview/session');
      });

      // 提前注册关键监听器，避免路由跳转过程中错过信号（竞态防护）
      // 这些 handler 与 session/page.tsx 中的 handler 不冲突：操作幂等，且 InterviewForm 卸载后闭包仍有效
      wsClient.on('self_intro', () => {
        console.log('[InterviewForm] 收到 self_intro');
        setInterviewPhase('self_intro');
        setCurrentQuestion(null);
        setHasSelfIntro(true);
      });

      wsClient.on('job_analysis_complete', () => {
        console.log('[InterviewForm] 收到 job_analysis_complete');
        setHasJobAnalysisComplete(true);
      });

      // 发送开始面试消息
      wsClient.sendStartInterview({
        resume,
        jobInfo,
        maxTechnicalQuestions,
        maxBusinessQuestions,
        maxFollowUps,
        ...(positionLevel ? { positionLevel } : {}),
      });

      // 不在这里立即跳转，等待 session_created 消息
    } catch {
      setError('开始面试失败，请重试');
      setLoading(false);
    }
  };

  const handleImportFromBoss = async () => {
    if (!importHtml.trim()) {
      setImportError('请粘贴页面源码');
      return;
    }

    setImporting(true);
    setImportError('');

    try {
      // 解析源码
      const jobInfo = parseBossZhipin(importHtml);

      if (!jobInfo) {
        setImportError('解析失败，请确保粘贴的是完整的页面源码');
        setImporting(false);
        return;
      }

      // 填充到输入框
      const formattedInfo = `【岗位名称】${jobInfo.jobName}
【薪资范围】${jobInfo.jobSalary || '面议'}
【公司名称】${jobInfo.company}

${jobInfo.jobDescription}`;

      setJobInfo(formattedInfo);
      setShowImportDialog(false);
      setImportHtml('');
      setImportError('');
    } catch (error) {
      setImportError(error instanceof Error ? error.message : '导入失败，请重试');
    } finally {
      setImporting(false);
    }
  };

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
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-foreground">
              岗位信息
            </label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowImportDialog(true)}
              className="h-7 text-xs gap-1.5"
            >
              <Link2 className="size-3.5" />
              从 BOSS 直聘导入
            </Button>
          </div>
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
              className="absolute right-3 top-12 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Import Dialog */}
        <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>从 BOSS 直聘导入</DialogTitle>
              <DialogDescription>
                粘贴 BOSS 直聘岗位详情页面的源码，自动解析岗位信息
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground space-y-1.5">
                  <p className="font-medium text-foreground">操作步骤：</p>
                  <ol className="list-decimal list-inside space-y-1 ml-1">
                    <li>在 BOSS 直聘页面点击「查看更多信息」</li>
                    <li>进入岗位详情页面（https://www.zhipin.com/job_detail/xxx）</li>
                    <li>在页面顶部右键 → 「查看页面源代码」</li>
                    <li>全选（Ctrl/Cmd + A）并复制所有内容</li>
                    <li>粘贴到下方文本框</li>
                  </ol>
                </div>
                <textarea
                  placeholder="粘贴页面源码..."
                  value={importHtml}
                  onChange={(e) => setImportHtml(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none custom-scrollbar"
                  rows={8}
                />
                {importError && (
                  <p className="text-xs text-destructive">{importError}</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowImportDialog(false)}
                  className="flex-1"
                >
                  取消
                </Button>
                <Button
                  type="button"
                  onClick={handleImportFromBoss}
                  disabled={importing}
                  className="flex-1"
                >
                  {importing ? (
                    <>
                      <Loader2 className="size-4 animate-spin mr-2" />
                      解析中...
                    </>
                  ) : (
                    '解析并导入'
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Settings & Start Button - Conditional Display */}
        {showSettings && (
          <div
            className={cn(
              'settings-container animate-in fade-in slide-in-from-bottom-4 duration-500',
              'relative overflow-hidden rounded-[1.75rem] border border-primary/12',
              'bg-gradient-to-b from-card via-card to-primary/[0.04]',
              'shadow-[0_12px_40px_-12px_rgba(8,145,178,0.18)] dark:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.45)]'
            )}
          >
            <div
              className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-primary/[0.07] blur-3xl"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -bottom-12 -left-12 size-40 rounded-full bg-cyan-400/[0.06] blur-3xl dark:bg-cyan-500/[0.08]"
              aria-hidden
            />

            <div className="relative space-y-6 p-6 sm:p-7">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary shadow-inner ring-1 ring-primary/15">
                    <Settings className="size-5" strokeWidth={2} />
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <h3 className="text-[15px] font-semibold tracking-tight text-foreground">
                      面试参数
                    </h3>
                    <p className="mt-0.5 max-w-md text-xs leading-relaxed text-muted-foreground">
                      职级与题量会影响题目深度与节奏；未指定职级时将依据岗位描述由模型推断。
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground/90">
                    岗位级别
                  </span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    可选
                  </span>
                </div>
                <div
                  role="radiogroup"
                  aria-label="岗位级别"
                  className="flex flex-wrap gap-2"
                >
                  {POSITION_LEVEL_OPTIONS.map((opt) => {
                    const selected = positionLevel === opt.value;
                    const isAuto = opt.value === '';
                    return (
                      <button
                        key={opt.value || 'auto'}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() =>
                          setPositionLevel((opt.value || '') as '' | PositionLevel)
                        }
                        className={cn(
                          'group relative min-w-[5.5rem] flex-1 rounded-2xl border px-3 py-2.5 text-left transition-all duration-200',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-card',
                          selected
                            ? 'border-primary/50 bg-primary/10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] dark:bg-primary/15'
                            : 'border-border/80 bg-background/60 hover:border-primary/35 hover:bg-muted/40 dark:bg-background/40'
                        )}
                      >
                        <span className="flex items-center gap-1.5">
                          {isAuto ? (
                            <Sparkles
                              className={cn(
                                'size-3.5 shrink-0 transition-colors',
                                selected
                                  ? 'text-primary'
                                  : 'text-muted-foreground group-hover:text-primary/80'
                              )}
                            />
                          ) : null}
                          <span
                            className={cn(
                              'text-sm font-semibold tracking-tight',
                              selected ? 'text-foreground' : 'text-foreground/90'
                            )}
                          >
                            {opt.title}
                          </span>
                        </span>
                        <span
                          className={cn(
                            'mt-1 block font-mono text-[10px] tabular-nums tracking-wide',
                            selected ? 'text-primary/90' : 'text-muted-foreground'
                          )}
                        >
                          {opt.code}
                        </span>
                        {selected ? (
                          <span
                            className="absolute right-2 top-2 size-1.5 rounded-full bg-primary shadow-[0_0_0_3px_rgba(8,145,178,0.2)]"
                            aria-hidden
                          />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="h-px w-full bg-gradient-to-r from-transparent via-border to-transparent" />

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <NumberStepper
                  label="技术题数"
                  value={maxTechnicalQuestions}
                  min={1}
                  max={15}
                  icon={<Code2 className="size-3.5" strokeWidth={2} />}
                  onChange={setMaxTechnicalQuestions}
                />
                <NumberStepper
                  label="业务题数"
                  value={maxBusinessQuestions}
                  min={1}
                  max={10}
                  icon={<Briefcase className="size-3.5" strokeWidth={2} />}
                  iconClassName="bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
                  onChange={setMaxBusinessQuestions}
                />
                <NumberStepper
                  label="最大追问数"
                  value={maxFollowUps}
                  min={0}
                  max={5}
                  icon={<MessagesSquare className="size-3.5" strokeWidth={2} />}
                  iconClassName="bg-amber-500/12 text-amber-700 dark:text-amber-400"
                  onChange={setMaxFollowUps}
                />
              </div>

              <Button
                type="submit"
                disabled={loading || !resume || !jobInfo}
                className={cn(
                  'h-14 w-full rounded-2xl text-base font-semibold shadow-[0_8px_24px_-8px_rgba(8,145,178,0.45)] transition-all duration-300',
                  'hover:scale-[1.01] active:scale-[0.99]',
                  (!resume || !jobInfo) && 'opacity-50 cursor-not-allowed shadow-none'
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
          </div>
        )}
      </form>
    </div>
  );
};

export default InterviewForm;
