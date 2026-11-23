import { expect, type Page } from '@playwright/test';
import { credentialsFor, manualLogin, type Role } from '@config/auth';

export const MANUAL_LOGIN_TIMEOUT = 5 * 60_000;

export class MicrosoftLoginPage {
  constructor(private readonly page: Page) {}

  async signInAs(role: Role) {
    await expect(this.page).toHaveURL(/login\.microsoftonline\.com/);
    if (manualLogin) {
      // MFA can't be automated: the tester finishes sign-in in the headed browser.
      console.log(`>> Sign in as ${role} in the browser window (${MANUAL_LOGIN_TIMEOUT / 60_000} min limit)`);
      return;
    }
    const { email, password } = credentialsFor(role);
    await this.page.locator('input[name="loginfmt"]').fill(email);
    await this.page.getByRole('button', { name: 'Next' }).click();
    await this.page.locator('input[name="passwd"]').fill(password);
    await this.page.getByRole('button', { name: 'Sign in' }).click();
    await this.page.getByRole('button', { name: 'Yes' }).click();
  }
}
