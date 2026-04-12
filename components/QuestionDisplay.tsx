'use client';

import { useState, useEffect, useRef } from 'react';
import { useInterviewStore } from '../store/interviewStore';
import { Badge } from './ui/badge';

const QuestionDisplay = () => {
  const { currentQuestion, interviewPhase } = useInterviewStore();
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const prevPhaseRef = useRef<string | null>(null);

  // 自我介绍引导文本
  const selfIntroText = '请做一个简短的自我介绍，谈谈你的背景、技能和为什么对这个岗位感兴趣。';

  useEffect(() => {
    const prevPhase = prevPhaseRef.current;
    prevPhaseRef.current = interviewPhase;

    // 自我介绍阶段显示引导文本
    if (interviewPhase === 'self_intro' && !currentQuestion) {
      // 只在阶段变化时重新开始动画
      if (prevPhase !== 'self_intro') {
        console.log('[QuestionDisplay] 开始自我介绍打字动画');
        setDisplayedText('');
        setIsTyping(true);

        let charIndex = 0;
        const typingInterval = setInterval(() => {
          if (charIndex < selfIntroText.length) {
            setDisplayedText(selfIntroText.slice(0, charIndex + 1));
            charIndex++;
          } else {
            setIsTyping(false);
            clearInterval(typingInterval);
          }
        }, 30);

        return () => clearInterval(typingInterval);
      }
      return;
    }

    // 正常问题阶段
    if (!currentQuestion) {
      setDisplayedText('');
      setIsTyping(false);
      return;
    }

    // Reset and start typing animation for normal questions
    console.log('[QuestionDisplay] 开始问题打字动画:', currentQuestion.content.substring(0, 30) + '...');
    setDisplayedText('');
    setIsTyping(true);

    const content = currentQuestion.content;
    let charIndex = 0;

    const typingInterval = setInterval(() => {
      if (charIndex < content.length) {
        setDisplayedText(content.slice(0, charIndex + 1));
        charIndex++;
      } else {
        setIsTyping(false);
        clearInterval(typingInterval);
      }
    }, 30); // 30ms per character for smooth typing

    return () => clearInterval(typingInterval);
  }, [currentQuestion, interviewPhase, selfIntroText]);

  // 自我介绍阶段显示引导
  if (interviewPhase === 'self_intro' && !currentQuestion) {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/30 p-6 backdrop-blur-sm shadow-lg animate-fade-in">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="text-xs font-bold text-primary font-mono">自我介绍</span>
            </div>
            <Badge variant="secondary" className="text-xs bg-background/50 border-border/50 font-medium">
              准备阶段
            </Badge>
          </div>
        </div>
        <div className="relative">
          <h2 className="text-base md:text-lg text-foreground leading-relaxed font-medium">
            {displayedText}
            {isTyping && (
              <span className="inline-block w-0.5 h-4 ml-1 bg-primary animate-pulse" />
            )}
          </h2>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="rounded-2xl bg-muted/30 border border-border/50 p-6 backdrop-blur-sm">
        <p className="text-muted-foreground text-sm font-medium">等待问题...</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-gradient-to-br from-muted/50 to-muted/30 border border-border/50 p-6 backdrop-blur-sm shadow-lg animate-fade-in">
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
        <h2 className="text-base md:text-lg text-foreground leading-relaxed font-medium">
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
