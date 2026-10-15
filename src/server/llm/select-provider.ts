import { SmartCartEnv } from '../env';
import { GeminiProvider } from './gemini-provider';
import { MockProvider } from './mock-provider';
import { LlmProvider } from './provider';

export function createProvider(env: SmartCartEnv): LlmProvider {
  if (env.GEMINI_API_KEY && env.SMARTCART_PROVIDER !== 'mock') {
    return new GeminiProvider({ apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL });
  }
  return new MockProvider({ delayMs: 25 });
}
