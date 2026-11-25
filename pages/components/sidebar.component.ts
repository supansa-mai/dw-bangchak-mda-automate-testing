import type { Page } from '@playwright/test';

export class SidebarComponent {
  constructor(private readonly page: Page) {}

  /** Every menu link, section headings excluded */
  get menus() {
    return this.page.getByRole('navigation').getByRole('link');
  }

  menu(name: string) {
    return this.page.getByRole('navigation').getByRole('link', { name, exact: true });
  }

  async open(name: string) {
    await this.menu(name).click();
  }
}
