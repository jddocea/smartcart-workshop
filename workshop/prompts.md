# Prompts

These are the copy-paste prompts for GitHub Copilot Chat (agent mode works best), grouped by module. Each one names real files and patterns in this repo.

Before you paste a prompt, open the file it targets so Copilot has the context. Always read and run what it gives you back.

## Module 01: CodeRabbit

### 1.1 Draft `.coderabbit.yaml`

```text
Create .coderabbit.yaml in the repo root for CodeRabbit. Start the file with
"# yaml-language-server: $schema=https://coderabbit.ai/integrations/schema.v2.json".
Use language en-US and reviews.profile "assertive", with high_level_summary and
sequence_diagrams on, poem off, and auto_review enabled but not for drafts, with base_branches [".*"]
so PRs into the step-* branches are reviewed too.
Add reviews.path_instructions for:
- src/app/** : Angular 22 zoneless app. Prefer signals/computed, standalone components
  and inject(). Flag window/document/localStorage used without isPlatformBrowser,
  because the app is server-side rendered.
- src/server/** : runs in a Cloudflare Worker. No Node-only APIs, validate all
  request input, never leak API keys or raw LLM errors, and treat LLM tool
  arguments as untrusted.
- **/*.spec.ts : Vitest. Deterministic tests only (no real network or Gemini calls),
  meaningful assertions and edge cases.
- e2e/** : Playwright. getByTestId/getByRole, web-first assertions, no fixed timeouts,
  mock provider only.
Add reviews.pre_merge_checks: a title check in warning mode requiring Conventional
Commits (feat:, fix:, test:, chore:, docs:, ci:), and a custom check "Tests for new
logic" in warning mode that fails when src/ logic changes without a *.spec.ts or e2e
test. Enable the eslint, gitleaks and actionlint tools. Under
code_generation.unit_tests.path_instructions for src/**/*.ts, say to use Vitest
globals, TestBed for Angular services and components, and fakes for fetch and LLM
clients. Set chat.auto_reply to true.
Only use keys that exist in the v2 schema.
```

### 1.2 Fix the bulk-discount calculation

```text
CodeRabbit flagged CartStore.discount in src/app/cart/cart.store.ts. The rule is
"10% off any line with a quantity of 3 or more", but the code checks
this.lines().length and then discounts every line. Rewrite discount so each line
is discounted only when line.quantity >= 3. Move the 3 and 0.1 into named
constants (BULK_MIN_QUANTITY, BULK_DISCOUNT_RATE). Keep rounding to cents and keep
total = subtotal - discount. Don't change the public signal names.
```

### 1.3 Make the promo banner SSR-safe

```text
src/app/layout/header.ts reads localStorage in a field initializer
(promoDismissed). The header is server-rendered in a Cloudflare Worker, where
localStorage doesn't exist, so every SSR page returns 500. Make it SSR-safe. Inject
PLATFORM_ID and use isPlatformBrowser, the same way src/app/cart/cart.store.ts
guards its storage access. Default to "not dismissed" on the server and only
read or write localStorage in the browser. Keep the template and test ids the same.
```

### 1.4 Add the missing tests

```text
Add Vitest specs for the bulk discount in src/app/cart/cart.store.spec.ts (create
it if it doesn't exist). Use Vitest globals (no imports from 'vitest'), TestBed,
and localStorage.clear() in beforeEach. Cover: no discount below quantity 3; a
single line with quantity 3 gets 10% off; three different products with
quantity 1 get no discount; mixed lines only discount the qualifying line; and
total = subtotal - discount rounded to cents. Use real products from
src/shared/products.ts via findProduct.
```

### 1.5 Reply to a CodeRabbit comment (paste on the PR)

```text
@coderabbitai Why is reading localStorage in a field initializer a problem here? Which routes are affected, given app.routes.server.ts renders /cart on the client only?
```

## Module 02: Unit tests

All of these assume Vitest globals (`describe`, `it`, `expect`, `vi`) through `ng test` with the `@angular/build:unit-test` builder, in jsdom. Tell Copilot not to import from `vitest`.

### 2.1 `src/shared/product-filter.ts`

