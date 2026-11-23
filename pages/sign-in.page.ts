import type { Page } from '@playwright/test';

export class SignInPage {
  readonly logo;
  readonly title;
  readonly signInWithMicrosoftButton;

  constructor(private readonly page: Page) {
    this.logo = page.getByRole('img', { name: /bangchak/i });
    this.title = page.getByText('Report Generator', { exact: true });
    this.signInWithMicrosoftButton = page.getByRole('button', { name: 'Sign in with Microsoft' });
  }

  async goto() {
    await this.page.goto('/');
  }

  async startMicrosoftSignIn() {
    await this.signInWithMicrosoftButton.click();
  }
}
