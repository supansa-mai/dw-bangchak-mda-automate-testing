import { test, expect, todo } from '@fixtures';
import { credentialsFor } from '@config/auth';
import { expectLogged } from '@helpers/activity-log';
import { uniqueName } from '@helpers/test-data';
import { TOAST_COMPANY_EDITED } from '@pages/company-management.page';

test.fixme(true, 'Draft: no UAT URL/account yet, locators not verified on the real page');

// Seed company for the cases that must not save anything, so they create no data
const UNCHANGED_COMPANY = 'BBGI';

test.beforeEach(async ({ companyManagementPage: companies }) => {
  await companies.goto();
});

test.describe('TS03-TC01 System Admin สามารถแก้ไขชื่อบริษัท', () => {
  test('แก้ชื่อซ้ำกับบริษัทอื่น แสดง error และไม่บันทึก', async ({ companyManagementPage: companies }) => {
    const dialog = companies.editDialog;
    await companies.openEditDialog(UNCHANGED_COMPANY);
    await dialog.fill({ name: 'BCPG' });

    await dialog.submit();

    await expect(dialog.duplicateNameError).toBeVisible();
    await expect(dialog.submitButton).toBeDisabled();
    await dialog.cancelButton.click();
    await expect(companies.row(UNCHANGED_COMPANY)).toBeVisible();
  });

  test('ลบชื่อออกทั้งหมด ปุ่ม Save กดไม่ได้', async ({ companyManagementPage: companies }) => {
    await companies.openEditDialog(UNCHANGED_COMPANY);

    await companies.editDialog.companyNameInput.clear();

    await expect(companies.editDialog.submitButton).toBeDisabled();
  });

  test('ไม่แก้ค่า ปุ่ม Save กดไม่ได้', async ({ companyManagementPage: companies }) => {
    await companies.openEditDialog(UNCHANGED_COMPANY);

    await expect(companies.editDialog.companyNameInput).toHaveValue(UNCHANGED_COMPANY);
    await expect(companies.editDialog.submitButton).toBeDisabled();
  });

  test('แก้ค่าแล้วกด Cancel ข้อมูลเดิมไม่เปลี่ยน', async ({ companyManagementPage: companies }) => {
    await companies.openEditDialog(UNCHANGED_COMPANY);
    await companies.editDialog.fill({ name: uniqueName() });

    await companies.editDialog.cancelButton.click();

    await expect(companies.editDialog.root).toBeHidden();
    await expect(companies.row(UNCHANGED_COMPANY)).toBeVisible();
  });
});

test.describe('TS03-TC02 System Admin สามารถแก้ไข Main Company', () => {
  test('Dropdown Main Company ไม่แสดงบริษัทตัวเอง', async ({ companyManagementPage: companies }) => {
    const dialog = companies.editDialog;
    await companies.openEditDialog(UNCHANGED_COMPANY);

    await dialog.openMainCompanyList();

    await expect(dialog.mainCompanyOption('BCP')).toBeVisible();
    await expect(dialog.mainCompanyOption(UNCHANGED_COMPANY)).toBeHidden();
  });

  // One company goes through every edit in turn, with a child company to check TS03-TC03; covers TS03-TC01 too
  test(
    'แก้ชื่อและ Main Company ทุกแบบสำเร็จ',
    { tag: '@creates-data' },
    async ({ companyManagementPage: companies, userManagementPage: users, activityLogPage: logs }) => {
      const dialog = companies.editDialog;
      const name = uniqueName();
      const renamed = `${name} Edited`;
      const finalName = `${name} Final`;
      const child = uniqueName('Child');
      await companies.addCompany({ name, mainCompany: 'BCP' });
      await companies.addCompany({ name: child, mainCompany: name });
      await companies.search(name);

      await test.step('เปลี่ยน Main Company เป็นบริษัทอื่น', async () => {
        await companies.editCompany(name, { mainCompany: 'BCPG' });
        await expect(companies.toast.withTitle(TOAST_COMPANY_EDITED)).toBeVisible();
        await expect(companies.mainCompanyOf(name)).toHaveText('BCPG');
      });

      await test.step('ลบ Main Company ออก ตารางแสดง "-"', async () => {
        await companies.openEditDialog(name);
        await dialog.mainCompanyClearButton.click();
        await dialog.submit();
        await expect(dialog.root).toBeHidden();
        await expect(companies.mainCompanyOf(name)).toHaveText('-');
      });

      await test.step('เพิ่ม Main Company ให้บริษัทที่ยังไม่มี', async () => {
        await companies.editCompany(name, { mainCompany: 'BBGI' });
        await expect(companies.mainCompanyOf(name)).toHaveText('BBGI');
      });

      await test.step('แก้ชื่อบริษัท', async () => {
        await companies.openEditDialog(name);
        await expect(dialog.companyNameInput).toHaveValue(name);
        await expect(dialog.mainCompanyInput).toHaveValue('BBGI');
        await dialog.fill({ name: renamed });
        await dialog.submit();
        await expect(dialog.root).toBeHidden();
        await companies.search(renamed);
        await expect(companies.row(renamed)).toBeVisible();
        await expect(companies.row(name)).toBeHidden();
      });

      await test.step('แก้ทั้งชื่อและ Main Company พร้อมกัน', async () => {
        await companies.editCompany(renamed, { name: finalName, mainCompany: 'BCP' });
        await companies.search(finalName);
        await expect(companies.mainCompanyOf(finalName)).toHaveText('BCP');
      });

      await test.step('บริษัทลูกแสดงชื่อ Main Company ใหม่', async () => {
        await companies.search(child);
        await expect(companies.mainCompanyOf(child)).toHaveText(finalName);
      });

      await test.step('ตัวกรอง Company ในหน้า User Management แสดงชื่อล่าสุด', async () => {
        await users.goto();
        await users.companyFilter.trigger.click();
        await expect(users.companyFilter.option(finalName)).toBeVisible();
        await expect(users.companyFilter.option(name)).toBeHidden();
        await expect(users.companyFilter.option(renamed)).toBeHidden();
      });

      await test.step('บันทึก View log และ Edit log 1 รายการต่อการ Save เฉพาะฟิลด์ที่เปลี่ยน', async () => {
        const admin = credentialsFor('system-admin').email;
        await expect(
          await expectLogged(
            logs,
            { email: admin, activity: 'View', object: 'Company' },
            `viewed Company "${name}"`,
          ),
        ).not.toHaveCount(0);

        const edits = { email: admin, activity: 'Edit', object: 'Company' } as const;
        const edited = await expectLogged(logs, edits, `edited Company "${name}"`);
        for (const change of [
          'Main company: BCP → BCPG',
          'Main company: BCPG → None',
          'Main company: None → BBGI',
        ]) {
          await expect(edited.filter({ hasText: change })).toHaveCount(1);
        }
        const renameLog = (await expectLogged(logs, edits, `Company name: ${name} → ${renamed}`)).first();
        await expect(renameLog).not.toContainText('Main company');
        await expect(
          await expectLogged(
            logs,
            edits,
            `Company name: ${renamed} → ${finalName}; Main company: BBGI → BCP`,
          ),
        ).toHaveCount(1);
      });
    },
  );
});

test.describe('TS03-TC03 ตรวจสอบผลกระทบเมื่อแก้ชื่อบริษัท', () => {
  // Needs a user assigned to the new company; the shared test users belong to the User Management specs
  todo('ผู้ใช้งานของบริษัทแสดงชื่อใหม่ในคอลัมน์ Company (รอ test user ของ spec นี้ใน .env)');
});
