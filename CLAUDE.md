# Project facts for Claude

Playwright + TypeScript UI E2E for **Bangchak MD&A – Report Generator**. Desktop Chrome only, no API tests, no CI yet.
Maintained by one QA. Follow README conventions; import `{ test, expect }` from `@fixtures`.

## Sources

- Test cases: Google Sheet `144wcE48NTGnO17QK1-ghtsLCSsA98iMheZhJ1QULyIA` ("[BCP] Bangchak_MD&A_Test Case")
  - Tabs → folders: Authentication (CBM-3) → `tests/authentication`, Company Management (CBM-4) → `tests/company-management`,
    User Management (CBM-6) → `tests/user-management`, Activity Logs (CBM-7) → `tests/activity-logs`
  - Also: Index, Requirement Review (RR-xx), Traceability
- Jira: project **CBM** on dwj.atlassian.net (board 737)
- Figma: file `lbG7lGVelEi332UcJzrNlQ` (BCP – Report Generator)

## Environments

- `TEST_ENV=dev|uat`, default and write target = **uat**. Base URLs live in `config/environments.ts` (not confirmed yet).
- DEV uses a mock SSO until BCP IT finishes the Azure app registration – the Microsoft page object won't fit there.

## Auth

- Microsoft Azure SSO only, MFA required by BCP policy → `npm run auth:manual` saves sessions; then `--no-deps`.
- Roles (fixture option `role`): `system-admin`, `super-user`, `end-user`, `uploader`; `null` = signed out.
- Session expires after ~15 min idle (TS01-TC02).
- Home page per role: System Admin → User Management, Super user → My Request, End user → Workspace, Uploader → Data source.

## Reuse from dw-postmax-automate-testing (port to TS when a case needs it)

- `helpers/orderData.js` parseCsv/readDownload → Activity Logs export, User Management batch upload
- `helpers/portal.js` openPortal/forUsers → second browser context as another role (TS02-TC03, Approve/Reject)
- `pages/BasePage.js` access-denied locators → an `AccessDeniedComponent` (composition, not a base class)
- `helpers/thaiDate.js`, `helpers/testData.js` → date filters, random names/emails

## Open questions

- UAT/DEV base URLs; test accounts per role and whether MFA can be disabled for them.
- `data-testid` not agreed with devs yet; locators unverified until the app is reachable.
