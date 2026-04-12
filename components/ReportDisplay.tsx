import { useInterviewStore } from '../store/interviewStore';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Loader2 } from 'lucide-react';

const ReportDisplay = () => {
  const { report } = useInterviewStore();

  if (!report) {
    return (
      <div className="rounded-2xl bg-card border border-border p-10 text-center">
        <div className="inline-flex items-center gap-2 text-muted-foreground">
          <Loader2 className="animate-spin size-5" />
          <span>面试报告生成中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-card border border-border p-8 shadow-sm animate-fade-in">
      <div className="prose prose-lg max-w-none
        prose-headings:font-sans
        prose-h1:text-3xl prose-h1:text-foreground prose-h1:font-bold prose-h1:border-b prose-h1:border-border prose-h1:pb-4 prose-h1:mb-6
        prose-h2:text-2xl prose-h2:text-foreground prose-h2:font-semibold prose-h2:mt-10 prose-h2:mb-4
        prose-h3:text-xl prose-h3:text-foreground prose-h3:font-medium prose-h3:mt-8 prose-h3:mb-3
        prose-p:text-muted-foreground prose-p:leading-relaxed prose-p:mb-4
        prose-li:text-muted-foreground prose-li:mb-1.5
        prose-strong:text-foreground prose-strong:font-semibold
        prose-code:text-primary prose-code:bg-primary/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-lg prose-code:font-mono prose-code:text-sm
        prose-table:border-collapse prose-table:my-6 prose-table:w-full prose-table:overflow-hidden prose-table:rounded-xl
        prose-th:bg-muted prose-th:text-foreground prose-th:font-semibold prose-th:px-4 prose-th:py-3 prose-th:border prose-th:border-border prose-th:text-left prose-th:text-sm
        prose-td:px-4 prose-td:py-3 prose-td:border prose-td:border-border prose-td:text-muted-foreground prose-td:text-sm
        prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:bg-muted/50 prose-blockquote:py-3 prose-blockquote:px-5 prose-blockquote:rounded-r-xl prose-blockquote:not-italic
        prose-a:text-primary prose-a:no-underline hover:prose-a:underline
        prose-hr:border-border
      ">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {report}
        </ReactMarkdown>
      </div>
    </div>
  );
};

export default ReportDisplay;
