import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { Category } from '../../shared/product';
import { filterProducts } from '../../shared/product-filter';
import { PRODUCTS } from '../../shared/products';
import { ProductCard } from './product-card';

type CategoryOption = Category | 'all';

const CATEGORY_LABELS: Record<CategoryOption, string> = {
  all: 'All',
  audio: 'Audio',
  kitchen: 'Kitchen',
  home: 'Home',
  fitness: 'Fitness',
  accessories: 'Accessories',
};

@Component({
  selector: 'app-product-list-page',
  imports: [CurrencyPipe, ProductCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container page">
      <section class="hero">
        <h1>Find something you'll love</h1>
        <p class="muted">Browse the catalog, or ask the shopping assistant ✨ for ideas.</p>
      </section>

      <section class="filters" aria-label="Product filters">
        <label class="search">
          <span class="visually-hidden">Search products</span>
          <span class="search-icon" aria-hidden="true">🔍</span>
          <input
            #search
            class="field"
            type="search"
            placeholder="Search products…"
            data-testid="search"
            [value]="query()"
            (input)="query.set(search.value)"
          />
        </label>

        <div class="chips" role="group" aria-label="Category">
          @for (option of categories; track option.value) {
            <button
              type="button"
              class="chip"
              data-testid="category-chip"
              [attr.aria-pressed]="category() === option.value"
              (click)="category.set(option.value)"
            >
              {{ option.label }}
            </button>
          }
        </div>

        <label class="price-filter">
          <span>Max price</span>
          <select
            #max
            class="field"
            data-testid="max-price"
            (change)="maxPrice.set(max.value ? +max.value : undefined)"
          >
            <option value="">Any</option>
            @for (price of priceOptions; track price) {
              <option [value]="price">{{ price | currency: 'USD' : 'symbol' : '1.0-0' }}</option>
            }
          </select>
        </label>
      </section>

      <p class="count muted" aria-live="polite">
        {{ products().length }} {{ products().length === 1 ? 'product' : 'products' }}
      </p>

      @if (products().length) {
        <div class="grid">
          @for (product of products(); track product.id) {
            <app-product-card [product]="product" />
          }
        </div>
      } @else {
        <div class="empty-state" data-testid="empty-state">
          <span class="emoji" aria-hidden="true">🔎</span>
          <p>No products match your filters.</p>
        </div>
      }
    </div>
  `,
  styles: `
    .hero {
      display: grid;
      gap: var(--space-2);
      margin-bottom: var(--space-5);
    }
    .hero p {
      font-size: 1.125rem;
    }
    .filters {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-3) var(--space-4);
      padding: var(--space-4);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      background: var(--color-surface);
      box-shadow: var(--shadow-sm);
    }
    .search {
      position: relative;
      flex: 1 1 16rem;
    }
    .search input {
      width: 100%;
      padding-left: 2.5rem;
    }
    .search-icon {
      position: absolute;
      top: 50%;
      left: var(--space-4);
      transform: translateY(-50%);
      font-size: 0.9rem;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }
    .chip {
      padding: var(--space-2) var(--space-4);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-pill);
      background: var(--color-surface);
      font-weight: 600;
      cursor: pointer;
      transition:
        background var(--transition),
        color var(--transition);
    }
    .chip:hover {
      background: var(--color-primary-soft);
    }
    .chip[aria-pressed='true'] {
      border-color: var(--color-primary);
      background: var(--color-primary);
      color: var(--color-on-primary);
    }
    .price-filter {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-weight: 600;
    }
    .count {
      margin: var(--space-5) 0 var(--space-3);
      font-weight: 600;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 14rem), 1fr));
      gap: var(--space-5);
    }
  `,
})
export class ProductListPage {
  protected readonly categories = (Object.keys(CATEGORY_LABELS) as CategoryOption[]).map(
    (value) => ({ value, label: CATEGORY_LABELS[value] }),
  );
  protected readonly priceOptions = [25, 50, 100, 200];

  protected readonly query = signal('');
  protected readonly category = signal<CategoryOption>('all');
  protected readonly maxPrice = signal<number | undefined>(undefined);

  protected readonly products = computed(() =>
    filterProducts(PRODUCTS, {
      query: this.query(),
      category: this.category(),
      maxPrice: this.maxPrice(),
    }),
  );
}
