import { useInterviewStore } from '../store/interviewStore';
import { cn } from '../lib/utils';

function getScoreColors(score: number) {
  if (score >= 80) return { bg: 'bg-emerald-500', text: 'text-emerald-500' };
  if (score >= 60) return { bg: 'bg-amber-500', text: 'text-amber-500' };
  return { bg: 'bg-red-500', text: 'text-red-500' };
}

const EmotionDisplay = () => {
  const { currentEvaluation, evaluationResults } = useInterviewStore();

  if (!currentEvaluation) {
    return (
      <div className="rounded-xl bg-muted/50 border border-border p-5">
        <p className="text-muted-foreground text-sm">等待评估结果...</p>
      </div>
    );
  }

  const scores = [
    { label: '准确度', value: currentEvaluation.accuracy },
    { label: '逻辑性', value: currentEvaluation.logic },
    { label: '流畅度', value: currentEvaluation.fluency },
    { label: '自信度', value: currentEvaluation.confidence },
    { label: '情绪', value: currentEvaluation.emotionScore },
    { label: '肢体语言', value: currentEvaluation.bodyLanguageScore },
    { label: '语音语调', value: currentEvaluation.voiceToneScore },
  ];

  return (
    <div className="rounded-xl bg-muted/30 border border-border p-5 animate-fade-in">
      <div className="flex justify-between items-center mb-5">
        <h3 className="text-base text-foreground font-semibold">
          评估 · 第 {currentEvaluation.questionIndex + 1} 题
        </h3>
        <div className="px-3 py-1.5 rounded-xl bg-card border border-border">
          <span className={cn('text-xl font-bold font-mono', getScoreColors(currentEvaluation.overallScore).text)}>
            {currentEvaluation.overallScore}
          </span>
          <span className="text-xs text-muted-foreground ml-1">分</span>
        </div>
      </div>

      {/* Modality concern warning */}
      {currentEvaluation.modalityConcern && (
        <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs font-medium mb-1">
            注意事项
          </div>
          <p className="text-amber-600/80 dark:text-amber-300/80 text-xs leading-relaxed">
            {currentEvaluation.modalityConcern}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-4">
        {scores.map(({ label, value }) => (
          <div key={label}>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-muted-foreground">{label}</span>
              <span className={cn('text-xs font-medium font-mono', getScoreColors(value).text)}>
                {value}
              </span>
            </div>
            <div className="relative h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-700 ease-out', getScoreColors(value).bg)}
                style={{ width: `${value}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {currentEvaluation.detailedEvaluation && (
        <div className="text-xs text-muted-foreground border-t border-border pt-3 leading-relaxed">
          {currentEvaluation.detailedEvaluation}
        </div>
      )}

      {currentEvaluation.strengths.length > 0 && (
        <div className="mt-3 text-xs text-muted-foreground">
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">优势:</span> {currentEvaluation.strengths.join(' · ')}
        </div>
      )}

      {currentEvaluation.weaknesses.length > 0 && (
        <div className="text-xs text-muted-foreground mt-1">
          <span className="text-amber-600 dark:text-amber-400 font-medium">不足:</span> {currentEvaluation.weaknesses.join(' · ')}
        </div>
      )}

      {/* Modality follow-up suggestion */}
      {currentEvaluation.modalityFollowUpSuggestion && (
        <div className="mt-3 p-3 bg-primary/10 border border-primary/20 rounded-xl">
          <div className="flex items-center gap-2 text-primary text-xs font-medium mb-1">
            改进建议
          </div>
          <p className="text-primary/80 text-xs leading-relaxed">
            {currentEvaluation.modalityFollowUpSuggestion}
          </p>
        </div>
      )}

      {evaluationResults.length > 1 && (
        <div className="mt-4 border-t border-border pt-3">
          <div className="text-xs text-muted-foreground mb-2">历史评估</div>
          <div className="flex gap-1.5">
            {evaluationResults.map((r, i) => (
              <div
                key={i}
                className={cn(
                  'h-7 w-9 rounded-lg text-xs flex items-center justify-center text-white/90 font-mono font-medium',
                  getScoreColors(r.overallScore).bg
                )}
                title={`第${r.questionIndex + 1}题: ${r.overallScore}分`}
              >
                {r.overallScore}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default EmotionDisplay;
