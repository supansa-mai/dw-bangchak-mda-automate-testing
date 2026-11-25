import type { Locator, Page } from '@playwright/test';
import { EmptyStateComponent } from '@pages/components/empty-state.component';
import { PaginationComponent } from '@pages/components/pagination.component';
import { SidebarComponent } from '@pages/components/sidebar.component';
import { ToastComponent } from '@pages/components/toast.component';

export const TOAST_COMPANY_ADDED = 'Successfully added new company';
export const TOAST_COMPANY_EDITED = 'Successfully edited company';

export type CompanyForm = { name?: string; mainCompany?: string };

/** The Add new company / Edit company detail modal; both have the same fields */
export class CompanyDialogComponent {
  readonly root: Locator;
  readonly companyNameInput: Locator;
  readonly mainCompanyInput: Locator;
  readonly mainCompanyClearButton: Locator;
  readonly duplicateNameError: Locator;
  readonly cancelButton: Locator;
  readonly closeButton: Locator;
  readonly submitButton: Locator;

  constructor(
    private readonly page: Page,
    mode: 'add' | 'edit',
  ) {
    this.root = page.getByRole('dialog', {
      name: mode === 'add' ? 'Add new company' : 'Edit company detail',
    });
    this.companyNameInput = this.root.getByLabel('Company Name');
    this.mainCompanyInput = this.root.getByRole('combobox', { name: /Main Company/ });
    // Verify on the real page: the clear (x) of the Main Company field, not the one of Company Name
    this.mainCompanyClearButton = this.root.getByRole('button', { name: /clear main company/i });
    this.duplicateNameError = this.root.getByText('This company already exists.', { exact: true });
    this.cancelButton = this.root.getByRole('button', { name: 'Cancel', exact: true });
    this.closeButton = this.root.getByRole('button', { name: 'Close', exact: true });
    this.submitButton = this.root.getByRole('button', { name: mode === 'add' ? 'Add' : 'Save', exact: true });
  }

  /** Options of the Main Company list; the list may be rendered outside the dialog */
  mainCompanyOption(name: string) {
    return this.page.getByRole('option', { name, exact: true });
  }

  get mainCompanyOptions() {
    return this.page.getByRole('option');
  }

  async openMainCompanyList() {
    await this.mainCompanyInput.click();
  }

  async searchMainCompany(keyword: string) {
    await this.mainCompanyInput.fill(keyword);
  }

  async selectMainCompany(name: string) {
    await this.openMainCompanyList();
    await this.mainCompanyOption(name).click();
  }

  async fill({ name, mainCompany }: CompanyForm) {
    if (name !== undefined) await this.companyNameInput.fill(name);
    if (mainCompany !== undefined) await this.selectMainCompany(mainCompany);
  }

  async submit() {
    await this.submitButton.click();
  }
}

export class CompanyManagementPage {
  readonly heading: Locator;
  readonly addNewCompanyButton: Locator;
  readonly searchInput: Locator;
  readonly table: Locator;
  readonly rows: Locator;
  readonly emptyState: EmptyStateComponent;
  readonly pagination: PaginationComponent;
  readonly addDialog: CompanyDialogComponent;
  readonly editDialog: CompanyDialogComponent;
  readonly sidebar: SidebarComponent;
  readonly toast: ToastComponent;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Company Management', level: 1 });
    this.addNewCompanyButton = page.getByRole('button', { name: 'Add New Company' });
    this.searchInput = page.getByPlaceholder('Search by Company Name');
    this.table = page.getByRole('table');
    this.rows = this.table.getByRole('row').filter({ has: page.getByRole('cell') });
    this.emptyState = new EmptyStateComponent(page);
    this.pagination = new PaginationComponent(page);
    this.addDialog = new CompanyDialogComponent(page, 'add');
    this.editDialog = new CompanyDialogComponent(page, 'edit');
    this.sidebar = new SidebarComponent(page);
    this.toast = new ToastComponent(page);
  }

  async goto() {
    await this.page.goto('/company-management');
  }

  columnHeader(name: 'Company Name' | 'Main Company') {
    return this.table.getByRole('columnheader', { name });
  }

  row(companyName: string) {
    return this.rows.filter({ has: this.page.getByRole('cell', { name: companyName, exact: true }) });
  }

  /** Main Company cell of a company's row (2nd column) */
  mainCompanyOf(companyName: string) {
    return this.row(companyName).getByRole('cell').nth(1);
  }

  editButtonOf(companyName: string) {
    return this.row(companyName).getByRole('button', { name: /edit/i });
  }

  /** Texts of one column on the current page, top to bottom (0 = Company Name, 1 = Main Company) */
  async columnTexts(index: 0 | 1) {
    return this.rows.evaluateAll(
      (rows, i) => rows.map((r) => r.querySelectorAll('td, [role=cell]')[i]?.textContent?.trim() ?? ''),
      index,
    );
  }

  async search(keyword: string) {
    await this.searchInput.fill(keyword);
  }

  async openAddDialog() {
    await this.addNewCompanyButton.click();
  }

  async openEditDialog(companyName: string) {
    await this.search(companyName);
    await this.editButtonOf(companyName).click();
  }

  /** Adds a company and waits until the modal closes */
  async addCompany(company: Required<Pick<CompanyForm, 'name'>> & CompanyForm) {
    await this.openAddDialog();
    await this.addDialog.fill(company);
    await this.addDialog.submit();
    await this.addDialog.root.waitFor({ state: 'hidden' });
  }

  async editCompany(companyName: string, changes: CompanyForm) {
    await this.openEditDialog(companyName);
    await this.editDialog.fill(changes);
    await this.editDialog.submit();
    await this.editDialog.root.waitFor({ state: 'hidden' });
  }
}
