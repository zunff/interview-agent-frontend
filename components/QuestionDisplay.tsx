'use client';

import { useState, useEffect, useRef } from 'react';
import { useInterviewStore } from '../store/interviewStore';
import { Badge } from './ui/badge';

// 自我介绍引导文本
const SELF_INTRO_TEXT = '请做一个简短的自我介绍，谈谈你的背景、技能和为什么对这个岗位感兴趣。';

const QuestionDisplay = () => {
  const { currentQuestion, interviewPhase } = useInterviewStore();
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // 确定要显示的内容
  const targetContent = interviewPhase === 'self_intro'
    ? SELF_INTRO_TEXT
    : (currentQuestion?.content || '');

  // 打字动画 - 仅依赖 targetContent，displayedText 更新不触发重新动画
  useEffect(() => {
    if (!targetContent) {
      setDisplayedText('');
      setIsTyping(false);
      return;
    }

    let charIndex = 0;
    let timeoutId: ReturnType<typeof setTimeout>;
    setDisplayedText('');
    setIsTyping(true);

    const typeChar = () => {
      if (charIndex < targetContent.length) {
        charIndex++;
        setDisplayedText(targetContent.slice(0, charIndex));
        timeoutId = setTimeout(typeChar, 30);
      } else {
        setIsTyping(false);
      }
    };

    timeoutId = setTimeout(typeChar, 30);

    return () => clearTimeout(timeoutId);
  }, [targetContent]);

  // 自我介绍阶段显示引导
  if (interviewPhase === 'self_intro') {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/30 p-6 backdrop-blur-sm shadow-lg">
        <div className="relative">
          <h2 className="text-base md:text-lg leading-relaxed font-medium" style={{ color: 'var(--foreground)' }}>
            {displayedText}
            {isTyping && (
              <span className="inline-block w-0.5 h-4 ml-1 bg-primary animate-pulse" />
            )}
          </h2>
        </div>
      </div>
    );
  }

  // 问答阶段
  if (!currentQuestion) {
    return (
      <div className="rounded-2xl bg-muted/30 border border-border/50 p-6 backdrop-blur-sm">
        <p className="text-muted-foreground text-sm font-medium">等待问题...</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-gradient-to-br from-muted/50 to-muted/30 border border-border/50 p-6 backdrop-blur-sm shadow-lg">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <span className="text-xs font-bold text-primary font-mono">Q{currentQuestion.index}</span>
          </div>
          {currentQuestion.isFollowUp && (
            <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20 font-medium">
              追问
            </Badge>
          )}
          <Badge variant="secondary" className="text-xs bg-background/50 border-border/50 font-medium">
            {currentQuestion.type}
          </Badge>
        </div>
      </div>
      <div className="relative">
        <h2 className="text-base md:text-lg leading-relaxed font-medium" style={{ color: 'var(--foreground)' }}>
          {displayedText}
          {isTyping && (
            <span className="inline-block w-0.5 h-4 ml-1 bg-primary animate-pulse" />
          )}
        </h2>
      </div>
    </div>
  );
};

export default QuestionDisplay;