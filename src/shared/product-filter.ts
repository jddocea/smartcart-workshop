import { Category, Product } from './product';

export interface ProductFilter {
  query?: string;
  category?: Category | 'all';
  maxPrice?: number;
}

export function filterProducts(products: readonly Product[], filter: ProductFilter): Product[] {
  const tokens = (filter.query ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  const category = filter.category === 'all' ? undefined : filter.category;

  return products.filter((product) => {
    if (category && product.category !== category) return false;
    if (filter.maxPrice !== undefined && product.price > filter.maxPrice) return false;

    const haystack = [product.name, product.description, ...product.tags, product.category]
      .join(' ')
      .toLowerCase();
    return tokens.every((token) => haystack.includes(token));
  });
}
