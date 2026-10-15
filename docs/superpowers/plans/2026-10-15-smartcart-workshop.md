# SmartCart Workshop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a fully working Angular 22 SSR e-commerce app (SmartCart) with an agentic Gemini shopping assistant on Cloudflare Workers, plus a 60‑minute workshop guide (CodeRabbit → Vitest → Playwright → GitHub Actions → Cloudflare deploy) with checkpoint branches.

**Architecture:** One Cloudflare Worker serves Angular SSR (`AngularAppEngine`) and an SSE endpoint `POST /api/chat`, routed in `src/server.ts`. The agent loop lives in `src/server/` behind an `LlmProvider` interface with two implementations: Gemini (`@google/genai`, function calling, max 3 tool rounds) and a deterministic Mock (used when no key or `SMARTCART_PROVIDER=mock`). Tools run server-side; cart mutations are streamed to the client as `action` events and applied by a signal-based `CartStore`.

**Tech Stack:** Angular ^22.2 (zoneless, signals, SSR), TypeScript ~6.0 strict, Vitest 5 via `ng test` (jsdom), Playwright, angular-eslint, wrangler 4, `@google/genai`, pnpm 10, GitHub Actions, CodeRabbit.

---

## File structure

```
smartcart-workshop/
├─ .coderabbit.yaml                    # Task 14
├─ .github/workflows/ci.yml            # Task 15
├─ .dev.vars.example                   # Task 1
├─ playwright.config.ts                # Task 13
├─ e2e/{tsconfig.json,shop.spec.ts,assistant.spec.ts}
├─ src/
│  ├─ server.ts                        # Task 9 – routing /api/chat vs SSR
│  ├─ shared/
│  │  ├─ product.ts  products.ts  product-filter.ts(+spec)   # Task 2
│  │  └─ agent-events.ts                                      # Task 4
│  ├─ server/
│  │  ├─ env.ts  sse.ts                                       # Task 4
│  │  ├─ tools.ts(+spec)                                      # Task 5
│  │  ├─ chat-handler.ts(+spec)                               # Task 8
│  │  └─ llm/{provider.ts, mock-provider.ts(+spec), gemini-provider.ts(+spec), select-provider.ts(+spec)}
│  └─ app/
│     ├─ app.ts app.config.ts app.routes.ts app.routes.server.ts
│     ├─ cart/{cart.store.ts(+spec), cart-page.ts}
│     ├─ products/{product-list-page.ts, product-card.ts, product-detail-page.ts}
│     └─ assistant/{sse-parser.ts(+spec), chat.service.ts(+spec), assistant.ts(+spec)}
└─ workshop/{README.md, 00-setup.md … 05-deploy.md, prompts.md, patches/bulk-discount.patch}
```

## Contracts (all tasks must use these exact names)

```ts
// src/shared/product.ts
export type Category = 'audio' | 'kitchen' | 'home' | 'fitness' | 'accessories';
export interface Product { id: string; name: string; description: string; category: Category; price: number; emoji: string; rating: number; tags: string[]; }

// src/shared/product-filter.ts
export interface ProductFilter { query?: string; category?: Category | 'all'; maxPrice?: number; }
export function filterProducts(products: readonly Product[], filter: ProductFilter): Product[];

// src/shared/agent-events.ts
export type AgentEvent =
  | { type: 'text'; delta: string }
  | { type: 'products'; items: Product[] }
  | { type: 'action'; action: 'addToCart'; productId: string; quantity: number }
  | { type: 'error'; message: string }
  | { type: 'done' };
export interface ChatMessage { role: 'user' | 'assistant'; content: string; }

// src/server/env.ts
export interface SmartCartEnv { GEMINI_API_KEY?: string; GEMINI_MODEL?: string; SMARTCART_PROVIDER?: string; }

// src/server/sse.ts
export function encodeSse(event: AgentEvent): string; // `data: ${JSON.stringify(event)}\n\n`

// src/server/tools.ts
export interface ToolResult { response: Record<string, unknown>; events: AgentEvent[]; }
export function executeTool(name: string, args: Record<string, unknown>): ToolResult;

// src/server/llm/provider.ts
export interface LlmProvider { readonly name: 'gemini' | 'mock'; run(messages: ChatMessage[]): AsyncIterable<AgentEvent>; }

// src/server/chat-handler.ts
export function handleChat(request: Request, env: SmartCartEnv, createProviderFn?: (env: SmartCartEnv) => LlmProvider): Promise<Response>;
```

