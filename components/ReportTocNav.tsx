'use client';

import { cn } from '@/lib/utils';
import type { TocItem } from '@/lib/reportToc';

type ReportTocNavProps = {
  items: TocItem[];
  className?: string;
};

/** 左侧目录：h2 主级，h3 缩进；小屏用折叠目录 */
export function ReportTocNav({ items, className }: ReportTocNavProps) {
  if (items.length === 0) return null;

  const navList = (
    <ul className="space-y-1 border-l border-border/80 pl-3 text-sm">
      {items.map((item) => (
        <li
          key={item.id}
          className={cn(item.depth === 3 && 'ml-2 border-l border-transparent pl-2')}
        >
          <a
            href={`#${item.id}`}
            className={cn(
              'block rounded-md py-1.5 pr-2 text-left text-muted-foreground transition-colors',
              'hover:bg-muted/60 hover:text-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              item.depth === 2 && 'font-medium',
              item.depth === 3 && 'text-[0.8125rem] text-muted-foreground/90',
            )}
          >
            <span className="line-clamp-2">{item.text}</span>
          </a>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <aside
        className={cn(
          'hidden w-52 shrink-0 lg:block',
          'sticky top-24 max-h-[min(100vh-8rem,720px)] self-start overflow-y-auto overscroll-contain',
          className,
        )}
        aria-label="本页目录"
      >
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          本页目录
        </p>
        {navList}
      </aside>

      <div className="mb-6 rounded-xl border border-border/80 bg-card/50 p-3 lg:hidden">
        <details className="group">
          <summary className="cursor-pointer list-none text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
            <span className="flex items-center justify-between gap-2">
              查看目录
              <span className="text-xs text-muted-foreground group-open:rotate-180">▼</span>
            </span>
          </summary>
          <div className="mt-3 border-t border-border/60 pt-3">{navList}</div>
        </details>
      </div>
    </>
  );
}
