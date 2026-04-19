import { toString } from 'mdast-util-to-string';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';

export type TocItem = {
  id: string;
  key: string;
  text: string;
  depth: 1 | 2 | 3 | 4;
  offset: number;
};

/**
 * 将标题文本规整为可比较 key，避免大小写和多空格导致的匹配抖动。
 */
export function normalizeHeadingText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * 标题 key：同层级 + 规整文本。
 */
export function buildHeadingKey(depth: 1 | 2 | 3 | 4, text: string): string {
  return `${depth}:${normalizeHeadingText(text)}`;
}

/**
 * 生成标题 id（保留 report-heading- 前缀，兼容现有 hash 判断）。
 */
export function makeHeadingId(depth: 1 | 2 | 3 | 4, text: string, index: number): string {
  const normalized = normalizeHeadingText(text);
  const slug = normalized
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
  const safeSlug = slug || `depth-${depth}`;
  return `report-heading-${depth}-${safeSlug}-${index}`;
}

/**
 * 从报告 Markdown AST 提取 h1–h4 标题，生成稳定 id（与渲染一致）。
 */
export function extractReportToc(markdown: string): TocItem[] {
  const out: TocItem[] = [];
  const keyCounter = new Map<string, number>();
  const tree = unified().use(remarkParse).use(remarkGfm).parse(markdown);

  visit(tree, 'heading', (node) => {
    const depth = node.depth as 1 | 2 | 3 | 4 | 5 | 6;
    if (depth < 1 || depth > 4) return;
    const headingDepth = depth as 1 | 2 | 3 | 4;
    const text = toString(node).trim();
    if (!text) return;
    const key = buildHeadingKey(headingDepth, text);
    const n = keyCounter.get(key) ?? 0;
    keyCounter.set(key, n + 1);
    out.push({
      id: makeHeadingId(headingDepth, text, n),
      key,
      text,
      depth: headingDepth,
      offset: node.position?.start?.offset ?? -1,
    });
  });

  return out;
}
