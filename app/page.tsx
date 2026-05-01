'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useTypingEffect } from '../hooks/useTypingEffect';
import { ReportExperienceLayout } from '../components/ReportExperienceLayout';
import { Loader2, History, FileSearch } from 'lucide-react';

const InterviewForm = dynamic(() => import('../components/InterviewForm'), {
  loading: () => (
    <div className="w-full max-w-3xl mx-auto flex items-center justify-center py-20">
      <Loader2 className="size-8 text-primary animate-spin" />
    </div>
  ),
});

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
  // 只在首次渲染时随机选取 quote，避免每次渲染变化导致 useTypingEffect 重置
  const [quote] = useState(() =>
    motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)]
  );
  const { displayedText, isTyping } = useTypingEffect(quote, 50);

  return (
    <ReportExperienceLayout
      headerExtra={
        <>
          <Link
            href="/resume"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <FileSearch className="size-4" />
            <span>简历分析</span>
          </Link>
          <Link
            href="/history"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <History className="size-4" />
            <span>历史记录</span>
          </Link>
        </>
      }
      breadcrumbs={[{ label: '首页' }]}
    >
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
    </ReportExperienceLayout>
  );
}
