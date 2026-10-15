import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CartStore } from '../cart/cart.store';
import { ProductDetailPage } from './product-detail.page';

describe('ProductDetailPage', () => {
  let fixture: ComponentFixture<ProductDetailPage>;
  let element: HTMLElement;

  async function render(id: string) {
    fixture.componentRef.setInput('id', id);
    await fixture.whenStable();
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    fixture = TestBed.createComponent(ProductDetailPage);
    element = fixture.nativeElement;
  });

  it('shows the product details', async () => {
    await render('wireless-headphones');

    expect(element.querySelector('h1')?.textContent).toContain('Wireless Headphones');
    expect(element.textContent).toContain('$89.00');
    expect(element.textContent).toContain('#bluetooth');
  });

  it('shows a not-found state for an unknown id', async () => {
    await render('does-not-exist');

    expect(element.querySelector('[data-testid="not-found"]')?.textContent).toContain(
      'Product not found',
    );
    expect(element.querySelector('[data-testid="add-to-cart"]')).toBeNull();
  });

  it('adds the selected quantity to the cart', async () => {
    await render('ceramic-coffee-mug');
    const select = element.querySelector<HTMLSelectElement>('[data-testid="quantity"]')!;
    select.value = '3';
    select.dispatchEvent(new Event('change'));
    element.querySelector<HTMLButtonElement>('[data-testid="add-to-cart"]')!.click();
    await fixture.whenStable();

    const cart = TestBed.inject(CartStore);
    expect(cart.lines()).toEqual([
      { product: expect.objectContaining({ id: 'ceramic-coffee-mug' }), quantity: 3 },
    ]);
    expect(element.textContent).toContain('Added 3 to your cart');
  });
});
