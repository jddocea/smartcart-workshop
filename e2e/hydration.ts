import { expect, Page } from '@playwright/test';

/**
 * Navigates to a server-rendered page and waits until Angular has hydrated it.
 * Angular strips the `ngh` attribute from each component as it hydrates, so once none are left
 * the event listeners are attached and clicks are safe.
 */
export async function gotoHydrated(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await expect(page.locator('[ngh]')).toHaveCount(0);
}
