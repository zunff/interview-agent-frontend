/**
 * Mock 面试报告：运行时从 /api/mock-report 拉取 docs/final_report.md（去敏示例），不嵌入源码。
 */

import type { EvaluationResult } from '../../types/index';

export async function generateMockReport(
  _sessionId: string,
  _evaluations: EvaluationResult[],
): Promise<string> {
  const res = await fetch('/api/mock-report');
  if (!res.ok) {
    throw new Error(`mock report unavailable: ${res.status}`);
  }
  return res.text();
}
