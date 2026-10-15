# SmartCart Workshop — Design Spec

**Workshop:** AI-Powered Code Review, Testing & CI/CD with Angular (60 minutes)
**Repo:** `santoshyadavdev/smartcart-workshop` (public)
**Date:** 2026-10-15

## 1. Goal

Ship a fully working Angular 22 SSR e-commerce app ("SmartCart") with an agentic Gemini shopping assistant, deployed on Cloudflare Workers, plus a written guide and copy-paste prompts that let attendees, in 60 minutes:

1. Configure CodeRabbit and open PRs to see AI review in action.
2. Generate and refine Vitest unit tests and Playwright e2e tests with AI assistants (GitHub Copilot, CodeRabbit).
3. Build a GitHub Actions CI pipeline with quality gates (lint, typecheck, unit, build, e2e).
4. Deploy to production using Cloudflare Workers Builds (GitHub integration) — a guided exercise, **not** part of CI.

## 2. The App

### Stack

- Angular 22: standalone components, signals, zoneless change detection, built-in control flow.
- `@angular/ssr` on Cloudflare Workers, scaffolded with `pnpm create cloudflare@latest smartcart-workshop --framework=angular`.
- pnpm, TypeScript strict mode, ESLint (`angular-eslint`).
- `@google/genai` SDK for Gemini.

### Pages

| Route          | Content                                                                                                        |
| -------------- | -------------------------------------------------------------------------------------------------------------- |
| `/`            | Product grid, category filter, text search                                                                     |
| `/product/:id` | Product detail with "Add to cart"                                                                              |
| `/cart`        | Cart lines, quantity controls, remove, subtotal/total (client render mode, since it depends on `localStorage`) |
| all pages      | Header with cart badge; floating **Assistant** chat panel                                                      |

### Data

- `src/shared/products.ts`: 20 typed products (`id`, `name`, `description`, `category`, `price`, `emoji`, `rating`, `tags`). Shared by UI and server tools.
- `CartStore` (`src/app/cart/cart.store.ts`): signals-based (`items`, `count`, `total` computed), persisted to `localStorage` only in the browser (SSR-safe via `isPlatformBrowser` / `afterNextRender`).

### Agent: `POST /api/chat` (Server-Sent Events)

- Routed in `src/server.ts`: requests to `/api/chat` go to `handleChat(request, env)`; all other requests go to `AngularAppEngine`.
- Request body: `{ messages: { role: 'user' | 'assistant', content: string }[] }`.
- `LlmProvider` interface (`src/server/llm/provider.ts`) with `stream(messages, tools): AsyncIterable<AgentEvent>`.
  - `GeminiProvider` — `gemini-2.5-flash`, function calling, streaming. Used when `env.GEMINI_API_KEY` is set.
  - `MockProvider` — deterministic keyword-based responder that exercises the same tools and events. Used when no key is set, and always in tests/CI/e2e.
- Tools (`src/server/tools.ts`):
  - `searchProducts({ query, maxPrice?, category? })` — server-side; returns matching products.
  - `getProduct({ id })` — server-side.
  - `addToCart({ productId, quantity })` — validated server-side, emitted to the browser as an `action` event; the browser applies it to `CartStore`.
- Agent loop: model → tool call(s) → execute → feed results back → stream final text. Max 3 tool rounds.
- SSE event types (`src/shared/agent-events.ts`):
  - `text` `{ delta }` — token chunks
  - `products` `{ items: Product[] }` — rendered as inline cards
  - `action` `{ type: 'addToCart', productId, quantity }`
  - `done` `{}`
  - `error` `{ message }`

### Client

- `ChatService` (`src/app/assistant/chat.service.ts`): `fetch` + `ReadableStream` SSE parser (handles events split across chunks), exposes `messages` and `streaming` signals, dispatches `action` events to `CartStore`.
- `AssistantComponent`: chat panel, streaming text, product cards, suggestion chips ("Show me headphones under $100", "Add the cheapest mug to my cart").

### Error handling

- `SMARTCART_PROVIDER=mock` forces `MockProvider` (used by Playwright); otherwise no `GEMINI_API_KEY` → `MockProvider`, UI shows a "Demo mode" banner (via `x-smartcart-provider: mock` response header).
- Gemini/network failure → `error` event, friendly message in chat, input re-enabled.
- Invalid tool args (unknown product, quantity < 1 or > 10) → tool returns an error result to the model; no action emitted.
- API key never sent to the browser.

## 3. Quality Tooling

