import { filterProducts } from './product-filter';
import { findProduct, PRODUCTS } from './products';

const HEADPHONE_IDS = ['wireless-headphones', 'kids-headphones', 'noise-cancelling-headphones'];

const ids = (filter: Parameters<typeof filterProducts>[1]) =>
  filterProducts(PRODUCTS, filter).map((product) => product.id);

describe('filterProducts', () => {
  it('returns every product for an empty filter', () => {
    expect(filterProducts(PRODUCTS, {})).toHaveLength(20);
    expect(filterProducts(PRODUCTS, { query: '   ' })).toHaveLength(20);
  });

  it('matches case-insensitively', () => {
    expect(ids({ query: 'HEADPHONES' })).toEqual(HEADPHONE_IDS);
  });

  it('requires every query token to match', () => {
    expect(ids({ query: 'travel mug' })).toEqual(['insulated-travel-mug']);
  });

  it('filters by category', () => {
    const kitchen = filterProducts(PRODUCTS, { category: 'kitchen' });

    expect(kitchen.length).toBeGreaterThan(0);
    expect(kitchen.every((product) => product.category === 'kitchen')).toBe(true);
    expect(kitchen.map((product) => product.id)).toEqual(
      expect.arrayContaining(['ceramic-coffee-mug', 'insulated-travel-mug']),
    );
  });

  it("treats category 'all' as no filter", () => {
    expect(filterProducts(PRODUCTS, { category: 'all' })).toEqual([...PRODUCTS]);
  });

  it('combines query and max price', () => {
    expect(ids({ query: 'headphones', maxPrice: 100 })).toEqual([
      'wireless-headphones',
      'kids-headphones',
    ]);
  });

  it('treats max price as inclusive', () => {
    expect(ids({ maxPrice: 14 })).toContain('ceramic-coffee-mug');
  });
});

describe('product catalog', () => {
  it('has 20 products with unique ids', () => {
    expect(PRODUCTS).toHaveLength(20);
    expect(new Set(PRODUCTS.map((product) => product.id)).size).toBe(20);
  });

  it('finds products by id', () => {
    expect(findProduct('ceramic-coffee-mug')?.price).toBe(14);
    expect(findProduct('does-not-exist')).toBeUndefined();
  });
});