---

### Task 1: Scaffold and tooling

**Files:** whole repo root (scaffold), `tsconfig.json`, `package.json`, `.gitignore`, `.dev.vars.example`

- [ ] Scaffold into a temp dir and copy over (repo dir already has `docs/`): `pnpm create cloudflare@latest smartcart-tmp --framework=angular --no-deploy --no-git`, then `rsync -a --exclude node_modules smartcart-tmp/ smartcart-workshop/`, `pnpm install`.
- [ ] Set `"strict": true` in `tsconfig.json` `compilerOptions`; add `"name": "smartcart-workshop"`.
- [ ] `pnpm ng add angular-eslint --skip-confirmation`; `pnpm add @google/genai`; `pnpm add -D @vitest/coverage-v8@^5 @playwright/test`.
- [ ] Scripts: `"test": "ng test --watch=false"`, `"test:watch": "ng test"`, `"test:coverage": "ng test --watch=false --coverage"`, `"typecheck": "tsc --noEmit -p tsconfig.app.json && tsc --noEmit -p tsconfig.spec.json && tsc --noEmit -p e2e/tsconfig.json"`, `"e2e": "pnpm build && playwright test"`.
- [ ] `.gitignore` add: `.dev.vars*`, `!.dev.vars.example`, `coverage/`, `playwright-report/`, `test-results/`, `.wrangler/`.
- [ ] `.dev.vars.example`: `GEMINI_API_KEY=your-key-here` and `# SMARTCART_PROVIDER=mock`.
- [ ] Verify `pnpm build && pnpm test && pnpm lint` pass. Commit `chore: scaffold Angular SSR app on Cloudflare Workers`.

### Task 2: Product model, catalog, filter (TDD)

- [ ] Write `product-filter.spec.ts`: empty filter returns all; query `"headphones"` matches 3 headphone products case-insensitively; multi-token `"travel mug"` requires all tokens; `category: 'kitchen'` filters; `'all'` no-op; `maxPrice: 100` inclusive.
- [ ] Run `pnpm test` → FAIL. Implement `product.ts`, `products.ts` (20 products incl. `wireless-headphones` $89, `kids-headphones` $35, `noise-cancelling-headphones` $249, `sport-earbuds` $59, `ceramic-coffee-mug` $14, `insulated-travel-mug` $24; `findProduct(id)`), `product-filter.ts` (haystack = name+description+tags+category lowercased; each whitespace token must be a substring).
- [ ] PASS. Commit `feat: product catalog and filtering`.

### Task 3: CartStore (TDD)

- [ ] Spec: add increments existing line; quantity capped at 10; `setQuantity(id, 0)` removes; `total` rounds to 2 dp; `count` sums quantities; `addById` with unknown id is no-op; persists to `localStorage['smartcart.cart.v1']` as `[{productId,quantity}]` and restores on construction (browser platform).
- [ ] Implement `@Injectable({providedIn:'root'})` with private `signal<CartLine[]>`, `computed` count/total, `effect` for persistence guarded by `isPlatformBrowser`.
- [ ] PASS. Commit `feat: signal-based cart store`.

### Task 4: AgentEvents, env, SSE encoder

- [ ] Create `agent-events.ts`, `env.ts`, `sse.ts` per contracts; trivial spec for `encodeSse`. Commit `feat: agent event contract and SSE encoder`.

### Task 5: Tools (TDD)

- [ ] Spec: `searchProducts({query:'headphones', maxPrice:100})` → response `{products:[…2 summaries]}` + one `products` event; max 5 results; `getProduct` unknown → `{error}`; `addToCart` valid → `{ok:true,…}` + `action` event; qty 0 / 11 / 1.5 / unknown product → `{error}` and no events; unknown tool → `{error}`.
- [ ] Implement + export `toolDeclarations` (JSON-schema style: name, description, parameters) consumed by Gemini. PASS. Commit `feat: agent tools`.

### Task 6: MockProvider (TDD)

