import { test, expect, todo } from '@fixtures';
import { testUsers } from '@config/test-users';
import { TOAST_USER_EDITED, UserManagementPage, type UserForm } from '@pages/user-management.page';

test.fixme(true, 'Draft: no UAT URL/account yet, locators not verified on the real page');

// The tests share two Azure test users and put them back afterwards, so they must not run at the same time
test.describe.configure({ mode: 'serial' });

/** What testUsers.approved is between tests */
const APPROVED_DEFAULT = { role: 'End User', companies: ['BCP'] } satisfies UserForm;

test.beforeEach(async ({ userManagementPage: users }) => {
  await users.goto();
});

/** Puts testUsers.unassigned back to Unassigned: a Super user of BCP rejects it if a test left it Pending */
test.afterEach(async ({ openAs }) => {
  const superUser = new UserManagementPage(await openAs('super-user'));
  await superUser.goto();
  await superUser.rejectIfPending(testUsers.unassigned);
});

test.describe('TS02-TC02 ตรวจสอบช่อง Email และ Name ของผู้ใช้งานที่ sync มา', () => {
  test('ช่อง Email และ Name แก้ไขไม่ได้', async ({ userManagementPage: users }) => {
    const dialog = users.editDialog;

    await users.openEditDialog(testUsers.unassigned);

    await expect(dialog.emailInput).toHaveValue(testUsers.unassigned);
    await expect(dialog.emailInput).toBeDisabled();
    await expect(dialog.nameInput).toBeDisabled();
  });
});

test.describe('TS03-TC01 System Admin : กำหนด Role,Company ให้ผู้ใช้งาน (User)', () => {
  test('เปิด modal Edit User Detail ของผู้ใช้ Unassigned เห็นค่าเริ่มต้นครบ', async ({
    userManagementPage: users,
  }) => {
    const dialog = users.editDialog;

    await users.openEditDialog(testUsers.unassigned);

    await expect(dialog.root).toBeVisible();
    await expect(dialog.roleSelect).toHaveText('End User');
    await expect(dialog.companySelect).toContainText('Select Company');
    await expect(dialog.accountStatusToggle).toBeDisabled();
    await expect(dialog.cancelButton).toBeVisible();
    await expect(dialog.saveButton).toBeDisabled();
  });

  test(
    'กำหนด End User + BCP แล้วเป็น Pending รออนุมัติ',
    { tag: '@smoke' },
    async ({ userManagementPage: users, openAs }) => {
      const email = testUsers.unassigned;
      const dialog = users.editDialog;

      await users.openEditDialog(email);
      await dialog.fill({ role: 'End User', companies: ['BCP'] });
      await dialog.saveButton.click();
      await expect(dialog.confirm.root).toBeVisible();
      await dialog.confirm.confirmButton.click();

      await expect(users.toast.withTitle(TOAST_USER_EDITED)).toBeVisible();
      await expect(users.cell(email, 'Role')).toHaveText('End User');
      await expect(users.cell(email, 'Company')).toHaveText('BCP');
      await expect(users.cell(email, 'Status')).toHaveText('Pending');
      await expect(users.cell(email, 'Activation')).toHaveText('Inactive');

      await test.step('Super user BCP เห็นผู้ใช้ในรายการรออนุมัติ', async () => {
        const superUser = new UserManagementPage(await openAs('super-user'));
        await superUser.goto();
        await superUser.search(email);
        await expect(superUser.approveButtonOf(email)).toBeVisible();
      });
    },
  );

  test('กด Cancel ใน modal ยืนยัน กลับสู่ modal Edit โดยไม่บันทึก', async ({ userManagementPage: users }) => {
    const email = testUsers.unassigned;
    const dialog = users.editDialog;
    await users.openEditDialog(email);
    await dialog.fill({ role: 'End User', companies: ['BCP'] });
    await dialog.saveButton.click();

    await dialog.confirm.cancelButton.click();

    await expect(dialog.confirm.root).toBeHidden();
    await expect(dialog.root).toBeVisible();
    await dialog.cancelButton.click();
    await expect(users.cell(email, 'Status')).toHaveText('-');
  });

  test('กด Cancel ใน modal Edit ปิดโดยไม่บันทึก', async ({ userManagementPage: users }) => {
    const email = testUsers.unassigned;
    const dialog = users.editDialog;
    await users.openEditDialog(email);
    await dialog.fill({ role: 'Uploader', companies: ['BCPG'] });

    await dialog.cancelButton.click();

    await expect(dialog.root).toBeHidden();
    await expect(users.cell(email, 'Role')).toHaveText('-');
  });

  todo('บันทึก View log ตอนเปิด modal และ Edit log พร้อมค่าก่อน/หลัง (รอ ActivityLogPage)');
});

