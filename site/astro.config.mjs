// @ts-check
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
import starlightLinksValidator from 'starlight-links-validator';

const REPO = 'https://github.com/santoshyadavdev/smartcart-workshop';

export default defineConfig({
	integrations: [
		starlight({
			title: 'SmartCart Workshop',
			description: 'AI-Powered Code Review, Testing & CI/CD with Angular',
			social: [{ icon: 'github', label: 'GitHub', href: REPO }],
			plugins: [starlightLinksValidator({ errorOnLocalLinks: false })],
			customCss: ['./src/styles/custom.css'],
			components: { Footer: './src/components/Footer.astro' },
			sidebar: [
				{ label: 'Start here', slug: 'index' },
				{ label: 'Pre-work: build from scratch', slug: 'build-from-scratch' },
				{
					label: 'Workshop',
					items: ['00-setup', '01-coderabbit', '02-unit-tests', '03-e2e', '04-ci', '05-deploy'],
				},
				{ label: 'Prompts', slug: 'prompts' },
			],
		}),
	],
});
