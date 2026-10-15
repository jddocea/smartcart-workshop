import { expect, Page, test } from '@playwright/test';
import { gotoHydrated } from './hydration';

const sse = (...events: object[]) => events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('');

async function openAssistant(page: Page): Promise<void> {
  await gotoHydrated(page, '/');
  await page.getByTestId('assistant-toggle').click();
  await expect(page.getByTestId('assistant-input')).toBeFocused();
}

async function ask(page: Page, text: string): Promise<void> {
  await page.getByTestId('assistant-input').fill(text);
  await page.getByTestId('assistant-send').click();
}

const lastReply = (page: Page) =>
  page.locator('[data-testid="assistant-message"][data-role="assistant"]').last();

test.describe('shopping assistant', () => {
  test('finds products matching a request', async ({ page }) => {
    await openAssistant(page);

    await ask(page, 'show me headphones under $100');

    await expect(lastReply(page).getByTestId('assistant-product')).toHaveCount(2);
    await expect(page.getByTestId('demo-banner')).toBeVisible();
  });

  test('adds a product to the cart', async ({ page }) => {
    await openAssistant(page);

    await ask(page, 'add the cheapest mug to my cart');

    await expect(page.getByTestId('cart-count')).toHaveText('1');
    await expect(lastReply(page)).toContainText('Ceramic Coffee Mug');
  });

  test('shows an error when the server fails', async ({ page }) => {
    await page.route('**/api/chat', (route) => route.fulfill({ status: 500, body: 'boom' }));
    await openAssistant(page);

    await ask(page, 'hello');

    await expect(page.getByTestId('assistant-error')).toBeVisible();
    await expect(page.getByTestId('assistant-error')).toContainText('Sorry, something went wrong');
  });

  test('keeps partial text when the stream errors', async ({ page }) => {
    await page.route('**/api/chat', (route) =>
      route.fulfill({
        contentType: 'text/event-stream',
        body: sse(
          { type: 'text', delta: 'Partial answer' },
          { type: 'error', message: 'Stream interrupted' },
          { type: 'done' },
        ),
      }),
    );
    await openAssistant(page);

    await ask(page, 'hello');

    await expect(lastReply(page)).toContainText('Partial answer');
    await expect(lastReply(page).getByTestId('assistant-error')).toHaveText('Stream interrupted');
  });

  test('disables send while a reply is streaming', async ({ page }) => {
    await page.route('**/api/chat', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      await route.fulfill({
        contentType: 'text/event-stream',
        body: sse({ type: 'text', delta: 'All done' }, { type: 'done' }),
      });
    });
    await openAssistant(page);

    await ask(page, 'hello');
    await page.getByTestId('assistant-input').fill('another question');
    await expect(page.getByTestId('assistant-send')).toBeDisabled();
    await expect(page.getByTestId('typing-indicator')).toBeVisible();

    await expect(lastReply(page)).toContainText('All done');
    await expect(page.getByTestId('assistant-send')).toBeEnabled();
  });
});
