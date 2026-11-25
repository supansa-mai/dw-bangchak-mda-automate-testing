import type { Download, Locator, Page } from '@playwright/test';
import { SelectFilter } from '@pages/components/select-filter.component';
import { PaginationComponent } from '@pages/components/pagination.component';
import { SidebarComponent } from '@pages/components/sidebar.component';
import { ToastComponent } from '@pages/components/toast.component';

export const LOG_COLUMNS = [
  'Date',
  'Email',
  'Name',
  'Company',
  'Role',
  'Activity',
  'Object',
  'Description',
] as const;
export type LogColumn = (typeof LOG_COLUMNS)[number];

/** Options of Select Activity: the sheet's list, named as in Figma ("Login", not "Log in") */
export const ACTIVITIES = [
  'Login',
  'Logout',
  'Access',
  'Search',
  'View',
  'Create',
  'Edit',
  'Delete',
  'Export',
  'Approve',
  'Reject',
  'Revision',
  'Submit',
] as const;
export type Activity = (typeof ACTIVITIES)[number];

/** Activities with no Object: picking one keeps Select Object disabled */
export const ACTIVITIES_WITHOUT_OBJECT: readonly Activity[] = ['Login', 'Logout'];

/** Objects the Sprint 1 pages write; pages (Access, Search) are "… management", records are singular */
export type LogObject =
  'Company management' | 'User management' | 'Activity Log' | 'Company' | 'User' | 'Template';

export type LogQuery = {
  /** Who did it: the Email search type */
  email?: string;
  /** Who did it: the Name search type */
  name?: string;
  company?: string;
  activity?: Activity;
  object?: LogObject;
};

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export class ActivityLogPage {
  readonly heading: Locator;
  readonly exportButton: Locator;
  readonly yearSelect: Locator;
  readonly dateRangePicker: Locator;
  readonly previousMonthButton: Locator;
  readonly nextMonthButton: Locator;
  readonly searchTypeSelect: Locator;
  readonly searchInput: Locator;
  readonly companyFilter: SelectFilter;
  readonly activityFilter: SelectFilter;
  readonly objectFilter: SelectFilter;
  /** Shown before any search or filter: the page loads no logs until then */
  readonly startState: { title: Locator; message: Locator };
  readonly noMatch: Locator;
  readonly table: Locator;
  readonly rows: Locator;
  readonly pagination: PaginationComponent;
  readonly sidebar: SidebarComponent;
  readonly toast: ToastComponent;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Activity Log', level: 1 });
    this.exportButton = page.getByRole('button', { name: 'Export (.csv)' });
    // Verify on the real page: accessible names of the Year and search type dropdowns and the calendar arrows
    this.yearSelect = page.getByRole('combobox', { name: /year/i });
    this.dateRangePicker = page.getByPlaceholder('Start Date - End Date');
    this.previousMonthButton = page.getByRole('button', { name: /previous month/i });
    this.nextMonthButton = page.getByRole('button', { name: /next month/i });
    this.searchTypeSelect = page.getByRole('combobox', { name: /^(Name|Email)$/ });
    this.searchInput = page.getByPlaceholder(/^Search by (Name|Email)$/);
    this.companyFilter = new SelectFilter(page, 'Select Company');
    this.activityFilter = new SelectFilter(page, 'Select Activity');
    this.objectFilter = new SelectFilter(page, 'Select Object');
    this.startState = {
      title: page.getByText('Search or filter to view activity', { exact: true }),
      message: page.getByText('Enter an email or name, or select a filter, to load activity logs.'),
    };
    this.noMatch = page.getByText('No matching activity', { exact: true });
    this.table = page.getByRole('table');
    this.rows = this.table.getByRole('row').filter({ has: page.getByRole('cell') });
    this.pagination = new PaginationComponent(page);
    this.sidebar = new SidebarComponent(page);
    this.toast = new ToastComponent(page);
  }

  async goto() {
    // Verify on the real page: the route
    await this.page.goto('/activity-log');
  }

  columnHeader(column: LogColumn) {
    return this.table.getByRole('columnheader', { name: column });
  }

  /** Rows whose text has `text`, e.g. a company name or "Company name: A → B" in the Description */
  logRows(text: string | RegExp) {
    return this.rows.filter({ hasText: text });
  }

  cell(row: Locator, column: LogColumn) {
    return row.getByRole('cell').nth(LOG_COLUMNS.indexOf(column));
  }

  /** Texts of one column on the current page, top to bottom */
  async columnTexts(column: LogColumn) {
    const rows = await this.rows.all();
    return Promise.all(rows.map((row) => this.cell(row, column).innerText()));
  }

  option(name: string) {
    return this.page.getByRole('option', { name, exact: true });
  }

  /** The calendar of one month, e.g. "November 2026"; the picker shows two side by side */
  month(date: Date) {
    return this.page.getByRole('grid', { name: `${MONTHS[date.getMonth()]} ${date.getFullYear()}` });
  }

  /**
   * A day in its month's calendar. Each calendar also shows the first days of the next month and the last days of the
   * previous one (greyed), so day 1-15 is the first cell with that number and day 16-31 the last.
   */
  day(date: Date) {
    const cells = this.month(date).getByRole('gridcell', { name: String(date.getDate()), exact: true });
    return date.getDate() <= 15 ? cells.first() : cells.last();
  }

  async selectYear(year: string) {
    await this.yearSelect.click();
    await this.option(year).click();
  }

  /** Both dates must be in the months the picker opens on (the current month and the next) */
  async selectDateRange(from: Date, to: Date) {
    await this.dateRangePicker.click();
    await this.day(from).click();
    await this.day(to).click();
  }

  /** Clicks Next until it is disabled, which Figma says happens at the end of the selected year */
  async showLastMonthOfYear() {
    for (let i = 0; i < 12 && (await this.nextMonthButton.isEnabled()); i++)
      await this.nextMonthButton.click();
  }

  async searchBy(type: 'Email' | 'Name', keyword: string) {
    await this.searchTypeSelect.click();
    await this.option(type).click();
    await this.searchInput.fill(keyword);
  }

  // Verify on the real page: whether each filter loads on change (as written here) or needs a Search button
  async query({ email, name, company, activity, object }: LogQuery) {
    if (email !== undefined) await this.searchBy('Email', email);
    if (name !== undefined) await this.searchBy('Name', name);
    if (company !== undefined) await this.companyFilter.select(company);
    if (activity !== undefined) await this.activityFilter.select(activity);
    if (object !== undefined) await this.objectFilter.select(object);
  }

  /** Number of logs the current search shows, across all pages (0 = "No matching activity") */
  async resultCount() {
    await this.rows.first().or(this.noMatch).waitFor();
    return (await this.noMatch.isVisible()) ? 0 : this.pagination.total();
  }

  /** Opens the page fresh, runs `query` and returns how many logs match */
  async count(query: LogQuery) {
    await this.goto();
    await this.query(query);
    return this.resultCount();
  }

  async exportCsv(): Promise<Download> {
    const download = this.page.waitForEvent('download');
    await this.exportButton.click();
    return download;
  }
}