test.describe('TS03-TC02 ตรวจสอบการเลือก Company ตาม Role', () => {
  test.beforeEach(async ({ userManagementPage: users }) => {
    await users.openEditDialog(testUsers.unassigned);
  });

  for (const role of ['End User', 'Super User', 'Uploader'] as const) {
    test(`Role = ${role} ต้องเลือก Company ก่อน Save`, async ({ userManagementPage: users }) => {
      const dialog = users.editDialog;

      await dialog.setRole(role);
      await expect(dialog.companySelect).toContainText('Select Company');
      await expect(dialog.saveButton).toBeDisabled();

      await dialog.setCompanies(['BCP']);
      await expect(dialog.saveButton).toBeEnabled();
    });
  }

  test('Role = System Admin แสดง All Company และ Save กดได้ทันที', async ({ userManagementPage: users }) => {
    const dialog = users.editDialog;

    await dialog.setRole('System Admin');

    await expect(dialog.companySelect).toContainText('All Company (System Admin)');
    await expect(dialog.companySelect).toBeDisabled();
    await expect(dialog.saveButton).toBeEnabled();
  });

  test('เลือกได้หลาย Company และแสดงทุกบริษัทที่เลือก', async ({ userManagementPage: users }) => {
    const dialog = users.editDialog;

    await dialog.setCompanies(['BCP', 'BCPG', 'BBGI']);

    await expect(dialog.companySelect).toContainText('BCP, BCPG, BBGI');
  });

  test('กดกากบาท ล้าง Company ที่เลือกทั้งหมด', async ({ userManagementPage: users }) => {
    const dialog = users.editDialog;
    await dialog.setCompanies(['BCP', 'BCPG']);

    await dialog.companyClearButton.click();

    await expect(dialog.companySelect).toContainText('Select Company');
    await expect(dialog.saveButton).toBeDisabled();
  });

  test('พิมพ์ค้นหาใน Dropdown Company แสดงเฉพาะที่ตรง', async ({ userManagementPage: users }) => {
    const dialog = users.editDialog;

    await dialog.searchCompany('BCPG');

    await expect(dialog.companyOption('BCPG')).toBeVisible();
    await expect(dialog.companyOption('BBGI')).toBeHidden();
  });

  test('เลือกเกิน 4 บริษัท แสดง badge "+n"', async ({ page, userManagementPage: users }) => {
    const dialog = users.editDialog;
    // The seed companies plus the AUTO ones left by the Company Management tests make sure there are more than 4
    await dialog.companySelect.click();
    const companies = (await dialog.companyOptions.allTextContents()).slice(0, 5);
    await page.keyboard.press('Escape');

    await dialog.setCompanies(companies);

    await expect(dialog.companySelect).toContainText(companies.slice(0, 4).join(', '));
    await expect(dialog.companySelect).toContainText('+1');
  });
});

test.describe('TS03-TC03 การกำหนด Role = System Admin ไม่ต้องรออนุมัติ', () => {
  todo('System Admin ได้ Approved + Active ทันที (รอ dev reset: ผู้ใช้ที่อนุมัติแล้วย้อนกลับเป็น Unassigned ไม่ได้)');
});

