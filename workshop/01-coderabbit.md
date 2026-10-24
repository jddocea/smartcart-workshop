# 01 · AI code review with CodeRabbit

|                     |                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------- |
| **Goal**            | Configure CodeRabbit with project-specific rules and watch it catch real bugs in a PR |
| **Time box**        | 10 minutes (5–15)                                                                     |
| **Starting branch** | `step-0-start` (solution: `step-1-coderabbit`)                                        |

## Steps

### 1. Install CodeRabbit on your fork

Go to <https://github.com/apps/coderabbitai>, then **Install**. Pick your account and choose **Only select repositories → smartcart-workshop**. It's free for public repositories. Sign in to <https://app.coderabbit.ai> once with GitHub so the org is set up.

### 2. Add `.coderabbit.yaml`

Either have Copilot draft it with [prompt 1.1](prompts.md#11-draft-coderabbityaml), or copy the finished file:

```bash
git checkout origin/step-1-coderabbit -- .coderabbit.yaml
```

Here's what each section does:

| Section                                   | Why                                                                                                                                                                                          |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `# yaml-language-server: $schema=…`       | VS Code autocompletes and validates the file against `schema.v2.json`                                                                                                                        |
| `reviews.profile: assertive`              | More nitpicky than `chill`. Good for a workshop, and often for real projects                                                                                                                 |
| `high_level_summary`, `sequence_diagrams` | A PR summary and a mermaid diagram of the changed flow. `poem: false` keeps the noise down                                                                                                   |
| `auto_review`                             | Reviews every non-draft PR without being asked. `base_branches: [".*"]` extends it beyond the default branch to PRs into the `step-*` branches                                               |
| `path_instructions`                       | The project knowledge a generic reviewer lacks: SSR-safety in `src/app/**`, Worker and secret rules in `src/server/**`, deterministic Vitest in `**/*.spec.ts`, Playwright rules in `e2e/**` |
| `pre_merge_checks.title`                  | Warns when the PR title isn't Conventional Commits                                                                                                                                           |
| `pre_merge_checks.custom_checks`          | **Tests for new logic**: warns when `src/` logic changes without a spec or e2e test                                                                                                          |
| `tools`                                   | Runs ESLint, gitleaks (secrets) and actionlint (workflows), and folds their findings into the review                                                                                         |
| `code_generation.unit_tests`              | Guidance used when you ask CodeRabbit to generate tests                                                                                                                                      |
| `chat.auto_reply`                         | CodeRabbit answers replies to its own comments without needing an `@coderabbitai` mention                                                                                                    |

Commit it and push the branch to your fork:

```bash
git add .coderabbit.yaml
git commit -m "chore: configure CodeRabbit"
git push origin step-0-start
```

### 3. Open a PR with seeded bugs

The patch adds a "bulk discount" feature: 10% off any line with a quantity of 3 or more, plus a promo banner in the header. It contains deliberate bugs.

```bash
git checkout -b feat/bulk-discount
git apply workshop/patches/bulk-discount.patch
git add src
git commit -m "feat: bulk discount for 3+ items"
git push -u origin feat/bulk-discount
```

Now open a PR **in your fork**: base `step-0-start` ← compare `feat/bulk-discount`. GitHub defaults to the upstream repo, so change the base repository to your own fork.

> **Auto review and non-default branches.** CodeRabbit only auto-reviews PRs into the default branch (`main`) unless `reviews.auto_review.base_branches` says otherwise. Our config sets it to `".*"`, so PRs into `step-0-start` are reviewed too. If a review still doesn't start, comment `@coderabbitai review`.

### 4. Watch the review

The review takes a minute or two. Look for:

- **The discount ignores quantity.** `CartStore.discount` in `src/app/cart/cart.store.ts` checks `this.lines().length < 3`, which is the number of lines, not `line.quantity`. It then discounts every line. One mug × 5 gets nothing, while three different items × 1 get 10% off.
- **`localStorage` during SSR.** `src/app/layout/header.ts` reads `localStorage` in a field initializer with no `isPlatformBrowser` check. This is the `src/app/**` path instruction at work. The header renders on every server-rendered route, so in the Worker every page except `/cart` (which is client-only, see `src/app/app.routes.server.ts`) returns **500 `ReferenceError: localStorage is not defined`**.
- **Magic numbers.** `3` and `0.1` are written inline instead of as named constants.
- **The "Tests for new logic" pre-merge check** shows a warning, because the PR changes `src/` logic without a `*.spec.ts`.

You can confirm the SSR bug yourself: run `pnpm preview` on the branch and open <http://localhost:8787>.

> **Unit tests don't catch the SSR bug.** If you apply the patch on `main` (which has the full test suite), `pnpm test` still passes. jsdom provides `localStorage`, and no existing spec has three or more cart lines. The SSR break only shows up in a real Worker, so `pnpm e2e` fails. That's why module 03 exists.

### 5. Talk to CodeRabbit

Comment on the PR, or reply in a review thread:

| Command                             | What it does                                                                                                   |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `@coderabbitai explain`             | Explains the code or comment in the thread (use it as a reply on a line)                                       |
| `@coderabbitai full review`         | Re-reviews the whole PR from scratch                                                                           |
| A reply to a review comment         | Push back or ask why. Try [prompt 1.5](prompts.md#15-reply-to-a-coderabbit-comment-paste-on-the-pr)            |
| `@coderabbitai generate unit tests` | Finishing Touches: generates tests for the PR's changes. You can also tick the checkbox in the summary comment |
| `@coderabbitai help`                | Lists all the commands                                                                                         |

### 6. Fix with Copilot and push

Use [prompts 1.2–1.4](prompts.md#12-fix-the-bulk-discount-calculation): fix the discount, make the banner SSR-safe, and add tests. Then:

```bash
pnpm lint && pnpm test
git add -A src
git commit -m "fix: apply bulk discount per line and guard localStorage"
git push
```

CodeRabbit runs an **incremental review**. It only looks at the new commits and resolves the threads you fixed.

## Expected result

- CodeRabbit posts a summary, a sequence diagram and inline comments for the quantity bug and the SSR `localStorage` bug, plus a warning from the tests pre-merge check.
- After your fix commit, the incremental review clears the resolved findings.

## If stuck

- **No review appears.** Check that the app is installed on _your fork_ (GitHub → Settings → Applications → CodeRabbit → Repository access). Then comment `@coderabbitai review`.
- **`git apply` fails.** Make sure you branched from `step-0-start`, or a later step, with a clean tree: `git status`. Use `git apply --check workshop/patches/bulk-discount.patch` to see the conflict.
- **Fall back.** Run `git checkout step-1-coderabbit`. It has the config and none of the bug fixes, so you can start module 02 from there.

## Next

Got time? [01b Bug hunt](01b-bug-hunt.md) has four more PRs with hidden bugs that pass every check, and shows how to fix them with CodeRabbit's suggestions, AI-agent prompts and `@coderabbitai fix comments`. Otherwise go on to [02 Unit tests](02-unit-tests.md).
