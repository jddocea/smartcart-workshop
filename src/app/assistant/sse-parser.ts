import { AgentEvent } from '../../shared/agent-events';

/** Incrementally parses a `text/event-stream` body into agent events. */
export class SseParser {
  private buffer = '';

  push(chunk: string): AgentEvent[] {
    this.buffer += chunk;
    const frames = this.buffer.split('\n\n');
    this.buffer = frames.pop() ?? '';
    return frames.flatMap((frame) => {
      const event = parseFrame(frame);
      return event ? [event] : [];
    });
  }
}

function parseFrame(frame: string): AgentEvent | null {
  const data = frame
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice('data:'.length).replace(/^ /, ''))
    .join('\n');
  if (!data) return null;

  try {
    const parsed: unknown = JSON.parse(data);
    const type = (parsed as { type?: unknown } | null)?.type;
    return typeof type === 'string' ? (parsed as AgentEvent) : null;
  } catch {
    return null;
  }
}
