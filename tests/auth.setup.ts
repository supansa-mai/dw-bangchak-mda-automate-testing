import { test as setup, expect } from '@playwright/test';
import { MANUAL_LOGIN_TIMEOUT, MicrosoftLoginPage } from '@pages/microsoft-login.page';
import { SignInPage } from '@pages/sign-in.page';
import { ROLES, authFile, manualLogin } from '@config/auth';
import { baseURL, scaled } from '@config/environments';

const appOrigin = new URL(baseURL).origin;
const signedInTimeout = manualLogin ? MANUAL_LOGIN_TIMEOUT : scaled(30_000);

for (const role of ROLES) {
  setup(`sign in as ${role}`, async ({ page }) => {
    setup.setTimeout(signedInTimeout + scaled(30_000));
    const signInPage = new SignInPage(page);
    await signInPage.goto();
    await signInPage.startMicrosoftSignIn();
    await new MicrosoftLoginPage(page).signInAs(role);

    await expect(page).toHaveURL((url) => url.origin === appOrigin && !/sign-?in/i.test(url.pathname), {
      timeout: signedInTimeout,
    });
    await page.context().storageState({ path: authFile(role) });
  });
}
