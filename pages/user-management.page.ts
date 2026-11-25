import type { Locator, Page } from '@playwright/test';
import type { FilePayload } from '@helpers/csv';
import { EmptyStateComponent } from '@pages/components/empty-state.component';
import { PaginationComponent } from '@pages/components/pagination.component';
import { SidebarComponent } from '@pages/components/sidebar.component';
import { ToastComponent } from '@pages/components/toast.component';

export const ROLE_NAMES = ['End User', 'Super User', 'Uploader', 'System Admin'] as const;
export type RoleName = (typeof ROLE_NAMES)[number];

export const COLUMNS = ['Email', 'Name', 'Company', 'Role', 'Status', 'Activation', 'Created Date'] as const;
export type Column = (typeof COLUMNS)[number];

export const TOAST_USER_EDITED = 'Successfully edited user detail';
export const TOAST_USER_APPROVED = 'Successfully approved user';
export const TOAST_USER_REJECTED = 'Successfully rejected user';

export type UserForm = { role?: RoleName; companies?: string[] };

/** A filter that shows "All Roles" until options are picked; several options can be picked */
export class MultiSelectFilter {
  readonly trigger: Locator;
  readonly clearButton: Locator;

  constructor(
    private readonly page: Page,
    allLabel: string,
  ) {
    // Verify on the real page: the trigger keeps its name after options are picked (it shows them instead)
    this.trigger = page.getByRole('combobox', { name: allLabel });
    this.clearButton = this.trigger.getByRole('button', { name: /clear/i });
  }

  option(name: string) {
    return this.page.getByRole('option', { name, exact: true });
  }

  get options() {
    return this.page.getByRole('option');
  }

  async select(...names: string[]) {
    await this.trigger.click();
    for (const name of names) await this.option(name).click();
    await this.page.keyboard.press('Escape');
  }
}

/** Confirm popups: "Update User Detail?", "Approve this user?", "Reject 3 users?", ... */
export class ConfirmDialog {
  readonly root: Locator;
  readonly confirmButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page, title: string | RegExp, confirmLabel: string | RegExp) {
    this.root = page.getByRole('dialog', { name: title });
    this.confirmButton = this.root.getByRole('button', { name: confirmLabel });
    this.cancelButton = this.root.getByRole('button', { name: 'Cancel', exact: true });
  }
}

export class EditUserDialog {
  readonly root: Locator;
  readonly emailInput: Locator;
  readonly nameInput: Locator;
  readonly roleSelect: Locator;
  readonly companySelect: Locator;
  readonly companyClearButton: Locator;
  readonly accountStatusToggle: Locator;
  readonly cancelButton: Locator;
  readonly saveButton: Locator;
  readonly confirm: ConfirmDialog;

  constructor(private readonly page: Page) {
    this.root = page.getByRole('dialog', { name: 'Edit User Detail' });
    this.emailInput = this.root.getByLabel('Email');
    this.nameInput = this.root.getByLabel('Name');
    this.roleSelect = this.root.getByRole('combobox', { name: 'Role' });
    this.companySelect = this.root.getByRole('combobox', { name: /Company/ });
    this.companyClearButton = this.root.getByRole('button', { name: /clear company/i });
    this.accountStatusToggle = this.root.getByRole('switch', { name: /Account Status/ });
    this.cancelButton = this.root.getByRole('button', { name: 'Cancel', exact: true });
    this.saveButton = this.root.getByRole('button', { name: 'Save', exact: true });
    this.confirm = new ConfirmDialog(page, 'Update User Detail?', 'Confirm');
  }

  /** Company options; the list may be rendered outside the dialog */
  companyOption(name: string) {
    return this.page.getByRole('option', { name, exact: true });
  }

  get companyOptions() {
    return this.page.getByRole('option');
  }

  async setRole(role: RoleName) {
    await this.roleSelect.click();
    await this.page.getByRole('option', { name: role, exact: true }).click();
  }

  async searchCompany(keyword: string) {
    await this.companySelect.click();
    await this.companySelect.pressSequentially(keyword);
  }

  /** Replaces the picked companies with `names` */
  async setCompanies(names: string[]) {
    await this.companyClearButton.click();
    await this.companySelect.click();
    for (const name of names) await this.companyOption(name).click();
    await this.page.keyboard.press('Escape');
  }

