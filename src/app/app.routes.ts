import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    title: 'SmartCart',
    loadComponent: () => import('./products/product-list.page').then((m) => m.ProductListPage),
  },
  {
    path: 'product/:id',
    title: 'Product · SmartCart',
    loadComponent: () => import('./products/product-detail.page').then((m) => m.ProductDetailPage),
  },
  {
    path: 'cart',
    title: 'Your cart · SmartCart',
    loadComponent: () => import('./cart/cart.page').then((m) => m.CartPage),
  },
  { path: '**', redirectTo: '' },
];
