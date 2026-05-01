export type SSEEventType = 'progress' | 'dimension_score' | 'radar_chart' | 'thinking_start' | 'thinking_end' | 'tool_status' | 'message' | 'done' | 'error';

export interface SSEEvent {
  event: SSEEventType;
  data: unknown;
}

export type SSEEventHandler = (event: SSEEvent) => void;

export async function parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onEvent: SSEEventHandler,
): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = '';
  let currentEvent: SSEEventType | null = null;
  let dataLines: string[] = [];

  const dispatchEvent = () => {
    if (!currentEvent) return;
    const raw = dataLines.join('\n');
    try {
      const data = raw ? JSON.parse(raw) : raw;
      onEvent({ event: currentEvent, data });
    } catch {
      onEvent({ event: currentEvent, data: raw });
    }
    currentEvent = null;
    dataLines = [];
  };

  const processLine = (line: string) => {
    const normalized = line.endsWith('\r') ? line.slice(0, -1) : line;
    if (normalized === '') {
      dispatchEvent();
      return;
    }

    if (normalized.startsWith(':')) return;

    if (normalized.startsWith('event:')) {
      currentEvent = normalized.slice(6).trim() as SSEEventType;
      return;
    }

    if (normalized.startsWith('data:')) {
      dataLines.push(normalized.slice(5).trimStart());
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });

    let lineBreakIndex = buffer.indexOf('\n');
    while (lineBreakIndex !== -1) {
      const line = buffer.slice(0, lineBreakIndex);
      processLine(line);
      buffer = buffer.slice(lineBreakIndex + 1);
      lineBreakIndex = buffer.indexOf('\n');
    }

    if (done) break;
  }

  if (buffer.length > 0) {
    processLine(buffer);
  }
  dispatchEvent();
}
