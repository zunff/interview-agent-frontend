/**
 * WebSocket 客户端工厂
 *
 * 根据 NEXT_PUBLIC_MOCK_MODE 环境变量决定返回真实客户端还是 Mock 客户端。
 * 这是 Mock 模式与生产代码的唯一集成点。
 */

import { WebSocketClient } from './api';
import { MockWebSocketClient } from './mockWebSocketClient';

export type WebSocketClientLike = WebSocketClient | MockWebSocketClient;

export function createWebSocketClient(): WebSocketClientLike {
  if (process.env.NEXT_PUBLIC_MOCK_MODE === 'true') {
    console.log('[Mock] 使用 MockWebSocketClient');
    return new MockWebSocketClient();
  }
  return new WebSocketClient();
}

/**
 * Mock 模式检测
 */
export function isMockMode(): boolean {
  return process.env.NEXT_PUBLIC_MOCK_MODE === 'true';
}
