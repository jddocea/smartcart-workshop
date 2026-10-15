import { Product } from './product';

export type AgentEvent =
  | { type: 'text'; delta: string }
  | { type: 'products'; items: Product[] }
  | { type: 'action'; action: 'addToCart'; productId: string; quantity: number }
  | { type: 'error'; message: string }
  | { type: 'done' };

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