### Unit tests — Vitest

- Angular CLI's `@angular/build:unit-test` builder with the Vitest runner; `pnpm test`, coverage via v8 (`pnpm test:coverage`).
- Coverage targets: `CartStore`, product filtering, `MockProvider`, tool handlers, SSE parser (including chunks split mid-event), `handleChat` with an injected fake provider, `AssistantComponent` rendering.

### E2E — Playwright

- Runs against the production build served locally with the mock provider forced (no key).
- Specs:
  1. Browse → add to cart → cart total is correct.
  2. Assistant streams a reply and renders product cards.
  3. "Add the cheapest mug to my cart" via chat updates cart badge.
  4. `page.route` simulates API error → friendly error message.
  5. `page.route` fulfils a stream that errors mid-way → partial text kept and error shown.
- HTML report uploaded as a CI artifact.

### CodeRabbit — `.coderabbit.yaml`

- `reviews.profile: assertive`, auto-review on PRs, high-level summary, sequence diagrams.
- `path_instructions`:
  - `src/app/**` — prefer signals, standalone, `inject()`, OnPush/zoneless-safe code, no direct `window`/`localStorage` without platform checks.
  - `src/server/**` — never expose secrets, validate tool inputs, every change needs tests.
  - `**/*.spec.ts`, `e2e/**` — meaningful assertions, no arbitrary timeouts.
- `reviews.tools.eslint.enabled: true`.

### CI — `.github/workflows/ci.yml`

- Triggers: `pull_request`, `push` to `main`.
- Jobs: `quality` (install with pnpm cache → lint → typecheck → unit + coverage → build) and `e2e` (needs build; install Playwright Chromium → run → upload report).
- Branch protection (guide step): require `quality` and `e2e` checks + CodeRabbit review before merge.
- **No deploy job.**

### Deploy — Cloudflare Workers Builds (guide exercise)

- Connect the GitHub repo in Cloudflare dashboard → Workers & Pages → Import repository.
- Build command `pnpm run build`, deploy command `pnpm wrangler deploy`.
- Add `GEMINI_API_KEY` as a secret (optional; mock mode works without it).
- Enable non-production branch builds to get PR preview URLs.

## 4. Workshop Package

### Checkpoint branches

| Branch              | Contents                                        | Module (min)                                    |
| ------------------- | ----------------------------------------------- | ----------------------------------------------- |
| `step-0-start`      | Working app; no tests, CI, or CodeRabbit config | 0. Setup & tour (5)                             |
| `step-1-coderabbit` | + `.coderabbit.yaml`                            | 1. CodeRabbit + seeded-bug PR (12)              |
| `step-2-unit-tests` | + Vitest specs                                  | 2. AI-generated unit tests (13)                 |
| `step-3-e2e`        | + Playwright config & specs                     | 3. E2E incl. streaming (12)                     |
| `step-4-ci`         | + GitHub Actions workflow                       | 4. CI quality gates (10)                        |
| `main`              | Final (identical to step-4 + deploy docs)       | 5. Deploy via Cloudflare GitHub integration (8) |

Each branch is cumulative. Attendees who fall behind run `git checkout step-N`.

### `workshop/` folder

- `README.md` — overview, prerequisites (Node 22+, pnpm, GitHub account, CodeRabbit GitHub app, Copilot, optional Gemini key, Cloudflare account), timeline, how to use checkpoint branches.
- `00-setup.md`, `01-coderabbit.md`, `02-unit-tests.md`, `03-e2e.md`, `04-ci.md`, `05-deploy.md` — each with goal, steps, **copy-paste AI prompts**, expected result, stuck? → checkpoint.
- `prompts.md` — all prompts in one place.
- Seeded-bug exercise (Module 1): attendees create branch `feat/bulk-discount` applying a provided patch that introduces a bug (cart total ignores quantity on discounted items and reads `localStorage` without a platform check), open a PR, and review CodeRabbit's findings, then use `@coderabbitai` chat commands (e.g. `@coderabbitai generate unit tests`).

## 5. Success Criteria

- `pnpm install && pnpm start` runs the app; assistant works in mock mode with no key and with Gemini when a key is set.
- `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm e2e` all pass on `main`.
- CI passes on GitHub for `main`.
- Each checkpoint branch builds and runs.
- The app deploys to Cloudflare Workers via `pnpm wrangler deploy`.
- Guide modules fit the 60-minute timeline.

## 6. Out of Scope

Auth, payments/checkout, database, admin UI, i18n, deploy in CI.
