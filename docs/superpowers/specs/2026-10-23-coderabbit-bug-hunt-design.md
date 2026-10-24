# CodeRabbit bug hunt: design

Date: 2026-10-23
Status: approved

## Goal

Add an optional workshop module, **01b · CodeRabbit bug hunt** (~15 min), placed after module 01. Attendees apply one of four seeded-bug patches, open a PR in their fork, let CodeRabbit find the bugs, and then fix them with CodeRabbit's own tools.

## Non-goals

- Pre-made bug branches. Forks copy only `main` by default, so patches are used, the same as `bulk-discount.patch`.
- New CI checks. The point is that lint, typecheck and the existing tests stay green, so **only the AI review** catches these bugs.

## Patches

The patches live in `workshop/patches/bug-hunt/`. Each one is independent and only touches files that are the same on every step branch from `step-1-coderabbit` onwards, or adds new files. That way each patch applies to `step-1-coderabbit`, `step-2-unit-tests`, `step-3-e2e`, `step-4-ci` and `main`.

| Patch                  | Disguised as                                            | Seeded bugs                                                                                                                                                                                                                                                                                                                                                                               |
| ---------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ai-security.patch`    | "Page context for the assistant and debug logging"      | 1. `chat-handler.ts` accepts a client-sent `system` role, which allows prompt injection. 2. `console.log` prints `GEMINI_API_KEY` into Worker logs. (A third bug, dropping the `addToCart` quantity bounds, was cut: `tools.spec` already rejects 0, 11 and 2.5, so the tests caught it.)                                                                                                 |
| `streaming-leak.patch` | "Stop generating button and elapsed timer"              | 1. `ChatService.stop()` only flips `streaming` to false. The fetch is never aborted and the reader never cancelled, so tokens and `addToCart` actions keep arriving after Stop. 2. Once stopped, a second `send()` runs alongside the first stream, and the first `finally` clears `streaming` early. 3. `setInterval` in the panel constructor is never cleared, and it runs during SSR. |
| `a11y.patch`           | "Compact quick-add and wishlist heart on product cards" | 1. The "Add to cart" button becomes an icon-only `＋` button with no accessible name, so screen readers announce "button". 2. The new wishlist heart button has no name and shows its state by colour only, with no `aria-pressed`. 3. `.link:focus { outline: none }` removes the focus indicator.                                                                                       |
| `fake-tests.patch`     | "Money helpers with tests"                              | 1. `lineTotal` returns raw float maths (`1.1 * 3 = 3.3000000000000003`). 2. `percentOff` doesn't clamp, so 150% gives a negative price. 3. The new spec "tests" a `vi.fn()` stand-in instead of the real function, uses `toBeTruthy()` and `toBeCloseTo(3.3, 0)`, which hide the bug, and has the edge-case test marked `it.skip`.                                                        |

Constraints that every patch must meet, on both `step-1-coderabbit` and `main`:

- `git apply --check` succeeds.
- `pnpm lint`, `pnpm typecheck` and `pnpm test` pass, on `main` with the full specs.
- `pnpm build` succeeds.

A first draft of `a11y.patch` used `<div (click)>` and `<span (click)>`. `pnpm lint` rejected it (`click-events-have-key-events`, `interactive-supports-focus`), so the patch now uses real buttons and keeps only the bugs ESLint can't see.

- Each bug is real. A throwaway probe (not committed) shows the bad behaviour.

## Fix workflow taught

On their bug-hunt PR, each attendee uses at least two of these:

1. **Commit suggestion**, for one-line committable suggestions.
2. **🤖 Prompt for AI Agents**: copy it into Copilot Chat, review the change, then push.
3. **`@coderabbitai fix comments`**, or the _Fix comments_ checkbox: CodeRabbit commits the fixes to the branch. The stacked-PR variant is mentioned. These need a Pro feature, which is free for public repos; the guide says it's optional.
4. **`@coderabbitai` chat**, to ask "why is this a bug?" or to have it generate a regression test.

Then they push, watch the incremental review resolve the threads, and compare findings with a neighbour who took a different patch.

## Docs and site changes

- New `workshop/01b-bug-hunt.md`, with the usual Steps / Expected result / If stuck sections, a per-patch findings table, and fix hints.
- `workshop/README.md`: add 01b to the agenda as optional (+15 min, 75 min in total), and add the bug-hunt patches to the file list.
- `workshop/prompts.md`: a new "Module 01b" section with prompts.
- `workshop/facilitator-notes.md`: the expected findings for each patch, round-robin assignment, and fallbacks.
- `.coderabbit.yaml`: path-instruction hints so these classes of bug are reliably flagged (accessibility in templates, subscription and timer cleanup, prompt-injection roles).
- `site/scripts/sync-content.mjs` `PAGES` and the `site/astro.config.mjs` sidebar get the new page, and the site tests are updated.

## Verification

- A script loops over the patches × {`step-1-coderabbit`, `main`} in a throwaway worktree, and runs `git apply --check` plus the lint, typecheck, test and build checks.
- Site: `pnpm --filter smartcart-workshop-guide test`, `build` and `e2e` pass, and the deployed site shows the new page.
- Rehearsal: open one PR per patch on the upstream repo against `step-1-coderabbit`, confirm that CodeRabbit flags the seeded bugs, then close the PRs.
