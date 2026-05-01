'use client';

import React from 'react';
import Link from 'next/link';
import ThemeToggle from './ThemeToggle';
import { Sparkles } from 'lucide-react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from './ui/breadcrumb';

export interface BreadcrumbItemData {
  label: string;
  href?: string; // 无 href 表示当前页
}

type AppHeaderProps = {
  /** 右侧操作区（链接、按钮等），与 ThemeToggle 并排显示 */
  right?: React.ReactNode;
  /** 面包屑路径 */
  breadcrumbs?: BreadcrumbItemData[];
};

export default function AppHeader({ right, breadcrumbs }: AppHeaderProps) {
  return (
    <header className="relative z-10 flex w-full items-center justify-between px-6 py-4">
      <div className="flex items-center gap-4">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-xl outline-none ring-offset-background transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Sparkles className="size-5 text-primary" />
          </div>
          <span className="text-sm font-semibold text-foreground">AI 模拟面试</span>
        </Link>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <Breadcrumb>
            <BreadcrumbList>
              {breadcrumbs.map((item, index) => {
                const isLast = index === breadcrumbs.length - 1;
                return (
                  <React.Fragment key={index}>
                    {index > 0 && <BreadcrumbSeparator />}
                    <BreadcrumbItem>
                      {isLast || !item.href ? (
                        <BreadcrumbPage>{item.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink asChild>
                          <Link href={item.href}>{item.label}</Link>
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </React.Fragment>
                );
              })}
            </BreadcrumbList>
          </Breadcrumb>
        )}
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        {right}
        <ThemeToggle />
      </div>
    </header>
  );
}
