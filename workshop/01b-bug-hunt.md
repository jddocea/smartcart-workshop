# 01b · Bug hunt: let CodeRabbit find it, then fix it with CodeRabbit

|                     |                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| **Goal**            | Open a PR with hidden bugs that pass lint, typecheck and tests, and fix them using CodeRabbit           |
| **Time box**        | 15 minutes. Optional: it takes the workshop to about 75 minutes                                         |
| **Starting branch** | `step-1-coderabbit` or later, with `.coderabbit.yaml` and CodeRabbit installed on your fork (module 01) |

Module 01 showed CodeRabbit catching bugs. This module is about **fixing** them with CodeRabbit's own tools. Each patch below looks like a reasonable feature. It passes `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build`, even on `main` with the full test suite, so CI would let it through. Only the review catches it.

## The patches

Pick one, or let the facilitator assign one. Don't read the diff closely first: the point is to see what the review finds.

| Patch                  | Disguised as                                       | Area                               |
| ---------------------- | -------------------------------------------------- | ---------------------------------- |
| `ai-security.patch`    | Page context for the assistant, plus debug logging | `src/server/`, `src/shared/`       |
| `streaming-leak.patch` | A **Stop** button and a "Thinking… Ns" timer       | `src/app/assistant/`               |
| `a11y.patch`           | Compact quick-add and a wishlist heart on cards    | `src/app/products/product-card.ts` |
| `fake-tests.patch`     | Money helpers, with tests                          | `src/shared/money.ts` and its spec |

## Steps

### 1. Apply a patch and open a PR

Start from a clean tree on `step-1-coderabbit` (or `main`). Replace `<name>` with the patch you picked, for example `a11y`.

```bash
git checkout step-1-coderabbit
git status   # must be clean
git checkout -b bug/<name>
git apply workshop/patches/bug-hunt/<name>.patch
git add -A src
git commit -m "feat: <name> changes"
git push -u origin bug/<name>
```

Open a PR **in your fork**: base `step-1-coderabbit` ← compare `bug/<name>`. As in module 01, change the base repository from upstream to your fork.

Optionally prove that the tooling is happy: `pnpm lint && pnpm typecheck && pnpm test`.

### 2. Read the review

Wait a minute or two for the review. Before reading the inline comments:

1. Read the **walkthrough** and the **sequence diagram**. Do they describe the change the way you'd describe it?
2. Open the **Actionable comments posted** comment. It lists every finding, grouped by file.
3. Check the **pre-merge checks**. `fake-tests.patch` adds a spec, so the "Tests for new logic" check passes. The tests are still useless, which is a good reason to read beyond the checks.

