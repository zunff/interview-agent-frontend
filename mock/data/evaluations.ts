/**
 * Mock 评估结果生成器
 *
 * 根据面试问题生成逼真的 EvaluationResult 对象。
 */

import type { EvaluationResult } from '../../types/index';

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

const STRENGTHS_POOL = [
  '回答准确，概念理解清晰',
  '逻辑思维能力强，推理过程严谨',
  '表达流畅，语言组织能力好',
  '能结合实际项目经验进行说明',
  '对技术原理有深入理解',
  '回答结构清晰，层次分明',
  '自信从容，态度积极',
  '善于举例说明，易于理解',
  '知识面广，融会贯通',
  '问题分析全面，考虑周到',
];

const WEAKNESSES_POOL = [
  '部分细节描述不够深入',
  '回答时略显紧张，语速偏快',
  '某些概念的理解可以更加精准',
  '实际项目案例可以更具体',
  '对边缘情况考虑不够充分',
  '回答可以更加结构化',
  '偶尔跑题，需要注意聚焦',
  '对新技术趋势了解不够',
  '表达中存在一些口语化表述',
  '缺乏对性能影响的量化分析',
];

const ANSWER_TEMPLATES = [
  '面试者对这个问题进行了较为全面的回答，先从基本概念入手，然后结合实际经验展开说明。整体来看回答思路清晰，但在某些细节上可以更加深入。',
  '面试者从多个角度分析了这个问题，展示了较好的技术视野。回答中提到了实际项目中的解决方案，但理论层面的阐述可以更系统。',
  '面试者的回答切中要害，先给出了明确的结论，再逐步展开论证。在举例说明方面做得不错，但对一些高级用法涉及较少。',
  '面试者展示了对这个领域的基本理解，回答逻辑清晰。建议在回答中更多地体现深度思考和个人见解。',
  '面试者从原理到实践进行了完整的阐述，体现了扎实的技术功底。表达过程中思路连贯，但在个别概念的表述上可以更加精确。',
];

/**
 * 为一道面试题生成模拟评估结果。
 */
export function generateEvaluation(
  questionIndex: number,
  question: string,
): EvaluationResult {
  const accuracy = randInt(65, 95);
  const logic = randInt(65, 95);
  const fluency = randInt(70, 95);
  const confidence = randInt(60, 90);
  const emotionScore = randInt(65, 90);
  const bodyLanguageScore = randInt(65, 90);
  const voiceToneScore = randInt(65, 90);

  const overallScore = Math.round(
    accuracy * 0.2 +
    logic * 0.2 +
    fluency * 0.15 +
    confidence * 0.15 +
    emotionScore * 0.1 +
    bodyLanguageScore * 0.1 +
    voiceToneScore * 0.1,
  );

  const strengthCount = randInt(2, 3);
  const weaknessCount = randInt(1, 2);

  return {
    questionIndex,
    question,
    answer: pickRandom(ANSWER_TEMPLATES),
    accuracy,
    logic,
    fluency,
    confidence,
    emotionScore,
    bodyLanguageScore,
    voiceToneScore,
    overallScore,
    strengths: pickN(STRENGTHS_POOL, strengthCount),
    weaknesses: pickN(WEAKNESSES_POOL, weaknessCount),
    detailedEvaluation: generateDetailedEvaluation(overallScore),
    needFollowUp: Math.random() < 0.3,
    followUpSuggestion: '',
  };
}

function generateDetailedEvaluation(overallScore: number): string {
  if (overallScore >= 85) {
    return '整体表现优秀。面试者展现了扎实的技术功底和良好的沟通能力，回答逻辑清晰，能够准确把握问题的核心要点。建议继续保持，同时在某些细节上可以追求更深入的探讨。';
  }
  if (overallScore >= 70) {
    return '整体表现良好。面试者对问题有基本的理解，回答思路较为清晰。建议在技术深度和实际项目经验的结合上进一步加强，同时注意表达的条理性。';
  }
  return '整体表现一般。面试者对问题有一定的了解，但在深度和准确性方面还有提升空间。建议加强基础知识的学习，多进行模拟面试练习，提升表达能力和技术视野。';
}