- [ ] Spec: "Show me headphones under $100" → text deltas joined === "I found 2 products for you:" then `products` with 2 items, then `done`; "Add the cheapest mug to my cart" → `action` for `ceramic-coffee-mug` qty 1 and text "Added 1 × Ceramic Coffee Mug to your cart."; "add 2 travel mugs" → qty 2; "hello" → help text; no matching products → "I couldn't find…".
- [ ] Implement keyword extraction (stopwords, singularize trailing s when len>3, `under $N` → maxPrice), uses `executeTool` so events match Gemini's path; optional `delayMs` between word deltas. PASS. Commit `feat: deterministic mock LLM provider`.

### Task 7: GeminiProvider (TDD with fake client)

- [ ] Spec with fake `{models:{generateContentStream}}` returning async generators: (a) text-only stream → text events + done; (b) round 1 yields a `functionCall searchProducts`, round 2 yields text → expect `products` event, and second call's `contents` includes the model parts and a `user` turn with `functionResponse{id,name,response}`; (c) `thought: true` parts are not emitted; (d) loop stops after 3 tool rounds with a text fallback.
- [ ] Implement: maps ChatMessage to `contents` (`assistant`→`model`), `config:{systemInstruction, tools:[{functionDeclarations}]}`, reads `chunk.candidates?.[0]?.content?.parts`. Default model `gemini-2.5-flash`, override `GEMINI_MODEL`. PASS. Commit `feat: Gemini provider with function calling`.

### Task 8: select-provider + chat handler (TDD)

- [ ] Specs: `createProvider({})`→mock; `{GEMINI_API_KEY:'k'}`→gemini; `{GEMINI_API_KEY:'k',SMARTCART_PROVIDER:'mock'}`→mock. Handler: GET→405; bad JSON / empty / >20 msgs / bad role / >2000 chars → 400 JSON; happy path → `text/event-stream`, `x-smartcart-provider: mock`, body contains events then `done`; provider throws → error event "The assistant is unavailable right now. Please try again." then `done`.
- [ ] Implement. PASS. Commit `feat: /api/chat SSE handler`.

### Task 9: server.ts routing

- [ ] Replace scaffold `src/server.ts` with the verified pattern (`route()` dispatching `/api/chat` to `handleChat`, `devEnv()` reading `process.env` for `ng serve`, default export `{fetch}` for Workers). Verify `pnpm preview` + `curl -N -X POST localhost:8787/api/chat -d '{"messages":[{"role":"user","content":"headphones"}]}'` streams. Commit `feat: route chat API in worker`.

### Task 10: SseParser (TDD)

- [ ] Spec: single chunk with two events; event split across 3 chunks; malformed JSON skipped; trailing partial retained. Implement. Commit.

### Task 11: ChatService (TDD)

- [ ] Spec with fake `FETCH` token returning `Response` with a `ReadableStream`: user + assistant messages appended; text deltas accumulate; products attached; `action` calls `CartStore.addById`; `provider` signal from header; non-OK → error message "Sorry, something went wrong. Please try again."; `streaming` false at end.
- [ ] Implement. Commit `feat: streaming chat client service`.

### Task 12: UI

- [ ] App shell (header + cart badge `data-testid=cart-count`, `<router-outlet>`, `<app-assistant>`), routes `''` ProductListPage, `product/:id` ProductDetailPage, `cart` CartPage; `withComponentInputBinding()`; server routes `cart` → `RenderMode.Client`, `**` → Server.
- [ ] ProductCard (`data-testid=product-card`, Add button), list page with search input + category select, detail page, cart page with qty +/- and `data-testid=cart-total`.
- [ ] Assistant panel: toggle, suggestions chips, messages (`assistant-message`, embedded `assistant-product` cards with Add), input/send disabled while streaming, demo banner when provider is `mock`. Component spec: toggle opens panel; send disabled when empty.
- [ ] Global styles in `styles.css`. Verify `pnpm lint && pnpm test && pnpm build`; manual check in `pnpm preview`. Commit `feat: SmartCart UI and shopping assistant`.

### Task 13: Playwright

