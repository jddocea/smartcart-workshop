import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { findProduct } from '../shared/products';
import { App } from './app';
import { CartStore } from './cart/cart.store';

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ imports: [App], providers: [provideRouter([])] });
  });

  it('renders the brand linking home and the assistant toggle', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    const brand = element.querySelector<HTMLAnchorElement>('a.brand');
    expect(brand?.textContent).toContain('SmartCart');
    expect(brand?.getAttribute('href')).toBe('/');
    expect(element.querySelector('[data-testid="assistant-toggle"]')).not.toBeNull();
  });

  it('shows the live cart count in the header', async () => {
    const fixture = TestBed.createComponent(App);
    const count = () =>
      (fixture.nativeElement as HTMLElement).querySelector('[data-testid="cart-count"]')
        ?.textContent;
    await fixture.whenStable();
    expect(count()?.trim()).toBe('0');

    TestBed.inject(CartStore).add(findProduct('ceramic-coffee-mug')!, 2);
    await fixture.whenStable();
    expect(count()?.trim()).toBe('2');
  });
});
