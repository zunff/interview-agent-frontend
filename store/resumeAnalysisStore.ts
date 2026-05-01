import { create } from 'zustand';

export type ProgressStatus = 'running' | 'completed' | 'failed';

export type AnalysisPhase =
  | 'idle'
  | 'uploading'
  | 'analyzing'
  | 'report_ready'
  | 'chatting'
  | 'error';

export interface DimensionScore {
  key: string;
  name: string;
  score: number;
  comment: string;
}

export interface RadarChartData {
  dimensions: DimensionScore[];
  overallScore: number;
  overallLevel: 'JUNIOR' | 'MID' | 'SENIOR' | 'EXPERT';
}

export interface ThinkingStep {
  tool?: string;
  state: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  thinking?: {
    steps: ThinkingStep[];
    summary?: string;
  };
}

export interface ToolInfo {
  name: string;
  arguments?: string;
}

export interface ProgressNode {
  node: string;
  status: ProgressStatus;
}

interface ResumeAnalysisState {
  sessionId: string | null;
  phase: AnalysisPhase;
  progressNodes: ProgressNode[];
  dimensionScores: DimensionScore[];
  radarChartData: RadarChartData | null;
  report: string | null;
  messages: ChatMessage[];
  currentStreamText: string;
  isThinking: boolean;
  error: string | null;

  setSessionId: (id: string) => void;
  setPhase: (phase: AnalysisPhase) => void;
  updateProgress: (node: string, status: ProgressStatus) => void;
  addDimensionScore: (score: DimensionScore) => void;
  setRadarChartData: (data: RadarChartData) => void;
  setReport: (markdown: string) => void;
  addUserMessage: (content: string) => void;
  startAssistantMessage: (withThinking?: boolean) => void;
  addThinkingStep: (step: ThinkingStep) => void;
  setThinkingSummary: (summary: string) => void;
  appendStreamText: (chunk: string) => void;
  finalizeStreamText: () => void;
  setError: (error: string | null) => void;
  setMessages: (messages: ChatMessage[]) => void;
  reset: () => void;
}

const initialState = {
  sessionId: null,
  phase: 'idle' as AnalysisPhase,
  progressNodes: [],
  dimensionScores: [],
  radarChartData: null,
  report: null,
  messages: [],
  currentStreamText: '',
  isThinking: false,
  error: null,
};

export const useResumeAnalysisStore = create<ResumeAnalysisState>((set) => ({
  ...initialState,

  setSessionId: (sessionId) => set({ sessionId }),
  setPhase: (phase) => set({ phase }),

  updateProgress: (node, status) =>
    set((state) => {
      const existing = state.progressNodes.findIndex((n) => n.node === node);
      const nodes = [...state.progressNodes];
      if (existing >= 0) {
        nodes[existing] = { node, status };
      } else {
        nodes.push({ node, status });
      }
      return { progressNodes: nodes };
    }),

  addDimensionScore: (score) =>
    set((state) => {
      const existing = state.dimensionScores.findIndex((s) => s.key === score.key);
      const scores = [...state.dimensionScores];
      if (existing >= 0) {
        scores[existing] = score;
      } else {
        scores.push(score);
      }
      return { dimensionScores: scores };
    }),

  setRadarChartData: (radarChartData) => set({ radarChartData }),
  setReport: (report) => set({ report }),

  addUserMessage: (content) =>
    set((state) => ({
      messages: [
        ...state.messages,
        { id: `user-${Date.now()}`, role: 'user' as const, content },
      ],
    })),

  startAssistantMessage: (withThinking = false) =>
    set((state) => ({
      currentStreamText: '',
      isThinking: withThinking,
      messages: [
        ...state.messages,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant' as const,
          content: '',
          ...(withThinking ? { thinking: { steps: [] as ThinkingStep[] } } : {}),
        },
      ],
    })),

  addThinkingStep: (step) =>
    set((state) => {
      const messages = [...state.messages];
      const last = messages[messages.length - 1];
      if (last?.role === 'assistant' && last.thinking) {
        messages[messages.length - 1] = {
          ...last,
          thinking: {
            ...last.thinking,
            steps: [...last.thinking.steps, step],
          },
        };
      }
      return { messages };
    }),

  setThinkingSummary: (summary) =>
    set((state) => {
      const messages = [...state.messages];
      const last = messages[messages.length - 1];
      if (last?.role === 'assistant') {
        messages[messages.length - 1] = {
          ...last,
          thinking: last.thinking
            ? { ...last.thinking, summary }
            : { steps: [], summary },
        };
      }
      return { messages, isThinking: false };
    }),

  appendStreamText: (chunk) =>
    set((state) => {
      const updated = state.currentStreamText + chunk;
      const messages = [...state.messages];
      const last = messages[messages.length - 1];
      if (last?.role === 'assistant') {
        messages[messages.length - 1] = { ...last, content: updated };
      }
      return { currentStreamText: updated, messages };
    }),

  finalizeStreamText: () => set({ currentStreamText: '', isThinking: false }),

  setError: (error) => set({ error, phase: error ? 'error' : 'idle' }),

  setMessages: (messages) => set({ messages }),

  reset: () => set({ ...initialState }),
}));

if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).__RESUME_ANALYSIS_STORE__ = useResumeAnalysisStore;
}
