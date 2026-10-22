import { describe, expect, it } from 'vitest';
import { extractTitle, REPO, rewriteHref, rewriteLinks, rewriteMermaid, transformPage } from './sync-content.mjs';

describe('extractTitle', () => {
	it('returns the first H1 and removes it from the body', () => {
		expect(extractTitle('# 00 · Setup\n\nHello\n')).toEqual({ title: '00 · Setup', body: 'Hello\n' });
	});

	it('ignores H2 headings', () => {
		expect(extractTitle('## Not me\n# Me\nbody').title).toBe('Me');
	});

	it('throws when there is no H1', () => {
		expect(() => extractTitle('no heading')).toThrow(/no "# Title"/);
	});
});

describe('rewriteHref', () => {
	it('maps workshop pages to site routes', () => {
		expect(rewriteHref('01-coderabbit.md')).toBe('/01-coderabbit/');
		expect(rewriteHref('./01-coderabbit.md')).toBe('/01-coderabbit/');
	});

	it('keeps anchors', () => {
		expect(rewriteHref('prompts.md#41-workflow')).toBe('/prompts/#41-workflow');
	});

	it('maps README.md to the home page', () => {
		expect(rewriteHref('README.md#prerequisites')).toBe('/#prerequisites');
	});

	it('sends unpublished pages and repo files to GitHub', () => {
		expect(rewriteHref('facilitator-notes.md')).toBe(`${REPO}/blob/main/workshop/facilitator-notes.md`);
		expect(rewriteHref('patches/bulk-discount.patch')).toBe(`${REPO}/blob/main/workshop/patches/bulk-discount.patch`);
		expect(rewriteHref('../src/server/tools.ts')).toBe(`${REPO}/blob/main/src/server/tools.ts`);
		expect(rewriteHref('../e2e/')).toBe(`${REPO}/tree/main/e2e`);
	});

	it('leaves absolute URLs, root paths and pure anchors alone', () => {
		for (const href of ['https://example.com/a.md', 'mailto:a@b.c', '#top', '/already/']) {
			expect(rewriteHref(href)).toBe(href);
		}
	});
});

describe('rewriteLinks', () => {
	it('rewrites links in prose', () => {
		expect(rewriteLinks('See [setup](00-setup.md) and [p](prompts.md "Prompts").')).toBe(
			'See [setup](/00-setup/) and [p](/prompts/ "Prompts").',
		);
	});

	it('leaves fenced code blocks untouched', () => {
		const md = 'a [x](00-setup.md)\n\n```md\n[x](00-setup.md)\n```\n\nb';
		expect(rewriteLinks(md)).toBe('a [x](/00-setup/)\n\n```md\n[x](00-setup.md)\n```\n\nb');
	});

	it('leaves inline code untouched', () => {
		expect(rewriteLinks('`[x](00-setup.md)` [y](04-ci.md)')).toBe('`[x](00-setup.md)` [y](/04-ci/)');
	});
});

describe('rewriteMermaid', () => {
	it('turns mermaid fences into escaped <pre class="mermaid"> blocks', () => {
		const md = 'before\n\n```mermaid\nflowchart LR\n  A[a<br/>b] --> B\n```\n\nafter';
		expect(rewriteMermaid(md)).toBe(
			'before\n\n<pre class="mermaid">flowchart LR\n  A[a&lt;br/&gt;b] --&gt; B</pre>\n\nafter',
		);
	});

	it('leaves other code fences alone', () => {
		const md = '```ts\nconst a = 1 < 2;\n```';
		expect(rewriteMermaid(md)).toBe(md);
	});
});

describe('transformPage', () => {
	it('adds title, edit link and sidebar order as frontmatter', () => {
		const out = transformPage('# 04 · CI\n\nGo to [deploy](05-deploy.md).\n', { file: '04-ci.md', order: 6 });
		expect(out).toBe(
			[
				'---',
				'title: "04 · CI"',
				`editUrl: "${REPO}/edit/main/workshop/04-ci.md"`,
				'sidebar:',
				'  order: 6',
				'---',
				'Go to [deploy](/05-deploy/).',
				'',
			].join('\n'),
		);
	});
});
