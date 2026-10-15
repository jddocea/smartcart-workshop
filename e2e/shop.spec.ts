import { expect, test } from '@playwright/test';
import { gotoHydrated } from './hydration';

test.describe('shop', () => {
  test('home page lists the whole catalog', async ({ page }) => {
    await gotoHydrated(page, '/');

    await expect(page.getByTestId('product-card')).toHaveCount(20);
  });

  test('search narrows the product list', async ({ page }) => {
    await gotoHydrated(page, '/');

    await page.getByTestId('search').fill('headphones');

    await expect(page.getByTestId('product-card')).toHaveCount(3);
  });

  test('adding a product updates the cart badge and cart page', async ({ page }) => {
    await gotoHydrated(page, '/');
    const card = page.getByTestId('product-card').filter({ hasText: 'Ceramic Coffee Mug' });

    await card.getByTestId('add-to-cart').click();
    await expect(page.getByTestId('cart-count')).toHaveText('1');

    await page.getByRole('link', { name: /^Cart/ }).click();
    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.getByTestId('cart-line')).toHaveCount(1);
    await expect(page.getByTestId('cart-line')).toContainText('Ceramic Coffee Mug');
    await expect(page.getByTestId('cart-total')).toHaveText('$14.00');

    await page.reload();
    await expect(page.getByTestId('cart-line')).toHaveCount(1);
    await expect(page.getByTestId('cart-line')).toContainText('Ceramic Coffee Mug');
    await expect(page.getByTestId('cart-count')).toHaveText('1');
  });

  test('product detail page is server-rendered', async ({ page }) => {
    const response = await page.request.get('/product/wireless-headphones');
    expect(response.ok()).toBe(true);
    expect(await response.text()).toContain('Wireless Headphones');

    await gotoHydrated(page, '/product/wireless-headphones');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Wireless Headphones');
    await expect(page.getByTestId('add-to-cart')).toBeVisible();
  });
});
