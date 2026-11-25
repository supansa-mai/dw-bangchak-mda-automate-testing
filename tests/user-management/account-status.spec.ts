import { test, expect, todo } from '@fixtures';
import { testUsers } from '@config/test-users';
import { TOAST_USER_EDITED } from '@pages/user-management.page';

test.fixme(true, 'Draft: no UAT URL/account yet, locators not verified on the real page');

// Every test turns the same Azure test user off and on, so they must not run at the same time
test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ userManagementPage: users }) => {
  await users.goto();
});

test.afterEach(async ({ userManagementPage: users }) => {
  await users.goto();
  await users.ensureActive(testUsers.status);
});

test.describe('TS04-TC01 การปิดการใช้งานผู้ใช้งาน (Inactive)', () => {
  test('ปิด toggle แล้ว Activation = Inactive โดย Role / Company เดิมยังอยู่', async ({
    userManagementPage: users,
  }) => {
    const email = testUsers.status;
    await users.search(email);
    const role = await users.cell(email, 'Role').innerText();
    const company = await users.cell(email, 'Company').innerText();

    await users.setAccountStatus(email, false);

    await expect(users.toast.withTitle(TOAST_USER_EDITED)).toBeVisible();
    await expect(users.cell(email, 'Activation')).toHaveText('Inactive');
    await expect(users.cell(email, 'Role')).toHaveText(role);
    await expect(users.cell(email, 'Company')).toHaveText(company);
  });

  test('กด Cancel ใน modal ยืนยัน ไม่บันทึก Activation คงเดิม', async ({ userManagementPage: users }) => {
    const email = testUsers.status;
    const dialog = users.editDialog;
    await users.openEditDialog(email);
    await dialog.accountStatusToggle.uncheck();
    await dialog.saveButton.click();

    await dialog.confirm.cancelButton.click();
    await dialog.cancelButton.click();

    await expect(users.cell(email, 'Activation')).toHaveText('Active');
  });

  todo('บันทึก Edit log "changed status ... Active → Inactive" (รอ ActivityLogPage)');
});

test.describe('TS04-TC02 การเปิดการใช้งานผู้ใช้งานอีกครั้ง (Active)', () => {
  test('เปิด toggle แล้ว Activation = Active และยังเป็น Approved', async ({ userManagementPage: users }) => {
    const email = testUsers.status;
    await users.setAccountStatus(email, false);
    await expect(users.cell(email, 'Activation')).toHaveText('Inactive');

    await users.setAccountStatus(email, true);

    await expect(users.cell(email, 'Activation')).toHaveText('Active');
    await expect(users.cell(email, 'Status')).toHaveText('Approved');
  });

  // "ผู้ใช้ Pending toggle กดไม่ได้" is the same check as TS03-TC05 in edit-user.spec.ts
  todo('บันทึก Edit log "changed status ... Inactive → Active" (รอ ActivityLogPage)');
});
