/**
 * 将视口滚动到报告标题，偏移量与 CSS 变量 --report-anchor-offset 一致（避开固定顶栏）。
 */
const warnedMissingIds = new Set<string>();

export function scrollToReportHeading(id: string): void {
  if (!id) {
    // eslint-disable-next-line no-console
    console.warn('[report-toc] skip scroll: empty heading id');
    return;
  }
  if (typeof document === 'undefined') return;
  const decodedId = (() => {
    try {
      return decodeURIComponent(id);
    } catch {
      return id;
    }
  })();
  const el = document.getElementById(id) ?? document.getElementById(decodedId);
  if (!el) {
    const warnKey = decodedId || id;
    if (!warnedMissingIds.has(warnKey)) {
      warnedMissingIds.add(warnKey);
      // eslint-disable-next-line no-console
      console.warn(`[report-toc] heading not found for id: ${id}`);
    }
    return;
  }

  const raw =
    getComputedStyle(document.documentElement).getPropertyValue('--report-anchor-offset').trim() ||
    '6.75rem';
  let offsetPx = 108;
  const m = raw.match(/^([\d.]+)(rem|px)$/);
  if (m) {
    offsetPx = Number.parseFloat(m[1]) * (m[2] === 'rem' ? 16 : 1);
  }

  const top = el.getBoundingClientRect().top + window.scrollY - offsetPx;
  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });

  try {
    history.replaceState(null, '', `#${id}`);
  } catch {
    /* ignore */
  }
}
