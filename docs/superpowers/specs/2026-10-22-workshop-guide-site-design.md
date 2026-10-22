# Workshop guide site: design

## Goal

Publish the workshop content as a hosted docs site that attendees can follow during the live session and at home. Each page gets copy buttons, and progress is saved in the browser.

## Decisions

| Topic       | Decision                                                                                                 |
| ----------- | -------------------------------------------------------------------------------------------------------- |
| Style       | Docs site: a sidebar of steps, copy buttons, progress checkboxes stored in `localStorage`                |
| Framework   | Astro Starlight                                                                                          |
| Location    | A `site/` folder on `main` in `santoshyadavdev/smartcart-workshop`, as a pnpm workspace package          |
| Hosting     | A Cloudflare Worker with static assets only, named `smartcart-workshop-guide`, served on `*.workers.dev` |
| Deploy      | `.github/workflows/site.yml` runs `wrangler deploy` on pushes to `main`                                  |
| Facilitator | `workshop/facilitator-notes.md` is **not** published                                                     |

## Content source

The single source of truth stays `workshop/*.md`, which also renders on GitHub. The site never keeps its own copy in git.

`site/scripts/sync-content.mjs` runs before `dev` and `build`. It writes to `site/src/content/docs/`, which is gitignored, and does the following:

1. Copies these pages in this order: `README.md`, `build-from-scratch.md`, `00-setup.md`, `01-coderabbit.md`, `02-unit-tests.md`, `03-e2e.md`, `04-ci.md`, `05-deploy.md`, `prompts.md`. `README.md` becomes `index.md`.
2. Removes the first `# Heading` and writes it as frontmatter: `title`, plus `sidebar.order` taken from the list above.
3. Rewrites relative links:
   - `./NN-name.md` or `NN-name.md`, with an optional `#anchor`, becomes `/NN-name/#anchor`. `README.md` becomes `/`.
   - A link to `facilitator-notes.md` becomes its GitHub URL.
   - Any other relative path, such as `patches/…`, `../src/…`, `../README.md` or `../.coderabbit.yaml`, becomes `https://github.com/santoshyadavdev/smartcart-workshop/blob/main/<resolved path>`. A path that ends in `/` uses `tree/` instead of `blob/`.
   - Absolute URLs and pure `#anchor` links stay as they are.
4. Leaves links inside fenced code blocks and inline code untouched.

The transform functions (`extractTitle`, `rewriteLinks`) are pure, exported, and unit tested.

## Site features

- **From Starlight:** search (Pagefind), dark mode, copy buttons on code blocks, previous/next links.
- **Edit link:** each page has an "Edit page" link to `workshop/<file>.md` on GitHub, set with the `editLink.baseUrl` frontmatter per page.
- **Interactive checklists:** a client script finds Markdown task-list checkboxes, enables them, and saves the ticked state in `localStorage` under `sc-guide:<path>:<index>`.
- **Mark step complete:** a button at the bottom of each page stores `sc-guide:done:<path>`. The sidebar entries of finished pages show a ✓.
- **Reset progress:** a button clears all `sc-guide:*` keys.
- These features are a Starlight component override (`Footer`) plus one client script. They use no other dependencies.
- **Site title:** "SmartCart Workshop". Social link to the GitHub repo.

## Hosting and CI

- **`site/wrangler.jsonc`:** worker `smartcart-workshop-guide`, `assets.directory: ./dist`, `compatibility_date` matching the app. No Worker script.
- **`.github/workflows/site.yml`:**
  - triggers on `pull_request` and on `push` to `main`, both limited to `site/**`, `workshop/**` and the workflow file
  - one `build` job: checkout, pnpm, Node 24, `pnpm install --frozen-lockfile`, then `pnpm --filter smartcart-workshop-guide test`, `build` and `e2e`
  - a `deploy` job that runs only on `push` to `main` after `build`, using `cloudflare/wrangler-action` with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`
  - If those secrets are missing, the deploy step is skipped with a notice and doesn't fail.
- **First deploy:** run locally with the facilitator's wrangler login.
- **Repo docs:** the root `README.md` and `workshop/README.md` link to the live URL.

## Testing

- **Vitest:** `site/scripts/sync-content.test.mjs` covers title extraction, each link-rewrite rule, code blocks left untouched, and the facilitator link.
- **Build:** `astro build` fails on content errors. A link check (`starlight-links-validator`) fails the build on broken internal links.
- **Playwright smoke test** against `astro preview`. It checks that:
  - the home page renders the sidebar with every step
  - a step page has a copy button on code blocks
  - a ticked checklist item on `/02-unit-tests/` is still ticked after a reload
  - "Mark step complete" shows ✓ in the sidebar

## Workspace impact

- `pnpm-workspace.yaml` gains `packages: ['.', 'site']`. The root lockfile covers both packages.
- The app's lint, typecheck, unit tests and e2e are scoped to `src/` and `e2e/`, so they don't change.
- Step branches don't get the site. It lives only on `main`.

## Out of scope

User accounts, server-side progress, per-branch sites, custom domain.
