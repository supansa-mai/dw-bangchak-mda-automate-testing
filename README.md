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
npm test                                             # everything except @uses-up-users
npx playwright test tests/authentication -g "TS01-TC01"
npm run test:smoke                                   # @smoke only
npm run test:no-data                                 # also skip @creates-data (no new companies)
npm run test:use-up-users                            # only the approve tests that use up pool users (7 per run)
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
pages/components/*.component.ts   parts shared across pages (sidebar, toast, pagination, empty state, list filter);
                              parts of one page (its dialogs, filters) stay in its page file
fixtures/index.ts             custom `test`: page objects, `role` option, `openAs(role)` = a second window as another role
config/environments.ts        base URL + timeoutScale per env, scaled()
config/auth.ts                roles, session files, credentials from .env
config/test-users.ts          Azure test users that User Management tests change and put back (emails in .env)
helpers/                      reusable code that isn't a page: test data, CSV files, table sorting, Bangkok dates, activity log checks
```

## Adding a test case

1. Find the case in the test-case sheet (tab = feature folder).
2. Add to the spec for that screen, or create `tests/<feature>/<screen>.spec.ts`.
3. Import from `@fixtures`, not `@playwright/test`:

```ts
import { test, expect } from '@fixtures';

test.use({ role: 'super-user' }); // default: system-admin, null = signed out

test.describe('TS02-TC01 ระบบพาไปหน้า Home ตาม Role หลังเข้าสู่ระบบสำเร็จ', () => {
  test('Super user เห็นหน้า Workspace', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Workspace' })).toBeVisible();
  });
});
```

## Conventions

- **describe** = `TSxx-TCxx <description from the sheet>`; **test** title = short outcome (Thai OK).
- **Locators**: `getByRole` > `getByLabel` / `getByText` > `getByTestId` > CSS (last resort, comment why).
- **Assertions** live in specs; page objects only hold locators and actions. The one shared check is
  `helpers/activity-log.ts`, used by every spec that verifies its own activity log.
- **Activity logs** are checked in the spec whose action writes them (Create company → add-company.spec). Find a log
  by a text only that test writes (`expectLogged`); when the text repeats between runs, count before the action
  (`expectNewLog`).
- No `waitForTimeout`; wait with `expect(...)` (web-first assertions) instead.
- Every test creates its own data and can run alone, in any order.
- Cases with status On Hold → `test.fixme('... (On Hold, <ref>)')`.
- Tags (`{ tag: '...' }` option, not in the title): `@smoke` = critical path; `@creates-data` = leaves records on the
  env that can't be deleted (companies), skipped by `npm run test:no-data`; `@uses-up-users` = approves pool users
  for good (see below), never run unless asked for with `npm run test:use-up-users`.
- Data the tests create gets a readable unique name starting with `AUTO`, e.g. `AUTO Star Power UIOM` (`uniqueName()` in `helpers/test-data.ts`), so it can be found and cleaned up.
- Users can't be created (they come from the Azure sync), so User Management tests use dedicated test users from
  `config/test-users.ts` and put them back in `afterEach` (reject → Unassigned, toggle → Active). Each user belongs to
  one spec file, and that file runs `serial`. Approving a user can't be undone, so those cases take still-Unassigned
  users from a pool in `.env` (`USER_APPROVE_POOL_EMAILS`, `USER_SYSADMIN_POOL_EMAILS`) and use them up: 7 per full
  run. Top the pools up when a test says they ran out.
- A sheet case that can't be written yet (waits for another page or a decision) → `todo('<what> (รอ <what>)')`.
- A case that stays manual (Azure sync, signing in as a test user behind MFA, states that can't be set up safely on
  UAT) is not in the specs: its sheet row gets Note `Manual: <reason>`.
- **Done** = passes `--repeat-each=5`, lint + typecheck clean, sheet's Automate column updated.
