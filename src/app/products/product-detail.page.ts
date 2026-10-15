import { CurrencyPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { findProduct } from '../../shared/products';
import { CartStore, MAX_QUANTITY } from '../cart/cart.store';

@Component({
  selector: 'app-product-detail-page',
  imports: [CurrencyPipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container page">
      @if (product(); as item) {
        <a class="back" routerLink="/">← Back to products</a>
        <article class="detail">
          <div class="emoji-tile tile" [attr.data-category]="item.category" aria-hidden="true">
            {{ item.emoji }}
          </div>
          <div class="info">
            <span class="category">{{ item.category }}</span>
            <h1>{{ item.name }}</h1>
            <p class="rating"><span aria-hidden="true">★</span> {{ item.rating }} / 5</p>
            <p class="description">{{ item.description }}</p>
            <ul class="tags" aria-label="Tags">
              @for (tag of item.tags; track tag) {
                <li>#{{ tag }}</li>
              }
            </ul>
            <p class="price">{{ item.price | currency: 'USD' }}</p>

            <div class="buy">
              <label class="quantity">
                Quantity
                <select
                  #qty
                  class="field"
                  data-testid="quantity"
                  (change)="quantity.set(+qty.value)"
                >
                  @for (n of quantities; track n) {
                    <option [value]="n" [selected]="n === quantity()">{{ n }}</option>
                  }
                </select>
              </label>
              <button
                type="button"
                class="btn btn-primary add"
                data-testid="add-to-cart"
                (click)="addToCart()"
              >
                Add to cart
              </button>
            </div>
            <p class="added" role="status">
              @if (added(); as count) {
                ✓ Added {{ count }} to your cart. <a routerLink="/cart">View cart</a>
              }
            </p>
          </div>
        </article>
      } @else {
        <div class="empty-state" data-testid="not-found">
          <span class="emoji" aria-hidden="true">🤷</span>
          <h1>Product not found</h1>
          <p>We couldn't find that product.</p>
          <a class="btn btn-primary" routerLink="/">Back to all products</a>
        </div>
      }
    </div>
  `,
  styles: `
    .back {
      display: inline-block;
      margin-bottom: var(--space-5);
      font-weight: 600;
      text-decoration: none;
    }
    .back:hover {
      text-decoration: underline;
    }
    .detail {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
      gap: var(--space-6);
      align-items: start;
      padding: var(--space-5);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      background: var(--color-surface);
      box-shadow: var(--shadow-sm);
    }
    .tile {
      font-size: clamp(6rem, 18vw, 11rem);
    }
    .info {
      display: grid;
      gap: var(--space-3);
    }
    .category {
      color: var(--color-text-muted);
      font-size: 0.875rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .description {
      font-size: 1.125rem;
      color: var(--color-text-muted);
    }
    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .tags li {
      padding: var(--space-1) var(--space-3);
      border-radius: var(--radius-pill);
      background: var(--color-primary-soft);
      color: var(--color-primary-hover);
      font-size: 0.875rem;
      font-weight: 600;
    }
    .price {
      font-size: 2rem;
    }
    .buy {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-3);
    }
    .quantity {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-weight: 600;
    }
    .add {
      min-height: 2.75rem;
      padding-inline: var(--space-6);
    }
    .added {
      min-height: 1.5rem;
      color: var(--color-success);
      font-weight: 600;
    }
  `,
})
export class ProductDetailPage {
  readonly id = input.required<string>();

  private readonly cart = inject(CartStore);
  protected readonly quantities = Array.from({ length: MAX_QUANTITY }, (_, i) => i + 1);
  protected readonly product = computed(() => findProduct(this.id()));
  // Both reset when the router reuses this page for another product.
  protected readonly quantity = linkedSignal({ source: this.id, computation: () => 1 });
  protected readonly added = linkedSignal({ source: this.id, computation: () => 0 });

  protected addToCart(): void {
    const product = this.product();
    if (!product) return;
    this.cart.add(product, this.quantity());
    this.added.set(this.quantity());
  }
}
