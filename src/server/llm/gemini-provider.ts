import {
  Content,
  FunctionCall,
  GenerateContentConfig,
  GenerateContentResponse,
  GoogleGenAI,
  Part,
} from '@google/genai';
import { AgentEvent, ChatMessage } from '../../shared/agent-events';
import { executeTool, toolDeclarations } from '../tools';
import { LlmProvider } from './provider';

export interface GeminiClient {
  models: {
    generateContentStream(params: {
      model: string;
      contents: Content[];
      config?: GenerateContentConfig;
    }): Promise<AsyncIterable<GenerateContentResponse>>;
  };
}

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

export const SYSTEM_INSTRUCTION = `You are SmartCart's shopping assistant.
Help shoppers find products in the SmartCart catalog and add them to their cart.
- Always use the provided tools to look up products. Never invent products, prices or ids.
- Keep replies concise: one or two short sentences. The UI shows product cards for search results, so do not repeat every detail.
- After adding something to the cart, confirm exactly what you added and how many.
- Politely refuse requests unrelated to shopping on SmartCart.`;

const MAX_TOOL_ROUNDS = 3;
const FALLBACK_TEXT = "I wasn't able to finish that request. Please try rephrasing.";

export class GeminiProvider implements LlmProvider {
  readonly name = 'gemini';
  private readonly client: GeminiClient;
  private readonly model: string;

  constructor(options: { apiKey: string; model?: string; client?: GeminiClient }) {
    this.client = options.client ?? new GoogleGenAI({ apiKey: options.apiKey });
    this.model = options.model ?? DEFAULT_GEMINI_MODEL;
  }

  async *run(messages: ChatMessage[]): AsyncGenerator<AgentEvent> {
    const contents: Content[] = messages.map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content }],
    }));
    const config: GenerateContentConfig = {
      systemInstruction: SYSTEM_INSTRUCTION,
      tools: [
        {
          functionDeclarations: toolDeclarations.map((d) => ({
            name: d.name,
            description: d.description,
            parametersJsonSchema: d.parameters,
          })),
        },
      ],
    };

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const stream = await this.client.models.generateContentStream({
        model: this.model,
        contents,
        config,
      });

      const modelParts: Part[] = [];
      const calls: FunctionCall[] = [];
      for await (const chunk of stream) {
        for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
          modelParts.push(part);
          if (part.text && !part.thought) yield { type: 'text', delta: part.text };
          if (part.functionCall) calls.push(part.functionCall);
        }
      }

      if (calls.length === 0) {
        yield { type: 'done' };
        return;
      }

      // Replay the model's parts verbatim so thoughtSignature fields survive the round trip.
      contents.push({ role: 'model', parts: modelParts });
      const responses: Part[] = [];
      for (const call of calls) {
        const name = call.name ?? '';
        const result = executeTool(name, call.args ?? {});
        yield* result.events;
        responses.push({ functionResponse: { id: call.id, name, response: result.response } });
      }
      contents.push({ role: 'user', parts: responses });
    }

    yield { type: 'text', delta: FALLBACK_TEXT };
    yield { type: 'done' };
  }
}