  async fill({ role, companies }: UserForm) {
    if (role !== undefined) await this.setRole(role);
    if (companies !== undefined) await this.setCompanies(companies);
  }

  /** Save, then Confirm in "Update User Detail?", and wait until both popups close */
  async saveAndConfirm() {
    await this.saveButton.click();
    await this.confirm.confirmButton.click();
    await this.root.waitFor({ state: 'hidden' });
  }
}

export class BatchUploadDialog {
  readonly root: Locator;
  readonly fileInput: Locator;
  readonly browseButton: Locator;
  readonly downloadTemplateButton: Locator;
  readonly uploadButton: Locator;
  readonly cancelButton: Locator;
  readonly reUploadButton: Locator;
  readonly removeFileButton: Locator;
  readonly validFileIcon: Locator;
  readonly confirm: ConfirmDialog;

  constructor(private readonly page: Page) {
    this.root = page.getByRole('dialog', { name: 'Upload to Edit Batch' });
    // The hidden <input type=file> behind Browse / drag-and-drop; setInputFiles needs the input itself
    this.fileInput = this.root.locator('input[type="file"]');
    this.browseButton = this.root.getByRole('button', { name: 'Browse' });
    this.downloadTemplateButton = this.root.getByRole('button', { name: /Download Template/ });
    this.uploadButton = this.root.getByRole('button', { name: 'Upload', exact: true });
    this.cancelButton = this.root.getByRole('button', { name: 'Cancel', exact: true });
    this.reUploadButton = this.root.getByRole('button', { name: 'Re-Upload' });
    this.removeFileButton = this.root.getByRole('button', { name: /remove file|delete file/i });
    // Verify on the real page: how the "file is valid" check icon is exposed
    this.validFileIcon = this.root.getByRole('img', { name: /valid|success/i });
    this.confirm = new ConfirmDialog(page, 'Edit User Detail?', 'Confirm');
  }

  /** The text that names the file once it is picked */
  fileName(name: string) {
    return this.root.getByText(name, { exact: true });
  }

  /** "Incorrect Data (Row 2)" / "Incorrect Data: 2 Rows (Row 2, 3)" */
  get incorrectDataError() {
    return this.root.getByText(/^Incorrect Data/);
  }

  errorText(text: string) {
    return this.root.getByText(text, { exact: true });
  }

  /** Count of one role in the summary of "Edit User Detail?" (and `Total`) */
  summaryCount(label: RoleName | 'Total') {
    return this.confirm.root
      .getByRole('row', { name: new RegExp(`^${label}\\b`) })
      .getByRole('cell')
      .last();
  }

  async choose(file: FilePayload) {
    await this.fileInput.setInputFiles(file);
  }

  async downloadTemplate() {
    const download = this.page.waitForEvent('download');
    await this.downloadTemplateButton.click();
    return download;
  }
}

