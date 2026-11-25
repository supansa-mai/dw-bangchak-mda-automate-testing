import type { Locator, Page } from '@playwright/test';

/** Rows per page + "1-20 of 57" + first/previous/next/last, under the tables */
export class PaginationComponent {
  readonly rowsPerPage: Locator;
  readonly range: Locator;
  readonly firstPage: Locator;
  readonly previousPage: Locator;
  readonly nextPage: Locator;
  readonly lastPage: Locator;

  constructor(private readonly page: Page) {
    this.rowsPerPage = page.getByRole('combobox', { name: /Rows per page/i });
    this.range = page.getByText(/^\d+-\d+ of \d+$/);
    // Verify on the real page: names of the icon-only paging buttons
    this.firstPage = page.getByRole('button', { name: /first page/i });
    this.previousPage = page.getByRole('button', { name: /previous page/i });
    this.nextPage = page.getByRole('button', { name: /next page/i });
    this.lastPage = page.getByRole('button', { name: /last page/i });
  }

  async setRowsPerPage(rows: number) {
    await this.rowsPerPage.click();
    await this.page.getByRole('option', { name: String(rows), exact: true }).click();
  }

  /** Total count from "1-20 of 57" */
  async total() {
    return Number((await this.range.textContent())?.match(/of (\d+)/)?.[1]);
  }
}
