export type TocItem = {
  id: string;
  text: string;
  depth: 1 | 2 | 3;
};

/**
 * 从报告 Markdown 提取 h1–h3 标题，生成稳定 id（与渲染时顺序一致）。
 * 跳过代码块内的 # 行。
 */
export function extractReportToc(markdown: string): TocItem[] {
  const lines = markdown.split('\n');
  const out: TocItem[] = [];
  let inFence = false;
  let n = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('```')) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const m = line.match(/^(#{1,3})\s+(.+)$/);
    if (!m) continue;

    const depth = m[1].length as 1 | 2 | 3;
    const text = m[2].trim().replace(/\s+#+$/, '');
    out.push({
      id: `report-heading-${n++}`,
      text,
      depth,
    });
  }

  return out;
}