```text
Write Vitest specs in src/shared/product-filter.spec.ts for filterProducts in
src/shared/product-filter.ts. Use Vitest globals (no imports from 'vitest'). Use the
real catalog from src/shared/products.ts. Cover: empty filter returns everything;
query matching is case-insensitive and multi-word (every token must match);
category filter, including 'all'; maxPrice is inclusive; combined filters; a query
with no matches returns []; the input array isn't mutated. Assert on product ids,
not just lengths.
```

### 2.2 `src/server/tools.ts`

```text
Write Vitest specs in src/server/tools.spec.ts for executeTool and
toolDeclarations in src/server/tools.ts. Use Vitest globals (no imports from
'vitest'). Treat every argument as untrusted LLM output. Cover searchProducts
(query, category, maxPrice, wrong types), getProduct (known id, unknown id),
addToCart (default quantity 1, quantity above 10 rejected, zero/negative/
non-integer quantity rejected, unknown product), and an unknown tool name. Check that every
tool in toolDeclarations is handled by executeTool. Assert on the full ToolResult
shape.
```

### 2.3 `src/server/llm/mock-provider.ts`

```text
Write Vitest specs in src/server/llm/mock-provider.spec.ts for MockProvider. Use
Vitest globals. Construct it with { delayMs: 0 } so tests are fast. Collect the
events from provider.run(messages) with a for await loop into an array. Cover:
"show me headphones under $100" yields a products event with only headphones
priced <= 100; "add the cheapest mug to my cart" yields an addToCart action for
the cheapest mug; an unrelated message yields only text; every run ends with
exactly one { type: 'done' } as the last event; and provider.name is 'mock'.
```

### 2.4 `src/server/chat-handler.ts` (streaming responses)

```text
Write Vitest specs in src/server/chat-handler.spec.ts for handleChat. Use Vitest
globals. Don't use a real provider: pass a fake as the third argument
(createProviderFn) that returns an LlmProvider whose run() is an async generator
yielding scripted AgentEvents. Add a post(body) helper that builds
new Request('http://localhost/api/chat', { method: 'POST', body: JSON.stringify(body) }).
Read the streamed body with `await new Response(res.body).text()` and assert on
the SSE frames from encodeSse in src/server/sse.ts. Cover: 405 for GET; 400 JSON
{ error } for invalid JSON, missing messages, more than 20 messages, a message
over 2000 characters, and a last message not from the user;
content-type text/event-stream; the x-smartcart-provider header; and when the provider
throws mid-stream, the client gets a generic error event and then done, never the
raw error message.
```

### 2.5 `src/server/llm/gemini-provider.ts` (LLM integration with a fake client)

```text
Write Vitest specs in src/server/llm/gemini-provider.spec.ts for GeminiProvider.
Use Vitest globals. Never call the real Gemini API: pass a fake GeminiClient via
the client option. Build it with a helper fakeClient(script: Part[][][]), where each
call to models.generateContentStream returns the next scripted round, as an async
generator yielding { candidates: [{ content: { role: 'model', parts } }] } chunks.
Record a structuredClone of each call's params so you can assert on what was sent.
Cover: text parts stream as text events; a searchProducts functionCall yields a
products event and a second round that includes the functionResponse; addToCart
yields an action event; it stops after 3 tool rounds; it sends SYSTEM_INSTRUCTION
and DEFAULT_GEMINI_MODEL unless a model is given; a client that throws produces
an error event without leaking the message; and it always ends with done.
```

### 2.6 `src/app/assistant/chat.service.ts` (fake streaming fetch)

```text
Write Vitest specs in src/app/assistant/chat.service.spec.ts for ChatService. Use
Vitest globals and TestBed. Replace the network with the FETCH InjectionToken from
chat.service.ts: provide { provide: FETCH, useValue: fakeFetch }, where fakeFetch
is a vi.fn returning a Response whose body is a ReadableStream that enqueues SSE
text in several chunks (split mid-frame to test buffering). Add a
sseResponse(chunks, init?) helper. Cover: user and assistant messages appear;
text deltas accumulate; products attach to the assistant message; an addToCart
action updates CartStore; a non-OK response sets an error; an error event mid-stream
keeps the partial text; the demo-mode flag follows the x-smartcart-provider header;
and the request body POSTed to /api/chat.
```

### 2.7 Review a generated spec

