import { parseSSEStream, type SSEEvent, type SSEEventHandler } from './sseParser';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';

export interface CreateSessionResponse {
  sessionId: string;
  status: string;
}

export interface AnalysisResult {
  hasAnalysis: boolean;
  analysisId: string;
  radarChartData: string;
  reportMarkdown: string;
}

export interface SessionListItem {
  sessionId: string;
  hasResume: boolean;
  status: string;
  createTime: string;
}

export interface SessionListResult {
  records: SessionListItem[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface ChatMessageItem {
  role: string;
  content: string;
}

export interface SessionInfo {
  sessionId: string;
  hasResume: boolean;
  status: string;
  messages: ChatMessageItem[];
}

export const resumeApi = {
  async createSession(): Promise<CreateSessionResponse> {
    const response = await fetch(
      `${API_BASE_URL}/api/chat/sessions`,
      { method: 'POST' }
    );
    if (!response.ok) {
      throw new Error('创建会话失败');
    }
    const result = await response.json();
    return result.data;
  },

  async uploadResume(
    sessionId: string,
    file: File,
    onEvent: SSEEventHandler
  ): Promise<void> {
    const formData = new FormData();
    formData.append('file', file);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 300_000);

    const response = await fetch(
      `${API_BASE_URL}/api/chat/sessions/${sessionId}/upload`,
      {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error('上传简历失败');
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('无法获取响应流');
    }

    await parseSSEStream(reader, onEvent);
  },

  async getAnalysis(sessionId: string): Promise<AnalysisResult> {
    const response = await fetch(
      `${API_BASE_URL}/api/chat/sessions/${sessionId}/analysis`
    );
    if (!response.ok) {
      throw new Error('获取分析结果失败');
    }
    const result = await response.json();
    return result.data;
  },

  async sendMessage(
    sessionId: string,
    message: string,
    onEvent: SSEEventHandler
  ): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 300_000);

    const response = await fetch(
      `${API_BASE_URL}/api/chat/sessions/${sessionId}/message`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error('发送消息失败');
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('无法获取响应流');
    }

    await parseSSEStream(reader, onEvent);
  },

  async getSessionList(params: { page?: number; size?: number } = {}): Promise<SessionListResult> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', String(params.page));
    if (params.size) searchParams.set('size', String(params.size));

    const response = await fetch(
      `${API_BASE_URL}/api/chat/sessions?${searchParams}`
    );
    if (!response.ok) {
      throw new Error('获取会话列表失败');
    }
    const result = await response.json();
    return result.data;
  },

  async getSessionInfo(sessionId: string): Promise<SessionInfo> {
    const response = await fetch(
      `${API_BASE_URL}/api/chat/sessions/${sessionId}`
    );
    if (!response.ok) {
      throw new Error('获取会话信息失败');
    }
    const result = await response.json();
    return result.data;
  },
};
