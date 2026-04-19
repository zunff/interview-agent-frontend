'use client';

import { cn } from '@/lib/utils';
import type { TocItem } from '@/lib/reportToc';
import { scrollToReportHeading } from '@/lib/scrollToReportHeading';

type ReportTocNavProps = {
  items: TocItem[];
  className?: string;
};

/** 左侧目录：展示题目（h4）；小屏折叠；点击用统一偏移滚动，避免顶栏遮挡与哈希失效 */
export function ReportTocNav({ items, className }: ReportTocNavProps) {
  if (items.length === 0) return null;

  const navList = (
    <ul className="space-y-1 border-l border-border/80 pl-3 text-sm">
      {items.map((item) => (
        <li key={item.id}>
          <a
            href={`#${item.id}`}
            className={cn(
              'block rounded-md py-1.5 pr-2 text-left text-[0.8125rem] leading-snug text-muted-foreground transition-colors',
              'hover:bg-muted/60 hover:text-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
            onClick={(e) => {
              e.preventDefault();
              if (!item.id) {
                // eslint-disable-next-line no-console
                console.warn('[report-toc] skip click: empty item id', { text: item.text });
                return;
              }
              scrollToReportHeading(item.id);
            }}
          >
            <span className="line-clamp-3">{item.text}</span>
          </a>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <aside
        className={cn(
          'hidden w-64 shrink-0 lg:block',
          'sticky top-24 max-h-[min(100vh-8rem,720px)] self-start overflow-y-auto overscroll-contain',
          className,
        )}
        aria-label="本页目录"
      >
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          题目目录
        </p>
        {navList}
      </aside>

      <div className="mb-6 rounded-xl border border-border/80 bg-card/50 p-3 lg:hidden">
        <details className="group">
          <summary className="cursor-pointer list-none text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
            <span className="flex items-center justify-between gap-2">
              查看题目目录
              <span className="text-xs text-muted-foreground group-open:rotate-180">▼</span>
            </span>
          </summary>
          <div className="mt-3 border-t border-border/60 pt-3">{navList}</div>
        </details>
      </div>
    </>
  );
}
