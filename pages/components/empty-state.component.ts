import type { Locator, Page } from '@playwright/test';

/** "Search not found" shown by a table when search/filters match nothing */
export class EmptyStateComponent {
  readonly title: Locator;
  readonly message: Locator;
  readonly resetFiltersButton: Locator;

  constructor(page: Page) {
    this.title = page.getByText('Search not found', { exact: true });
    this.message = page.getByText(
      'No results matched your search or filters. Try adjusting your keywords or clearing filters.',
    );
    this.resetFiltersButton = page.getByRole('button', { name: 'Reset Filters' });
  }
}