```text
Review the spec file I have open as a strict test reviewer. Check: it's
deterministic (no real network, timers or Date.now without fakes); no real Gemini
or fetch calls; every test has an assertion that would fail if the code under test
broke; edge cases and error paths are covered; there's no duplicated setup that
should be in beforeEach. List concrete problems, then fix them.
```

## Module 03: E2E

### 3.1 `playwright.config.ts`

```text
Create playwright.config.ts for this Angular SSR app on Cloudflare Workers. testDir
'e2e', fullyParallel, forbidOnly and retries 2 on CI, list plus html reporters
(html with open: 'never'), and a chromium project only. baseURL http://localhost:8787. The
webServer command is `pnpm wrangler dev --port 8787 --var SMARTCART_PROVIDER:mock`
(the build already ran via `pnpm e2e`), with url http://localhost:8787,
reuseExistingServer when not on CI, a 120s timeout and
env WRANGLER_SEND_METRICS: 'false'. trace 'on-first-retry'.
e2e/tsconfig.json already exists and type-checks e2e/**/*.ts and
../playwright.config.ts, so don't create another tsconfig.
```

### 3.2 Hydration helper and shop spec

```text
Create e2e/hydration.ts exporting gotoHydrated(page, path), which navigates and
then waits until Angular hydration finishes: expect(page.locator('[ngh]')).toHaveCount(0).
Then write e2e/shop.spec.ts using it. Use getByTestId and web-first assertions
only (no waitForTimeout). Cover: the home page lists 20 product-card items; typing
in the search box narrows the list; add-to-cart updates the cart-count badge and
the cart page shows a cart-line and cart-total; and a product detail page is
server-rendered (request it with page.request.get and assert the product name is
in the raw HTML).
```

### 3.3 Assistant spec (streaming and failures)

```text
Write e2e/assistant.spec.ts for the shopping assistant. The server uses the mock
provider. Open the panel with the assistant-toggle test id after gotoHydrated.
Cover:
1. "show me headphones under $100" shows assistant-product cards.
2. "add the cheapest mug to my cart" updates cart-count to 1.
3. A server failure: page.route('**/api/chat', r => r.fulfill({ status: 500 })) shows
   assistant-error.
4. A mid-stream error: fulfill with content-type text/event-stream and a body of a text
   frame followed by an error frame. The partial text stays and assistant-error shows.
5. While a reply is streaming (delay the routed response), assistant-send is
   disabled and typing-indicator is visible.
Use web-first assertions and no fixed timeouts.
```

## Module 04: CI

### 4.1 Workflow

```text
Create .github/workflows/ci.yml named CI. Trigger it on pull_request, push to main
and workflow_dispatch. Set concurrency group ci-${{ github.ref }} with
cancel-in-progress, and permissions contents: read.
Job quality (ubuntu-latest, 15 min): actions/checkout@v4, pnpm/action-setup@v4 (no
version, it reads packageManager from package.json), actions/setup-node@v4 with
node-version 24 and cache pnpm, then pnpm install --frozen-lockfile, pnpm lint,
pnpm typecheck, pnpm test:coverage and pnpm build, then upload coverage/ with
actions/upload-artifact@v4 if: always().
Job e2e (needs quality, 20 min): the same setup, then
pnpm exec playwright install --with-deps chromium, then pnpm e2e with env CI: true.
Upload playwright-report/ if: failure().
No deploy job: Cloudflare Workers Builds deploys. It must pass actionlint.
```

### 4.2 Explain a failing job

```text
Here is the failing log from the CI "<job>" job: <paste>. Explain the root cause
using the files in this repo and propose the smallest fix. Don't disable the check.
```

## Module 05: Deploy

### 5.1 Explain the deploy setup

```text
Explain how this repo deploys to Cloudflare Workers. Use wrangler.jsonc (name, main,
assets), the build and deploy scripts in package.json, and src/server.ts. What does
Workers Builds need as the build command and deploy command, and how does
GEMINI_API_KEY get to the Worker at runtime?
```

### 5.2 Adapt the workflow to your project

```text
Look at this repository and propose a .coderabbit.yaml, a GitHub Actions CI
workflow, and the first three unit tests to write, following the SmartCart workshop
pattern: path_instructions per folder, a "Tests for new logic" pre-merge check, a
quality job (lint, typecheck, test with coverage, build) and an e2e job. Use only the
scripts that exist in this repo's package.json.
```
