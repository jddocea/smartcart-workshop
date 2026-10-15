import { AgentEvent } from '../shared/agent-events';
import { Category } from '../shared/product';
import { ProductFilter, filterProducts } from '../shared/product-filter';
import { PRODUCTS, findProduct } from '../shared/products';

export interface ToolResult {
  response: Record<string, unknown>;
  events: AgentEvent[];
}

const CATEGORIES: readonly Category[] = ['audio', 'kitchen', 'home', 'fitness', 'accessories'];
const MAX_SEARCH_RESULTS = 5;
const MAX_QUANTITY = 10;

export const toolDeclarations: {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}[] = [
  {
    name: 'searchProducts',
    description: 'Search the SmartCart catalog. Returns up to 5 matching products.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Keywords to match against product names, descriptions and tags.',
        },
        category: {
          type: 'string',
          enum: [...CATEGORIES],
          description: 'Restrict results to one category.',
        },
        maxPrice: { type: 'number', description: 'Maximum price in US dollars.' },
      },
    },
  },
  {
    name: 'getProduct',
    description: 'Get the full details of one product by its id.',
    parameters: {
      type: 'object',
      properties: {
        productId: { type: 'string', description: 'The product id, e.g. "wireless-headphones".' },
      },
      required: ['productId'],
    },
  },
  {
    name: 'addToCart',
    description: "Add a product to the shopper's cart.",
    parameters: {
      type: 'object',
      properties: {
        productId: { type: 'string', description: 'The product id to add.' },
        quantity: {
          type: 'integer',
          minimum: 1,
          maximum: MAX_QUANTITY,
          description: 'How many to add. Defaults to 1.',
        },
      },
      required: ['productId'],
    },
  },
];

// Tool arguments come from the LLM, so every value is treated as untrusted.
export function executeTool(name: string, args: Record<string, unknown>): ToolResult {
  switch (name) {
    case 'searchProducts':
      return searchProducts(args);
    case 'getProduct':
      return getProduct(args);
    case 'addToCart':
      return addToCart(args);
    default:
      return failure(`Unknown tool: ${name}`);
  }
}

function searchProducts(args: Record<string, unknown>): ToolResult {
  const filter: ProductFilter = {};
  if (typeof args['query'] === 'string') filter.query = args['query'];
  if (isCategory(args['category'])) filter.category = args['category'];
  if (typeof args['maxPrice'] === 'number' && Number.isFinite(args['maxPrice']))
    filter.maxPrice = args['maxPrice'];

  const items = filterProducts(PRODUCTS, filter).slice(0, MAX_SEARCH_RESULTS);
  return {
    response: {
      count: items.length,
      products: items.map(({ id, name, price, category, rating }) => ({
        id,
        name,
        price,
        category,
        rating,
      })),
    },
    events: items.length > 0 ? [{ type: 'products', items }] : [],
  };
}

function getProduct(args: Record<string, unknown>): ToolResult {
  const productId = typeof args['productId'] === 'string' ? args['productId'] : '';
  const product = findProduct(productId);
  if (!product) return failure(`Unknown product: ${productId}`);
  return { response: { product }, events: [] };
}

function addToCart(args: Record<string, unknown>): ToolResult {
  const productId = typeof args['productId'] === 'string' ? args['productId'] : '';
  const quantity = args['quantity'] ?? 1;

  if (
    typeof quantity !== 'number' ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > MAX_QUANTITY
  ) {
    return failure(`Quantity must be a whole number from 1 to ${MAX_QUANTITY}.`);
  }
  const product = findProduct(productId);
  if (!product) return failure(`Unknown product: ${productId}`);

  return {
    response: { added: true, productId, quantity, name: product.name },
    events: [{ type: 'action', action: 'addToCart', productId, quantity }],
  };
}

function isCategory(value: unknown): value is Category {
  return typeof value === 'string' && (CATEGORIES as readonly string[]).includes(value);
}

function failure(error: string): ToolResult {
  return { response: { error }, events: [] };
}
