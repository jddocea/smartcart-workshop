import { AgentEvent, ChatMessage } from '../../shared/agent-events';

export interface LlmProvider {
  readonly name: 'gemini' | 'mock';
  run(messages: ChatMessage[]): AsyncIterable<AgentEvent>;
}
