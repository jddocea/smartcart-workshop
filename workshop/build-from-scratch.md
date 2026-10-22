# Build SmartCart from scratch (self-paced pre-work)

The live workshop starts from the finished app on `step-0-start`. This guide shows you how to build that app yourself, from an empty folder to an Angular 22 SSR shop on Cloudflare Workers with an agentic Gemini assistant that streams its replies and calls tools.

- **Time:** about 2–3 hours with GitHub Copilot in agent mode.
- **Result:** the same app as `step-0-start`. The file paths, `data-testid`s and test seams match, so you can carry on with modules 01–05 on your own repo.
- **Reference:** whenever you are unsure, compare your file with the same path on the `main` branch of [`santoshyadavdev/smartcart-workshop`](https://github.com/santoshyadavdev/smartcart-workshop).

You need the same [prerequisites](README.md#prerequisites) as the workshop.

## What you are building

```text
src/
├── shared/                 # code used by both browser and Worker
│   ├── product.ts          # Product + Category types
│   ├── products.ts         # 20-product catalog + findProduct()
│   ├── product-filter.ts   # filterProducts()
│   └── agent-events.ts     # AgentEvent, ChatMessage, MAX_MESSAGE_LENGTH
├── server/                 # runs in the Cloudflare Worker
│   ├── env.ts              # SmartCartEnv
│   ├── sse.ts              # encodeSse()
│   ├── tools.ts            # searchProducts / getProduct / addToCart
│   ├── chat-handler.ts     # POST /api/chat → text/event-stream
│   └── llm/
│       ├── provider.ts         # LlmProvider interface
│       ├── mock-provider.ts    # deterministic keyword "LLM"
│       ├── gemini-provider.ts  # Gemini with function calling
│       └── select-provider.ts  # createProvider(env)
├── server.ts               # Worker entry: /api/chat + Angular SSR
└── app/
    ├── cart/               # CartStore (signals + localStorage), CartPage
    ├── products/           # list, detail, card
    ├── layout/header.ts
    └── assistant/          # SseParser, ChatService, AssistantPanel
```

## How to use the prompts

1. Open Copilot Chat in VS Code and switch to **Agent** mode.
2. Paste one prompt at a time. Each one ends with the command that proves it worked.
3. Read the diff before you accept it. Run the check. Commit.
4. If a check fails, paste the error back into Copilot Chat and ask it to fix it.

The prompts ask for tests along the way. They are kept small on purpose; the workshop's module 02 is where you write the full test suite.

---

## Part 1: Scaffold the app (commands)

### 1.1 Create the project

Cloudflare's [`create-cloudflare`](https://developers.cloudflare.com/workers/framework-guides/web-apps/more-web-frameworks/angular/) tool runs `ng new` with SSR and then wires the result to Workers: it adds `wrangler.jsonc`, a Workers-compatible `src/server.ts`, and the `preview` and `deploy` scripts.

```bash
npm install -g pnpm@12.15.0   # skip if `pnpm -v` already prints 12.x
pnpm_config_strict_dep_builds=false pnpm create cloudflare@latest smartcart-workshop --framework=angular --platform=workers --no-deploy
cd smartcart-workshop
```

If you leave out the flags, the tool asks the same questions interactively. Choose **Yes** for git and **No** for deploy.

> **Why `pnpm_config_strict_dep_builds=false`?** Since pnpm 11, an install fails with `ERR_PNPM_IGNORED_BUILDS` if any dependency has an install script you haven't approved or denied. The project C3 generates approves only `esbuild` and `workerd`, so the Angular install step fails without this. The variable only applies to this one command. On Windows PowerShell, run `$env:pnpm_config_strict_dep_builds="false"` first, then the `pnpm create` line on its own.

Now record a decision for the remaining install scripts, so later installs pass the same check. Open `pnpm-workspace.yaml` and extend `allowBuilds`:

```yaml
allowBuilds:
  esbuild: true
  workerd: true
  # Not needed: these ship prebuilt binaries or only print a message.
  '@google/genai': false
  '@parcel/watcher': false
  lmdb: false
  msgpackr-extract: false
  protobufjs: false
```

### 1.2 Check the scaffold runs

```bash
pnpm build      # builds dist/browser and dist/server
pnpm test       # Vitest via the Angular CLI (Ctrl+C to exit watch mode)
pnpm preview    # wrangler dev on http://localhost:8787
```

You should see the Angular welcome page on port 8787.

### 1.3 Add the tooling

```bash
pnpm ng add angular-eslint --skip-confirmation
pnpm add @google/genai
pnpm add -D @vitest/coverage-v8@^5 @playwright/test
```

Then update `package.json`:

- **Delete** the `serve:ssr:smartcart-workshop` script. It starts a Node server that doesn't exist in the Workers setup.
- Replace `"test"` and add the others:

```json
"test": "ng test --watch=false",
"test:watch": "ng test",
"test:coverage": "ng test --watch=false --coverage",
"lint": "ng lint",
"typecheck": "tsc --noEmit -p tsconfig.app.json && tsc --noEmit -p tsconfig.spec.json",
"e2e": "pnpm build && playwright test"
```

The `typecheck` script gains `&& tsc --noEmit -p e2e/tsconfig.json` in module 03, once `e2e/` exists.

### 1.4 Secrets and ignores

Add these lines to `.gitignore`:

```text
.dev.vars*
!.dev.vars.example
coverage/
playwright-report/
test-results/
.wrangler/
.pnpm-store/
```

Create `.dev.vars.example`:

```text
# Copy to .dev.vars and add your key from https://aistudio.google.com/apikey
GEMINI_API_KEY=your-key-here
# Force the deterministic mock assistant even when a key is set:
# SMARTCART_PROVIDER=mock
```

If you have a Gemini key, run `cp .dev.vars.example .dev.vars` and paste it in. `.dev.vars` is git-ignored.

### 1.5 Check and commit

```bash
pnpm lint && pnpm test && pnpm build
git add -A && git commit -m "chore: scaffold Angular SSR app on Cloudflare Workers"
```

---

## Part 2: The shop (prompts)

### 2.1 Catalog and filtering

```text
Create the shared product catalog. These files must not import anything from
Angular because the Cloudflare Worker uses them too.

1. src/shared/product.ts:
   export type Category = 'audio' | 'kitchen' | 'home' | 'fitness' | 'accessories';
   export interface Product { id: string; name: string; description: string;
     category: Category; price: number; emoji: string; rating: number; tags: string[] }

2. src/shared/products.ts: export const PRODUCTS: readonly Product[] with 20 products,
   4 per category, using kebab-case ids, an emoji instead of an image, and ratings 3.5–5.
   It must include exactly these (more products are fine, but no other headphones
   under $100):
   wireless-headphones $89, kids-headphones $35, noise-cancelling-headphones $249,
   sport-earbuds $59, ceramic-coffee-mug $14, insulated-travel-mug $24.
   Also export function findProduct(id: string): Product | undefined.

3. src/shared/product-filter.ts:
   export interface ProductFilter { query?: string; category?: Category | 'all'; maxPrice?: number }
   export function filterProducts(products: readonly Product[], filter: ProductFilter): Product[]
   Build a lowercased haystack from name + description + tags + category. Split the
   query on whitespace; every token must be a substring of the haystack. category
   'all' or undefined means no category filter. maxPrice is inclusive.

4. src/shared/product-filter.spec.ts (Vitest globals): an empty filter returns all;
   "headphones" matches 3 products case-insensitively; "travel mug" needs both tokens;
   the category filter works; 'all' is a no-op; maxPrice 100 is inclusive.

Run pnpm test.
```

Commit: `feat: product catalog and filtering`.

### 2.2 Cart store

```text
Create src/app/cart/cart.store.ts, an Angular 22 zoneless signal store.

export interface CartLine { product: Product; quantity: number }
export const MAX_QUANTITY = 10;
export const CART_STORAGE_KEY = 'smartcart.cart.v1';

@Injectable({ providedIn: 'root' }) export class CartStore:
- a private signal<CartLine[]>, exposed as readonly `lines`
- computed `count` (sum of quantities) and `total` (rounded to 2 decimal places)
- add(product, quantity = 1): increments an existing line; quantity is clamped to 1..MAX_QUANTITY
- addById(productId, quantity = 1): uses findProduct; an unknown id is a no-op
- setQuantity(productId, quantity): 0 or less removes the line
- remove(productId) and clear()
- persistence: the app is server-side rendered, so only touch localStorage when
  isPlatformBrowser(inject(PLATFORM_ID)) is true. Restore on construction and save
  with an effect(). Store [{ productId, quantity }], not whole products. Ignore
  corrupt JSON and unknown ids when restoring.

Add src/app/cart/cart.store.spec.ts covering add/increment, the cap, setQuantity 0,
total rounding, unknown ids, and save/restore through localStorage (TestBed with
PLATFORM_ID 'browser'). Run pnpm test.
```

Commit: `feat: signal-based cart store`.

---

## Part 3: The agent on the server (prompts)

This is the "agentic" part. The model never touches the cart or the catalog directly. It calls **tools**, and each tool returns a JSON response for the model plus **events** for the UI. Both providers, Gemini and the mock, produce the same event stream, so the UI and the tests don't care which one is running.

### 3.1 Event contract, env and SSE

```text
Create the contracts shared by the Worker and the browser:

1. src/shared/agent-events.ts:
   export type AgentEvent =
     | { type: 'text'; delta: string }
     | { type: 'products'; items: Product[] }
     | { type: 'action'; action: 'addToCart'; productId: string; quantity: number }
     | { type: 'error'; message: string }
     | { type: 'done' };
   export const MAX_MESSAGE_LENGTH = 2000;
   export interface ChatMessage { role: 'user' | 'assistant'; content: string }

2. src/server/env.ts:
   export interface SmartCartEnv { GEMINI_API_KEY?: string; GEMINI_MODEL?: string; SMARTCART_PROVIDER?: string }

3. src/server/sse.ts: export function encodeSse(event: AgentEvent): string that returns
   `data: ${JSON.stringify(event)}\n\n`, plus a one-test spec.

4. src/server/llm/provider.ts:
   export interface LlmProvider { readonly name: 'gemini' | 'mock'; run(messages: ChatMessage[]): AsyncIterable<AgentEvent> }

Run pnpm test.
```

Commit: `feat: agent event contract and SSE encoder`.

### 3.2 Tools

```text
Create src/server/tools.ts. It runs in a Cloudflare Worker, so no Node APIs.
Arguments come from an LLM, so treat them as untrusted and validate everything.

export interface ToolResult { response: Record<string, unknown>; events: AgentEvent[] }

export const toolDeclarations: { name: string; description: string; parameters: Record<string, unknown> }[]
with JSON-schema parameters for:
- searchProducts { query?: string, category?: one of the 5 categories, maxPrice?: number }
- getProduct { productId: string } (required)
- addToCart { productId: string, quantity?: integer 1-10 } (productId required)

export function executeTool(name: string, args: Record<string, unknown>): ToolResult
- searchProducts: uses filterProducts and returns at most 5 results. The response is
  { products: [{ id, name, price, category, rating }] } and there is one
  { type: 'products', items } event.
- getProduct: { product } or { error: 'Unknown product …' } with no events.
- addToCart: on success { ok: true, productId, name, quantity } plus one
  { type: 'action', action: 'addToCart', productId, quantity } event. The server does
  NOT hold the cart; the browser applies the action. A quantity that is not an integer
  from 1 to 10, or an unknown productId, returns { error } and no events.
- an unknown tool name returns { error } and no events.

Add src/server/tools.spec.ts for each of those cases. Run pnpm test.
```

Commit: `feat: assistant tools`.

### 3.3 Mock provider

The mock makes the app work without an API key, and makes the e2e tests deterministic.

```text
Create src/server/llm/mock-provider.ts:
export class MockProvider implements LlmProvider, with name 'mock' and
constructor(options: { delayMs?: number } = {}).

run(messages) is an async generator. It reads the last user message, lowercases it and:
- extracts keywords: drop stopwords (show, me, find, i, want, a, the, for, please, add,
  to, my, cart, under, cheapest, hi, hello, …), drop numbers and $ amounts, and
  singularize a trailing "s" on words longer than 3 letters;
  "under $N" becomes maxPrice N
- no keywords: streams a help text that suggests "show me headphones under $100" and
  "add the cheapest mug to my cart"
- otherwise it calls executeTool('searchProducts', …) so the events match the real path
- if the message contains "add" and there are results, it picks the cheapest when
  "cheapest" is present (else the first), reads the quantity from "add N", calls
  executeTool('addToCart', …), yields its action event, then streams
  "Added N × <name> to your cart."
- otherwise it streams "I found N products for you:" (singular for 1), then yields the
  products event; with no results it streams "I couldn't find …"
- text is streamed word by word as { type: 'text', delta } events, waiting delayMs
  between words when it is set
- always ends with { type: 'done' }

Add src/server/llm/mock-provider.spec.ts:
"Show me headphones under $100" → text "I found 2 products for you:", a products event
with 2 items, then done. "Add the cheapest mug to my cart" → an action for
ceramic-coffee-mug with quantity 1. "add 2 travel mugs" → quantity 2. "hello" → help
text. Run pnpm test.
```

Commit: `feat: deterministic mock LLM provider`.

### 3.4 Gemini provider with tool calling

```text
Create src/server/llm/gemini-provider.ts using @google/genai.

export interface GeminiClient { models: { generateContentStream(params: { model: string;
  contents: Content[]; config?: GenerateContentConfig }): Promise<AsyncIterable<GenerateContentResponse>> } }
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
export const SYSTEM_INSTRUCTION: a shopping-assistant prompt. Always use the tools, never
invent products, prices or ids, reply in 1–2 short sentences, confirm what was added to
the cart, and refuse requests that aren't about shopping.

export class GeminiProvider implements LlmProvider (name 'gemini'),
constructor(options: { apiKey: string; model?: string; client?: GeminiClient }).
The client option is the test seam; default to new GoogleGenAI({ apiKey }).

run(messages) is an async generator implementing the agent loop:
- map ChatMessage to Content (assistant → 'model', user → 'user')
- config: { systemInstruction, tools: [{ functionDeclarations }] } built from
  toolDeclarations (use parametersJsonSchema)
- for each streamed chunk, read chunk.candidates?.[0]?.content?.parts. Yield text parts
  as text events, skip parts with thought: true, and collect functionCall parts
- after the stream ends, if there were function calls: run each with executeTool, yield
  its events, append the model's parts and a 'user' turn of functionResponse parts
  ({ id, name, response }) to contents, and call the model again
- stop after 3 tool rounds and fall back to "I wasn't able to finish that request.
  Please try rephrasing."
- always end with done

Add src/server/llm/gemini-provider.spec.ts with a fake client whose
generateContentStream returns async generators: text only; a searchProducts call then
text (assert the products event and that the 2nd call's contents include the
functionResponse); thought parts are hidden; the 3-round cap. No real network.
Run pnpm test.
```

Commit: `feat: Gemini provider with tool calling`.

### 3.5 Chat endpoint

```text
1. src/server/llm/select-provider.ts: export function createProvider(env: SmartCartEnv): LlmProvider.
   Return a GeminiProvider when GEMINI_API_KEY is set and SMARTCART_PROVIDER !== 'mock'
   (pass GEMINI_MODEL); otherwise return new MockProvider({ delayMs: 25 }). Add a spec.

2. src/server/chat-handler.ts:
   export async function handleChat(request: Request, env: SmartCartEnv,
     createProviderFn: (env: SmartCartEnv) => LlmProvider = createProvider): Promise<Response>
   - not POST → 405 with an allow: POST header
   - invalid JSON, messages not an array of 1–20, a bad role, content that is not a
     string of 1–MAX_MESSAGE_LENGTH characters, or a last message that isn't from the
     user → 400 with a JSON { error }
   - otherwise return a ReadableStream of encodeSse(event) with content-type
     text/event-stream; charset=utf-8, cache-control no-cache, and
     x-smartcart-provider set to provider.name
   - if the provider throws, log the error server-side and send
     { type: 'error', message: 'The assistant is unavailable right now. Please try again.' }
     then done. Never send the raw error or the API key to the client.

Add src/server/chat-handler.spec.ts that uses createProviderFn fakes for each case.
Run pnpm test.
```

Commit: `feat: streaming chat handler`.

### 3.6 Route the API in the Worker

```text
Replace src/server.ts so that one function serves both the Worker and ng serve:

- const angularApp = new AngularAppEngine({ allowedHosts: ['localhost', '127.0.0.1', '*.workers.dev'] })
- async function route(request, env): if the pathname is /api/chat, return
  handleChat(request, env); otherwise return angularApp.handle(request), or a 404.
- devEnv(): ng serve has no Worker env, so build a SmartCartEnv from
  globalThis.process?.env (GEMINI_API_KEY, GEMINI_MODEL, SMARTCART_PROVIDER) without
  importing node:process.
- export const reqHandler = createRequestHandler((request) => route(request, devEnv()));
- export default { fetch: (request: Request, env: SmartCartEnv) => route(request, env) };

Keep the comment that tells people to add a custom domain to allowedHosts.
```

Check it streams:

```bash
pnpm preview
# in a second terminal:
curl -N -X POST localhost:8787/api/chat \
  -H 'content-type: application/json' \
  -d '{"messages":[{"role":"user","content":"show me headphones under $100"}]}'
```

You should see `data: {"type":"text",…}` lines, a `products` event and then `done`. Commit: `feat: route /api/chat in the worker`.

---

## Part 4: The UI (prompts)

### 4.1 Streaming client

```text
1. src/app/assistant/sse-parser.ts: export class SseParser with
   push(chunk: string): AgentEvent[]. Buffer the text, split it on blank lines, parse
   each "data: " line as JSON, skip malformed events, and keep a trailing partial event
   for the next push. Add a spec: two events in one chunk, one event split across 3
   chunks, malformed JSON skipped.

2. src/app/assistant/chat.service.ts:
   export const FETCH = new InjectionToken<typeof fetch>('FETCH', { providedIn: 'root',
     factory: () => (input, init) => fetch(input, init) });   // test seam
   export interface UiMessage { id: number; role: 'user' | 'assistant'; text: string; products: Product[]; error?: string }
   @Injectable({ providedIn: 'root' }) export class ChatService with readonly signals
   messages, streaming and provider ('gemini' | 'mock' | null), plus send(text) and reset().
   send():
   - trims and clips to MAX_MESSAGE_LENGTH and ignores empty input or calls while streaming
   - appends a user message and an empty assistant message, then POSTs /api/chat with
     the last 20 messages of history. Leave out user turns whose reply errored, and empty
     assistant messages.
   - reads x-smartcart-provider into provider()
   - reads response.body with a TextDecoder and SseParser: text appends to the assistant
     message, products attaches items, action calls CartStore.addById, and error sets
     message.error
   - a non-OK response or a network failure sets error to
     "Sorry, something went wrong. Please try again."
   - streaming is false at the end (use finally)
   Add a spec with a fake FETCH that returns a Response with a ReadableStream. Run pnpm test.
```

Commit: `feat: streaming chat service`.

### 4.2 Pages and layout

```text
Build the SmartCart UI: an Angular 22 zoneless app with standalone components,
inject(), signals, the new control flow (@if/@for), and input() for route params.
Use plain CSS in src/styles.css plus component styles; no UI library.

- src/app/app.config.ts: provideBrowserGlobalErrorListeners, provideHttpClient(withFetch()),
  provideRouter(routes, withComponentInputBinding()), provideClientHydration().
- src/app/app.routes.ts: lazy loadComponent routes '' → ProductListPage,
  'product/:id' → ProductDetailPage, 'cart' → CartPage, '**' → redirect ''. Give each a title.
- src/app/app.routes.server.ts: 'cart' → RenderMode.Client (the cart lives in
  localStorage), '**' → RenderMode.Server.
- src/app/layout/header.ts: the logo links home, plus a cart link with a badge
  data-testid="cart-count" bound to CartStore.count().
- src/app/app.ts: header, <main><router-outlet/></main> and <app-assistant/>. Delete the
  welcome page in app.html and update app.spec.ts.
- src/app/products/product-card.ts: input product; data-testid="product-card"; emoji,
  name, price, rating, a link to /product/:id, and an "Add to cart" button
  data-testid="add-to-cart".
- src/app/products/product-list.page.ts: a search input data-testid="search",
  category chips data-testid="category-chip" (All + 5 categories), a max price input
  data-testid="max-price", and a grid of cards from computed filterProducts(…), with
  data-testid="empty-state" when nothing matches.
- src/app/products/product-detail.page.ts: id = input.required<string>(), the product
  via findProduct, data-testid="not-found" for unknown ids, and add to cart.
- src/app/cart/cart.page.ts: rows data-testid="cart-line" with buttons
  data-testid="decrement"/"increment", data-testid="quantity", data-testid="line-total",
  data-testid="remove"; data-testid="cart-total"; data-testid="clear-cart";
  data-testid="cart-empty" when empty.

Run pnpm lint && pnpm test && pnpm build.
```

Commit: `feat: product browsing and cart pages`.

### 4.3 Assistant panel

```text
Create src/app/assistant/assistant-panel.ts (selector app-assistant) using ChatService.
- a floating "✨ Ask AI" button data-testid="assistant-toggle" opens a side panel
  data-testid="assistant-panel" with a close button data-testid="assistant-close"
  and "New chat" data-testid="assistant-reset"
- when the provider is 'mock', show a banner data-testid="demo-banner": "Demo mode —
  responses are simulated. Add a GEMINI_API_KEY to use Gemini."
- an empty state with suggestion chips data-testid="assistant-suggestion" (e.g. "Show
  me headphones under $100", "Add the cheapest mug to my cart") that send on click
- messages: assistant bubbles data-testid="assistant-message", product mini-cards
  data-testid="assistant-product" each with an Add button, errors
  data-testid="assistant-error", and data-testid="typing-indicator" while streaming
  with no text yet. Auto-scroll to the bottom.
- a textarea data-testid="assistant-input" (maxlength = MAX_MESSAGE_LENGTH, Enter
  sends, Shift+Enter adds a newline) and a send button data-testid="assistant-send"
  that is disabled while streaming or when the input is empty
- accessible: aria-labels, aria-live on the message list, Escape closes the panel

Add assistant-panel.spec.ts: the toggle opens the panel and send is disabled when the
input is empty. Run pnpm lint && pnpm test && pnpm build.
```

Commit: `feat: shopping assistant panel`.

---

## Part 5: Try it end to end

```bash
pnpm start      # ng serve on http://localhost:4200, mock assistant unless GEMINI_API_KEY is exported
pnpm preview    # the real Worker on http://localhost:8787, reads .dev.vars
```

Check these:

- [ ] The search for "headphones" filters the grid, and the category chips work.
- [ ] Add to cart updates the badge, and the cart survives a reload.
- [ ] **✨ Ask AI → "Show me headphones under $100"** streams text and shows 2 product cards.
- [ ] **"Add the cheapest mug to my cart"** bumps the cart badge to 1.
- [ ] Without a key you see the demo banner. With a key in `.dev.vars` the banner disappears and Gemini answers.
- [ ] View the page source on `/`: the products are in the HTML, so SSR works.
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` all pass.

## Part 6: Publish and join the workshop

```bash
gh repo create smartcart-workshop --public --source . --push
```

Your `main` now matches `step-0-start`. Continue with [01 AI code review](01-coderabbit.md), running each module on your own repo. When a module says "check out `step-N`", compare your work with that branch of the reference repo instead.

## If stuck

- **`pnpm create cloudflare` hangs on a question.** Pass the flags shown in 1.1, or answer the prompts: framework **Angular**, platform **Workers**, deploy **No**.
- **`400 Bad Request` from SSR on a new host.** Add the host to `allowedHosts` in `src/server.ts`.
- **`ReferenceError: localStorage is not defined` during build or SSR.** Something touched `localStorage` outside an `isPlatformBrowser` check.
- **`/api/chat` returns the Angular page on `ng serve`.** `src/server.ts` must export `reqHandler` built from `route()`, not the scaffold's default handler.
- **Gemini errors in the Worker log.** Check the key in `.dev.vars` and try `GEMINI_MODEL=gemini-2.5-flash`. Set `SMARTCART_PROVIDER=mock` to carry on without it.
- **Copilot invented a different file or API.** Paste the matching file from the reference repo's `main` branch and ask Copilot to align with it.
