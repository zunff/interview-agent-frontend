'use client';

import dynamic from 'next/dynamic';
import ParticleBackground from '../components/ParticleBackground';
import ThemeToggle from '../components/ThemeToggle';
import { useTheme } from '../components/ThemeProvider';
import { Badge } from '../components/ui/badge';
import { Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';

const InterviewForm = dynamic(() => import('../components/InterviewForm'), { ssr: false });

const motivationalQuotes = [
  '你好！我是你的 AI 面试助手，今天感觉怎么样？',
  '欢迎！准备好开始今天的面试练习了吗？',
  '很高兴见到你！让我们开始吧',
  '你好呀！我会帮你展现最好的一面',
  '欢迎！今天也要加油哦',
  '嗨！我是你的智能面试助手',
  '你好！准备好展示实力了吗？',
  '欢迎！让我们一起进步',
  '你好！今天状态如何？',
  '欢迎回来！准备好迎接挑战了吗？',
  '嗨！很高兴见到你',
  '你好！让我们一起开启今天的练习',
  '欢迎！每一次练习都是进步',
  '你好呀！今天也要全力以赴',
  '欢迎！我会全程陪伴你',
  '嗨！准备好了吗？让我们开始',
  '你好！相信你今天会很棒',
  '欢迎！让我们一起努力',
  '你好！今天也要保持自信',
  '欢迎！期待你的精彩表现',
];

export default function Home() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [displayedQuote, setDisplayedQuote] = useState('');
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    const quote = motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)];
    setDisplayedQuote(quote);
    
    let charIndex = 0;
    const typingInterval = setInterval(() => {
      if (charIndex < quote.length) {
        setDisplayedText(quote.slice(0, charIndex + 1));
        charIndex++;
      } else {
        setIsTyping(false);
        clearInterval(typingInterval);
      }
    }, 50);

    return () => clearInterval(typingInterval);
  }, []);

  return (
    <main className="relative min-h-screen flex flex-col">
      {/* Particle background - only in dark mode */}
      {isDark && <ParticleBackground />}

      {/* Subtle gradient for light mode */}
      {!isDark && (
        <div className="fixed inset-0 bg-gradient-to-br from-cyan-50/50 via-transparent to-sky-50/30 pointer-events-none" />
      )}

      {/* Header with theme toggle */}
      <div className="w-full px-6 py-4 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
            <Sparkles className="size-5 text-primary" />
          </div>
          <span className="text-sm font-semibold text-foreground">AI 模拟面试</span>
        </div>
        <div>
          <ThemeToggle />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-start px-6 pt-16 pb-12 relative z-10">
        {/* AI Greeting Display */}
        <div className="w-full max-w-3xl mb-10">
          <div className="text-center py-8">
            <div className="font-mono text-lg md:text-xl lg:text-2xl leading-relaxed text-foreground/90">
              <span>{displayedText}</span>
              {isTyping && (
                <span className="inline-block w-0.5 h-5 ml-1 bg-primary animate-pulse" />
              )}
            </div>
          </div>
        </div>
        
        <InterviewForm />
      </div>
    </main>
  );
}
