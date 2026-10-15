import { AgentEvent } from '../shared/agent-events';

export function encodeSse(event: AgentEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}
