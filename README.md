# Bangchak MD&A (Report Generator) – Automate Testing

Playwright + TypeScript UI E2E tests for Bangchak Report Generator (desktop Chrome only).

## Setup

```bash
nvm use                      # Node 20 (.nvmrc)
npm ci
npx playwright install chromium
cp .env.example .env         # fill in base URLs and test accounts
```

`.env` and `.auth/` are git-ignored. Never commit credentials.

## Environments

`TEST_ENV=dev|uat` (default `uat`) picks the env in [config/environments.ts](config/environments.ts), which holds the
base URLs (not secret, so they are committed) and `timeoutScale`. `BASE_URL` in `.env` overrides the URL.
`.env` holds only accounts and switches. Tests that create data run on **uat**.

Wrap any hard-coded timeout in `scaled(ms)` so a slower env needs one change only.

## Sign-in (Microsoft SSO, 4 roles)

The `setup` project signs in once per role and saves the session to `.auth/<env>-<role>.json`.
Roles: `system-admin`, `super-user`, `end-user`, `uploader`.

| Situation                              | Command                                                                                                         |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Test accounts without MFA              | `npm test` (signs in automatically before tests)                                                                |
| Accounts with MFA                      | `npm run auth:manual` – a browser opens per role, sign in yourself (5 min each), then `npm run test:reuse-auth` |
| Sessions already saved and still valid | `npm run test:reuse-auth`                                                                                       |

Sessions expire (about 15 minutes idle per the test cases), so re-run the sign-in step when tests start landing on the Sign in page.

## Running

```bash
npm test                                             # everything
npx playwright test tests/authentication -g "TS01-TC01"
npm run test:smoke                                   # @smoke only
npm run test:ui                                      # UI mode for debugging
npm run report                                       # open last HTML report (traces on failure)
VIDEO=1 npx playwright test -g "TS01-TC01"           # record video of every test, slowed down (evidence)
npm run lint && npm run typecheck
```

## Layout

```
tests/<feature>/*.spec.ts     one folder per sheet tab (authentication, company-management, user-management, activity-logs)
tests/auth.setup.ts           sign in per role → .auth/
pages/*.page.ts               page objects (actions + locators, no assertions)
pages/components/*.component.ts   parts shared across pages (sidebar, table, dialog) – add when needed
fixtures/index.ts             custom `test`: page objects + `role` option
config/environments.ts        base URL + timeoutScale per env, scaled()
config/auth.ts                roles, session files, credentials from .env
helpers/                      reusable code that isn't a page: test data, CSV/date parsing, multi-role sessions
                              (created with its first helper)
```

## Adding a test case

1. Find the case in the test-case sheet (tab = feature folder).
2. Add to the spec for that screen, or create `tests/<feature>/<screen>.spec.ts`.
3. Import from `@fixtures`, not `@playwright/test`:

```ts
import { test, expect } from '@fixtures';

test.use({ role: 'super-user' }); // default: system-admin, null = signed out

test.describe('TS02-TC01 ระบบพาไปหน้า Home ตาม Role หลังเข้าสู่ระบบสำเร็จ', () => {
  test('Super user เห็นหน้า My Request', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'My Request' })).toBeVisible();
  });
});
```

## Conventions

- **describe** = `TSxx-TCxx <description from the sheet>`; **test** title = short outcome (Thai OK).
- **Locators**: `getByRole` > `getByLabel` / `getByText` > `getByTestId` > CSS (last resort, comment why).
- **Assertions** live in specs; page objects only hold locators and actions.
- No `waitForTimeout`; wait with `expect(...)` (web-first assertions) instead.
- Every test creates its own data and can run alone, in any order.
- Cases with status On Hold → `test.fixme('... (On Hold, <ref>)')`.
- Tags: `@smoke` = critical path.
- **Done** = passes `--repeat-each=5`, lint + typecheck clean, sheet's Automate column updated.
