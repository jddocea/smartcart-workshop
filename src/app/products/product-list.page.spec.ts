import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CartStore } from '../cart/cart.store';
import { ProductListPage } from './product-list.page';

describe('ProductListPage', () => {
  let fixture: ComponentFixture<ProductListPage>;
  let element: HTMLElement;

  const cards = () => element.querySelectorAll('[data-testid="product-card"]');

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    fixture = TestBed.createComponent(ProductListPage);
    element = fixture.nativeElement;
    await fixture.whenStable();
  });

  it('renders the whole catalog', () => {
    expect(cards().length).toBe(20);
  });

  it('filters by the search query', async () => {
    const search = element.querySelector<HTMLInputElement>('[data-testid="search"]')!;
    search.value = 'headphones';
    search.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(cards().length).toBe(3);
  });

  it('filters by category chip', async () => {
    const chip = [
      ...element.querySelectorAll<HTMLButtonElement>('[data-testid="category-chip"]'),
    ].find((button) => button.textContent?.trim() === 'Kitchen')!;
    chip.click();
    await fixture.whenStable();

    expect(chip.getAttribute('aria-pressed')).toBe('true');
    expect(cards().length).toBe(5);
    for (const card of cards()) expect(card.textContent?.toLowerCase()).toContain('kitchen');
  });

  it('shows the empty state when nothing matches', async () => {
    const search = element.querySelector<HTMLInputElement>('[data-testid="search"]')!;
    search.value = 'unobtainium';
    search.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(cards().length).toBe(0);
    expect(element.textContent).toContain('No products match your filters.');
  });

  it('filters by maximum price', async () => {
    const select = element.querySelector<HTMLSelectElement>('[data-testid="max-price"]')!;
    select.value = '25';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    const prices = [...cards()].map((card) =>
      Number(card.querySelector('.price')?.textContent?.replace(/[^0-9.]/g, '')),
    );
    expect(prices.length).toBeGreaterThan(0);
    expect(prices.every((price) => price <= 25)).toBe(true);
  });

  it('adds a product to the cart', async () => {
    const cart = TestBed.inject(CartStore);
    element.querySelector<HTMLButtonElement>('[data-testid="add-to-cart"]')!.click();
    await fixture.whenStable();

    expect(cart.count()).toBe(1);
  });
});
