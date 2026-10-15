import { TestBed } from '@angular/core/testing';
import { AgentEvent } from '../../shared/agent-events';
import { findProduct } from '../../shared/products';
import { encodeSse } from '../../server/sse';
import { CartStore } from '../cart/cart.store';
import { ChatService, FETCH } from './chat.service';

const GENERIC_ERROR = 'Sorry, something went wrong. Please try again.';
const headphones = findProduct('wireless-headphones')!;

/** Streams the events as SSE, splitting the encoded text into small chunks. */
function sseResponse(events: AgentEvent[], provider = 'mock'): Response {
  const encoder = new TextEncoder();
  const text = events.map(encodeSse).join('');
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < text.length; i += 7)
        controller.enqueue(encoder.encode(text.slice(i, i + 7)));
      controller.close();
    },
  });
  return new Response(body, {
    headers: { 'content-type': 'text/event-stream', 'x-smartcart-provider': provider },
  });
}

function setup(fetchImpl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  const fetchMock = vi.fn(fetchImpl);
  TestBed.configureTestingModule({ providers: [{ provide: FETCH, useValue: fetchMock }] });
  return { service: TestBed.inject(ChatService), fetchMock };
}

function requestBody(fetchMock: ReturnType<typeof setup>['fetchMock'], call = 0): unknown {
  return JSON.parse(String(fetchMock.mock.calls[call][1]?.body));
}

const lastMessage = (service: ChatService) => service.messages().at(-1)!;

describe('ChatService', () => {
  beforeEach(() => localStorage.clear());

  it('accumulates text deltas into the assistant message', async () => {
    const { service, fetchMock } = setup(async () =>
      sseResponse([
        { type: 'text', delta: 'Hello ' },
        { type: 'text', delta: 'there!' },
        { type: 'done' },
      ]),
    );

    await service.send('  hi  ');

    expect(service.messages()).toEqual([
      { id: expect.any(Number), role: 'user', text: 'hi', products: [] },
      { id: expect.any(Number), role: 'assistant', text: 'Hello there!', products: [] },
    ]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/chat');
    expect(init?.method).toBe('POST');
    expect(new Headers(init?.headers).get('content-type')).toBe('application/json');
  });

  it('attaches products to the assistant message', async () => {
    const { service } = setup(async () =>
      sseResponse([{ type: 'products', items: [headphones] }, { type: 'done' }]),
    );

    await service.send('headphones');

    expect(lastMessage(service).products).toEqual([headphones]);
  });

  it('adds products to the cart on an action event', async () => {
    const { service } = setup(async () =>
      sseResponse([
        { type: 'action', action: 'addToCart', productId: 'wireless-headphones', quantity: 2 },
        { type: 'done' },
      ]),
    );
    const cart = TestBed.inject(CartStore);

    await service.send('add headphones');

    expect(cart.count()).toBe(2);
  });

  it('shows a generic error for a failed response', async () => {
    const { service } = setup(async () => new Response('boom', { status: 500 }));

    await service.send('hi');

    expect(lastMessage(service).error).toBe(GENERIC_ERROR);
    expect(service.streaming()).toBe(false);
  });

  it('shows a generic error when fetch rejects', async () => {
    const { service } = setup(() => Promise.reject(new TypeError('offline')));

    await service.send('hi');

    expect(lastMessage(service).error).toBe(GENERIC_ERROR);
    expect(service.streaming()).toBe(false);
  });

  it('keeps partial text when an error event arrives mid-stream', async () => {
    const { service } = setup(async () =>
      sseResponse([
        { type: 'text', delta: 'Let me ' },
        { type: 'error', message: 'The assistant is unavailable.' },
        { type: 'done' },
      ]),
    );

    await service.send('hi');

    expect(lastMessage(service)).toMatchObject({
      text: 'Let me ',
      error: 'The assistant is unavailable.',
    });
  });

  it('sets the provider from the response header', async () => {
    const { service } = setup(async () => sseResponse([{ type: 'done' }], 'gemini'));
    expect(service.provider()).toBeNull();

    await service.send('hi');

    expect(service.provider()).toBe('gemini');
  });

  it('is streaming while the request is in flight and ignores a second send', async () => {
    let respond!: (response: Response) => void;
    const { service, fetchMock } = setup(
      () => new Promise<Response>((resolve) => (respond = resolve)),
    );

    const pending = service.send('first');
    expect(service.streaming()).toBe(true);

    await service.send('second');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(service.messages().map((message) => message.text)).toEqual(['first', '']);

    respond(sseResponse([{ type: 'text', delta: 'ok' }, { type: 'done' }]));
    await pending;
    expect(service.streaming()).toBe(false);
  });

  it('sends prior completed history, skipping errored and empty replies', async () => {
    const replies: Response[] = [
      sseResponse([{ type: 'text', delta: 'Hi!' }, { type: 'done' }]),
      new Response('boom', { status: 500 }),
      sseResponse([{ type: 'done' }]),
      sseResponse([{ type: 'done' }]),
    ];
    const { service, fetchMock } = setup(async () => replies.shift()!);

    await service.send('one');
    await service.send('two');
    await service.send('three');
    await service.send('four');

    expect(requestBody(fetchMock, 3)).toEqual({
      messages: [
        { role: 'user', content: 'one' },
        { role: 'assistant', content: 'Hi!' },
        { role: 'user', content: 'two' },
        { role: 'user', content: 'three' },
        { role: 'user', content: 'four' },
      ],
    });
  });

  it('sends at most the last 20 messages', async () => {
    const { service, fetchMock } = setup(async () =>
      sseResponse([{ type: 'text', delta: 'ok' }, { type: 'done' }]),
    );

    for (let i = 1; i <= 11; i++) await service.send(`message ${i}`);

    const { messages } = requestBody(fetchMock, 10) as { messages: { content: string }[] };
    expect(messages).toHaveLength(20);
    expect(messages.at(-1)).toEqual({ role: 'user', content: 'message 11' });
    expect(messages[0]).toEqual({ role: 'assistant', content: 'ok' });
  });

  it('ignores whitespace-only input', async () => {
    const { service, fetchMock } = setup(async () => sseResponse([{ type: 'done' }]));

    await service.send('   ');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(service.messages()).toEqual([]);
  });

  it('reset clears the conversation', async () => {
    const { service } = setup(async () => sseResponse([{ type: 'done' }]));
    await service.send('hi');

    service.reset();

    expect(service.messages()).toEqual([]);
  });
});
