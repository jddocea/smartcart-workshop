import { expect, test } from '@playwright/test';

const STEPS = ['00 · Setup', '01 · AI code review', '02 · AI-assisted unit tests', '03 · E2E tests', '04 · CI', '05 · Deploy'];

test('home page lists every workshop step in the sidebar', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(/AI-Powered Code Review/);
	const sidebar = page.locator('nav.sidebar');
	for (const step of STEPS) await expect(sidebar.getByRole('link', { name: new RegExp(step) })).toBeVisible();
});

test('code blocks have a copy button', async ({ page }) => {
	await page.goto('/00-setup/');
	await expect(page.getByRole('button', { name: /copy/i }).first()).toBeAttached();
});

test('mermaid diagrams render as SVG', async ({ page }) => {
	await page.goto('/00-setup/');
	await expect(page.locator('pre.mermaid svg')).toBeVisible();
});

test('checklist ticks survive a reload', async ({ page }) => {
	await page.goto('/02-unit-tests/');
	const box = page.locator('.sl-markdown-content input[type="checkbox"]').first();
	await expect(box).toBeEnabled();
	await box.check();
	await page.reload();
	await expect(box).toBeChecked();
});

test('marking a step complete shows a tick in the sidebar until progress is reset', async ({ page }) => {
	await page.goto('/03-e2e/');
	const sidebarLink = page.locator('nav.sidebar a[href="/03-e2e/"]');
	await expect(sidebarLink).not.toHaveClass(/sc-complete/);
	await page.getByRole('button', { name: 'Mark step complete' }).click();
	await expect(page.getByRole('button', { name: '✓ Step complete' })).toBeVisible();
	await expect(sidebarLink).toHaveClass(/sc-complete/);

	await page.goto('/');
	await expect(page.locator('nav.sidebar a[href="/03-e2e/"]')).toHaveClass(/sc-complete/);

	await page.getByRole('button', { name: 'Reset all progress' }).click();
	await expect(page.locator('nav.sidebar a[href="/03-e2e/"]')).not.toHaveClass(/sc-complete/);
});
