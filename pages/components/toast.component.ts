import type { Locator, Page } from '@playwright/test';

/** The generic toast for any failed API call, the same on every page */
export const TOAST_API_ERROR = { title: 'Something went wrong', message: 'Please try again.' } as const;

export class ToastComponent {
  private readonly root: Locator;

  constructor(page: Page) {
    // Sonner toasts have no role of their own; data-sonner-toast is the library's stable hook
    this.root = page.locator('[data-sonner-toast]');
  }

  withTitle(title: string) {
    return this.root.filter({ hasText: title });
  }
}
