# Facilitator notes

## Pre-workshop checklist

- [ ] The upstream repo `santoshyadavdev/smartcart-workshop` is public and has all five checkpoint branches: `step-0-start`, `step-1-coderabbit`, `step-2-unit-tests`, `step-3-e2e`, `step-4-ci`.
- [ ] On a fresh fork (with **Copy the `main` branch only** unticked), each branch runs `pnpm install && pnpm start`.
- [ ] `git apply --check workshop/patches/bulk-discount.patch` passes on `step-0-start`.
- [ ] CodeRabbit is installed on your own demo fork, and a rehearsal PR shows the expected findings (quantity bug, SSR `localStorage`, missing-tests warning).
- [ ] A rehearsal `CI` run on `step-4-ci` is green, so `quality` and `e2e` appear in the ruleset check picker.
- [ ] The Cloudflare demo Worker `smartcart-workshop` is already deployed, as a fallback for the live demo, and you have its `workers.dev` URL ready.
- [ ] Your Gemini key is in `.dev.vars` for the live demo. Attendees don't need one.
- [ ] Ask attendees in advance to install Node 24, run `corepack enable`, and run `pnpm exec playwright install chromium`. The Playwright browser download is the slowest step on venue Wi-Fi.

## Timing tips

| Time  | Module     | Tip                                                                                                            |
| ----- | ---------- | -------------------------------------------------------------------------------------------------------------- |
| 0–5   | Setup      | Start `pnpm install` first, then talk through the architecture diagram while it runs                           |
| 5–15  | CodeRabbit | Open the PR in the **first 3 minutes**, because the review takes 1–3 minutes. Explain the config while it runs |
| 15–30 | Unit tests | Live-code prompts 2.4 and 2.5 (streaming and fake LLM client). Let attendees pick one of the others            |
| 30–42 | E2E        | Run `pnpm e2e` once early, because the first build plus `wrangler dev` start takes time. Demo `--ui` mode      |
| 42–52 | CI         | Push first, then explain the gates while the run is in progress. Set up the ruleset during the `e2e` job       |
| 52–60 | Deploy     | Show your pre-connected Worker. Attendees can finish their own setup after the session                         |

If you're behind schedule, modules 02 and 03 can be cut short by taking the solution branch. Everything downstream still works.

## Fallback branches

Each branch is cumulative. An attendee can jump in at any point:

| Behind on                          | Run                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------ |
| 01 → 02                            | `git checkout step-1-coderabbit`                                         |
| 02 → 03                            | `git checkout step-2-unit-tests`                                         |
| 03 → 04                            | `git checkout step-3-e2e`                                                |
| 04 → 05                            | `git checkout step-4-ci`                                                 |
| Keep own work, take only the files | `git checkout origin/<branch> -- <paths>` (see each module's "If stuck") |

Use `origin/<branch>` as the source for path checkouts. A bare branch name only resolves after the attendee has checked out a local branch with that name.

## Common failures

| Symptom                                                  | Cause and fix                                                                                                                                                                                                                                                                                               |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pathspec 'step-0-start' did not match`                  | The fork was made with **Copy the `main` branch only**. Fix: `git remote add upstream https://github.com/santoshyadavdev/smartcart-workshop.git && git fetch upstream && git checkout -b step-0-start upstream/step-0-start`, then push the branches to the fork (`git push origin step-0-start` and so on) |
| `pnpm: command not found` or a wrong pnpm version        | Run `corepack enable`. This reads `packageManager: pnpm@10.33.4`. Check with `pnpm -v`                                                                                                                                                                                                                      |
| `Address already in use :8787`, or e2e hits an old build | Another `wrangler dev` or `pnpm preview` is running. Find it with `lsof -i :8787` and stop it. Locally, Playwright reuses an existing server                                                                                                                                                                |
| `Executable doesn't exist … chromium`                    | Run `pnpm exec playwright install chromium`. Linux may also need `--with-deps`                                                                                                                                                                                                                              |
| No CodeRabbit review                                     | The app isn't installed on the **fork**, or the PR was opened against upstream, or the base isn't the default branch. Comment `@coderabbitai review`                                                                                                                                                        |
| `git apply` fails                                        | The tree is dirty or on the wrong branch. Run `git status` and `git stash`, then start from `step-0-start` or later                                                                                                                                                                                         |
| Assistant says "demo mode" with a key set                | For `pnpm start`, the key must be in the environment: `GEMINI_API_KEY=… pnpm start`. `.dev.vars` is only read by wrangler (`pnpm preview`)                                                                                                                                                                  |
| Actions don't run on the fork                            | Forks have Actions disabled until you click **enable** in the Actions tab                                                                                                                                                                                                                                   |
| `quality` or `e2e` not in the ruleset check picker       | A check has to run once before it can be selected. Push a commit or run the workflow manually (`workflow_dispatch`)                                                                                                                                                                                         |
| Workers Build fails on the name                          | The dashboard Worker name must be `smartcart-workshop`, matching `wrangler.jsonc`                                                                                                                                                                                                                           |
| The preview URL runs in demo mode                        | Previews use separate variables and secrets. Add `GEMINI_API_KEY` to the preview settings as well                                                                                                                                                                                                           |

## Notes on the seeded patch

- `workshop/patches/bulk-discount.patch` touches only `src/app/cart/cart.store.ts`, `src/app/cart/cart.page.ts` and `src/app/layout/header.ts`. It contains no specs, so it applies on every checkpoint branch.
- On `main`, the existing unit tests **still pass** with the patch applied. jsdom has `localStorage`, and no spec builds a cart with three lines. `pnpm e2e` **fails**, because SSR of `/` returns 500. This is a good talking point: unit tests alone miss runtime-specific bugs.
- The reference fix: apply the discount per line when `line.quantity >= BULK_MIN_QUANTITY`, and read `localStorage` only when `isPlatformBrowser(inject(PLATFORM_ID))` is true. `CartStore` already shows the pattern.
