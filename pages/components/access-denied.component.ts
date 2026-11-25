import type { Locator, Page } from '@playwright/test';

/** "Access denied" with a button back to the role's home, e.g. [Back to Workspace] */
export class AccessDeniedComponent {
  readonly title: Locator;

  constructor(private readonly page: Page) {
    this.title = page.getByRole('heading', { name: 'Access denied' });
  }

  /** Verify on the real page: whether it is a button or a link */
  backButton(name: string) {
    return this.page
      .getByRole('button', { name, exact: true })
      .or(this.page.getByRole('link', { name, exact: true }));
  }
}
