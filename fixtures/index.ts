import { test as base } from '@playwright/test';
import { SignInPage } from '@pages/sign-in.page';
import { authFile, type Role } from '@config/auth';

type Options = {
  /** Role whose saved session the test runs with; `null` = no session (signed out). */
  role: Role | null;
};

type Pages = {
  signInPage: SignInPage;
};

export const test = base.extend<Options & Pages>({
  role: ['system-admin', { option: true }],
  storageState: async ({ role }, use) => {
    await use(role ? authFile(role) : { cookies: [], origins: [] });
  },
  signInPage: async ({ page }, use) => {
    await use(new SignInPage(page));
  },
});

export { expect } from '@playwright/test';
