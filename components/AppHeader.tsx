'use client';

import Link from 'next/link';
import ThemeToggle from './ThemeToggle';
import { Sparkles } from 'lucide-react';

type AppHeaderProps = {
  /** 右侧操作区（链接、按钮等），与 ThemeToggle 并排显示 */
  right?: React.ReactNode;
};

/**
 * 全局应用头部：Logo + 标题 + 右侧操作区（含 ThemeToggle）
 */
export default function AppHeader({ right }: AppHeaderProps) {
  return (
    <header className="relative z-10 flex w-full items-center justify-between px-6 py-4">
      <Link
        href="/"
        className="flex items-center gap-3 rounded-xl outline-none ring-offset-background transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Sparkles className="size-5 text-primary" />
        </div>
        <span className="text-sm font-semibold text-foreground">AI 模拟面试</span>
      </Link>
      <div className="flex items-center gap-2 sm:gap-3">
        {right}
        <ThemeToggle />
      </div>
    </header>
  );
}
