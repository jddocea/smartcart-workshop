import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Product } from '../../shared/product';
import { CartStore } from '../cart/cart.store';

@Component({
  selector: 'app-product-card',
  imports: [CurrencyPipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let item = product();
    <article class="card" data-testid="product-card">
      <a class="link" [routerLink]="['/product', item.id]">
        <div class="emoji-tile tile" [attr.data-category]="item.category" aria-hidden="true">
          {{ item.emoji }}
        </div>
        <span class="category">{{ item.category }}</span>
        <h3 class="name" [id]="'product-' + item.id">{{ item.name }}</h3>
      </a>
      <div class="footer">
        <div class="meta">
          <span class="price">{{ item.price | currency: 'USD' }}</span>
          <span class="rating"><span aria-hidden="true">★</span> {{ item.rating }}</span>
        </div>
        <button
          type="button"
          class="btn btn-primary"
          data-testid="add-to-cart"
          [attr.aria-describedby]="'product-' + item.id"
          (click)="cart.add(item)"
        >
          Add to cart
        </button>
      </div>
    </article>
  `,
  styles: `
    :host {
      display: block;
    }
    .card {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      height: 100%;
      padding: var(--space-3);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      background: var(--color-surface);
      box-shadow: var(--shadow-sm);
      transition:
        box-shadow var(--transition),
        transform var(--transition);
    }
    .card:hover {
      box-shadow: var(--shadow-md);
      transform: translateY(-2px);
    }
    .link {
      display: grid;
      gap: var(--space-1);
      color: inherit;
      text-decoration: none;
    }
    .tile {
      margin-bottom: var(--space-2);
      font-size: 4.5rem;
      transition: transform var(--transition);
    }
    .card:hover .tile {
      transform: scale(1.02);
    }
    .category {
      color: var(--color-text-muted);
      font-size: 0.8125rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .name {
      font-size: 1.0625rem;
      line-height: 1.3;
    }
    .link:hover .name {
      color: var(--color-primary);
    }
    .footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2);
      margin-top: auto;
    }
    .meta {
      display: grid;
      font-size: 0.9375rem;
    }
    .price {
      font-size: 1.125rem;
    }
  `,
})
export class ProductCard {
  readonly product = input.required<Product>();
  protected readonly cart = inject(CartStore);
}