export class UserManagementPage {
  readonly heading: Locator;
  readonly uploadBatchButton: Locator;
  readonly searchInput: Locator;
  readonly statusFilter: MultiSelectFilter;
  readonly roleFilter: MultiSelectFilter;
  readonly companyFilter: MultiSelectFilter;
  readonly table: Locator;
  readonly rows: Locator;
  /** Super user only: "Selected 0 items" with bulk Approve / Reject */
  readonly bulk: { selected: Locator; approveButton: Locator; rejectButton: Locator; selectAll: Locator };
  readonly editDialog: EditUserDialog;
  readonly batchDialog: BatchUploadDialog;
  readonly approveDialog: ConfirmDialog;
  readonly rejectDialog: ConfirmDialog;
  readonly emptyState: EmptyStateComponent;
  readonly pagination: PaginationComponent;
  readonly sidebar: SidebarComponent;
  readonly toast: ToastComponent;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'User Management', level: 1 });
    this.uploadBatchButton = page.getByRole('button', { name: 'Upload to Edit Batch' });
    this.searchInput = page.getByPlaceholder('Search by Email or Name');
    this.statusFilter = new MultiSelectFilter(page, 'All Statuses');
    this.roleFilter = new MultiSelectFilter(page, 'All Roles');
    this.companyFilter = new MultiSelectFilter(page, 'All Companies');
    this.table = page.getByRole('table');
    this.rows = this.table.getByRole('row').filter({ has: page.getByRole('cell') });
    this.bulk = {
      selected: page.getByText(/^Selected \d+ items?$/),
      approveButton: page.getByRole('button', { name: /^Approve( \(\d+\))?$/ }).first(),
      rejectButton: page.getByRole('button', { name: /^Reject( \(\d+\))?$/ }).first(),
      selectAll: this.table.getByRole('columnheader').getByRole('checkbox'),
    };
    this.editDialog = new EditUserDialog(page);
    this.batchDialog = new BatchUploadDialog(page);
    this.approveDialog = new ConfirmDialog(page, /^Approve (this user|\d+ users)\?$/, /^Approve/);
    this.rejectDialog = new ConfirmDialog(page, /^Reject (this user|\d+ users)\?$/, /^Reject/);
    this.emptyState = new EmptyStateComponent(page);
    this.pagination = new PaginationComponent(page);
    this.sidebar = new SidebarComponent(page);
    this.toast = new ToastComponent(page);
  }

  async goto() {
    await this.page.goto('/user-management');
  }

  columnHeader(column: Column) {
    return this.table.getByRole('columnheader', { name: column });
  }

  row(email: string) {
    return this.rows.filter({ has: this.page.getByRole('cell', { name: email, exact: true }) });
  }

  /**
   * Data cells only: the Super user's checkbox cell is skipped.
   * Verify on the real page: Approved rows may keep an empty checkbox cell, which would shift the index.
   */
  private dataCells(row: Locator) {
    return row.getByRole('cell').filter({ hasNot: this.page.getByRole('checkbox') });
  }

  cell(email: string, column: Column) {
    return this.dataCells(this.row(email)).nth(COLUMNS.indexOf(column));
  }

  checkboxOf(email: string) {
    return this.row(email).getByRole('checkbox');
  }

  editButtonOf(email: string) {
    return this.row(email).getByRole('button', { name: /edit/i });
  }

  approveButtonOf(email: string) {
    return this.row(email).getByRole('button', { name: /approve/i });
  }

  rejectButtonOf(email: string) {
    return this.row(email).getByRole('button', { name: /reject/i });
  }

  /** Texts of one column on the current page, top to bottom */
  async columnTexts(column: Column) {
    const index = COLUMNS.indexOf(column);
    return this.rows.evaluateAll(
      (rows, i) =>
        rows.map((row) => {
          const cells = [...row.querySelectorAll('td, [role=cell]')].filter(
            (c) => !c.querySelector('[type=checkbox]'),
          );
          return cells[i]?.textContent?.trim() ?? '';
        }),
      index,
    );
  }

  async search(keyword: string) {
    await this.searchInput.fill(keyword);
  }

  async openEditDialog(email: string) {
    await this.search(email);
    await this.editButtonOf(email).click();
  }

  /** System Admin: change Role/Company of one user and confirm */
  async editUser(email: string, changes: UserForm) {
    await this.openEditDialog(email);
    await this.editDialog.fill(changes);
    await this.editDialog.saveAndConfirm();
  }

  async setAccountStatus(email: string, active: boolean) {
    await this.openEditDialog(email);
    await this.editDialog.accountStatusToggle.setChecked(active);
    await this.editDialog.saveAndConfirm();
  }

  /** Super user: reject one user and wait for the popup to close */
  async rejectUser(email: string) {
    await this.search(email);
    await this.rejectButtonOf(email).click();
    await this.rejectDialog.confirmButton.click();
    await this.rejectDialog.root.waitFor({ state: 'hidden' });
  }

  /** Clean-up as a Super user: puts a Pending user back to Unassigned; does nothing when it isn't listed */
  async rejectIfPending(email: string) {
    await this.search(email);
    await this.row(email).or(this.emptyState.title).waitFor();
    if (await this.rejectButtonOf(email).isVisible()) await this.rejectUser(email);
  }

  /** Clean-up as a System Admin: turns a user back on when a test left it Inactive */
  async ensureActive(email: string) {
    await this.search(email);
    await this.cell(email, 'Activation').waitFor();
    if ((await this.cell(email, 'Activation').textContent())?.trim() !== 'Active') {
      await this.setAccountStatus(email, true);
    }
  }
}
