import { test as base, type BrowserContext, type Page } from '@playwright/test';
import { CompanyManagementPage } from '@pages/company-management.page';
import { SignInPage } from '@pages/sign-in.page';
import { UserManagementPage } from '@pages/user-management.page';
import { authFile, type Role } from '@config/auth';

type Options = {
  /** Role whose saved session the test runs with; `null` = no session (signed out). */
  role: Role | null;
};

type Fixtures = {
  signInPage: SignInPage;
  companyManagementPage: CompanyManagementPage;
  userManagementPage: UserManagementPage;
  /** A second browser window signed in as another role, e.g. the Super user who approves; closed after the test */
  openAs: (role: Role) => Promise<Page>;
};

export const test = base.extend<Options & Fixtures>({
  role: ['system-admin', { option: true }],
  storageState: async ({ role }, use) => {
    await use(role ? authFile(role) : { cookies: [], origins: [] });
  },
  signInPage: async ({ page }, use) => {
    await use(new SignInPage(page));
  },
  companyManagementPage: async ({ page }, use) => {
    await use(new CompanyManagementPage(page));
  },
  userManagementPage: async ({ page }, use) => {
    await use(new UserManagementPage(page));
  },
  openAs: async ({ browser, baseURL, locale, timezoneId }, use) => {
    const contexts: BrowserContext[] = [];
    await use(async (role) => {
      // browser.newContext() doesn't get the project's `use` options, so pass the ones the app depends on
      const context = await browser.newContext({ storageState: authFile(role), baseURL, locale, timezoneId });
      contexts.push(context);
      return context.newPage();
    });
    await Promise.all(contexts.map((context) => context.close()));
  },
});

export { expect } from '@playwright/test';

/** A case from the sheet that can't be written yet; the title says what it waits for. Shows as fixme in the report */
export function todo(title: string) {
  test.fixme(title, async () => {});
}
