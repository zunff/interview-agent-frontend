'use client';

import { cn } from '@/lib/utils';
import PageBackground from './PageBackground';
import AppHeader from './AppHeader';
import type { BreadcrumbItemData } from './AppHeader';

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
  /** 面包屑路径 */
  breadcrumbs?: BreadcrumbItemData[];
};

export function ReportExperienceLayout({
  children,
  pageTitle,
  pageDescription,
  showPageHeading = true,
  headerExtra,
  contentClassName,
  breadcrumbs,
}: ReportExperienceLayoutProps) {
  return (
    <main className="relative flex min-h-screen flex-col">
      <PageBackground />

      <AppHeader right={headerExtra} breadcrumbs={breadcrumbs} />

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
