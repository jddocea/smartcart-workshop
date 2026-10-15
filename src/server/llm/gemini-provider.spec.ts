import type { Content, GenerateContentConfig, GenerateContentResponse, Part } from '@google/genai';
import { AgentEvent } from '../../shared/agent-events';
import { DEFAULT_GEMINI_MODEL, GeminiClient, GeminiProvider } from './gemini-provider';

interface RecordedCall {
  model: string;
  contents: Content[];
  config?: GenerateContentConfig;
}

function fakeClient(script: Part[][][]): { client: GeminiClient; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const client: GeminiClient = {
    models: {
      async generateContentStream(params) {
        // Snapshot contents, because the provider keeps mutating its history array.
        calls.push({ ...params, contents: structuredClone(params.contents) });
        const chunks = script[Math.min(calls.length - 1, script.length - 1)];
        return (async function* () {
          for (const parts of chunks) {
            yield {
              candidates: [{ content: { role: 'model', parts } }],
            } as GenerateContentResponse;
          }
        })();
      },
    },
  };
  return { client, calls };
}

async function collect(provider: GeminiProvider, message = 'hi'): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  for await (const event of provider.run([{ role: 'user', content: message }])) {
    events.push(event);
  }
  return events;
}

describe('GeminiProvider', () => {
  it('streams text deltas then done using the default model', async () => {
    const { client, calls } = fakeClient([[[{ text: 'Hello ' }], [{ text: 'there!' }]]]);

    const events = await collect(new GeminiProvider({ apiKey: 'k', client }));

    expect(events).toEqual([
      { type: 'text', delta: 'Hello ' },
      { type: 'text', delta: 'there!' },
      { type: 'done' },
    ]);
    expect(calls).toHaveLength(1);
    expect(calls[0].model).toBe(DEFAULT_GEMINI_MODEL);
    expect(calls[0].contents).toEqual([{ role: 'user', parts: [{ text: 'hi' }] }]);
    const declarations = calls[0].config?.tools?.[0];
    expect(declarations && 'functionDeclarations' in declarations).toBe(true);
  });

  it('maps assistant messages to the model role', async () => {
    const { client, calls } = fakeClient([[[{ text: 'ok' }]]]);
    const provider = new GeminiProvider({ apiKey: 'k', client });

    for await (const event of provider.run([
      { role: 'user', content: 'a' },
      { role: 'assistant', content: 'b' },
      { role: 'user', content: 'c' },
    ])) {
      void event;
    }

    expect(calls[0].contents.map((c) => c.role)).toEqual(['user', 'model', 'user']);
  });

  it('executes function calls and replays the model parts', async () => {
    const callPart: Part = {
      functionCall: {
        id: 'call-1',
        name: 'addToCart',
        args: { productId: 'wireless-headphones' },
      },
      thoughtSignature: 'sig',
    };
    const { client, calls } = fakeClient([[[callPart]], [[{ text: 'Added it.' }]]]);

    const events = await collect(new GeminiProvider({ apiKey: 'k', client }), 'add headphones');

    expect(events).toEqual([
      { type: 'action', action: 'addToCart', productId: 'wireless-headphones', quantity: 1 },
      { type: 'text', delta: 'Added it.' },
      { type: 'done' },
    ]);
    expect(calls).toHaveLength(2);
    const [, modelTurn, toolTurn] = calls[1].contents;
    expect(modelTurn).toEqual({ role: 'model', parts: [callPart] });
    expect(toolTurn.role).toBe('user');
    expect(toolTurn.parts?.[0].functionResponse).toEqual({
      id: 'call-1',
      name: 'addToCart',
      response: expect.objectContaining({ added: true, productId: 'wireless-headphones' }),
    });
  });

  it('does not yield thought parts', async () => {
    const { client } = fakeClient([[[{ text: 'thinking…', thought: true }, { text: 'Answer' }]]]);

    const events = await collect(new GeminiProvider({ apiKey: 'k', client }));

    expect(events).toEqual([{ type: 'text', delta: 'Answer' }, { type: 'done' }]);
  });

  it('passes a custom model through', async () => {
    const { client, calls } = fakeClient([[[{ text: 'ok' }]]]);

    await collect(new GeminiProvider({ apiKey: 'k', model: 'gemini-custom', client }));

    expect(calls[0].model).toBe('gemini-custom');
  });

  it('stops after 3 tool rounds with a fallback message', async () => {
    const loop: Part = {
      functionCall: { id: 'x', name: 'searchProducts', args: { query: 'mug' } },
    };
    const { client, calls } = fakeClient([[[loop]]]);

    const events = await collect(new GeminiProvider({ apiKey: 'k', client }));

    expect(calls).toHaveLength(3);
    expect(events.slice(-2)).toEqual([
      { type: 'text', delta: "I wasn't able to finish that request. Please try rephrasing." },
      { type: 'done' },
    ]);
  });
});
