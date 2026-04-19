/**
 * 将「> **xxx**」形式的连续引用行之间插入空行，使解析为多个 <p>，
 * 避免无空行时合并成一段而在页面上挤成一行。
 * 仅在两行均以 `> **` 开头时插入，避免打断普通多行引用段落。
 */
export function normalizeBlockquoteKpiParagraphs(markdown: string): string {
  const lines = markdown.split('\n');
  const out: string[] = [];
  let inFence = false;

  const isKpiQuoteLine = (l: string) => /^\s*>\s*\*\*/.test(l);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      inFence = !inFence;
      out.push(line);
      continue;
    }
    if (inFence) {
      out.push(line);
      continue;
    }

    const prev = out[out.length - 1];
    const prevBlank = prev === undefined || /^\s*$/.test(prev);
    if (
      prev !== undefined &&
      !prevBlank &&
      isKpiQuoteLine(line) &&
      isKpiQuoteLine(prev)
    ) {
      out.push('');
    }

    out.push(line);
  }

  return out.join('\n');
}

/**
 * 将「**追问：**」区块内顶层的 `- ` 无序列表转为 `1. 2. 3.` 有序列表语法，
 * 便于阅读；嵌套行（以空白开头的 `-`）保持不变。
 */
export function normalizeFollowUpNumberedLists(markdown: string): string {
  const lines = markdown.split('\n');
  let inFollowUp = false;
  let n = 0;
  const out: string[] = [];

  for (const line of lines) {
    const trimmed = line.trimEnd();

    if (trimmed === '**追问：**') {
      inFollowUp = true;
      n = 0;
      out.push(line);
      continue;
    }

    if (inFollowUp) {
      if (
        trimmed.startsWith('---') ||
        trimmed.startsWith('### ') ||
        trimmed.startsWith('#### ')
      ) {
        inFollowUp = false;
        n = 0;
        out.push(line);
        continue;
      }

      const isIndentedListLine = /^\s+-\s+/.test(line);
      const isTopLevelBullet = /^-\s+/.test(line) && !isIndentedListLine;

      // CommonMark 要求子列表相对父级有足够缩进（通常 ≥3 空格），后端常给 1～2 空格，
      // 解析后与 ol 平级导致样式选择器 ol > li > ul 不命中；统一为 4 空格嵌套。
      if (isIndentedListLine) {
        const content = line.trimStart();
        out.push(`    ${content}`);
        continue;
      }

      if (isTopLevelBullet) {
        n += 1;
        out.push(line.replace(/^-\s+/, `${n}. `));
        continue;
      }
    }

    out.push(line);
  }

  return out.join('\n');
}

/**
 * 后端常把「1. … 2. … 3. …」写在同一行且无换行。
 * 在数字序号前插入换行，便于渲染为多行或列表。
 * 代码块内不处理。
 */
export function breakInlineNumberedListItems(markdown: string): string {
  const parts = markdown.split(/(```[\s\S]*?```)/g);
  return parts
    .map((part) => {
      if (part.startsWith('```')) return part;
      return part.split('\n').map(line => {
        const indentMatch = line.match(/^(\s*)/);
        const indent = indentMatch ? indentMatch[1] : '';
        
        let baseIndent = indent;
        const ulMatch = line.match(/^(\s*[-*+]\s+)/);
        if (ulMatch) {
          baseIndent = ' '.repeat(ulMatch[1].length);
        }
        
        return line.replace(/([^\n])(\s*)(\d{1,3}\.\s)/g, (match, before: string, spaces: string, numDot: string) => {
          // 若数字前无空格，则必须紧跟标点符号才换行（避免误伤普通文本，如"变量名1. "）
          if (!spaces && !/[：:；;。.,，）)\]}”">]/.test(before)) return match;
          
          if (/\d$/.test(before)) return match;
          const n = parseInt(numDot, 10);
          if (Number.isNaN(n) || n < 1) return match;
          
          // 插入换行，并使用计算好的 baseIndent 对齐，丢弃原来的 spaces
          return `${before}\n${baseIndent}${numDot}`;
        });
      }).join('\n');
    })
    .join('');
}

/** 报告 Markdown 展示前统一预处理（顺序：引用分段 → 追问编号 → 行内序号换行） */
export function normalizeReportMarkdown(markdown: string): string {
  return breakInlineNumberedListItems(
    normalizeFollowUpNumberedLists(normalizeBlockquoteKpiParagraphs(markdown)),
  );
}
