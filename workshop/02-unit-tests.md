# 02 · AI-assisted unit tests with Vitest

|                     |                                                                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Goal**            | Have Copilot write meaningful, deterministic Vitest specs, including the streaming and LLM ones, then review them critically |
| **Time box**        | 15 minutes (15–30)                                                                                                           |
| **Starting branch** | `step-1-coderabbit` (solution: `step-2-unit-tests`)                                                                          |

```bash
git checkout step-1-coderabbit
```

## How testing is wired

- `pnpm test` runs `ng test --watch=false`. The `@angular/build:unit-test` builder runs **Vitest** in jsdom.
- `pnpm test:watch` runs `ng test` in watch mode, which is handy while you iterate.
- `pnpm test:coverage` runs `ng test --watch=false --coverage` and writes an HTML report to `coverage/smartcart-workshop/index.html`.
- `tsconfig.spec.json` loads `vitest/globals`, so specs use `describe`, `it`, `expect` and `vi` **without importing from `vitest`**.
- Specs sit next to their source as `*.spec.ts`. On this branch only `src/app/app.spec.ts` exists. Open it to see the style.

## Steps

Do these in order. They go from pure functions to streams to the LLM. Paste each prompt into Copilot Chat with the source file open, run `pnpm test:watch`, then **review the result** using the checklist below.

1. **Pure logic: `src/shared/product-filter.ts`** ([prompt 2.1](prompts.md#21-srcsharedproduct-filterts)). This is a warm-up. Check that it asserts on ids, not just `.length`.
2. **Untrusted input: `src/server/tools.ts`** ([prompt 2.2](prompts.md#22-srcservertoolsts)). LLM tool arguments are untrusted, so look for wrong types, missing ids, and quantities of `0`, `11` and `2.5`.
3. **Async generators: `src/server/llm/mock-provider.ts`** ([prompt 2.3](prompts.md#23-srcserverllmmock-providerts)). Collect the events with `for await`, and use `{ delayMs: 0 }` so the tests are fast.
4. **Streaming HTTP responses: `src/server/chat-handler.ts`** ([prompt 2.4](prompts.md#24-srcserverchat-handlerts-streaming-responses)). The key move is to pass a fake provider as the third argument of `handleChat` and read the stream in one go:

   ```ts
   // post() is a small helper that builds a POST Request to /api/chat
   const res = await handleChat(post({ messages }), {}, () => fakeProvider(events));
   expect(res.headers.get('content-type')).toContain('text/event-stream');
   const body = await new Response(res.body).text();
   expect(body).toContain('"type":"done"');
   ```

   Make sure there's a test where the provider **throws mid-stream**. The client should get a generic `error` event and then `done`, never the raw error text.

5. **LLM integration: `src/server/llm/gemini-provider.ts`** ([prompt 2.5](prompts.md#25-srcserverllmgemini-providerts-llm-integration-with-a-fake-client)). **This is the key pattern of the workshop.** `GeminiProvider` takes an optional `client` that implements the small `GeminiClient` interface. In tests you inject a fake whose `generateContentStream` returns scripted async generators, one script entry per model round:

   ```ts
   function fakeClient(script: Part[][][]) {
     const calls: unknown[] = [];
     let round = 0;
     const client: GeminiClient = {
       models: {
         generateContentStream: async (params) => {
           calls.push(structuredClone(params));
           const chunks = script[round++] ?? [];
           return (async function* () {
             for (const parts of chunks) {
               yield {
                 candidates: [{ content: { role: 'model', parts } }],
               } as GenerateContentResponse;
             }
           })();
         },
       },
     };
     return { client, calls };
   }
   ```

   This lets you script a `functionCall` → tool → `functionResponse` → final text conversation and assert on **what was sent to the model**: the tool response, the system instruction and the model name. All of this runs with no network and no API key.

6. **Client streaming: `src/app/assistant/chat.service.ts`** ([prompt 2.6](prompts.md#26-srcappassistantchatservicets-fake-streaming-fetch)). `ChatService` injects `fetch` through the `FETCH` `InjectionToken`, so a test can provide a fake whose `Response` body is a `ReadableStream` that delivers SSE in awkward chunks, including splits mid-frame:

   ```ts
   TestBed.configureTestingModule({ providers: [{ provide: FETCH, useValue: fakeFetch }] });
   ```

7. **Measure coverage:**

   ```bash
   pnpm test:coverage
   open coverage/smartcart-workshop/index.html   # macOS; use xdg-open on Linux
   ```

8. **Optional: ask CodeRabbit.** On a PR, comment `@coderabbitai generate unit tests`. CodeRabbit follows `code_generation.unit_tests.path_instructions` from `.coderabbit.yaml` and proposes the specs as a commit or a follow-up PR. Compare what it gives you with Copilot's output.

## Review checklist for AI-written tests

Use [prompt 2.7](prompts.md#27-review-a-generated-spec), or go through this yourself:

- [ ] **Deterministic.** No real timers, randomness or dates without fakes. `MockProvider` uses `delayMs: 0`.
- [ ] **No real network.** No real `fetch` or Gemini calls. Use `FETCH`, the `client` option and `createProviderFn`.
- [ ] **Meaningful assertions.** Would the test fail if you broke the code? Try it: flip a `<` in the source and run the tests.
- [ ] **Edge cases.** Empty input, limits (20 messages, 2000 chars, quantity 10), wrong types, and unknown ids.
- [ ] **Error paths.** A thrown provider, a non-OK response, an `error` event mid-stream, and no leaked error text.
- [ ] **Readable.** One behaviour per `it`, with setup in `beforeEach` (for example `localStorage.clear()`).

## Expected result

- `pnpm test` passes with specs for all six files.
- `pnpm test:coverage` shows high coverage on `src/server/**` and `src/shared/**`. The reference solution has 105 tests and about 97% statement coverage.

## If stuck

Pull the reference specs from the solution branch. This only touches files that match the pathspec:

```bash
git checkout origin/step-2-unit-tests -- 'src/*.spec.ts'
```

This **restores only the spec files**. Your other `src` changes stay as they are, though any spec you already wrote with the same name is overwritten. Use the `origin/` prefix, because a bare `step-2-unit-tests` only works once you've checked out a local branch with that name.

To compare without overwriting anything:

```bash
git diff HEAD origin/step-2-unit-tests -- src
```

You can also check out the whole branch: `git checkout step-2-unit-tests`.
