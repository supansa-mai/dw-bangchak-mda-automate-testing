import type { Locator, Page } from '@playwright/test';

/** A list-page filter that shows its label ("All Roles", "Select Activity") until an option is picked; one at a time */
export class SelectFilter {
  readonly trigger: Locator;
  readonly clearButton: Locator;

  constructor(
    private readonly page: Page,
    label: string,
  ) {
    // Verify on the real page: the trigger keeps its name after an option is picked (it shows the option instead)
    this.trigger = page.getByRole('combobox', { name: label });
    this.clearButton = this.trigger.getByRole('button', { name: /clear/i });
  }

  option(name: string) {
    return this.page.getByRole('option', { name, exact: true });
  }

  get options() {
    return this.page.getByRole('option');
  }

  /** Picking an option replaces the one picked before */
  async select(name: string) {
    await this.trigger.click();
    await this.option(name).click();
  }
}
