/**
 * Mock 面试题库
 *
 * 提供技术题、业务题和追问三类面试问题，
 * MockWebSocketClient 按顺序循环取题。
 */

export interface MockQuestion {
  content: string;
  questionType: string;
}

export const TECHNICAL_QUESTIONS: MockQuestion[] = [
  { content: '请详细解释 React 的虚拟 DOM 机制及其工作原理。', questionType: '技术基础' },
  { content: '在处理大型前端应用时，你如何进行性能优化？请结合实际项目说明。', questionType: '技术基础' },
  { content: '请解释 JavaScript 的事件循环机制，并说明宏任务和微任务的区别。', questionType: '技术基础' },
  { content: '你如何设计和实现前端的状态管理？请比较不同方案的优劣。', questionType: '技术基础' },
  { content: '请解释 TypeScript 中泛型的使用场景，并举例说明。', questionType: '技术基础' },
  { content: '在前后端分离架构中，你如何处理跨域问题？', questionType: '技术基础' },
  { content: '请解释 React Hooks 的工作原理，以及使用时需要注意的规则。', questionType: '技术基础' },
  { content: '如何实现一个高性能的虚拟滚动列表？请描述你的思路。', questionType: '技术基础' },
  { content: '请解释 Webpack 或 Vite 的构建流程，以及 Tree Shaking 的原理。', questionType: '技术基础' },
  { content: '你如何保证前端代码的质量？请描述你的测试策略。', questionType: '技术基础' },
  { content: '请解释浏览器渲染机制，从输入 URL 到页面展示的完整流程。', questionType: '技术基础' },
  { content: '你如何实现前端国际化（i18n）？请描述技术方案。', questionType: '技术基础' },
  { content: '请解释 WebSocket 的工作原理，以及与 HTTP 长轮询的区别。', questionType: '技术基础' },
  { content: '如何设计和实现一个可复用的组件库？请描述你的思路。', questionType: '技术基础' },
  { content: '请解释 CSS 盒模型、BFC 以及常见布局方案的实现原理。', questionType: '技术基础' },
];

export const BUSINESS_QUESTIONS: MockQuestion[] = [
  { content: '请描述一次你在团队中解决过的最具挑战性的问题。', questionType: '业务理解' },
  { content: '你如何与产品经理、设计师和后端工程师协作完成一个需求？', questionType: '业务理解' },
  { content: '请描述你对敏捷开发流程的理解和实践经验。', questionType: '业务理解' },
  { content: '当项目中出现技术方案分歧时，你通常如何处理？', questionType: '业务理解' },
  { content: '请描述一次你在紧迫的截止日期下完成任务的经历。', questionType: '业务理解' },
  { content: '你如何平衡代码质量与项目进度的关系？', questionType: '业务理解' },
  { content: '请描述你在代码审查中的关注点和最佳实践。', questionType: '业务理解' },
  { content: '你如何持续学习新技术并应用到实际工作中？', questionType: '业务理解' },
  { content: '请描述你对前端工程化的理解和实践经验。', questionType: '业务理解' },
  { content: '面对线上故障，你的排查思路和处理流程是什么？', questionType: '业务理解' },
];

export const FOLLOW_UP_QUESTIONS: MockQuestion[] = [
  { content: '你能否举一个具体的例子来进一步说明？', questionType: '追问' },
  { content: '这个方案在实际项目中遇到过什么问题？你是如何解决的？', questionType: '追问' },
  { content: '如果让你重新来过，你会做哪些不同的选择？', questionType: '追问' },
  { content: '你觉得这个技术方案有哪些局限性？', questionType: '追问' },
  { content: '你从这个经验中学到了什么？对以后的工作有什么启发？', questionType: '追问' },
];

/**
 * 按照配置的题数生成完整的面试问题序列。
 *
 * 顺序：先技术题，再业务题，追问随机插入到任意题目之后。
 */
export function generateQuestionSequence(
  maxTechnical: number,
  maxBusiness: number,
  maxFollowUps: number,
): MockQuestion[] {
  const questions: MockQuestion[] = [];

  // 取技术题
  for (let i = 0; i < maxTechnical; i++) {
    questions.push(TECHNICAL_QUESTIONS[i % TECHNICAL_QUESTIONS.length]);
  }

  // 取业务题
  for (let i = 0; i < maxBusiness; i++) {
    questions.push(BUSINESS_QUESTIONS[i % BUSINESS_QUESTIONS.length]);
  }

  // 追问插入：随机选择位置插入
  const followUpIndices: number[] = [];
  for (let i = 0; i < Math.min(maxFollowUps, questions.length); i++) {
    // 在 1 ~ questions.length - 1 之间随机选位置（不插在最前面）
    let idx: number;
    do {
      idx = Math.floor(Math.random() * questions.length) + 1;
    } while (followUpIndices.includes(idx));
    followUpIndices.push(idx);
  }

  // 从后往前插入，避免索引偏移
  followUpIndices.sort((a, b) => b - a);
  for (const idx of followUpIndices) {
    const followUpIdx = followUpIndices.indexOf(idx);
    questions.splice(idx, 0, FOLLOW_UP_QUESTIONS[followUpIdx % FOLLOW_UP_QUESTIONS.length]);
  }

  return questions;
}
