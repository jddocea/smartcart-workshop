import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { findProduct } from '../../shared/products';
import { CartPage } from './cart.page';
import { CartStore } from './cart.store';

describe('CartPage', () => {
  let fixture: ComponentFixture<CartPage>;
  let element: HTMLElement;
  let cart: CartStore;

  const query = (testId: string) => element.querySelector<HTMLElement>(`[data-testid="${testId}"]`);

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    cart = TestBed.inject(CartStore);
    fixture = TestBed.createComponent(CartPage);
    element = fixture.nativeElement;
  });

  it('shows the empty state', async () => {
    await fixture.whenStable();

    expect(query('cart-empty')?.textContent).toContain('Your cart is empty.');
    expect(element.querySelectorAll('[data-testid="cart-line"]').length).toBe(0);
  });

  describe('with lines', () => {
    beforeEach(async () => {
      cart.add(findProduct('ceramic-coffee-mug')!, 2);
      cart.add(findProduct('wireless-headphones')!);
      await fixture.whenStable();
    });

    it('lists each line and the total', () => {
      expect(element.querySelectorAll('[data-testid="cart-line"]').length).toBe(2);
      expect(query('cart-total')?.textContent).toContain('$117.00');
    });

    it('changes quantity with the stepper', async () => {
      query('increment')!.click();
      await fixture.whenStable();
      expect(query('quantity')?.textContent?.trim()).toBe('3');
      expect(query('cart-total')?.textContent).toContain('$131.00');

      query('decrement')!.click();
      await fixture.whenStable();
      expect(cart.lines()[0].quantity).toBe(2);
    });

    it('removes a line when decremented below one', async () => {
      cart.setQuantity('ceramic-coffee-mug', 1);
      await fixture.whenStable();
      query('decrement')!.click();
      await fixture.whenStable();

      expect(element.querySelectorAll('[data-testid="cart-line"]').length).toBe(1);
    });

    it('clears the cart', async () => {
      query('clear-cart')!.click();
      await fixture.whenStable();

      expect(cart.count()).toBe(0);
      expect(query('cart-empty')).not.toBeNull();
    });
  });
});