test.describe('TS03-TC04 การแก้ไข Role / Company ของผู้ใช้งาน', () => {
  test.afterEach(async ({ userManagementPage: users }) => {
    await users.goto();
    await users.editUser(testUsers.approved, APPROVED_DEFAULT);
  });

  test('ผู้ใช้ Approved แก้ Role และ Company แล้วยังเป็น Approved', async ({ userManagementPage: users }) => {
    const email = testUsers.approved;

    await users.editUser(email, { role: 'Super User', companies: ['BCP', 'BCPG'] });

    await expect(users.toast.withTitle(TOAST_USER_EDITED)).toBeVisible();
    await expect(users.cell(email, 'Role')).toHaveText('Super User');
    await expect(users.cell(email, 'Company')).toHaveText('BCP, BCPG');
    await expect(users.cell(email, 'Status')).toHaveText('Approved');
  });

  test('ผู้ใช้ Approved เปลี่ยนเฉพาะ Role แล้ว Company เดิมยังอยู่', async ({ userManagementPage: users }) => {
    const email = testUsers.approved;

    await users.openEditDialog(email);
    await users.editDialog.setRole('Super User');
    await expect(users.editDialog.companySelect).toContainText('BCP');
    await users.editDialog.saveAndConfirm();

    await expect(users.cell(email, 'Company')).toHaveText('BCP');
    await expect(users.cell(email, 'Status')).toHaveText('Approved');
  });

  test('ผู้ใช้ Approved เปลี่ยนเป็น System Admin แล้ว Company เป็น All Company', async ({
    userManagementPage: users,
  }) => {
    const email = testUsers.approved;

    await users.editUser(email, { role: 'System Admin' });

    await expect(users.cell(email, 'Company')).toHaveText(/^All/);
    await expect(users.cell(email, 'Status')).toHaveText('Approved');
  });

  todo('ผู้ใช้ Pending เปลี่ยนเป็น System Admin แล้วเป็น Approved ทันที (รอ dev reset ผู้ใช้ที่อนุมัติแล้ว)');
  todo('Super user BCPG ที่เพิ่มใหม่เห็นผู้ใช้ (รอบัญชี Super user BCPG ใน .env)');
});

test.describe('TS03-TC04 การแก้ไข Role / Company ของผู้ใช้ Pending', () => {
  test('ผู้ใช้ Pending แก้ Role / Company แล้วยังเป็น Pending', async ({ userManagementPage: users }) => {
    const email = testUsers.unassigned;
    await users.editUser(email, { role: 'End User', companies: ['BCP'] });
    await expect(users.cell(email, 'Status')).toHaveText('Pending');

    await users.editUser(email, { role: 'Super User', companies: ['BCP', 'BCPG'] });

    await expect(users.cell(email, 'Role')).toHaveText('Super User');
    await expect(users.cell(email, 'Status')).toHaveText('Pending');
  });

  todo('Super user บริษัทเดิมไม่เห็น / บริษัทใหม่เห็นผู้ใช้ Pending (รอบัญชี Super user BCPG ใน .env)');
});

test.describe('TS03-TC05 ตรวจสอบ Account Status toggle ตามสถานะผู้ใช้งาน', () => {
  test('ผู้ใช้ Unassigned toggle กดไม่ได้', async ({ userManagementPage: users }) => {
    await users.openEditDialog(testUsers.unassigned);

    await expect(users.editDialog.accountStatusToggle).toBeDisabled();
  });

  test('ผู้ใช้ Pending toggle กดไม่ได้', async ({ userManagementPage: users }) => {
    await users.editUser(testUsers.unassigned, { role: 'End User', companies: ['BCP'] });

    await users.openEditDialog(testUsers.unassigned);

    await expect(users.editDialog.accountStatusToggle).toBeDisabled();
  });

  test('ผู้ใช้ Approved toggle กดได้', async ({ userManagementPage: users }) => {
    await users.openEditDialog(testUsers.approved);

    await expect(users.editDialog.accountStatusToggle).toBeEnabled();
  });
});
