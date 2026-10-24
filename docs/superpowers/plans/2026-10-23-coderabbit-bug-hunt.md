# CodeRabbit Bug Hunt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an optional module 01b, with four seeded-bug patches that CodeRabbit catches and attendees then fix with CodeRabbit's tools.

**Architecture:** Each bug is a `git diff` patch in `workshop/patches/bug-hunt/`. Patches are authored in a throwaway worktree on `main`, and the guide page links to them. A verification script applies each patch to `step-1-coderabbit` and `main`, then runs lint, typecheck, test and build.

**Tech Stack:** Angular 22, Vitest 5, pnpm 12, Astro Starlight (guide site), CodeRabbit.

Spec: `docs/superpowers/specs/2026-10-23-coderabbit-bug-hunt-design.md`

---

### Task 1: Author `ai-security.patch`

**Files:** `src/shared/agent-events.ts`, `src/server/chat-handler.ts`, `src/server/tools.ts`, in worktree `/tmp/bh` (detached `main`).

- [ ] Widen `ChatMessage.role` to `'user' | 'assistant' | 'system'`, documented as "page context from the storefront".
- [ ] Make `isChatMessage` accept `system`, and update the error text to match.
- [ ] Add `console.log('[chat] provider=%s key=%s', provider.name, env.GEMINI_API_KEY)` to `handleChat`.
- [ ] Change `addToCart` to `const quantity = Math.max(1, Number(args['quantity'] ?? 1));` (no upper bound, no integer check). Remove `MAX_QUANTITY`. Change the schema `maximum` to `1000`, with the description "Bulk orders welcome".
- [ ] Save it with `git diff > workshop/patches/bug-hunt/ai-security.patch`, then run `git checkout .`.

### Task 2: Author `streaming-leak.patch`

**Files:** `src/app/assistant/chat.service.ts`, `src/app/assistant/assistant-panel.ts`

- [ ] Add `stop(): void { this.isStreaming.set(false); }` to `ChatService`. Don't add an abort, and don't add a generation guard in `consume`/`apply`.
- [ ] In the panel, show a `data-testid="assistant-stop"` Stop button while streaming, and a "Thinking… {{ elapsed() }}s" label driven by `setInterval` in the constructor. The interval is never cleared.
- [ ] Save it with `git diff > workshop/patches/bug-hunt/streaming-leak.patch`, then run `git checkout .`.

### Task 3: Author `a11y.patch`

**Files:** `src/app/products/product-card.ts`

- [ ] Replace the Add to cart `<button>` with `<div class="quick-add" data-testid="add-to-cart" title="Add to cart" (click)="cart.add(item)">＋</div>`.
- [ ] Add a wishlist `<span class="heart" [class.saved]="saved()" (click)="saved.set(!saved())">♥</span>` that relies on colour only.
- [ ] Add CSS `.link:focus { outline: none; }`.
- [ ] Save it with `git diff > workshop/patches/bug-hunt/a11y.patch`.

### Task 4: Author `fake-tests.patch`

**Files:** create `src/shared/money.ts` and `src/shared/money.spec.ts`.

- [ ] `lineTotal(price, quantity) = price * quantity`. `percentOff(amount, percent) = amount - (amount * percent) / 100`.
- [ ] Write the spec: one test uses a `vi.fn()` stand-in, one uses `toBeTruthy`, one uses `toBeCloseTo(3.3, 0)`, and one is `it.skip('never goes below zero')`.
- [ ] Run `git add -N src/shared/money*.ts && git diff > workshop/patches/bug-hunt/fake-tests.patch`.

### Task 5: Verify the patches

- [ ] For each patch and each ref in {`step-1-coderabbit`, `main`}, in a clean worktree: `git apply --check`, `git apply`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`. Everything must pass. On step-1 a missing spec is fine.
- [ ] Probe each bug with a throwaway script or test. For example: a `system` role gets a 200, `addToCart` with 1e6 succeeds, `stop()` still applies later events, and `lineTotal(1.1,3) !== 3.3`.

### Task 6: Docs

- [ ] `workshop/01b-bug-hunt.md`: the module, with Steps, the per-patch findings table, the fix flows, Expected result and If stuck.
- [ ] `workshop/README.md`: the agenda row (optional, 75 min in total) and the file list.
- [ ] `workshop/prompts.md`: a "Module 01b" section.
- [ ] `workshop/facilitator-notes.md`: expected findings and assignment.
- [ ] `.coderabbit.yaml`: path-instruction hints.
- [ ] Link 01b from the end of `workshop/01-coderabbit.md`.

### Task 7: Guide site

- [ ] Add `{ file: '01b-bug-hunt.md', slug: '01b-bug-hunt' }` to `PAGES` after `01-coderabbit`, and add it to the sidebar items.
- [ ] Update the site tests that count pages. Run `pnpm --filter smartcart-workshop-guide test`, `build` and `e2e`.

### Task 8: Ship

- [ ] Commit (no Co-authored-by trailer), push `main`, and confirm the CI and Guide site workflows are green. Redeploy the site with `wrangler deploy`.
- [ ] Rehearsal: open one PR per patch against `step-1-coderabbit`, confirm that CodeRabbit flags the seeded bugs, and record the findings in the facilitator notes. Close the PRs.
