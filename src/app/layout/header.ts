import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CartStore } from '../cart/cart.store';

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="header">
      <div class="container bar">
        <a class="brand" routerLink="/"><span aria-hidden="true">🛒</span> SmartCart</a>
        <nav aria-label="Main">
          <a class="cart-link" routerLink="/cart" routerLinkActive="active">
            <span aria-hidden="true">🛍️</span>
            Cart
            <span class="badge" data-testid="cart-count">{{ cart.count() }}</span>
            <span class="visually-hidden">items</span>
          </a>
        </nav>
      </div>
    </header>
  `,
  styles: `
    .header {
      position: sticky;
      top: 0;
      z-index: 10;
      background: rgb(255 255 255 / 88%);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid var(--color-border);
    }
    .bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 4rem;
    }
    .brand {
      font-size: 1.375rem;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: var(--color-text);
      text-decoration: none;
    }
    .cart-link {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-4);
      border-radius: var(--radius-pill);
      color: var(--color-text);
      font-weight: 600;
      text-decoration: none;
      transition: background var(--transition);
    }
    .cart-link:hover,
    .cart-link.active {
      background: var(--color-primary-soft);
    }
    .badge {
      min-width: 1.75rem;
      padding: 0.125rem var(--space-2);
      border-radius: var(--radius-pill);
      background: var(--color-primary);
      color: var(--color-on-primary);
      font-size: 0.875rem;
      text-align: center;
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class Header {
  protected readonly cart = inject(CartStore);
}
