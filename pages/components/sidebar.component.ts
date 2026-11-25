import type { Page } from '@playwright/test';

export class SidebarComponent {
  constructor(private readonly page: Page) {}

  menu(name: string) {
    return this.page.getByRole('navigation').getByRole('link', { name, exact: true });
  }

  async open(name: string) {
    await this.menu(name).click();
  }
}