Compare the findings with the [answer key](#answer-key) at the end, but only after you've read the review.

### 3. Fix it with CodeRabbit

Try at least two of these on your PR. They're listed from the most manual to the most automated.

| Method                                      | How                                                                                                                                                                                                                                                                               |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Commit suggestion**                       | Small fixes come with a suggested diff. Click **Commit suggestion** (or add several to a batch) on the comment. This commits straight to your branch                                                                                                                              |
| **Prompt for AI Agents** + Copilot          | Expand **🤖 Prompt for AI Agents** under a comment and copy it. Paste it into Copilot Chat in agent mode with [prompt 1b.1](prompts.md#1b1-fix-from-a-coderabbit-prompt-for-ai-agents). The actionable-comments summary has one prompt for all findings                           |
| **Ask in the thread**                       | Reply on a comment, for example `@coderabbitai how should stop() cancel the stream?` or [prompt 1b.2](prompts.md#1b2-ask-coderabbit-for-the-fix-in-the-thread). It answers with code you can apply                                                                                |
| **`@coderabbitai fix comments`** (optional) | Comment this on the PR, or tick **Fix comments** in the actionable-comments summary. CodeRabbit writes the fixes and commits them. `@coderabbitai fix comments stacked pr` opens a separate PR against your branch instead. Needs the Pro features that public repos get for free |

If you fix it locally, run the checks before pushing:

```bash
pnpm lint && pnpm typecheck && pnpm test
git add -A src
git commit -m "fix: address CodeRabbit review"
git push
```

### 4. Watch the threads resolve

The push triggers an **incremental review**. CodeRabbit checks the new commits against its open comments and marks the fixed ones resolved. If a thread stays open, reply to it and ask why. CodeRabbit either explains what's still wrong or agrees and resolves it.

Then compare notes with a neighbour who had a different patch. Which fix method gave the best result for which bug?

## Expected result

- The review flags at least two of the seeded bugs in your patch, even though lint, typecheck and tests pass.
- You fixed them with at least two CodeRabbit methods, and the incremental review resolved the threads.

## If stuck

- **No review.** Check that the PR is in your fork and that `.coderabbit.yaml` is on the base branch. Then comment `@coderabbitai review`.
- **`git apply` fails.** You're on `step-0-start`, or the tree is dirty. Run `git status` and start from `step-1-coderabbit`. Use `git apply --check workshop/patches/bug-hunt/<name>.patch` to see the conflict.
- **The review missed a bug.** Reviews aren't deterministic. Reply on the file with a hint, for example `@coderabbitai is this button accessible to screen readers?`, or run `@coderabbitai full review`.
- **`fix comments` does nothing.** It needs Pro features, which are free on public repos. Use the Prompt for AI Agents method instead.

## Answer key

Read this after the review.

### `ai-security.patch`

| Bug                                                                                                                                                               | Fix                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `isChatMessage` in `src/server/chat-handler.ts` now accepts a `system` role from the browser. Any client can inject its own system instructions: prompt injection | Accept only `user` and `assistant`. If page context is needed, build it on the server |
| `console.log` prints `GEMINI_API_KEY`. Worker logs (`wrangler tail`, the dashboard, log push) now contain the secret                                              | Remove the key from the log, or log only whether it's set                             |

### `streaming-leak.patch`

| Bug                                                                                                                                                                               | Fix                                                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ChatService.stop()` only sets `streaming` to false. The fetch is never aborted, so tokens and `addToCart` actions keep arriving after **Stop**, and items still land in the cart | Keep an `AbortController` per send, pass its `signal` to `fetch`, and call `abort()` in `stop()`. Ignore events from an aborted stream                       |
| After Stop, **Send** is enabled again, so a second stream runs alongside the first. The first stream's `finally` then sets `streaming` to false while the second is running       | Abort the previous request before starting a new one, and only clear `streaming` if the finishing request is the current one                                 |
| `setInterval` in the `AssistantPanel` constructor is never cleared, and it also starts during SSR on the server                                                                   | Start the timer only in the browser (for example in `afterNextRender`), and clear it with `DestroyRef.onDestroy`, or derive the label from a start timestamp |

### `a11y.patch`

| Bug                                                                                                  | Fix                                                                         |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| The "Add to cart" button is now just `＋`, with no accessible name. Screen readers announce "button" | Add `aria-label="Add {{ item.name }} to cart"`, or keep visible text        |
| The heart button has no name, and its saved state is shown by colour only                            | Add `aria-label="Save {{ item.name }}"` and `[attr.aria-pressed]="saved()"` |
| `.link:focus { outline: none; }` removes the keyboard focus indicator from the product link          | Delete the rule, or replace it with a visible `:focus-visible` style        |

ESLint's template accessibility rules pass, because they check for keyboard handlers and focusability, not for names. That's why the review catches what lint can't.

### `fake-tests.patch`

| Bug                                                                                                                                                                                                      | Fix                                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `lineTotal(1.1, 3)` returns `3.3000000000000003`                                                                                                                                                         | Round to cents: `Math.round(price * quantity * 100) / 100`                     |
| `percentOff(80, 150)` returns `-40`                                                                                                                                                                      | Clamp `percent` to 0–100, or clamp the result at 0                             |
| The first test calls a `vi.fn()` stand-in, not `lineTotal`. `toBeCloseTo(3.3, 0)` only checks to the nearest whole number, `toBeTruthy()` passes for any non-zero number, and the edge case is `it.skip` | Test the real functions with `toBe` on exact values, and un-skip the edge case |
