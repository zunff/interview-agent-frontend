// Re-export WebSocket 客户端，供组件使用
export { WebSocketClient } from './websocket/WebSocketClient';
export { createWebSocketClient, isMockMode } from './createWebSocketClient';
export type { WebSocketClientLike } from './createWebSocketClient';

// API 基础 URL（使用相对路径，通过 Next.js 代理）
const API_BASE_URL = process.env.API_BASE_URL || '';

// REST API 调用函数
export const api = {
  async getReport(sessionId: string) {
    const response = await fetch(`${API_BASE_URL}/api/interview/report/${sessionId}`);

    if (!response.ok) {
      throw new Error('获取面试报告失败');
    }

    const result = await response.json();
    return result.data;
  },

  async getHistory(params: { page?: number; size?: number; keyword?: string } = {}) {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', String(params.page));
    if (params.size) searchParams.set('size', String(params.size));
    if (params.keyword) searchParams.set('keyword', params.keyword);

    const response = await fetch(`${API_BASE_URL}/api/interview/history?${searchParams}`);

    if (!response.ok) {
      throw new Error('获取面试历史失败');
    }

    const result = await response.json();
    return result.data;
  },
};
