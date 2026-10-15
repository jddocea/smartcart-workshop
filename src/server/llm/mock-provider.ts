import { AgentEvent, ChatMessage } from '../../shared/agent-events';
import { Product } from '../../shared/product';
import { executeTool } from '../tools';
import { LlmProvider } from './provider';

const STOPWORDS = new Set(
  'show me find i want need some a an the for please add to my cart under cheapest any get buy with and of in is are what do you have hi hello hey thanks thank'.split(
    ' ',
  ),
);

const HELP_TEXT =
  'I can help you find products and add them to your cart. Try “show me headphones under $100” or “add the cheapest mug to my cart”.';

/** A deterministic, keyword-based stand-in for an LLM, used when no Gemini key is configured. */
export class MockProvider implements LlmProvider {
  readonly name = 'mock';

  constructor(private readonly options: { delayMs?: number } = {}) {}

  async *run(messages: ChatMessage[]): AsyncGenerator<AgentEvent> {
    const message = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
    const text = message.toLowerCase();
    const words: string[] = text.match(/[a-z0-9$]+/g) ?? [];
    const priceMatch = text.match(/under \$?(\d+)/);
    const maxPrice = priceMatch ? Number(priceMatch[1]) : undefined;
    const keywords = words
      .filter((word) => !STOPWORDS.has(word) && !/^[\d$]+$/.test(word))
      .map(singularize);

    if (keywords.length === 0) {
      yield* this.say(HELP_TEXT);
    } else {
      const search = executeTool('searchProducts', { query: keywords.join(' '), maxPrice });
      const productsEvent = search.events.find((e) => e.type === 'products');
      const results = productsEvent?.items ?? [];

      if (words.includes('add') && results.length > 0) {
        const product = words.includes('cheapest') ? cheapest(results) : results[0];
        const quantity = Number(text.match(/add (\d+)/)?.[1] ?? 1);
        const added = executeTool('addToCart', { productId: product.id, quantity });
        yield* added.events;
        yield* this.say(
          added.response['added']
            ? `Added ${quantity} × ${product.name} to your cart.`
            : `Sorry, I couldn't add that: ${String(added.response['error'])}`,
        );
      } else if (productsEvent) {
        const noun = results.length === 1 ? 'product' : 'products';
        yield* this.say(`I found ${results.length} ${noun} for you:`);
        yield productsEvent;
      } else {
        yield* this.say(
          `I couldn't find any products matching “${keywords.join(' ')}”. Try a different search.`,
        );
      }
    }

    yield { type: 'done' };
  }

  private async *say(sentence: string): AsyncGenerator<AgentEvent> {
    const words = sentence.split(' ');
    for (const [index, word] of words.entries()) {
      if (index > 0 && this.options.delayMs) await sleep(this.options.delayMs);
      yield { type: 'text', delta: index < words.length - 1 ? `${word} ` : word };
    }
  }
}

function singularize(word: string): string {
  return word.length > 3 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word;
}

function cheapest(products: Product[]): Product {
  return products.reduce((best, product) => (product.price < best.price ? product : best));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
