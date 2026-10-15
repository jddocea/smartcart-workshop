import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Product } from '../../shared/product';
import { findProduct } from '../../shared/products';
import { CART_STORAGE_KEY, CartStore, MAX_QUANTITY } from './cart.store';

const mug = findProduct('ceramic-coffee-mug')!;
const headphones = findProduct('wireless-headphones')!;
const pricedHeadphones: Product = { ...headphones, price: 89.99 };

function createStore(platformId = 'browser'): CartStore {
  TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: platformId }] });
  return TestBed.inject(CartStore);
}

function storedCart(): unknown {
  const raw = localStorage.getItem(CART_STORAGE_KEY);
  return raw === null ? null : JSON.parse(raw);
}

describe('CartStore', () => {
  beforeEach(() => localStorage.clear());

  it('adds products and merges repeated adds into one line', () => {
    const store = createStore();

    store.add(mug);
    store.add(mug, 2);

    expect(store.lines()).toEqual([{ product: mug, quantity: 3 }]);
  });

  it('caps quantity at MAX_QUANTITY', () => {
    const store = createStore();

    store.add(mug, 8);
    store.add(mug, 5);
    expect(store.lines()[0].quantity).toBe(MAX_QUANTITY);

    store.setQuantity(mug.id, 99);
    expect(store.lines()[0].quantity).toBe(MAX_QUANTITY);
  });

  it('removes a line when its quantity is set to 0', () => {
    const store = createStore();
    store.add(mug, 2);

    store.setQuantity(mug.id, 0);

    expect(store.lines()).toEqual([]);
  });

  it('removes a line', () => {
    const store = createStore();
    store.add(mug);
    store.add(headphones);

    store.remove(mug.id);

    expect(store.lines().map((line) => line.product.id)).toEqual([headphones.id]);
  });

  it('clears all lines', () => {
    const store = createStore();
    store.add(mug);
    store.add(headphones);

    store.clear();

    expect(store.lines()).toEqual([]);
    expect(store.count()).toBe(0);
  });

  it('computes count and a rounded total', () => {
    const store = createStore();

    store.add(mug, 3);
    store.add(pricedHeadphones);

    expect(store.count()).toBe(4);
    expect(store.total()).toBe(131.99);
  });

  it('adds by id and rejects unknown ids', () => {
    const store = createStore();

    expect(store.addById(mug.id, 2)).toBe(true);
    expect(store.addById('does-not-exist')).toBe(false);
    expect(store.lines()).toEqual([{ product: mug, quantity: 2 }]);
  });

  it('persists the cart to localStorage', () => {
    const store = createStore();

    store.add(mug, 2);
    TestBed.tick();

    expect(storedCart()).toEqual([{ productId: mug.id, quantity: 2 }]);
  });

  it('restores the cart from localStorage, skipping unknown ids', () => {
    localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify([
        { productId: mug.id, quantity: 3 },
        { productId: 'does-not-exist', quantity: 1 },
      ]),
    );

    const store = createStore();

    expect(store.lines()).toEqual([{ product: mug, quantity: 3 }]);
  });

  it('ignores corrupt storage', () => {
    localStorage.setItem(CART_STORAGE_KEY, '{not json');

    const store = createStore();

    expect(store.lines()).toEqual([]);
  });

  it('does not touch localStorage on the server', () => {
    const store = createStore('server');

    store.add(mug);
    TestBed.tick();

    expect(localStorage.getItem(CART_STORAGE_KEY)).toBeNull();
  });
});
