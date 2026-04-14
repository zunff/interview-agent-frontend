/**
 * Mock 面试报告生成器
 *
 * 根据评估结果生成 Markdown 格式的面试报告。
 */

import type { EvaluationResult } from '../../types/index';

/**
 * 根据评估结果数组生成完整的面试报告（Markdown 格式）。
 */
export function generateMockReport(
  sessionId: string,
  evaluations: EvaluationResult[],
): string {
  const avgScore = Math.round(
    evaluations.reduce((sum, e) => sum + e.overallScore, 0) / evaluations.length,
  );

  const technicalEvals = evaluations.filter((_, i) => {
    const question = evaluations[i];
    return question.questionIndex <= evaluations.length;
  });

  const scoreLevel = getScoreLevel(avgScore);

  const now = new Date();
  const dateStr = now.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const questionSections = evaluations
    .map((e, i) => {
      return `### 问题 ${i + 1}${e.question ? '：' + e.question.substring(0, 40) + '...' : ''}

| 维度 | 得分 |
|------|------|
| 准确性 | ${e.accuracy}/100 |
| 逻辑性 | ${e.logic}/100 |
| 流畅度 | ${e.fluency}/100 |
| 自信度 | ${e.confidence}/100 |
| 综合得分 | **${e.overallScore}/100** |

${e.strengths.length > 0 ? '**亮点：**\n' + e.strengths.map(s => `- ${s}`).join('\n') : ''}

${e.weaknesses.length > 0 ? '**改进建议：**\n' + e.weaknesses.map(w => `- ${w}`).join('\n') : ''}

${e.detailedEvaluation}`;
    })
    .join('\n\n---\n\n');

  const allStrengths = evaluations.flatMap((e) => e.strengths);
  const allWeaknesses = evaluations.flatMap((e) => e.weaknesses);
  const uniqueStrengths = [...new Set(allStrengths)].slice(0, 5);
  const uniqueWeaknesses = [...new Set(allWeaknesses)].slice(0, 4);

  return `# 面试评估报告

## 基本信息

| 项目 | 详情 |
|------|------|
| 会话 ID | ${sessionId} |
| 面试时间 | ${dateStr} |
| 问题数量 | ${evaluations.length} |
| 综合评分 | **${avgScore}/100** (${scoreLevel}) |

---

## 综合评价

${generateOverallComment(avgScore, evaluations.length)}

### 总体维度得分

| 维度 | 平均分 |
|------|--------|
| 准确性 | ${avgDimension(evaluations, 'accuracy')}/100 |
| 逻辑性 | ${avgDimension(evaluations, 'logic')}/100 |
| 流畅度 | ${avgDimension(evaluations, 'fluency')}/100 |
| 自信度 | ${avgDimension(evaluations, 'confidence')}/100 |
| 情绪表现 | ${avgDimension(evaluations, 'emotionScore')}/100 |
| 肢体语言 | ${avgDimension(evaluations, 'bodyLanguageScore')}/100 |
| 语音语调 | ${avgDimension(evaluations, 'voiceToneScore')}/100 |

---

## 核心优势

${uniqueStrengths.map((s) => `- ${s}`).join('\n')}

## 改进建议

${uniqueWeaknesses.map((w) => `- ${w}`).join('\n')}

---

## 逐题详情

${questionSections}

---

*本报告由 AI 面试系统自动生成，仅供参考。*
`;
}

function avgDimension(evaluations: EvaluationResult[], key: keyof EvaluationResult): number {
  const values = evaluations.map((e) => e[key] as number);
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

function getScoreLevel(score: number): string {
  if (score >= 90) return '优秀';
  if (score >= 80) return '良好';
  if (score >= 70) return '中等';
  if (score >= 60) return '及格';
  return '需提升';
}

function generateOverallComment(avgScore: number, questionCount: number): string {
  if (avgScore >= 85) {
    return `候选人在本次面试中共回答了 ${questionCount} 道问题，整体表现优秀。在技术理解、逻辑思维和表达能力方面均展现了较高水准，回答准确且条理清晰。建议继续保持，并关注细节深度的提升。`;
  }
  if (avgScore >= 70) {
    return `候选人在本次面试中共回答了 ${questionCount} 道问题，整体表现良好。具备扎实的基础知识和一定的项目经验，但在部分技术细节和深度思考方面还有提升空间。建议加强系统性学习，提升综合技术实力。`;
  }
  return `候选人在本次面试中共回答了 ${questionCount} 道问题，整体表现中等。具备基本的技术理解能力，但在知识深度、逻辑表达和综合应用方面需要进一步加强。建议制定系统的学习计划，多进行项目实践和模拟面试。`;
}
