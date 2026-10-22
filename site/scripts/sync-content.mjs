import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO = 'https://github.com/santoshyadavdev/smartcart-workshop';

/** Published pages in sidebar order. `slug` '' is the home page. */
export const PAGES = [
	{ file: 'README.md', slug: '' },
	{ file: 'build-from-scratch.md', slug: 'build-from-scratch' },
	{ file: '00-setup.md', slug: '00-setup' },
	{ file: '01-coderabbit.md', slug: '01-coderabbit' },
	{ file: '02-unit-tests.md', slug: '02-unit-tests' },
	{ file: '03-e2e.md', slug: '03-e2e' },
	{ file: '04-ci.md', slug: '04-ci' },
	{ file: '05-deploy.md', slug: '05-deploy' },
	{ file: 'prompts.md', slug: 'prompts' },
];

/** Splits off the first `# Heading` line and returns it as the title. */
export function extractTitle(markdown) {
	const match = markdown.match(/^# (.+)\r?\n/m);
	if (!match) throw new Error('Page has no "# Title" heading');
	const body = markdown.slice(0, match.index) + markdown.slice(match.index + match[0].length);
	return { title: match[1].trim(), body: body.replace(/^\s*\n/, '') };
}

/** Maps one relative link target (as written in workshop/*.md) to its site or GitHub URL. */
export function rewriteHref(href) {
	if (/^([a-z][a-z0-9+.-]*:|\/\/|#|\/)/i.test(href)) return href;
	const [path, hash] = href.split('#');
	const anchor = hash ? `#${hash}` : '';
	const page = PAGES.find((p) => p.file === posix.normalize(path));
	if (page) return `/${page.slug ? `${page.slug}/` : ''}${anchor}`;
	const resolved = posix.normalize(posix.join('workshop', path));
	const kind = path.endsWith('/') ? 'tree' : 'blob';
	return `${REPO}/${kind}/main/${resolved.replace(/\/$/, '')}${anchor}`;
}

/** Rewrites `[text](target)` links outside fenced code blocks and inline code. */
export function rewriteLinks(markdown) {
	const parts = markdown.split(/(^(?:```|~~~)[^\n]*\n[\s\S]*?^(?:```|~~~)[ \t]*$)/m);
	return parts
		.map((part, i) => {
			if (i % 2 === 1) return part;
			return part
				.split(/(`[^`\n]*`)/)
				.map((seg, j) =>
					j % 2 === 1
						? seg
						: seg.replace(/\]\(([^)\s]+)((?:\s+"[^"]*")?)\)/g, (_, href, title) => `](${rewriteHref(href)}${title})`),
				)
				.join('');
		})
		.join('');
}

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Turns ```mermaid fences into <pre class="mermaid"> so the browser renders them instead of the code highlighter. */
export function rewriteMermaid(markdown) {
	return markdown.replace(
		/^```mermaid[ \t]*\r?\n([\s\S]*?)^```[ \t]*$/gm,
		(_, source) => `<pre class="mermaid">${escapeHtml(source.trimEnd())}</pre>`,
	);
}

/** Builds the final page: frontmatter plus the rewritten body. */
export function transformPage(markdown, { file, order }) {
	const { title, body } = extractTitle(markdown);
	const frontmatter = [
		'---',
		`title: ${JSON.stringify(title)}`,
		`editUrl: ${JSON.stringify(`${REPO}/edit/main/workshop/${file}`)}`,
		'sidebar:',
		`  order: ${order}`,
		'---',
		'',
	].join('\n');
	return frontmatter + rewriteLinks(rewriteMermaid(body));
}

async function main() {
	const here = dirname(fileURLToPath(import.meta.url));
	const source = join(here, '..', '..', 'workshop');
	const target = join(here, '..', 'src', 'content', 'docs');
	await rm(target, { recursive: true, force: true });
	await mkdir(target, { recursive: true });
	for (const [order, page] of PAGES.entries()) {
		const markdown = await readFile(join(source, page.file), 'utf8');
		const out = join(target, `${page.slug || 'index'}.md`);
		await writeFile(out, transformPage(markdown, { file: page.file, order }));
	}
	console.log(`sync-content: wrote ${PAGES.length} pages to src/content/docs`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