- [ ] `playwright.config.ts`: `testDir:'e2e'`, chromium only, `baseURL http://localhost:8787`, `webServer:{command:'pnpm wrangler dev --port 8787 --var SMARTCART_PROVIDER:mock', url, reuseExistingServer:!CI, env:{WRANGLER_SEND_METRICS:'false'}}`, `retries: CI?2:0`, html reporter.
- [ ] `e2e/shop.spec.ts`: search filters cards; add to cart updates badge; cart page qty + total.
- [ ] `e2e/assistant.spec.ts`: headphones under $100 → 2 `assistant-product` + demo banner; "Add the cheapest mug" → cart-count 1; `page.route('**/api/chat', 500)` → error message; fulfilled SSE body with text then error event → partial text + error shown; send disabled while streaming.
- [ ] `pnpm e2e` green. Commit `test: Playwright e2e for shop and assistant`.

### Task 14: `.coderabbit.yaml` (schema verified against schema.v2.json)

```yaml
# yaml-language-server: $schema=https://coderabbit.ai/integrations/schema.v2.json
language: en-US
reviews:
  profile: assertive
  high_level_summary: true
  sequence_diagrams: true
  poem: false
  auto_review: { enabled: true, drafts: false }
  path_instructions:
    - path: "src/app/**"
      instructions: Angular 22 zoneless app. Prefer signals/computed, standalone components, inject(). Flag direct browser globals (window, localStorage) without isPlatformBrowser — this app is SSR.
    - path: "src/server/**"
      instructions: Runs in a Cloudflare Worker. No Node-only APIs. Validate all request input. Never leak API keys or raw LLM errors to clients. Tool arguments from the LLM are untrusted.
    - path: "**/*.spec.ts"
      instructions: Vitest. Tests must be deterministic — no real network or Gemini calls; use fakes. Check edge cases and assertions are meaningful.
    - path: "e2e/**"
      instructions: Playwright. Prefer getByTestId/getByRole, web-first assertions, no fixed timeouts. Mock provider only.
  pre_merge_checks:
    title: { mode: warning, requirements: "Use Conventional Commits (feat:, fix:, test:, chore:, docs:, ci:)." }
    custom_checks:
      - name: Tests for new logic
        mode: warning
        instructions: Fail if the PR adds or changes logic in src/ without adding or updating a *.spec.ts or e2e test.
  tools:
    eslint: { enabled: true }
    gitleaks: { enabled: true }
    actionlint: { enabled: true }
code_generation:
  unit_tests:
    path_instructions:
      - path: "src/**/*.ts"
        instructions: Use Vitest globals (describe/it/expect, vi). Use TestBed for Angular services. Fake fetch/LLM clients; never call real APIs.
chat:
  auto_reply: true
```

- [ ] Commit `chore: configure CodeRabbit`.

### Task 15: CI workflow

- [ ] `.github/workflows/ci.yml`: on `pull_request` + `push: main`; `concurrency` cancel-in-progress; job `quality` (checkout, pnpm/action-setup, setup-node 24 cache pnpm, `pnpm install --frozen-lockfile`, lint, typecheck, test:coverage, build, upload coverage); job `e2e` needs quality (install, `pnpm exec playwright install --with-deps chromium`, `pnpm e2e`, upload `playwright-report` on failure). No deploy job. Commit `ci: lint, typecheck, test, build, e2e`.

### Task 16: Workshop docs

- [ ] `workshop/README.md` (agenda: 0–5 setup, 5–15 CodeRabbit, 15–30 unit tests, 30–42 e2e, 42–52 CI, 52–60 deploy; checkpoint branch table), `00-setup.md` … `05-deploy.md`, `prompts.md` (all copy-paste prompts). Each module: goal, checkpoint branch, steps, prompt, expected result, "if stuck" (`git checkout step-N`).
- [ ] `workshop/patches/bulk-discount.patch` via temp branch with seeded bugs (discount ignores quantity; localStorage without platform check) for the CodeRabbit PR exercise.
- [ ] Update `README.md` (project overview, commands). Commit `docs: workshop guide and prompts`.

### Task 17–19: Publish

- [ ] `gh repo create santoshyadavdev/smartcart-workshop --public --source . --push`.
- [ ] Create cumulative checkpoint branches from main: `step-0-start` (remove specs, e2e, playwright config, CI, `.coderabbit.yaml`), `step-1-coderabbit`, `step-2-unit-tests`, `step-3-e2e`, `step-4-ci`; each must `pnpm build` and push.
- [ ] Confirm CI green on main (`gh run watch`). Delete `/tmp/c3probe`.
