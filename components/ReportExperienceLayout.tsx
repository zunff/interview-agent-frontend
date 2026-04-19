'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import ParticleBackground from './ParticleBackground';
import ThemeToggle from './ThemeToggle';
import { useTheme } from './ThemeProvider';
import { Sparkles } from 'lucide-react';

type ReportExperienceLayoutProps = {
  children: React.ReactNode;
  /** 页面主标题，如「面试报告」「面试结束」 */
  pageTitle?: string;
  /** 标题下方说明 */
  pageDescription?: string;
  /** 为 false 时不展示标题区（仅顶栏 + 内容），用于独立报告页 */
  showPageHeading?: boolean;
  /** 与 ThemeToggle 并排的操作按钮，如「首页」 */
  headerExtra?: React.ReactNode;
  /** 主内容区宽度，报告页带侧栏时用 max-w-7xl */
  contentClassName?: string;
};

export function ReportExperienceLayout({
  children,
  pageTitle,
  pageDescription,
  showPageHeading = true,
  headerExtra,
  contentClassName,
}: ReportExperienceLayoutProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <main className="relative flex min-h-screen flex-col">
      {isDark && <ParticleBackground />}
      {!isDark && (
        <div
          className="pointer-events-none fixed inset-0 bg-gradient-to-br from-cyan-50/50 via-transparent to-sky-50/30"
          aria-hidden
        />
      )}

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
          {headerExtra}
          <ThemeToggle />
        </div>
      </header>

      <div
        className={cn(
          'relative z-10 mx-auto w-full flex-1 px-6 pb-12 sm:pb-16',
          contentClassName ?? 'max-w-4xl',
          showPageHeading ? 'pt-6 sm:pt-8' : 'pt-2 sm:pt-4',
        )}
      >
        {showPageHeading && (pageTitle || pageDescription) ? (
          <div className="animate-fade-in-up mb-8 text-center sm:mb-10">
            {pageTitle ? (
              <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                {pageTitle}
              </h1>
            ) : null}
            {pageDescription ? (
              <p className="mt-2 text-sm text-muted-foreground sm:text-base">{pageDescription}</p>
            ) : null}
          </div>
        ) : null}
        {children}
      </div>
    </main>
  );
}
