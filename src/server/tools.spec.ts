import { executeTool, toolDeclarations } from './tools';

describe('toolDeclarations', () => {
  it('declares the three assistant tools', () => {
    expect(toolDeclarations.map((d) => d.name)).toEqual([
      'searchProducts',
      'getProduct',
      'addToCart',
    ]);
  });
});

describe('executeTool', () => {
  describe('searchProducts', () => {
    it('returns matching products and a products event', () => {
      const result = executeTool('searchProducts', { query: 'headphones', maxPrice: 100 });

      expect(result.response).toEqual({
        count: 2,
        products: [
          {
            id: 'wireless-headphones',
            name: 'Wireless Headphones',
            price: 89,
            category: 'audio',
            rating: expect.any(Number),
          },
          {
            id: 'kids-headphones',
            name: 'Kids Headphones',
            price: 35,
            category: 'audio',
            rating: expect.any(Number),
          },
        ],
      });
      expect(result.events).toEqual([
        {
          type: 'products',
          items: [
            expect.objectContaining({ id: 'wireless-headphones' }),
            expect.objectContaining({ id: 'kids-headphones' }),
          ],
        },
      ]);
    });

    it('returns at most 5 results', () => {
      const result = executeTool('searchProducts', {});

      expect(result.response['count']).toBe(5);
      expect(result.events[0]).toEqual({ type: 'products', items: expect.any(Array) });
      expect((result.events[0] as { items: unknown[] }).items).toHaveLength(5);
    });

    it('filters by category', () => {
      const result = executeTool('searchProducts', { category: 'kitchen', query: 'mug' });

      expect(result.response['count']).toBe(2);
    });

    it('emits no events when nothing matches', () => {
      const result = executeTool('searchProducts', { query: 'unicorn' });

      expect(result.response).toEqual({ count: 0, products: [] });
      expect(result.events).toEqual([]);
    });

    it('ignores invalid argument types', () => {
      const result = executeTool('searchProducts', {
        query: 42,
        maxPrice: 'cheap',
        category: 'toys',
      });

      expect(result.response['count']).toBe(5);
    });
  });

  describe('getProduct', () => {
    it('returns the product', () => {
      const result = executeTool('getProduct', { productId: 'yoga-mat' });

      expect(result.response).toEqual({
        product: expect.objectContaining({ id: 'yoga-mat', name: 'Yoga Mat' }),
      });
      expect(result.events).toEqual([]);
    });

    it('returns an error for an unknown id', () => {
      const result = executeTool('getProduct', { productId: 'nope' });

      expect(result.response).toEqual({ error: 'Unknown product: nope' });
      expect(result.events).toEqual([]);
    });
  });

  describe('addToCart', () => {
    it('adds one item by default', () => {
      const result = executeTool('addToCart', { productId: 'ceramic-coffee-mug' });

      expect(result.response).toEqual({
        added: true,
        productId: 'ceramic-coffee-mug',
        quantity: 1,
        name: 'Ceramic Coffee Mug',
      });
      expect(result.events).toEqual([
        { type: 'action', action: 'addToCart', productId: 'ceramic-coffee-mug', quantity: 1 },
      ]);
    });

    it('accepts an explicit quantity', () => {
      const result = executeTool('addToCart', { productId: 'yoga-mat', quantity: 3 });

      expect(result.events).toEqual([
        { type: 'action', action: 'addToCart', productId: 'yoga-mat', quantity: 3 },
      ]);
    });

    it('rejects an unknown product', () => {
      const result = executeTool('addToCart', { productId: 'nope' });

      expect(result.response).toEqual({ error: 'Unknown product: nope' });
      expect(result.events).toEqual([]);
    });

    it.each([0, 11, 2.5, '2'])('rejects quantity %s', (quantity) => {
      const result = executeTool('addToCart', { productId: 'yoga-mat', quantity });

      expect(result.response['error']).toEqual(expect.any(String));
      expect(result.events).toEqual([]);
    });
  });

  it('returns an error for an unknown tool', () => {
    expect(executeTool('deleteEverything', {})).toEqual({
      response: { error: 'Unknown tool: deleteEverything' },
      events: [],
    });
  });
});
