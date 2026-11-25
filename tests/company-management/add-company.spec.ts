import type { Page } from '@playwright/test';
import { test, expect, todo } from '@fixtures';
import { credentialsFor } from '@config/auth';
import { uniqueName } from '@helpers/test-data';
import { TOAST_COMPANY_ADDED } from '@pages/company-management.page';

test.fixme(true, 'Draft: no UAT URL/account yet, locators not verified on the real page');

/** Makes the save request of the company form answer 500 */
async function failCompanySave(page: Page) {
  await page.route(/compan/i, async (route) => {
    if (route.request().method() === 'POST') await route.fulfill({ status: 500 });
    else await route.continue();
  });
}

test.beforeEach(async ({ companyManagementPage: companies }) => {
  await companies.goto();
});

test.describe('TS02-TC01 System Admin สามารถเพิ่มบริษัทใหม่', () => {
  test('เปิด modal Add new company เห็นฟิลด์ครบ', async ({ companyManagementPage: companies }) => {
    const dialog = companies.addDialog;

    await companies.openAddDialog();

    await expect(dialog.root).toBeVisible();
    await expect(dialog.companyNameInput).toBeEmpty();
    await expect(dialog.mainCompanyInput).toBeEmpty();
    await expect(dialog.cancelButton).toBeVisible();
    await expect(dialog.submitButton).toBeVisible();
  });

  test(
    'เพิ่มบริษัทโดยไม่เลือก Main Company สำเร็จ และเลือกได้ใน Edit User Detail',
    { tag: ['@smoke', '@creates-data'] },
    async ({ page, companyManagementPage: companies, userManagementPage: users }) => {
      // Thai and special characters in the name also check that the table shows them as plain text
      const name = `${uniqueName()} บางจาก & Co. <test>`;

      await companies.addCompany({ name });

      await expect(companies.toast.withTitle(TOAST_COMPANY_ADDED)).toContainText(
        'You can now assign users and datasources to this company.',
      );
      await companies.search(name);
      await expect(companies.row(name)).toBeVisible();
      await expect(companies.mainCompanyOf(name)).toHaveText('-');

      await test.step('บริษัทใหม่แสดงใน Company dropdown ของ Edit User Detail', async () => {
        // Any approved user will do: the dialog is closed with Cancel, so nothing is saved
        const { email } = credentialsFor('end-user');
        await users.goto();
        await users.openEditDialog(email);
        await users.editDialog.searchCompany(name);
        await expect(users.editDialog.companyOption(name)).toBeVisible();
        await page.keyboard.press('Escape');
        await users.editDialog.cancelButton.click();
      });
    },
  );

  test(
    'เพิ่มบริษัทพร้อมเลือก Main Company สำเร็จ',
    { tag: '@creates-data' },
    async ({ companyManagementPage: companies }) => {
      const name = uniqueName();

      await companies.addCompany({ name, mainCompany: 'BCP' });

      await expect(companies.toast.withTitle(TOAST_COMPANY_ADDED)).toBeVisible();
      await companies.search(name);
      await expect(companies.mainCompanyOf(name)).toHaveText('BCP');
    },
  );

  test('บันทึกไม่สำเร็จจาก error ของระบบ ข้อมูลที่กรอกยังอยู่ใน modal', async ({
    page,
    companyManagementPage: companies,
  }) => {
    const dialog = companies.addDialog;
    const name = uniqueName();
    await failCompanySave(page);

    await companies.openAddDialog();
    await dialog.fill({ name });
    await dialog.submit();

    // The error message itself is still waiting for design (RR-28)
    await expect(dialog.root).toBeVisible();
    await expect(dialog.companyNameInput).toHaveValue(name);
  });

  todo('บันทึก Create log และไม่บันทึก log ตอนเปิด/ปิด modal (รอ ActivityLogPage)');
});

test.describe('TS02-TC02 ตรวจสอบ Main Company dropdown (Optional)', () => {
  test.beforeEach(async ({ companyManagementPage: companies }) => {
    await companies.openAddDialog();
  });

  test('เปิด dropdown แสดงบริษัทในระบบให้เลือก', async ({ companyManagementPage: companies }) => {
    const dialog = companies.addDialog;

    await dialog.openMainCompanyList();

    for (const name of ['BCP', 'BCPG', 'BBGI']) {
      await expect(dialog.mainCompanyOption(name)).toBeVisible();
    }
  });

  test('พิมพ์ค้นหาแล้วแสดงเฉพาะบริษัทที่ตรง และเลือกได้', async ({ companyManagementPage: companies }) => {
    const dialog = companies.addDialog;

    await dialog.searchMainCompany('BBG');

    await expect(dialog.mainCompanyOption('BBGI')).toBeVisible();
    await expect(dialog.mainCompanyOption('BCP')).toBeHidden();
    await dialog.mainCompanyOption('BBGI').click();
    await expect(dialog.mainCompanyInput).toHaveValue('BBGI');
  });

  test('ลบ Main Company ที่เลือกออกได้', async ({ companyManagementPage: companies }) => {
    const dialog = companies.addDialog;
    await dialog.selectMainCompany('BCP');
    await expect(dialog.mainCompanyInput).toHaveValue('BCP');

    await dialog.mainCompanyClearButton.click();

    await expect(dialog.mainCompanyInput).toHaveValue('');
    await expect(dialog.mainCompanyInput).toHaveAttribute('placeholder', 'Select Main Company');
  });
});

test.describe('TS02-TC03 ตรวจสอบ validation ของ Company Name', () => {
  test('ไม่กรอก Company Name ปุ่ม Add กดไม่ได้', async ({ companyManagementPage: companies }) => {
    await companies.openAddDialog();

    await expect(companies.addDialog.submitButton).toBeDisabled();
  });

  test('กรอกเว้นวรรคอย่างเดียว ปุ่ม Add กดไม่ได้', async ({ companyManagementPage: companies }) => {
    await companies.openAddDialog();
    await companies.addDialog.fill({ name: '   ' });

    await expect(companies.addDialog.submitButton).toBeDisabled();
  });

  test('ชื่อซ้ำกับบริษัทที่มีอยู่ แสดง error และไม่บันทึก', async ({ companyManagementPage: companies }) => {
    const dialog = companies.addDialog;
    await companies.openAddDialog();
    await dialog.fill({ name: 'BCP' });

    await dialog.submit();

    await expect(dialog.duplicateNameError).toBeVisible();
    await expect(dialog.submitButton).toBeDisabled();
    await expect(dialog.root).toBeVisible();
  });

  test('กด Cancel หรือ X ปิด modal โดยไม่บันทึก', async ({ companyManagementPage: companies }) => {
    const dialog = companies.addDialog;
    const name = uniqueName();

    for (const closeWith of [dialog.cancelButton, dialog.closeButton]) {
      await companies.openAddDialog();
      await dialog.fill({ name });
      await closeWith.click();
      await expect(dialog.root).toBeHidden();
    }

    await companies.search(name);
    await expect(companies.emptyState.title).toBeVisible();
  });
});
