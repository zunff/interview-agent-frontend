import { useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { useInterviewStore } from '../store/interviewStore';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import { Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { normalizeReportMarkdown } from '../lib/normalizeReportMarkdown';
import type { TocItem } from '../lib/reportToc';
import { extractReportToc } from '../lib/reportToc';
import { Card, CardContent } from './ui/card';
import { ReportTocNav } from './ReportTocNav';

/** 不含 h1–h3（由 buildReportMarkdownComponents 注入 id） */
const reportMarkdownBodyComponents: Components = {
  h4: ({ children, ...props }) => (
    <h4 className="not-prose mt-8 mb-2 text-base font-semibold text-foreground" {...props}>
      {children}
    </h4>
  ),
  table: ({ children, ...props }) => (
    <div className="not-prose my-8 overflow-x-auto rounded-xl border border-border/90 bg-muted/25 shadow-sm ring-1 ring-black/[0.04] dark:bg-muted/15 dark:ring-white/[0.06]">
      <table
        className="w-full min-w-[min(100%,42rem)] border-collapse text-left text-sm"
        {...props}
      >
        {children}
      </table>
    </div>
  ),
  thead: ({ children, ...props }) => (
    <thead className="bg-muted/90 dark:bg-muted/40" {...props}>
      {children}
    </thead>
  ),
  tbody: ({ children, ...props }) => (
    <tbody className="divide-y divide-border/70" {...props}>
      {children}
    </tbody>
  ),
  tr: ({ children, ...props }) => (
    <tr className="transition-colors hover:bg-muted/50 dark:hover:bg-muted/25" {...props}>
      {children}
    </tr>
  ),
  th: ({ children, ...props }) => (
    <th
      className="whitespace-normal px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-foreground sm:px-5"
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td className="px-4 py-3 align-top text-muted-foreground sm:px-5" {...props}>
      {children}
    </td>
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote
      className={cn(
        'not-prose my-6 space-y-3 rounded-r-xl border-l-[3px] border-primary bg-gradient-to-r from-primary/[0.08] to-transparent py-4 pl-5 pr-4 text-[0.9375rem] not-italic leading-relaxed text-foreground/95 shadow-sm dark:from-primary/[0.12]',
        '[&_p]:!mb-0 [&_p]:text-[0.9375rem]',
      )}
      {...props}
    >
      {children}
    </blockquote>
  ),
  hr: () => (
    <div className="not-prose my-10 flex items-center gap-3" role="separator">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-border" />
      <div className="size-1.5 shrink-0 rounded-full bg-primary/40" />
      <div className="h-px flex-1 bg-gradient-to-l from-transparent via-border to-border" />
    </div>
  ),
  p: ({ children, ...props }) => (
    <p
      className="mb-8 text-[0.9375rem] leading-[1.85] text-muted-foreground last:mb-0"
      {...props}
    >
      {children}
    </p>
  ),
  strong: ({ children, ...props }) => (
    <strong className="font-semibold text-foreground" {...props}>
      {children}
    </strong>
  ),
  a: ({ children, ...props }) => (
    <a
      className="font-medium text-primary underline decoration-primary/30 underline-offset-2 transition-colors hover:decoration-primary"
      {...props}
    >
      {children}
    </a>
  ),
  pre: ({ children, ...props }) => (
    <pre
      className="not-prose my-6 overflow-x-auto rounded-xl border border-border bg-muted/40 p-4 text-sm leading-relaxed dark:bg-muted/25"
      {...props}
    >
      {children}
    </pre>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = Boolean(className?.includes('language-'));
    if (isBlock) {
      return (
        <code className={cn('font-mono text-sm text-foreground', className)} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code
        className="rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[0.85em] font-medium text-primary"
        {...props}
      >
        {children}
      </code>
    );
  },
  ol: ({ children, ...props }) => (
    <ol
      className="not-prose mt-4 mb-10 list-decimal space-y-2.5 pl-6 text-[0.9375rem] [list-style-position:outside] marker:font-semibold marker:text-primary sm:pl-7"
      {...props}
    >
      {children}
    </ol>
  ),
  ul: ({ children, ...props }) => (
    <ul
      className={cn(
        'not-prose my-3 list-disc space-y-2.5 pl-4 marker:text-muted-foreground',
        '[ol_li>&]:list-none [ol_li>&]:pl-0 [ol_li>&]:mt-4 [ol_li>&]:space-y-3',
      )}
      {...props}
    >
      {children}
    </ul>
  ),
  li: ({ children, ...props }) => (
    <li
      className={cn(
        'leading-relaxed text-muted-foreground [&>p]:mb-2 [&>p:last-child]:mb-0 [&_strong]:text-foreground',
        'relative [ol_ul>&]:rounded-xl [ol_ul>&]:border [ol_ul>&]:border-border/50 [ol_ul>&]:bg-muted/40 [ol_ul>&]:px-5 [ol_ul>&]:py-4 [ol_ul>&]:text-[0.9375rem] dark:[ol_ul>&]:bg-muted/20',
      )}
      {...props}
    >
      {children}
    </li>
  ),
};

function buildReportMarkdownComponents(
  toc: TocItem[],
  cursorRef: MutableRefObject<number>,
): Components {
  const take = (depth: 1 | 2 | 3): TocItem | undefined => {
    const i = cursorRef.current;
    if (i >= toc.length) return undefined;
    const item = toc[i];
    if (item.depth !== depth) return undefined;
    cursorRef.current += 1;
    return item;
  };

  return {
    ...reportMarkdownBodyComponents,
    h1: ({ children, ...props }) => {
      const item = take(1);
      return (
        <h1
          id={item?.id}
          className="not-prose mb-8 scroll-mt-28 text-balance border-b border-border pb-6 text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
          {...props}
        >
          {children}
        </h1>
      );
    },
    h2: ({ children, ...props }) => {
      const item = take(2);
      return (
        <h2
          id={item?.id}
          className="not-prose mt-12 mb-5 flex scroll-mt-28 items-start gap-3 text-xl font-semibold tracking-tight text-foreground first:mt-0 sm:text-2xl"
          {...props}
        >
          <span
            className="mt-1.5 inline-block h-6 w-1 shrink-0 rounded-full bg-primary"
            aria-hidden
          />
          <span className="min-w-0 flex-1 leading-snug">{children}</span>
        </h2>
      );
    },
    h3: ({ children, ...props }) => {
      const item = take(3);
      return (
        <h3
          id={item?.id}
          className="not-prose mt-10 mb-3 scroll-mt-28 text-balance text-lg font-semibold leading-snug text-foreground sm:text-xl"
          {...props}
        >
          {children}
        </h3>
      );
    },
  };
}

const ReportDisplay = () => {
  const { report } = useInterviewStore();
  const headingCursorRef = useRef(0);

  const reportMd = useMemo(
    () => (report ? normalizeReportMarkdown(report) : ''),
    [report],
  );

  const toc = useMemo(() => (reportMd ? extractReportToc(reportMd) : []), [reportMd]);

  const markdownComponents = useMemo(
    () => buildReportMarkdownComponents(toc, headingCursorRef),
    [toc],
  );

  if (!report) {
    return (
      <Card className="gap-0 border-dashed py-0 shadow-sm ring-border/60">
        <CardContent className="flex min-h-[220px] flex-col items-center justify-center gap-3 py-14">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">面试报告生成中…</p>
        </CardContent>
      </Card>
    );
  }

  headingCursorRef.current = 0;

  const tocNavItems = toc.filter((t) => t.depth >= 2);

  return (
    <div className="flex w-full flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
      <ReportTocNav items={tocNavItems} />
      <div className="min-w-0 flex-1">
        <Card
          className={cn(
            'gap-0 overflow-hidden rounded-2xl border-border/80 py-0 shadow-md',
            'ring-1 ring-foreground/[0.06] dark:ring-white/[0.08]',
          )}
        >
          <div
            className="pointer-events-none h-px w-full bg-gradient-to-r from-transparent via-primary/40 to-transparent"
            aria-hidden
          />
          <CardContent className="px-5 py-8 sm:px-9 sm:py-10">
            <article
              className={cn(
                'report-markdown prose prose-lg max-w-none',
                'prose-slate dark:prose-invert',
                'prose-headings:font-semibold prose-headings:text-foreground prose-headings:tracking-tight',
                'prose-li:my-2 prose-li:marker:text-primary',
                'prose-p:mb-0',
              )}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {reportMd}
              </ReactMarkdown>
            </article>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ReportDisplay;
