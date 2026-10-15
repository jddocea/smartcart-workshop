import { AgentEvent } from '../../shared/agent-events';
import { MockProvider } from './mock-provider';

async function collect(message: string): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  for await (const event of new MockProvider().run([{ role: 'user', content: message }])) {
    events.push(event);
  }
  return events;
}

function textOf(events: AgentEvent[]): string {
  return events.map((e) => (e.type === 'text' ? e.delta : '')).join('');
}

describe('MockProvider', () => {
  it('searches with a price limit', async () => {
    const events = await collect('show me headphones under $100');

    const products = events.find((e) => e.type === 'products');
    expect(products?.type === 'products' && products.items.map((p) => p.id)).toEqual([
      'wireless-headphones',
      'kids-headphones',
    ]);
    expect(textOf(events)).toBe('I found 2 products for you:');
  });

  it('adds the cheapest match to the cart', async () => {
    const events = await collect('add the cheapest mug to my cart');

    expect(events).toContainEqual({
      type: 'action',
      action: 'addToCart',
      productId: 'ceramic-coffee-mug',
      quantity: 1,
    });
    expect(textOf(events)).toBe('Added 1 × Ceramic Coffee Mug to your cart.');
  });

  it('adds the requested quantity', async () => {
    const events = await collect('add 2 yoga mats');

    expect(events).toContainEqual({
      type: 'action',
      action: 'addToCart',
      productId: 'yoga-mat',
      quantity: 2,
    });
  });

  it('streams help text when there are no keywords', async () => {
    const events = await collect('hello');

    expect(textOf(events)).toBe(
      'I can help you find products and add them to your cart. Try “show me headphones under $100” or “add the cheapest mug to my cart”.',
    );
  });

  it('explains when nothing matches', async () => {
    const events = await collect('show me unicorns');

    expect(textOf(events)).toBe(
      "I couldn't find any products matching “unicorn”. Try a different search.",
    );
  });

  it('streams text as word-sized deltas', async () => {
    const events = await collect('show me headphones under $100');

    const deltas = events.filter((e) => e.type === 'text').map((e) => e.delta);
    expect(deltas).toEqual(['I ', 'found ', '2 ', 'products ', 'for ', 'you:']);
  });

  it.each(['show me headphones', 'add the cheapest mug', 'hello', 'show me unicorns'])(
    'always ends with done for "%s"',
    async (message) => {
      const events = await collect(message);

      expect(events.at(-1)).toEqual({ type: 'done' });
      expect(events.filter((e) => e.type === 'done')).toHaveLength(1);
    },
  );
});
