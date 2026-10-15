import { AgentEvent, ChatMessage } from '../shared/agent-events';
import { handleChat } from './chat-handler';
import { LlmProvider } from './llm/provider';
import { encodeSse } from './sse';

function fakeProvider(
  run: (messages: ChatMessage[]) => AsyncIterable<AgentEvent>,
): () => LlmProvider {
  return () => ({ name: 'mock', run });
}

const scripted = fakeProvider(async function* () {
  yield { type: 'text', delta: 'Hi' };
  yield { type: 'done' };
});

function post(body: unknown): Request {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

async function expectBadRequest(response: Response): Promise<void> {
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: expect.any(String) });
}

describe('handleChat', () => {
  it('rejects non-POST requests', async () => {
    const response = await handleChat(new Request('http://localhost/api/chat'), {}, scripted);

    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('POST');
  });

  it('rejects invalid JSON', async () => {
    await expectBadRequest(await handleChat(post('{nope'), {}, scripted));
  });

  it('rejects an empty message list', async () => {
    await expectBadRequest(await handleChat(post({ messages: [] }), {}, scripted));
  });

  it('rejects content that is too long', async () => {
    const messages = [{ role: 'user', content: 'x'.repeat(2001) }];

    await expectBadRequest(await handleChat(post({ messages }), {}, scripted));
  });

  it('rejects a conversation that does not end with a user message', async () => {
    const messages = [
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
    ];

    await expectBadRequest(await handleChat(post({ messages }), {}, scripted));
  });

  it('streams provider events as SSE', async () => {
    const response = await handleChat(
      post({ messages: [{ role: 'user', content: 'hi' }] }),
      {},
      scripted,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/event-stream; charset=utf-8');
    expect(response.headers.get('cache-control')).toBe('no-cache');
    expect(response.headers.get('x-smartcart-provider')).toBe('mock');
    expect(await new Response(response.body).text()).toBe(
      encodeSse({ type: 'text', delta: 'Hi' }) + encodeSse({ type: 'done' }),
    );
  });

  it('reports provider failures without leaking details', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const failing = fakeProvider(async function* () {
      yield { type: 'text', delta: 'Partial' };
      throw new Error('secret upstream failure');
    });

    const response = await handleChat(
      post({ messages: [{ role: 'user', content: 'hi' }] }),
      {},
      failing,
    );
    const body = await new Response(response.body).text();

    expect(body).toBe(
      encodeSse({ type: 'text', delta: 'Partial' }) +
        encodeSse({
          type: 'error',
          message: 'The assistant is unavailable right now. Please try again.',
        }) +
        encodeSse({ type: 'done' }),
    );
    expect(body).not.toContain('secret');
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
